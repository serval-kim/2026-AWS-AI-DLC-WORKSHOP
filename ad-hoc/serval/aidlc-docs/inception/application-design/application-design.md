# Application Design — Consolidated

## Architecture Overview

2-Container 아키텍처로 Requirement 2-4를 구현:

| Container | Role | Components |
|-----------|------|-----------|
| **api-server** | REST API + 작업 큐 발행 | APIController, S3Client |
| **video-worker** | GPU 배치 처리 + AI 분석 | AnalysisPipeline, VideoAnalyzer, FaultAnalyzer, ScriptGenerator, DataIngestion, S3Client, OpenSearchClient, BedrockClient |
| **redis** | 작업 큐 (메시지 브로커) | Redis 7 |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 통신 방식 | Redis Queue + HTTP 콜백 | 비동기 처리로 GPU 유휴 최소화, 콜백으로 완료 알림 |
| 상태 관리 | S3 메타데이터 | 추가 인프라 불필요, S3 객체와 상태 동일 위치 관리 |
| 인증 | 없음 (MVP) | 로컬 Docker 환경, 외부망 미노출 |
| 에러 처리 | Partial Result | 가능한 단계까지 진행 후 부분 결과 반환 |
| OpenSearch | AWS SDK 직접 연결 | credentials.env로 인증, Serverless 직접 접근 |

---

## Data Flow Summary

```
Client → POST /analyze → api-server → Redis Queue → video-worker
                                                        |
                                                        v
                                              VideoAnalyzer (FFmpeg + YOLOv8 + ByteTrack)
                                                        |
                                                        v
                                              FaultAnalyzer (OpenSearch RAG + Bedrock LLM)
                                                        |
                                                        v
                                              ScriptGenerator (Bedrock LLM → 3단 구조 JSON)
                                                        |
                                                        v
                                              S3 결과 저장 → api-server 콜백
                                                        
Client → GET /result/{job_id} → api-server → S3 → 결과 반환
```

---

## S3 Object Structure

```
s3://bucket/
├── videos/
│   └── {job_id}/input.mp4
├── results/
│   └── {job_id}/
│       ├── video_analysis.json      (Req 2 output)
│       ├── fault_result.json        (Req 3 output)
│       └── structured_analysis.json (Req 4 output)
└── status/
    └── {job_id}.json                (상태 메타데이터)
```

---

## Security Baseline Compliance (Application Design)

| Rule | Status | Notes |
|------|--------|-------|
| SECURITY-01 | N/A | 데이터 저장소 설계는 Infrastructure Design에서 다룸 |
| SECURITY-02 | N/A | 네트워크 중간자 없음 (로컬 Docker) |
| SECURITY-03 | Compliant | 구조화된 로깅 설계 포함 (각 컴포넌트에 logger) |
| SECURITY-04 | N/A | HTML 서빙 없음 (API only) |
| SECURITY-05 | Compliant | FastAPI Pydantic 모델로 입력 검증 설계 |
| SECURITY-06 | N/A | IAM 정책은 Infrastructure Design에서 다룸 |
| SECURITY-07 | N/A | 네트워크 설정은 Infrastructure Design에서 다룸 |
| SECURITY-08 | N/A | 인증 없음 (MVP, 로컬 환경) — 사용자 결정 |
| SECURITY-09 | Compliant | 에러 응답에 내부 정보 미노출 설계 |
| SECURITY-10 | Deferred | Code Generation에서 의존성 핀닝 적용 |
| SECURITY-11 | Compliant | 보안 로직 분리 (S3Client, BedrockClient 별도 모듈) |
| SECURITY-12 | N/A | 인증 없음 (MVP) |
| SECURITY-13 | Deferred | Code Generation에서 직렬화 안전성 적용 |
| SECURITY-14 | N/A | 모니터링은 Infrastructure Design에서 다룸 |
| SECURITY-15 | Compliant | Partial Result 전략으로 fail-safe 설계, 리소스 정리 포함 |

---

## PBT Applicability (Application Design)

| Component | PBT Applicable | Property Categories |
|-----------|---------------|-------------------|
| VideoAnalyzer | Yes | Invariant (프레임 수 보존), Round-trip (좌표 변환) |
| FaultAnalyzer | Yes | Invariant (과실비율 합계 = 100%), Easy Verification |
| ScriptGenerator | Yes | Round-trip (JSON Schema 검증), Invariant (3단 구조 보존) |
| S3Client | Yes | Round-trip (upload/download) |
| DataIngestion | Yes | Invariant (청크 수 보존), Round-trip (embed/search) |
| APIController | Limited | Invariant (상태 전이 규칙) |

---

## Related Documents
- [components.md](components.md) — 컴포넌트 상세 정의
- [component-methods.md](component-methods.md) — 메서드 시그니처
- [services.md](services.md) — 서비스 레이어 설계
- [component-dependency.md](component-dependency.md) — 의존성 및 데이터 흐름
