# Component Inventory

## Module Structure

```
hanmuncheol-reels/
├── models.py          # 입력 스키마 (Script, Scene, Clip)
├── config.py          # AWS 설정, 상수
├── tts.py             # Polly TTS 생성 (duration SSOT 맞춤)
├── prompt_builder.py  # 씬 → Nova Reel 프롬프트 변환
├── video_gen.py       # Nova Reel 샷 생성 + 프레임 추출 + 트림
├── video_edit.py      # ffmpeg 합성 (concat, overlay, subtitle)
├── pipeline.py        # 전체 오케스트레이션
└── test/
    ├── sample_script.json
    ├── sample_15s.json
    ├── test_tts.py
    ├── test_one_shot.py
    └── test_edit.py
```

## Component Details

| 컴포넌트 | 책임 | 외부 의존 | 테스트 상태 |
|----------|------|-----------|------------|
| models.py | 입력 파싱, 샷 수 계산 | 없음 | ✅ |
| config.py | AWS 세션, 상수 | boto3 | ✅ |
| tts.py | TTS 생성, rate 자동 조절 | Polly, ffprobe | ✅ |
| prompt_builder.py | 프롬프트 생성 (512자 제한) | 없음 | ✅ |
| video_gen.py | 샷 생성, 프레임 추출, 트림 | Bedrock, ffmpeg | ✅ |
| video_edit.py | 영상 결합, 오디오 합성 | ffmpeg | ✅ |
| pipeline.py | 전체 흐름 오케스트레이션 | 모든 모듈 | ✅ |

## Technology Stack
- **Language**: Python 3.12
- **AWS Services**: Bedrock (Nova Reel v1:1), Polly (Seoyeon neural)
- **Local Tools**: ffmpeg, ffprobe
- **SDK**: boto3

## Data Flow

```
JSON (duration_sec = SSOT)
    │
    ├──→ tts.py: text + duration → MP3 (prosody rate 자동 조절)
    │
    └──→ video_gen.py: 
           shots = ceil(duration/6)
           last_shot_trim = duration % 6 or 6
           Shot1(image) → Shot2(last_frame) → ... → concat → trim
    │
    └──→ video_edit.py: video + audio → scene_final.mp4
    │
    └──→ concat all scenes → hanmuncheol_reels.mp4
```
