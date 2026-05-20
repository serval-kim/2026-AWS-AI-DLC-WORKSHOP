# Tech Stack Decisions

## Final Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Language** | Python | 3.11+ | 요구사항 명시, ML/AI 생태계 |
| **API Framework** | FastAPI | 0.115.x | 비동기, Pydantic 통합, 자동 문서화 |
| **Video Processing** | FFmpeg | 6.x | 프레임 추출, 영상 메타데이터 |
| **Video Binding** | ffmpeg-python | 0.2.0 | Python FFmpeg 래퍼 |
| **Object Detection** | ultralytics (YOLOv8) | 8.3.x | 객체 탐지, GPU/CPU 자동 감지 |
| **Object Tracking** | ByteTrack | — | supervision 패키지 내 포함 |
| **Computer Vision** | OpenCV (cv2) | 4.10.x | 이미지 처리, 프레임 조작 |
| **Supervision** | supervision | 0.25.x | ByteTrack 추적, 어노테이션 |
| **AWS SDK** | boto3 | 1.35.x | S3, Bedrock, 인증 |
| **OpenSearch** | opensearch-py | 2.7.x | 벡터 검색, 문서 적재 |
| **Redis Client** | redis[hiredis] | 5.2.x | 작업 큐 |
| **Task Queue** | rq (Redis Queue) | 1.16.x | 경량 작업 큐 |
| **Data Validation** | pydantic | 2.9.x | 모델 검증, 직렬화 |
| **Settings** | pydantic-settings | 2.6.x | 환경변수 관리 |
| **Logging** | structlog | 24.4.x | 구조화된 JSON 로깅 |
| **HTTP Client** | httpx | 0.27.x | 비동기 HTTP (콜백) |
| **Testing** | pytest | 8.3.x | 테스트 프레임워크 |
| **PBT** | hypothesis | 6.112.x | Property-Based Testing |
| **Container** | Docker | 24.x+ | 컨테이너화 |
| **Orchestration** | docker-compose | 2.x | 멀티 컨테이너 관리 |
| **Redis** | Redis | 7-alpine | 메시지 브로커 |

---

## AWS Services

| Service | Purpose | Access Method |
|---------|---------|--------------|
| S3 | 영상/결과 저장, 상태 관리 | boto3, credentials.env |
| Bedrock (Claude Sonnet 4) | 과실비율 판단, 스크립트 생성 (Extended Thinking) | boto3 bedrock-runtime |
| Bedrock (Titan Embeddings) | 텍스트 벡터화 | boto3 bedrock-runtime |
| OpenSearch Serverless | 벡터 검색 (RAG) | opensearch-py + AWS SigV4 |

---

## Docker Base Images

| Container | Base Image | Rationale |
|-----------|-----------|-----------|
| api-server | python:3.11-slim | 경량, API 서버에 충분 |
| video-worker | nvidia/cuda:12.1-runtime-ubuntu22.04 | GPU 지원, CUDA 런타임 |
| video-worker (CPU fallback) | python:3.11-slim | GPU 없는 환경용 |
| redis | redis:7-alpine | 경량 Redis |

---

## Key Design Decisions

### 1. RQ (Redis Queue) 선택 이유
- Celery 대비 경량 (단일 워커 MVP에 적합)
- Redis만 필요 (별도 브로커 불필요)
- 간단한 API (enqueue/dequeue)
- 콜백 패턴 직접 구현 가능

### 2. structlog 선택 이유
- JSON 구조화 로깅 (SECURITY-03 준수)
- correlation_id 바인딩 (job_id 추적)
- 성능 오버헤드 최소

### 3. Hypothesis 선택 이유 (PBT-09)
- Python 생태계 표준 PBT 프레임워크
- 우수한 shrinking 지원
- pytest 완벽 통합
- 커스텀 전략(strategy) 정의 용이
- Seed 기반 재현성

### 4. supervision 패키지 선택 이유
- ByteTrack 추적 알고리즘 내장
- ultralytics 탐지 결과와 직접 호환
- 어노테이션/시각화 유틸리티 포함

### 5. GPU 선택적 지원 구현
- ultralytics 자동 디바이스 감지 (`device='auto'`)
- Docker 이미지: CUDA 베이스 + CPU fallback 빌드 타겟
- `docker-compose.yml`에서 GPU 리소스 선택적 할당

---

## Dependency Pinning Strategy (SECURITY-10)

- `requirements.txt`: 정확한 버전 고정 (`==`)
- Docker 이미지: 특정 태그 사용 (`:latest` 금지)
- 취약점 스캔: `pip-audit` 포함 (build-and-test 지침)

---

## Deployment Pipeline

### Target Infrastructure

| Component | AWS Service | Instance Type | Notes |
|-----------|------------|---------------|-------|
| api-server | EC2 | t3.medium (또는 유사) | 일반 인스턴스, Docker 실행 |
| video-worker | EC2 | g4dn.xlarge (또는 유사 GPU) | NVIDIA GPU, Docker + CUDA |
| Redis | ElastiCache Redis 또는 EC2 내 Docker | — | 워커-API 간 큐 |
| Container Registry | Amazon ECR | — | 프라이빗 이미지 저장소 |

### CI/CD Pipeline (GitHub Actions)

```
Push to main → GitHub Actions:
  1. Lint + Test (pytest + hypothesis)
  2. Security scan (pip-audit)
  3. Docker build (api-server, video-worker)
  4. Push to ECR
  5. Deploy to EC2 (SSH + docker pull + restart)
```

| Stage | Tool | Description |
|-------|------|-------------|
| Build | GitHub Actions | pytest, pip-audit, docker build |
| Registry | Amazon ECR | 이미지 저장 (태그: git SHA) |
| Deploy | GitHub Actions → EC2 | SSH로 docker pull + docker-compose up |

### Deployment Flow

```
Developer → git push → GitHub Actions
                          |
                          v
                    [Test + Build]
                          |
                          v
                    [ECR Push]
                     /        \
                    v          v
          EC2 (api-server)  EC2 GPU (video-worker)
          docker pull        docker pull
          docker-compose up  docker-compose up
```

### Infrastructure Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 배포 대상 | EC2 분리 (일반 + GPU) | GPU 유휴 비용 최소화, 독립 스케일링 |
| CI/CD | GitHub Actions | 코드 저장소와 통합, 무료 tier 활용 |
| Registry | Amazon ECR | AWS 생태계 통합, IAM 인증 |
| 배포 방식 | 자동 (CI/CD → ECR → EC2) | 수동 개입 최소화 |
| 향후 확장 | EKS 전환 가능 | 대규모 트래픽 시 Kubernetes 오케스트레이션 |

### GitHub Actions Workflow Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | 테스트 + 린트 (PR 시) |
| `.github/workflows/deploy.yml` | 빌드 + ECR 푸시 + EC2 배포 (main 머지 시) |

### ECR Repository Structure

| Repository | Image |
|-----------|-------|
| `accident-api` | api-server Docker 이미지 |
| `accident-worker` | video-worker Docker 이미지 |
