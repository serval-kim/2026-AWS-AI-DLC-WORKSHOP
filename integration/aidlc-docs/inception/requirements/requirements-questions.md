# Requirements Clarification Questions — Serval 실제 연결

Please answer the following questions to help clarify the requirements.

## Question 1
Serval 파이프라인 호출 방식을 어떻게 할까요?

A) HTTP API 호출 — Serval API 서버(`ad-hoc/serval/api/`)를 별도 프로세스로 띄우고 HTTP로 호출
B) 직접 import — `ad-hoc/serval/worker/pipeline.py`의 `AnalysisPipeline`을 Python import로 직접 호출
C) Redis Queue — Serval worker에 job을 enqueue하고 callback으로 결과 수신
D) Other (please describe after [Answer]: tag below)

[Answer]: 어차피 같은 API 서버니까 import.

## Question 2
인프라 의존성(S3, Redis, OpenSearch) 처리 방식은?

A) 실제 AWS 서비스 사용 — credentials.env의 실제 키로 S3/OpenSearch 연결
B) LocalStack/Docker — 로컬 에뮬레이션으로 S3/Redis/OpenSearch 대체
C) Mock/Stub — 인프라 호출은 mock하고 Serval의 분석 로직만 실제 실행
D) Other (please describe after [Answer]: tag below)

[Answer]:  A

## Question 3
영상 입력 소스는?

A) S3에 이미 업로드된 영상의 key를 전달 (Serval API 방식 그대로)
B) Integration API에서 직접 파일을 받아 로컬 경로로 Serval에 전달
C) 테스트용 샘플 영상을 `ad-hoc/serval/data/`에서 사용
D) Other (please describe after [Answer]: tag below)

[Answer]: A 하되 테스트는 샘플 영상 쓰자

## Question 4
Property-Based Testing Extension — 이 프로젝트에 property-based testing (PBT) 규칙을 적용할까요?

A) Yes — 모든 PBT 규칙을 blocking constraint로 적용 (비즈니스 로직, 데이터 변환이 있는 프로젝트에 권장)
B) Partial — 순수 함수와 직렬화 round-trip에만 PBT 적용
C) No — PBT 규칙 스킵 (단순 CRUD, UI 전용, 또는 얇은 통합 레이어에 적합)
D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 5
Security Extension — 보안 규칙을 적용할까요?

A) Yes — 모든 보안 규칙을 blocking constraint로 적용 (프로덕션 수준 애플리케이션에 권장)
B) No — 보안 규칙 스킵 (PoC, 프로토타입, 실험적 프로젝트에 적합)
C) Other (please describe after [Answer]: tag below)

[Answer]: A
