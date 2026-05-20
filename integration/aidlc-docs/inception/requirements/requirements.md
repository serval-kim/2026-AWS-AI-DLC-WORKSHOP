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

---

## Data Flow

```
[Upload MP4]
    │
    ▼ POST /analyze → job_id
[Serval: VideoAnalyzer + FaultAnalyzer]
    │
    ▼ StructuredAnalysis
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
# 입력: StructuredAnalysis (Pydantic)
# 출력 필요: dict with fault_summary + video_metadata
{
  "accident_type": "추돌",
  "fault_ratios": [{"vehicle": "뒤차", "ratio": 70}, {"vehicle": "앞차", "ratio": 30}],
  "key_faults": ["안전거리 미확보", "전방주시 태만"],
  "violated_laws": ["도로교통법 19조"],
  "video_duration": 6.0,
  "collision_timestamp": 4.5
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

## Gap: 타임스탬프 형식
- Serval: `float` (초 단위, e.g. `3.5`)
- Ssol/Juan: `string` ("MM:SS" or "MM:SS.f", e.g. `"00:03.5"`)
- **결정**: 변환 함수 작성 (`float_to_ts(3.5) → "00:03.5"`)
