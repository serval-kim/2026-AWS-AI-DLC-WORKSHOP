# Module Interface Specification

## 호출 방법

### CLI
```bash
MOCK_VIDEO_GEN=false python3 pipeline.py <script.json>
```

### Python Import
```python
from pipeline import run_pipeline
output_path = run_pipeline("script.json", output_dir="/tmp/output")
```

---

## 입력: script.json

```json
{
  "script": {
    "intro": { "text": str, "duration_sec": int, "emphasis": [str], "clips": [...] },
    "analysis": { "text": str, "duration_sec": int, "emphasis": [str], "clips": [...] },
    "conclusion": { "text": str, "duration_sec": int, "emphasis": [str], "clips": [...] }
  },
  "total_duration_sec": int,
  "style_notes": str
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `text` | str | ✅ | TTS 스크립트 (`**강조**` 마크다운 지원) |
| `duration_sec` | int | ✅ | **SSOT** — 이 씬의 최종 길이(초) |
| `emphasis` | [str] | ❌ | 강조 단어 목록 (현재 미사용, 향후 자막용) |
| `clips` | [Clip] | ❌ | 블랙박스 영상 편집 메타 (이 모듈에서는 프롬프트 참고용) |
| `total_duration_sec` | int | ✅ | 전체 릴스 목표 길이 |

### Clip 스키마
```json
{ "start": "MM:SS", "end": "MM:SS", "effect": "normal|slow_2x|slow_4x|freeze|replay", "desc": str }
```

---

## 출력

| 파일 | 설명 |
|------|------|
| `{output_dir}/hanmuncheol_reels.mp4` | 최종 릴스 (영상 + TTS 오디오) |
| `{output_dir}/{scene}_final.mp4` | 씬별 영상 |
| `{output_dir}/{scene}_tts.mp3` | 씬별 TTS 오디오 |
| `{output_dir}/{scene}_last_frame.png` | 씬 마지막 프레임 (다음 씬 연결용) |

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `AWS_ACCESS_KEY_ID` | ✅ | AWS 자격증명 |
| `AWS_SECRET_ACCESS_KEY` | ✅ | AWS 자격증명 |
| `AWS_SESSION_TOKEN` | ❌ | 임시 자격증명 시 |
| `MOCK_VIDEO_GEN` | ❌ | `true`면 Nova Reel 호출 스킵 (더미 영상) |

---

## 의존성

- Python 3.10+
- boto3
- ffmpeg, ffprobe (PATH에 있어야 함)
- Pillow (이미지 리사이즈용)

---

## SSOT 규칙

1. `duration_sec`이 모든 출력 길이의 기준
2. TTS: prosody rate 자동 조절 → ±0.3초 이내 보정 (padding/trim)
3. 영상: ceil(duration/6) 샷 생성 → 마지막 샷 트림
4. 최종 영상 길이 ≈ sum(scene.duration_sec)

---

## AWS IAM 권한

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockNovaReel",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:StartAsyncInvoke",
        "bedrock:GetAsyncInvoke"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-reel-v1:1"
    },
    {
      "Sid": "PollyTTS",
      "Effect": "Allow",
      "Action": "polly:SynthesizeSpeech",
      "Resource": "*"
    },
    {
      "Sid": "S3VideoOutput",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${BUCKET_NAME}",
        "arn:aws:s3:::${BUCKET_NAME}/*"
      ]
    }
  ]
}
```

| 서비스 | 용도 | 최소 권한 |
|--------|------|-----------|
| Bedrock | Nova Reel 영상 생성 | StartAsyncInvoke, GetAsyncInvoke |
| Polly | TTS 음성 생성 | SynthesizeSpeech |
| S3 | 영상 출력 저장/다운로드 | PutObject, GetObject |

---

## 에러 처리

| 상황 | 동작 |
|------|------|
| 샷 생성 실패 | 2회 재시도 (seed 변경) → fail-fast |
| TTS 실패 | 1회 재시도 → fail |
| ffmpeg 실패 | 즉시 fail |
| timeout (3분/샷) | 재시도 카운트 소진 후 fail |
