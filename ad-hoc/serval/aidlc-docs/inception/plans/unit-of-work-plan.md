# Unit of Work Plan

## Context
Application Design에서 2-Container 아키텍처가 확정됨:
- api-server (FastAPI REST API + Redis Queue 발행)
- video-worker (GPU 배치 처리 + AI 분석 파이프라인)
- redis (메시지 브로커)

## Plan Checklist

### Part 1: Unit Definitions
- [x] Unit 1 (api-server) 정의 — 범위, 책임, 컴포넌트 매핑
- [x] Unit 2 (video-worker) 정의 — 범위, 책임, 컴포넌트 매핑
- [x] Shared 모듈 정의 — 공통 모델, S3Client, 설정

### Part 2: Dependencies & Execution Order
- [x] 유닛 간 의존성 매트릭스 생성
- [x] 개발 순서 결정 (어떤 유닛을 먼저 구현할지)
- [x] 공유 모듈 식별

### Part 3: Code Organization
- [x] 프로젝트 디렉토리 구조 정의
- [x] 패키지 구조 결정

### Part 4: Requirement-Unit Mapping
- [x] Requirement 2-4를 유닛에 매핑
- [x] 각 유닛의 구현 범위 확정

### Part 5: Validation
- [x] 유닛 경계 검증
- [x] 모든 요구사항이 유닛에 할당되었는지 확인

---

## Design Questions

### Question 1
프로젝트 디렉토리 구조 선호도는?

A) 모노레포 (단일 루트) — 하나의 프로젝트 루트에 api-server/, worker/, shared/ 디렉토리로 분리
B) 멀티레포 스타일 — 각 서비스를 완전히 독립된 디렉토리로 분리 (별도 requirements.txt, Dockerfile)
C) 패키지 기반 — Python 패키지로 구성하여 shared를 설치 가능한 패키지로 관리
X) Other (please describe after [Answer]: tag below)

[Answer]: 모노레포 기반. 이 워크스페이스만 사용할 거야

### Question 2
개발 순서 선호도는?

A) Shared → api-server → video-worker (API 먼저, 워커 나중)
B) Shared → video-worker → api-server (핵심 로직 먼저, API 나중)
C) 병렬 개발 — shared 먼저 후 api-server와 video-worker 동시 진행
X) Other (please describe after [Answer]: tag below)

[Answer]: 서로 호출로직이 있으니 C가 맞겠지만. video-worker 핵심 로직 구현 후 서빙 로직을 병렬로 가면 좋겠네

