# Req 4 + Req 6 → 릴스 프리뷰 통합 가이드

> **대상**: Req 4 (Script_Generator 출력) + Req 6 (Voice_Generator 출력)을 받아
> `VideoEngine` + `VideoTemplate`에 연결하는 개발자

---

## 현재 구조 (프론트엔드)

```
ResultPage
└── VideoTemplate          ← 1080×1920 썸네일 프레임 (scale로 축소)
    ├── titleLine1/2        ← 사고 유형 텍스트
    ├── videoContent        ← VideoEngine 주입
    │   └── VideoEngine     ← 원본 MP4 + script JSON으로 클립 편집 재현
    ├── subtitle            ← onSubtitleChange 콜백으로 실시간 업데이트
    └── personImage         ← 한문철 배경제거 이미지 URL
```

---

## Req 4 연결 — Script JSON

### 현재 (mock)
```js
import MUNCHEOL_SCRIPT from '../assets/muncheol-script-oneshot.json';

<VideoEngine script={MUNCHEOL_SCRIPT} ... />
```

### Req 4 완성 후 교체
```js
// AnalyzingPage → ResultPage로 분석 결과 전달 시
<VideoEngine script={analysisResult.muncheolScript} ... />
```

### VideoEngine이 기대하는 script 스키마
```json
{
  "script": {
    "intro": {
      "text": "나레이션 전체 텍스트",
      "duration_sec": 12,
      "emphasis": ["강조 키워드"],
      "clips": [
        { "start": "00:00", "end": "00:06", "effect": "normal", "desc": "설명" }
      ]
    },
    "analysis": { ... },
    "conclusion": { ... }
  },
  "total_duration_sec": 60
}
```

**effect 종류**: `normal` | `slow_2x` | `slow_4x` | `replay` | `freeze`

### 타임 계산 규칙 (VideoEngine 내부)
- `clips` 재생시간 합 ≠ `duration_sec`일 때 → 마지막 클립 `playDur`를 늘리거나 잘라서 맞춤
- `elapsed` (릴스 재생 시간) = `Date.now()` 기반 독립 타이머 → `video.currentTime`과 무관
- `video.currentTime`은 오직 클립 끝 감지용으로만 사용

---

## Req 6 연결 — TTS 음성 + 한문철 이미지

### 1. TTS 음성 (MP3)

VideoEngine에 `audioSrc` prop 추가 필요 (현재 미구현):

```jsx
// VideoEngine에 추가할 prop
audioSrc  {string}  TTS MP3 URL — VideoEngine 내부 <audio> 태그로 재생
```

**구현 포인트**:
```jsx
// VideoEngine 내부에 추가
const audioRef = useRef(null);

// goToClip에서 재생 시작 시
if (audioRef.current && shouldPlay) {
  audioRef.current.currentTime = 0; // 섹션 시작점으로 seek 필요
  audioRef.current.play().catch(() => {});
}

// togglePlay 일시정지 시
audioRef.current?.pause();

// JSX
<audio ref={audioRef} src={audioSrc} preload="auto" />
```

**주의**: TTS는 전체 60초 단일 MP3이므로 `elapsed`와 동기화.
일시정지/재개 시 `audioRef.current.currentTime = elapsed`로 맞춰야 함.

### 2. 한문철 배경제거 이미지

`VideoTemplate`의 `personImage` prop에 URL만 넘기면 바로 적용됨:

```jsx
// 현재 (플레이스홀더)
<VideoTemplate personImage={null} ... />

// Req 6 완성 후
<VideoTemplate personImage={analysisResult.personImageUrl} ... />
```

`PersonSlot` 컴포넌트가 이미 `image` prop 처리 구현되어 있음:
- `image` 있으면 → `<img>` 렌더 (objectFit: cover, objectPosition: top center)
- `image` 없으면 → "한문철 배경제거 이미지" 플레이스홀더

---

## ResultPage에서 받아야 할 데이터 구조

```js
// AnalyzingPage → ResultPage props 또는 API 응답
{
  // Req 4 출력
  muncheolScript: { script: { intro, analysis, conclusion }, total_duration_sec },

  // Req 6 출력
  ttsAudioUrl: "https://s3.../narration.mp3",
  personImageUrl: "https://s3.../muncheol-nobg.png",

  // 원본 영상 (Req 1 출력 — 이미 file prop으로 전달 중)
  // videoSrc: URL.createObjectURL(file) 또는 S3 presigned URL
}
```

---

## 현재 ResultPage 연결 코드 위치

```
src/components/ResultPage.jsx
  └── activeTab === 'reels' 블록
      └── <VideoTemplate
            videoContent={<VideoEngine src={videoSrc} script={MUNCHEOL_SCRIPT} ... />}
            personImage={null}          ← ✅ personImageUrl로 교체
            subtitle={liveSubtitle}     ← ✅ onSubtitleChange 콜백으로 자동 업데이트 중
          />
```

---

## 체크리스트

- [ ] Req 4 완성 → `MUNCHEOL_SCRIPT` import를 API 응답으로 교체
- [ ] Req 6 완성 → `VideoEngine`에 `audioSrc` prop 추가 + `<audio>` 동기화 구현
- [ ] Req 6 완성 → `VideoTemplate`에 `personImage={personImageUrl}` 연결
- [ ] `videoSrc` → S3 presigned URL로 교체 (현재 `URL.createObjectURL(file)` 또는 `/bb_h264.mp4` fallback)
- [ ] `App.jsx`의 `stage` 초기값 `'result'` → `'disclaimer'`로 복원
