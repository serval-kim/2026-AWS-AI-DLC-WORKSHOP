# Build Instructions — U6: Serval 실제 연결

## Prerequisites
- **Python**: 3.11+ (venv at `.venv/`)
- **Dependencies**: pydantic, pydantic-settings, structlog, hypothesis, pytest, boto3, fastapi, uvicorn, httpx
- **Environment Variables**: `credentials.env` at workspace root
- **System Requirements**: macOS/Linux, 4GB+ RAM

## Build Steps

### 1. Install Dependencies

```bash
# Workspace venv 활성화
source .venv/bin/activate

# Integration에서 추가로 필요한 패키지 (이미 설치되어 있을 가능성 높음)
pip install hypothesis  # PBT framework (PBT-09)
```

### 2. Configure Environment

```bash
# credentials.env가 workspace root에 있는지 확인
ls credentials.env

# 필수 환경변수 (credentials.env에서 자동 로드됨):
# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY
# AWS_DEFAULT_REGION (default: us-east-1)
# S3_BUCKET_NAME (default: accident-analysis)
# OPENSEARCH_ENDPOINT
```

### 3. Verify Integration Module Structure

```bash
# 파일 구조 확인
ls -la integration/
ls -la integration/adapters/
ls -la integration/tests/
ls -la integration/scripts/
```

예상 구조:
```
integration/
├── adapters/
│   ├── __init__.py
│   ├── serval_runner.py    (신규 — U6)
│   └── serval_to_ssol.py   (수정 — U6)
├── scripts/
│   └── test_integration_e2e.py  (신규 — U6)
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_pbt_adapter.py     (신규 — U6)
│   └── test_serval_runner.py   (신규 — U6)
├── api.py                       (수정 — U6)
├── server.py                    (수정 — U6)
└── utils.py                     (U1 — 변경 없음)
```

### 4. Verify Build Success

```bash
# Import 검증 (syntax + dependency check)
.venv/bin/python -c "
import sys; sys.path.insert(0, 'integration'); sys.path.insert(0, 'ad-hoc/serval')
from adapters.serval_runner import ServalAnalysisRunner, ServalAnalysisResult
from adapters.serval_to_ssol import structured_analysis_to_pipeline_input
from utils import float_to_ts, ts_to_float
print('✅ All imports successful')
"
```

## Troubleshooting

### Import Error: shared.models not found
- **Cause**: sys.path에 `ad-hoc/serval` 미포함
- **Solution**: 반드시 workspace root에서 실행하거나, `PYTHONPATH=ad-hoc/serval:integration` 설정

### pydantic-settings not found
- **Cause**: serval/shared/config.py가 pydantic-settings 필요
- **Solution**: `pip install pydantic-settings`

### hypothesis not found
- **Cause**: PBT 테스트 프레임워크 미설치
- **Solution**: `pip install hypothesis`
