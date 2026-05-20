# ssol — 한문철 스타일 스크립트 생성 PoC

Requirement 4, 5, 6 담당: 스크립트 생성 → 문철어 번역 → TTS 음성 생성

---

## 폴더 구조

```
ssol/
├── scripts/
│   ├── style-analysis/          # 한문철 화법 자동 분석 파이프라인
│   │   ├── 00_extract_muncheol_style_yt_dlp.py   # yt-dlp + Whisper 기반 (구버전)
│   │   ├── 01_fetch_transcripts.py                # YouTube Transcript API로 자막 수집
│   │   ├── 02_analyze_style_bedrock.py            # Bedrock Claude 기본 화법 분석
│   │   ├── 02_analyze_style_bedrock_deep.py       # Bedrock Claude 심층 화법 분석
│   │   └── 03_fetch_bulk_transcripts.py           # 대량 수집 + 분석 통합 스크립트
│   ├── pipeline/
│   │   └── mock_pipeline.py     # 과실비율 데이터 → 문철어 스크립트 PoC
│   └── utils/
│       ├── generate_image_bedrock.py   # Bedrock Titan 이미지 생성
│       └── generate_thumbnail.py       # 유튜브 썸네일 생성 (Pillow)
│
├── data/
│   ├── transcripts/             # 한문철TV 숏츠 개별 트랜스크립트 (10개)
│   ├── raw-transcripts.txt      # 트랜스크립트 합본
│   ├── raw-transcripts.json     # 트랜스크립트 JSON
│   ├── style-analysis.md        # 기본 화법 분석 결과
│   └── style-analysis-deep.md   # 심층 화법 분석 결과 (시스템 프롬프트 + Few-shot 5개)
│
├── mock-output/
│   ├── schema.md                # Reels_Composer용 JSON 스펙 문서
│   └── muncheol-script-oneshot.json   # mock_pipeline.py 실행 결과 예시
│
└── docs/
    └── muncheol-style-template.md     # 수동 화법 분석용 템플릿
```

---

## 빠른 시작

### 사전 조건
```bash
pip install yt-dlp youtube-transcript-api boto3
# AWS 자격증명 필요 (us-east-1 리전, Bedrock Claude Sonnet 4 접근 권한)
```

### 1. 한문철 화법 분석 (자동)
```bash
# 트랜스크립트 수집 (10개)
python scripts/style-analysis/01_fetch_transcripts.py

# 기본 분석
python scripts/style-analysis/02_analyze_style_bedrock.py

# 심층 분석 (시스템 프롬프트 + Few-shot 포함)
python scripts/style-analysis/02_analyze_style_bedrock_deep.py
```

### 2. 파이프라인 PoC 실행
```bash
# 과실비율 데이터 → 문철어 스크립트 (1회 호출)
python scripts/pipeline/mock_pipeline.py --one-shot

# 2단계 (중립 스크립트 → 문철어 변환)
python scripts/pipeline/mock_pipeline.py

# API 없이 데이터만 확인
python scripts/pipeline/mock_pipeline.py --dry-run
```

---

## 핵심 산출물

### `data/style-analysis-deep.md`
한문철 화법 심층 분석 결과. 여기서 뽑은 **시스템 프롬프트 20개 규칙**과 **사고 유형별 Few-shot 5개**를 `mock_pipeline.py`의 `ONE_SHOT_PROMPT`에 반영함.

### `mock-output/schema.md`
Reels_Composer(영상 편집 모듈, Req 7)가 소비하는 JSON 스펙 문서. clips 배열 구조, effect 종류(normal/slow_2x/slow_4x/replay/freeze), 타임라인 계산 방법 포함.

### `mock-output/muncheol-script-oneshot.json`
실제 Bedrock Claude가 생성한 문철어 스크립트 예시 출력.

---

## 파이프라인 위치

```
[Req 3] Fault_Analyzer
    ↓ 과실비율 JSON
[Req 4] Script_Generator      ← mock_pipeline.py Step 2
    ↓ 중립 스크립트 JSON
[Req 5] Muncheol_Translator   ← mock_pipeline.py Step 3 (또는 one-shot)
    ↓ 문철어 스크립트 JSON
[Req 6] Voice_Generator       ← TBD (Amazon Polly 연동 예정)
    ↓ MP3
[Req 7] Reels_Composer        ← schema.md 참고 (Ssol 담당)
```

---

## 참고: YouTube IP 차단 이슈

`youtube-transcript-api`로 대량 수집 시 YouTube IP 차단 발생.
현재 10개 트랜스크립트 수집 완료 상태. IP 풀리면 `03_fetch_bulk_transcripts.py 100`으로 추가 수집 가능.
