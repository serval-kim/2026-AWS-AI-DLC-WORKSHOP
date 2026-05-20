# 2026-AWS-AI-DLC-WORKSHOP

늑구해방전선 — AWS AI-DLC(AI-assisted Development Lifecycle) 워크샵 프로젝트

## 팀원

| 이름 | 폴더 |
|------|------|
| Andy | `ad-hoc/andy/` |
| Serval | `ad-hoc/serval/` |
| Ssol | `ad-hoc/ssol/` |
| Kuza | `ad-hoc/kuza/` |
| Juan | `ad-hoc/juan/` |

## 디렉토리 구조

```
.
├── .kiro/
│   ├── steering/aws-aidlc-rules/   # AI-DLC 코어 워크플로우 룰
│   └── aws-aidlc-rule-details/     # 상세 룰 (inception, construction, etc.)
├── aidlc-workflows/                 # awslabs/aidlc-workflows 참조 저장소
├── ad-hoc/                          # 팀원별 임시 작업 공간
│   ├── andy/
│   ├── serval/
│   ├── ssol/
│   ├── kuza/
│   └── juan/
├── requirements/                    # 프로젝트 요구사항 (추후 추가)
└── setup-prompt.md                  # 환경 설정 가이드
```

## 시작하기

```bash
git clone https://github.com/serval-kim/2026-AWS-AI-DLC-WORKSHOP.git
cd 2026-AWS-AI-DLC-WORKSHOP
```

## AI-DLC 워크플로우

이 프로젝트는 `.kiro/steering/` 에 배치된 AI-DLC Rules를 통해 AI 에이전트가 체계적인 소프트웨어 개발 라이프사이클을 따르도록 합니다:

1. **Inception** — 요구사항 분석, 유저 스토리, 애플리케이션 설계
2. **Construction** — 기능 설계, NFR, 코드 생성, 빌드 & 테스트
3. **Operations** — 운영 및 유지보수

## 작업 규칙

- `ad-hoc/{이름}/` 폴더에 개인 임시 파일 저장
- 공용 코드는 루트 또는 별도 디렉토리에서 브랜치 → PR로 진행
- 커밋 메시지는 간결하게, 한글/영문 무관
