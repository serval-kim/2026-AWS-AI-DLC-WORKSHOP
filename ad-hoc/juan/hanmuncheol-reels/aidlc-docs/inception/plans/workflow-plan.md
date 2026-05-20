# Workflow Planning

## Execution Plan

현재 코드가 이미 존재하고 유닛 테스트 통과 상태. 남은 작업을 정리.

---

## Remaining Work Items

### Phase 1: 코드 보강 (현재 세션)

| # | 작업 | 우선순위 | 상태 |
|---|------|---------|------|
| 1 | TTS silence padding 보정 (±0.5초 오차 처리) | High | TODO |
| 2 | 샷 생성 재시도 로직 (2회, seed 변경) | High | TODO |
| 3 | TTS 병렬 생성 (영상 생성과 동시) | Medium | TODO |
| 4 | .gitignore에 __pycache__ 추가 | Low | TODO |
| 5 | MOCK_VIDEO_GEN 환경변수 지원 | Medium | TODO |

### Phase 2: 통합 (다음 세션)

| # | 작업 | 우선순위 |
|---|------|---------|
| 6 | handler.py (CLI + Lambda 진입점) | Medium |
| 7 | S3 job prefix 격리 구조 | Medium |
| 8 | Step Functions 워크플로우 정의 | Low |
| 9 | CloudWatch 로깅/메트릭 | Low |

---

## Architecture Decision Records

### ADR-1: TTS 오차 처리
- **결정**: silence padding (짧을 때) + trim (길 때)
- **근거**: 영상 속도 변경은 시각적 위화감 유발

### ADR-2: 샷 생성 실패 전략
- **결정**: shot 단위 2회 재시도 → fail-fast
- **근거**: 부분 성공 영상은 릴스로 사용 불가

### ADR-3: 병렬화 범위
- **결정**: TTS는 병렬, 샷 생성은 순차
- **근거**: 샷 간 프레임 의존성으로 병렬 불가, TTS는 독립적

### ADR-4: 배포 형태
- **결정**: 현재 CLI, 향후 Step Functions + Lambda
- **근거**: Nova Reel 비동기 대기(분 단위)로 동기 API 부적합
