# VideoEngine + TTS 나레이션 통합 가이드

> Req 4 (Script_Generator JSON) + Req 6 (Voice_Generator MP3) → VideoEngine 연결 시 참고

---

## 현재 구조 (Req 4만 연결된 상태)

```
muncheol-script-oneshot.json
        ↓
   VideoEngine
  (영상 클립 편집)
        ↓
  VideoTemplate
  (썸네일 프레임)
```

---

## 목표 구조 (Req 4 + Req 6 통합)

```
muncheol-script-oneshot.json ──→ VideoEngine (클립 편집 + 타이밍)
                                       ↓
naration.mp3 (Voice_Generator) ──→ <audio> 동기화
                                       ↓
                                  VideoTemplate
```

---

## VideoEngine이 관리하는 두 개의 타임라인

| 타임라인 | 기준 | 용도 |
|---|---|---|
| `video.currentTime` | 원본 영상 위치 (0~10s) | 클립 start/end 감지 |
| `elapsed` (timerRef) | 릴스 재생 시간 (0~60s) | 진행률, 자막, **MP3 동기화** |

`elapsed`가 벽시계 기반이라 MP3 `<audio>.currentTime`과 1:1 매핑 가능.

---

## MP3 연결 방법

### 1. `audioRef` 추가

```jsx
const audioRef = useRef(null);

// JSX
<audio ref={audioRef} src={narrationSrc} preload="auto" />
```

### 2. 재생/일시정지 동기화

```js
// togglePlay 안에서
if (st.playing) {
  video.pause();
  audioRef.current?.pause();
  timerPause();
} else {
  video.play();
  audioRef.current?.play();
  timerStart();
}
```

### 3. seek 동기화

클립 전환 시 `goToClip(idx)`에서 영상 seek와 함께 오디오도 seek:

```js
// goToClip 안에서
video.currentTime = clip.startSec;
if (audioRef.current) {
  // elapsed = 이 클립의 릴스 타임라인 시작점
  audioRef.current.currentTime = clip.offsetStart;
}
```

### 4. VideoEngine Props 추가

```jsx
<VideoEngine
  src="/bb_h264.mp4"
  narrationSrc={narrationUrl}   // ← 추가: Voice_Generator가 반환한 S3 URL
  script={MUNCHEOL_SCRIPT}
  showSubtitle={false}
  onSubtitleChange={setLiveSubtitle}
/>
```

---

## JSON 스크립트와 MP3의 타임스탬프 관계

```
릴스 타임라인 (elapsed 0~60s)
│
├── 0s  ─── intro 시작    → audio.currentTime = 0
│   ├── clip: 00:00~00:06 normal (6s)
│   └── [padding freeze 6s] → duration_sec 12s 맞추기
│
├── 12s ─── analysis 시작 → audio.currentTime = 12
│   ├── clip: 00:01~00:03 normal (2s)
│   ├── clip: 00:03~00:05 slow_2x (4s)
│   ├── clip: 00:01~00:02 freeze (1s)
│   └── clip: 00:03~00:05 replay + padding (28s)
│
└── 47s ─── conclusion 시작 → audio.currentTime = 47
    ├── clip: 00:04~00:05 freeze (1s)
    └── clip: 00:00~00:06 slow_4x + padding (12s)
```

**핵심**: `clip.offsetStart` = 해당 클립의 릴스 시작 시간 = `audio.currentTime` seek 값

---

## 주의사항

### 브라우저 autoplay 정책
- `<audio>`는 사용자 인터랙션(버튼 클릭) 이후에만 재생 가능
- `togglePlay` 버튼 클릭 시 `audio.play()` 호출 → 정책 통과

### 오디오 길이 vs duration_sec
- MP3 실제 길이 ≈ `total_duration_sec` (60s)
- 오차가 있을 경우 `audio.playbackRate`로 미세 조정 가능

### 일시정지 후 재개 시 drift 방지
```js
// 재개 시 audio를 elapsed 기준으로 재sync
audioRef.current.currentTime = timerRead();
audioRef.current.play();
```

### S3 CORS 설정
- `narrationSrc`가 S3 URL이면 CORS 허용 필요
- `<audio crossOrigin="anonymous" />`

---

## VideoEngine Props 최종 인터페이스 (통합 후)

```ts
interface VideoEngineProps {
  src: string;              // 원본 MP4 URL (S3 presigned or blob URL)
  narrationSrc?: string;    // TTS MP3 URL (Voice_Generator 출력)
  script: MuncheolScript;   // muncheol-script-oneshot.json
  autoPlay?: boolean;
  onEnded?: () => void;
  onSubtitleChange?: (text: string) => void;
  showSubtitle?: boolean;   // false면 VideoTemplate 자막박스에 위임
  style?: CSSProperties;
}
```

---

## 현재 VideoEngine에서 elapsed 흐름 (참고)

```
togglePlay() 클릭
  → timerStart()          // Date.now() 기록
  → goToClip(idx, true)
      → video.currentTime = clip.startSec  // 원본 영상 seek
      → video.play()
      → startRaf()
          → tick() 매 프레임:
              elapsed = timerRead()         // 벽시계 기반
              progress = elapsed / totalDuration * 100
              자막 인덱스 = floor(secElapsed / perSentence)
              // ← 여기서 audio.currentTime = elapsed 로 sync 가능
```
