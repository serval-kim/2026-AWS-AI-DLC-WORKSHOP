# Workflow Plan — Integration Pipeline

## Execution Units

| Unit | 작업 | 의존 | 예상 시간 |
|------|------|------|-----------|
| U1 | 타임스탬프 변환 유틸 | 없음 | 5분 |
| U2 | Serval→Ssol 어댑터 | U1 | 10분 |
| U3 | 오케스트레이션 API (`/analyze`) | U2 | 15분 |
| U4 | Frontend 연결 (VideoEngine narration) | U3 | 10분 |
| U5 | E2E 테스트 (mock 모드) | U4 | 10분 |

## Unit Details

### U1: 타임스탬프 변환
- `float_to_ts(3.5) → "00:03"`
- `ts_to_float("00:03.5") → 3.5`
- 위치: `integration/utils.py`

### U2: Serval→Ssol 어댑터
- `StructuredAnalysis` → Ssol `mock_pipeline.py` 입력 형식 변환
- Ssol 호출 → `muncheol-script.json` 반환
- 위치: `integration/adapters/serval_to_ssol.py`

### U3: 오케스트레이션 API
- FastAPI 엔드포인트: `POST /analyze`, `GET /jobs/{id}`
- 파이프라인: upload → serval → ssol → juan → S3 URL 반환
- MOCK 모드 지원 (실제 Nova Reel 스킵)
- 위치: `integration/api.py`

### U4: Frontend 연결
- `AnalyzingPage.jsx`: mock → 실제 API 호출
- `ResultPage.jsx`: API 응답 → VideoEngine props
- `VideoEngine.jsx`: `narrationSrc` prop + `<audio>` 동기화

### U5: E2E 테스트
- MOCK_VIDEO_GEN=true로 전체 파이프라인 실행
- 입력: 테스트 블랙박스 영상 (또는 mock 분석 결과)
- 검증: VideoEngine에 script + audio URL 전달 확인
