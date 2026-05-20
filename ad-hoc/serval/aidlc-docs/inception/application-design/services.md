# Services

## Service Layer Overview

| Service | Container | Responsibility |
|---------|-----------|---------------|
| API Service | api-server | HTTP 요청 처리, 큐 발행, 상태 조회 |
| Pipeline Service | video-worker | 큐 소비, 파이프라인 오케스트레이션, 콜백 |

---

## API Service (api-server)

### Purpose
FastAPI 기반 REST API 서버. 외부 클라이언트의 분석 요청을 수신하고, Redis Queue에 작업을 발행하며, S3 메타데이터 기반으로 상태를 조회하여 반환.

### Orchestration Pattern
```
Client → POST /analyze → API Service → Redis Queue → (즉시 응답: job_id)
Client → GET /status/{job_id} → API Service → S3 metadata → (상태 반환)
Client → GET /result/{job_id} → API Service → S3 → (결과 JSON 반환)
Worker → POST /callback → API Service → (상태 업데이트 확인)
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /analyze | 분석 작업 생성 — job_id 반환 |
| GET | /status/{job_id} | 작업 상태 조회 |
| GET | /result/{job_id} | 최종 분석 결과 조회 |
| POST | /callback | Worker 완료 콜백 수신 (internal) |
| GET | /health | 헬스체크 |

### Dependencies
- Redis (작업 큐 발행)
- S3Client (상태 조회, 결과 다운로드)

---

## Pipeline Service (video-worker)

### Purpose
Redis Queue에서 작업을 소비하여 VideoAnalyzer → FaultAnalyzer → ScriptGenerator 순서로 파이프라인을 실행. Partial Result 전략으로 가능한 단계까지 진행 후 결과를 S3에 저장하고 api-server에 콜백.

### Orchestration Pattern
```
Redis Queue → Pipeline Service → VideoAnalyzer.analyze()
                               → FaultAnalyzer.run()
                               → ScriptGenerator.run()
                               → S3 결과 저장
                               → api-server 콜백
```

### Error Handling (Partial Result Strategy)
```
1. VideoAnalyzer 실행
   - 성공 → 다음 단계
   - 프레임 추출 실패 → 파이프라인 중단, 에러 반환
   - 객체 탐지 실패 → 프레임 데이터만 저장, 에러 기록
   - 차량 추적 실패 → 탐지 결과까지 저장, 에러 기록

2. FaultAnalyzer 실행
   - 성공 → 다음 단계
   - RAG 검색 실패 → 검색 없이 LLM 분석 시도
   - LLM 호출 실패 → 영상 분석 결과까지만 저장, 에러 기록

3. ScriptGenerator 실행
   - 성공 → 전체 결과 저장
   - 실패 → 과실비율 결과까지만 저장, 에러 기록

4. 최종: 부분 결과 + 에러 목록을 S3에 저장, 콜백 전송
```

### State Transitions (S3 Metadata)
```
PENDING → PROCESSING → COMPLETED (or PARTIAL or FAILED)
```

| Status | Description |
|--------|-------------|
| PENDING | 작업 큐에 등록됨 |
| PROCESSING | 워커가 작업 처리 중 |
| COMPLETED | 전체 파이프라인 성공 |
| PARTIAL | 일부 단계 성공, 부분 결과 존재 |
| FAILED | 치명적 오류로 결과 없음 |

### Dependencies
- Redis (작업 큐 소비)
- VideoAnalyzer, FaultAnalyzer, ScriptGenerator (파이프라인 단계)
- S3Client (결과 저장, 상태 업데이트)
- HTTP Client (api-server 콜백)
