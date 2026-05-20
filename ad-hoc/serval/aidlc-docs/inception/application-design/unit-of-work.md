# Unit of Work Definitions

## Units Overview

| Unit | Type | Container | Priority | Description |
|------|------|-----------|----------|-------------|
| shared | Module | (공통) | 1st | 공통 모델, 클라이언트, 설정 |
| video-worker | Service | video-worker | 2nd | 핵심 분석 파이프라인 (영상 분석 + AI 분석) |
| api-server | Service | api-server | 3rd | REST API 서빙 + 작업 큐 관리 |

---

## Unit 1: shared

### Purpose
모든 서비스에서 공유하는 데이터 모델, AWS 클라이언트, 설정을 제공하는 공통 모듈.

### Components
- S3Client
- BedrockClient
- OpenSearchClient
- 공통 데이터 모델 (Pydantic)
- 설정 관리 (환경변수)

### Responsibilities
- AWS 서비스 클라이언트 (S3, Bedrock, OpenSearch)
- 공통 Pydantic 모델 정의 (AnalysisJob, JobStatus, VideoAnalysisResult, FaultResult, StructuredAnalysis 등)
- 환경변수 기반 설정 관리
- 로깅 설정

### Deliverables
- `shared/` 디렉토리
- `shared/models/` — Pydantic 데이터 모델
- `shared/clients/` — AWS 클라이언트 (S3, Bedrock, OpenSearch)
- `shared/config.py` — 환경변수 설정
- `shared/logging.py` — 구조화된 로깅

---

## Unit 2: video-worker

### Purpose
Redis Queue에서 작업을 소비하여 영상 분석 → 과실비율 판단 → 구조화된 결과 생성 파이프라인을 실행하는 GPU 배치 워커.

### Components
- AnalysisPipeline
- VideoAnalyzer
- FaultAnalyzer
- ScriptGenerator
- DataIngestion (CLI 모드)

### Responsibilities
- Redis Queue 소비 (작업 가져오기)
- 영상 분석 파이프라인 실행 (FFmpeg + YOLOv8 + ByteTrack)
- 과실비율 판단 (OpenSearch RAG + Bedrock LLM)
- 구조화된 분석 결과 JSON 생성
- S3에 결과 저장 + 상태 업데이트
- api-server에 완료 콜백 전송
- 데이터 적재 CLI (판례/법규 → OpenSearch)

### Deliverables
- `worker/` 디렉토리
- `worker/pipeline.py` — AnalysisPipeline 오케스트레이터
- `worker/video_analyzer.py` — 영상 분석 모듈
- `worker/fault_analyzer.py` — 과실비율 분석 모듈
- `worker/script_generator.py` — 구조화된 결과 생성
- `worker/data_ingestion.py` — 데이터 적재 CLI
- `worker/main.py` — 워커 엔트리포인트 (큐 소비 루프)
- `worker/Dockerfile`
- `worker/requirements.txt`

---

## Unit 3: api-server

### Purpose
외부 클라이언트의 분석 요청을 수신하고, Redis Queue에 작업을 발행하며, S3 기반 상태 조회 및 결과 반환을 제공하는 REST API 서버.

### Components
- APIController (FastAPI routes)

### Responsibilities
- POST /analyze — 분석 요청 수신, job_id 생성, Redis Queue 발행
- GET /status/{job_id} — S3 메타데이터에서 상태 조회
- GET /result/{job_id} — S3에서 최종 결과 JSON 반환
- POST /callback — worker 완료 콜백 수신
- GET /health — 헬스체크

### Deliverables
- `api/` 디렉토리
- `api/main.py` — FastAPI 앱 엔트리포인트
- `api/routes.py` — API 라우트 정의
- `api/schemas.py` — 요청/응답 스키마 (shared 모델 활용)
- `api/Dockerfile`
- `api/requirements.txt`

---

## Code Organization (Monorepo)

```
/Users/serval.cat/Work/AWS-WORKSHOP/
├── shared/                    # 공통 모듈
│   ├── __init__.py
│   ├── models/               # Pydantic 데이터 모델
│   │   ├── __init__.py
│   │   ├── job.py            # AnalysisJob, JobStatus
│   │   ├── video.py          # FrameData, DetectionResult, VehicleTrack
│   │   ├── fault.py          # FaultResult, LegalReference
│   │   └── analysis.py       # StructuredAnalysis (3단 구조)
│   ├── clients/              # AWS 클라이언트
│   │   ├── __init__.py
│   │   ├── s3_client.py
│   │   ├── bedrock_client.py
│   │   └── opensearch_client.py
│   ├── config.py             # 환경변수 설정
│   └── logging.py            # 구조화된 로깅
├── worker/                   # video-worker 서비스
│   ├── __init__.py
│   ├── main.py               # 워커 엔트리포인트
│   ├── pipeline.py           # AnalysisPipeline
│   ├── video_analyzer.py     # 영상 분석
│   ├── fault_analyzer.py     # 과실비율 분석
│   ├── script_generator.py   # 구조화된 결과 생성
│   ├── data_ingestion.py     # 데이터 적재 CLI
│   ├── Dockerfile
│   └── requirements.txt
├── api/                      # api-server 서비스
│   ├── __init__.py
│   ├── main.py               # FastAPI 앱
│   ├── routes.py             # API 라우트
│   ├── schemas.py            # 요청/응답 스키마
│   ├── Dockerfile
│   └── requirements.txt
├── data/                     # 판례/법규 시드 데이터
│   └── legal/
├── tests/                    # 테스트
│   ├── unit/
│   ├── integration/
│   └── property/             # PBT 테스트
├── docker-compose.yml
├── credentials.env
└── requirements.md
```

---

## Development Order

```
Phase 1: shared (공통 모듈)
  → 데이터 모델, AWS 클라이언트, 설정

Phase 2: video-worker (핵심 로직)
  → VideoAnalyzer → FaultAnalyzer → ScriptGenerator → Pipeline

Phase 3: api-server (서빙 로직) — Phase 2 완료 후 또는 병렬
  → FastAPI routes, Redis 연동, 콜백 처리
```
