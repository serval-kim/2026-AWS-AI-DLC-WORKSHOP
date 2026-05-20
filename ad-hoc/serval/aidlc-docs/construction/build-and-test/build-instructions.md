# Build Instructions

## Prerequisites
- **Python**: 3.11+
- **Docker**: 24.x+ with Docker Compose v2
- **NVIDIA Container Toolkit** (GPU 환경만): nvidia-docker2
- **FFmpeg**: 6.x (worker 컨테이너에 포함)
- **AWS Credentials**: `credentials.env` 파일에 설정

## Environment Variables (credentials.env)
```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
OPENSEARCH_ENDPOINT=your-opensearch-endpoint
```

---

## Option A: Local Development (venv)

### 1. Create Virtual Environment
```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r worker/requirements.txt
pip install -r api/requirements.txt
pip install pytest==8.3.4 hypothesis==6.112.1 ruff==0.8.0 pip-audit==2.7.3
```

### 3. Run Tests
```bash
pytest tests/ -v
```

### 4. Run API Server (개발 모드)
```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Run Worker (별도 터미널)
```bash
python -m worker.main
```

---

## Option B: Docker Compose (권장)

### 1. Build All Images
```bash
# GPU 환경
docker-compose build

# CPU 환경
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml build
```

### 2. Start Services
```bash
# GPU 환경
docker-compose up -d

# CPU 환경
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up -d
```

### 3. Verify Services
```bash
# API 서버 헬스체크
curl http://localhost:8000/health

# 로그 확인
docker-compose logs -f
```

### 4. Stop Services
```bash
docker-compose down
```

---

## Option C: Data Ingestion (초기 셋업)

### 1. 판례/법규 데이터 준비
`data/legal/` 디렉토리에 JSON 또는 TXT 파일 배치.

### 2. OpenSearch에 데이터 적재
```bash
# venv 환경
python -m worker.data_ingestion

# Docker 환경
docker-compose exec video-worker python -m worker.data_ingestion
```

---

## Troubleshooting

### Docker Build 실패 — CUDA 관련
- **원인**: NVIDIA 드라이버 미설치 또는 nvidia-docker2 미설치
- **해결**: CPU 빌드 사용 `docker-compose -f docker-compose.yml -f docker-compose.cpu.yml build`

### Import Error — shared 모듈
- **원인**: PYTHONPATH 미설정
- **해결**: `export PYTHONPATH=/path/to/AWS-WORKSHOP` 또는 Docker 환경 사용

### Redis 연결 실패
- **원인**: Redis 미실행
- **해결**: `docker-compose up redis` 또는 로컬 Redis 시작
