# Integration Requirements

## Intent
VideoEngine까지 구동 가능한 E2E 파이프라인 완성.
블랙박스 영상 업로드 → 분석 → 스크립트 → 한문철 영상+TTS → 프론트엔드 재생.

## Scope
- **In**: 모듈 간 연결 코드, 데이터 변환, API 엔드포인트
- **Out**: 각 모듈 내부 로직 변경 (이미 완성됨)

---

## Functional Requirements

### FR-1: Serval → Ssol 연결
- Serval `StructuredAnalysis` 출력 → Ssol `mock_pipeline.py` 입력으로 변환
- 변환: timestamp float → "MM:SS" 문자열, fault_ratios → 텍스트

### FR-2: Ssol → Juan 연결
- Ssol `muncheol-script.json` 출력 → Juan `pipeline.py` 입력
- **스키마 이미 일치** — 변환 불필요 ✅

### FR-3: Juan → Frontend 연결
- Juan 출력: `hanmuncheol_reels.mp4` + 씬별 `tts.mp3`
- Frontend 필요: S3 presigned URL (video + audio)
- `ResultPage`에 `narrationSrc` prop 전달

### FR-4: API 오케스트레이션
- 단일 엔드포인트: `POST /analyze` (영상 업로드)
- 비동기 처리: 업로드 → job_id 반환 → 폴링으로 상태 확인
- 완료 시: `{script, videoUrl, audioUrl}` 반환

### FR-5: Frontend 연결
- `AnalyzingPage` → 실제 API 호출 (현재 mock)
- `ResultPage` → API 응답의 script + presigned URL 사용
- `VideoEngine`에 `narrationSrc` prop 추가

### FR-6: Serval 실제 모듈 연결 (현재 작업 — U6)
- 현재 `integration/api.py`의 `run_pipeline()`은 mock script만 사용
- 현재 `integration/adapters/serval_to_ssol.py`는 dict 변환만 수행, Serval 호출 없음
- **목표**: Serval `AnalysisPipeline` (VideoAnalyzer → FaultAnalyzer → ScriptGenerator)을 실제로 호출하여 `StructuredAnalysis` 생성, mock 대체
- **호출 방식**: 직접 Python import (Q1 답변 — 같은 API 서버이므로)
- **인프라**: 실제 AWS 사용 (Q2 답변 — credentials.env 기반 S3, OpenSearch)
- **입력**: S3 video_s3_key 기반 (Q3 답변 — Serval API 방식 그대로)
- **테스트**: 샘플 영상으로 검증 (Q3 답변)

---

## Data Flow

```
[Upload MP4]
    │
    ▼ POST /analyze → job_id
[Serval: VideoAnalyzer + FaultAnalyzer + ScriptGenerator]
    │
    ▼ StructuredAnalysis (실제 출력)
[Adapter: structured_analysis_to_pipeline_input]
    │
    ▼ pipeline_input dict
[Ssol: mock_pipeline.py (문철어 변환)]
    │
    ▼ muncheol-script.json
[Juan: pipeline.py (TTS + 영상 생성)]
    │
    ▼ reels.mp4 + tts.mp3 → S3
[Frontend: VideoEngine + VideoTemplate]
    │
    ▼ 릴스 재생
```

---

## Interface Contracts

### Serval → Ssol
```python
# 입력: StructuredAnalysis (Pydantic from ad-hoc/serval/shared/models/analysis.py)
# 출력 필요: dict with fault_summary + video_metadata
{
  "accident_type": "추돌",
  "fault_ratios": [{"vehicle_id": 1, "ratio_percent": 70}, ...],
  "legal_basis": ["도로교통법 19조"],
  "video_duration": 6.0,
  "collision_timestamp": 4.5,
  "driver_actions": [...]
}
```

### Ssol → Juan
```json
// muncheol-script.json (이미 일치)
{ "script": { "intro": {...}, "analysis": {...}, "conclusion": {...} }, "total_duration_sec": 60 }
```

### Juan → Frontend
```json
{
  "videoUrl": "https://s3.../reels.mp4",
  "audioUrl": "https://s3.../narration.mp3",
  "script": { /* muncheol-script.json 그대로 */ }
}
```

---

## Non-Functional Requirements

### NFR-1: 환경 분리
- Mock 모드: `MOCK_VIDEO_GEN=true`로 Juan의 비싼 호출(Nova Reel) 스킵
- Real 모드: 실제 AWS S3, Bedrock, OpenSearch 호출 (credentials.env 기반)

### NFR-2: 인프라 의존성
- AWS S3: 영상 업로드/다운로드, 결과 JSON 저장
- AWS Bedrock: Claude (FaultAnalyzer, ScriptGenerator)
- AWS OpenSearch: 법규 RAG 검색 (accident_rag 패키지)
- Redis (Serval API용): 통합 시점에 직접 import 사용으로 우회 가능

### NFR-3: 에러 처리
- Serval Pipeline 단계별 실패 처리 (Partial Result strategy 이미 존재)
- Integration 레이어에서 Serval 에러 → 사용자 친화적 응답 변환

### NFR-4: 성능
- Serval pipeline 실행 시간: ~30~60초 (영상 분석 + LLM 호출)
- 비동기 처리 필수 (FastAPI BackgroundTasks 사용 중)

### NFR-5: 관찰가능성
- Serval은 structlog 사용 — Integration도 동일 로거 사용
- job_id 기반 추적 (correlation ID)

---

## Gap: 타임스탬프 형식
- Serval: `float` (초 단위, e.g. `3.5`)
- Ssol/Juan: `string` ("MM:SS" or "MM:SS.f", e.g. `"00:03.5"`)
- **결정**: 변환 함수 작성 (`float_to_ts(3.5) → "00:03.5"`) — U1에서 완료

---

## Extension Configuration

### Property-Based Testing (Enabled — Full)
- 데이터 변환 함수(adapter, timestamp util)에 PBT 적용
- Round-trip property: `ts_to_float(float_to_ts(x)) == x`
- Invariant property: adapter 변환 시 fault_ratios 합 = 100% 보존
- Generator quality: 도메인 타입(StructuredAnalysis fixture) 사용

### Security Baseline (Enabled)
- SECURITY-03: 구조화된 로깅 — Serval의 structlog 패턴 따름
- SECURITY-05: API 입력 검증 — Pydantic schemas 사용
- SECURITY-09: 에러 응답 — 스택트레이스 노출 금지
- SECURITY-12: 자격증명 — credentials.env 사용, 코드에 하드코딩 금지
- SECURITY-15: 예외 처리 — 모든 외부 호출(Serval, S3, Ssol, Juan)에 try/except + fail-closed

---

## Out of Scope (이번 U6에서 다루지 않음)
- Frontend 변경 (U4 deferred)
- Juan의 실제 영상 생성 비용 부담 — MOCK_VIDEO_GEN=true 유지
- Ssol의 실제 LLM 호출 통합 — 현재 mock-output 그대로 사용 (FR-1만 실제 변환)
- 새로운 API 엔드포인트 추가
