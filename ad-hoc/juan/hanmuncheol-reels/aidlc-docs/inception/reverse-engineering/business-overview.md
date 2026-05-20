# Business Overview

## Business Context Diagram

```
┌─────────────────────────────────────────────────────────┐
│              블랙박스 사고 분석 시스템 (상위)               │
│                                                         │
│  [영상 분석] → [과실 판단] → [스크립트 생성] → ┐          │
│                                              ▼          │
│                                   ┌──────────────────┐  │
│                                   │ hanmuncheol-reels│  │
│                                   │ (이 모듈)         │  │
│                                   │                  │  │
│                                   │ JSON Script      │  │
│                                   │   → TTS 생성     │  │
│                                   │   → 영상 생성    │  │
│                                   │   → 합성         │  │
│                                   │   → 릴스 MP4     │  │
│                                   └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Business Description
- **모듈 역할**: 사고 분석 스크립트(JSON)를 입력받아 한문철 스타일 해설 영상을 자동 생성
- **핵심 가치**: 사고 분석 결과를 엔터테인먼트 콘텐츠(릴스)로 변환

## Business Transactions
1. **TTS 생성**: 스크립트 텍스트 → 목표 duration에 맞춘 음성 MP3
2. **영상 생성**: 씬별 프롬프트 → Nova Reel 6초 샷 생성 → 트림 → 연결
3. **합성**: 영상 + TTS 오디오 → 최종 릴스 MP4

## Business Dictionary
| 용어 | 의미 |
|------|------|
| Scene | 스크립트의 논리적 단위 (intro/analysis/conclusion) |
| Shot | Nova Reel 1회 생성 단위 (6초 고정) |
| SSOT | Single Source of Truth - JSON의 duration_sec이 모든 출력 길이의 기준 |
| Trim | 6초 샷에서 필요한 길이만 잘라내기 |
| Frame Continuity | 이전 샷 마지막 프레임 → 다음 샷 시작 이미지로 사용 |
