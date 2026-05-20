# Code Generation Plan

## Context
- **Project Type**: Greenfield, Monorepo
- **Workspace Root**: `/Users/serval.cat/Work/AWS-WORKSHOP/`
- **Units**: shared → video-worker → api-server
- **Structure**: `shared/`, `worker/`, `api/`, `tests/`, `data/`

## Development Order
1. Phase 1: shared (공통 모듈)
2. Phase 2: video-worker (핵심 분석 파이프라인)
3. Phase 3: api-server (REST API 서빙)
4. Phase 4: Integration (docker-compose, CI/CD, 데이터 적재)

---

## Phase 1: shared (공통 모듈)

### Step 1: Project Structure Setup
- [ ] 프로젝트 루트 설정 파일 생성 (pyproject.toml, .gitignore 업데이트)
- [ ] `shared/` 패키지 구조 생성 (__init__.py)
- [ ] `shared/config.py` — 환경변수 설정 (pydantic-settings)
- [ ] `shared/logging.py` — structlog JSON 로깅 설정

### Step 2: Domain Models
- [ ] `shared/models/__init__.py`
- [ ] `shared/models/job.py` — AnalysisJob, JobStatus, StageError, ResultKeys
- [ ] `shared/models/video.py` — FrameData, BoundingBox, DetectionResult, VehicleTrack, TrackPoint, AccidentClassification, VideoAnalysisResult, VideoMetadata
- [ ] `shared/models/fault.py` — LegalReference, FaultRatio, FaultResult
- [ ] `shared/models/analysis.py` — StructuredAnalysis, IntroSection, AnalysisSection, ConclusionSection, DriverAction, TimestampRange

### Step 3: AWS Clients
- [ ] `shared/clients/__init__.py`
- [ ] `shared/clients/s3_client.py` — S3Client (upload, download, status management)
- [ ] `shared/clients/bedrock_client.py` — BedrockClient (invoke_with_thinking, generate_embedding)
- [ ] `shared/clients/opensearch_client.py` — OpenSearchClient (create_index, bulk_index, search)

### Step 4: Shared Unit Tests
- [ ] `tests/unit/shared/__init__.py`
- [ ] `tests/unit/shared/test_models.py` — 모델 직렬화/역직렬화 테스트
- [ ] `tests/unit/shared/test_config.py` — 설정 로딩 테스트

### Step 5: Shared PBT Tests
- [ ] `tests/property/__init__.py`
- [ ] `tests/property/test_models_pbt.py` — 모델 Round-trip PBT (Hypothesis)
- [ ] `tests/property/conftest.py` — 도메인 전략(strategy) 정의

---

## Phase 2: video-worker (핵심 분석 파이프라인)

### Step 6: Video Analyzer
- [ ] `worker/__init__.py`
- [ ] `worker/video_analyzer.py` — VideoAnalyzer 클래스 (extract_frames, detect_objects, track_vehicles, classify_accident, analyze)

### Step 7: Fault Analyzer
- [ ] `worker/fault_analyzer.py` — FaultAnalyzer 클래스 (search_references, analyze_fault, run)
- [ ] `worker/prompts/` — LLM 프롬프트 템플릿
- [ ] `worker/prompts/fault_analysis.py` — 과실비율 분석 프롬프트
- [ ] `worker/prompts/script_generation.py` — 구조화 결과 생성 프롬프트

### Step 8: Script Generator
- [ ] `worker/script_generator.py` — ScriptGenerator 클래스 (generate_structure, run)

### Step 9: Analysis Pipeline
- [ ] `worker/pipeline.py` — AnalysisPipeline 클래스 (run, update_status, send_callback)
- [ ] `worker/main.py` — 워커 엔트리포인트 (RQ worker 실행)

### Step 10: Data Ingestion
- [ ] `worker/data_ingestion.py` — DataIngestion 클래스 (load_data, chunk_documents, embed_chunks, ingest_to_opensearch, run)
- [ ] `data/legal/` — 샘플 판례/법규 데이터 파일

### Step 11: Worker Unit Tests
- [ ] `tests/unit/worker/__init__.py`
- [ ] `tests/unit/worker/test_video_analyzer.py`
- [ ] `tests/unit/worker/test_fault_analyzer.py`
- [ ] `tests/unit/worker/test_script_generator.py`
- [ ] `tests/unit/worker/test_pipeline.py`

### Step 12: Worker PBT Tests
- [ ] `tests/property/test_video_analyzer_pbt.py` — 프레임 수 불변, bbox 범위 불변
- [ ] `tests/property/test_fault_analyzer_pbt.py` — 과실비율 합계=100% 불변
- [ ] `tests/property/test_script_generator_pbt.py` — 3단 구조 불변, 타임스탬프 유효성

### Step 13: Worker Dockerfile + Requirements
- [ ] `worker/Dockerfile` — CUDA 베이스, FFmpeg, Python 의존성
- [ ] `worker/requirements.txt` — 정확한 버전 핀닝

---

## Phase 3: api-server (REST API)

### Step 14: API Routes
- [ ] `api/__init__.py`
- [ ] `api/main.py` — FastAPI 앱 (lifespan, 글로벌 에러 핸들러)
- [ ] `api/routes.py` — API 라우트 (POST /analyze, GET /status, GET /result, POST /callback, GET /health)
- [ ] `api/schemas.py` — 요청/응답 Pydantic 스키마

### Step 15: API Unit Tests
- [ ] `tests/unit/api/__init__.py`
- [ ] `tests/unit/api/test_routes.py` — FastAPI TestClient 기반 테스트

### Step 16: API PBT Tests
- [ ] `tests/property/test_api_pbt.py` — 상태 전이 불변 규칙

### Step 17: API Dockerfile + Requirements
- [ ] `api/Dockerfile` — python:3.11-slim 베이스
- [ ] `api/requirements.txt` — 정확한 버전 핀닝

---

## Phase 4: Integration (docker-compose, CI/CD)

### Step 18: Docker Compose
- [ ] `docker-compose.yml` — api-server + video-worker + redis
- [ ] `docker-compose.cpu.yml` — GPU 없는 환경용 override

### Step 19: CI/CD (GitHub Actions)
- [ ] `.github/workflows/ci.yml` — PR 시 테스트 + 린트
- [ ] `.github/workflows/deploy.yml` — main 머지 시 빌드 + ECR + EC2 배포

### Step 20: Documentation
- [ ] `README.md` 업데이트 — 프로젝트 설명, 실행 방법, API 문서
- [ ] `aidlc-docs/construction/shared/code/code-summary.md` — 코드 생성 요약

---

## Total: 20 Steps
- Phase 1 (shared): Steps 1-5
- Phase 2 (worker): Steps 6-13
- Phase 3 (api): Steps 14-17
- Phase 4 (integration): Steps 18-20
