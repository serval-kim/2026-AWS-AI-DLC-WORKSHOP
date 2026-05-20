# Requirements Verification Questions

Requirement 2-4 구현에 대한 명확화 질문입니다. 각 질문의 [Answer]: 태그 뒤에 선택지 문자를 입력해주세요.

---

## Question 1
Docker 이미지의 서빙 방식은 어떤 형태를 원하시나요?

A) REST API 서버 (FastAPI/Flask) — 영상 분석 요청을 HTTP API로 받아 처리
B) CLI 기반 배치 처리 — 컨테이너 실행 시 S3 경로를 인자로 받아 처리
C) 메시지 큐 기반 워커 — SQS/Redis 큐에서 작업을 가져와 처리
D) 전체 파이프라인 (Req 1 포함) — 업로드부터 분석까지 한 번에 처리하는 API 서버
X) Other (please describe after [Answer]: tag below)

[Answer]: 도커를 여러개 써야할 것 같은데. 
무거운 작업이니 워커 GPU 인스턴스는 S3 인자로 받아서 처리하는 배치작업으로 돌리고,
그 GPU 인스턴스를 호출 할 수 있도록 REST 기반의 API 서버를 따로 둬야겠네.
효율화 시킬수 있다면 다른 방식으로 진행해도 상관없어.

---

## Question 2
Requirement 2의 YOLOv8 객체 탐지에서 GPU 사용 여부는?

A) GPU 필수 — NVIDIA GPU + CUDA Docker 이미지 사용 (빠른 추론)
B) CPU 전용 — GPU 없이 CPU로만 추론 (느리지만 환경 제약 없음)
C) GPU 선택적 — GPU 있으면 사용, 없으면 CPU fallback
X) Other (please describe after [Answer]: tag below)

[Answer]: 
C.
---

## Question 3
Requirement 3의 RAG 벡터 DB로 어떤 것을 사용하시겠습니까?

A) 로컬 ChromaDB (Docker 컨테이너 내) — 외부 의존성 없이 자체 포함
B) Amazon OpenSearch Serverless — AWS 관리형 서비스 사용
C) FAISS (로컬 인메모리) — 경량 벡터 검색, 파일 기반 저장
X) Other (please describe after [Answer]: tag below)

[Answer]: 
B
---

## Question 4
판례/법규 데이터는 어떻게 준비하시겠습니까?

A) 샘플 데이터 포함 — 소수의 예시 판례/법규를 시드 데이터로 Docker 이미지에 포함
B) 외부 데이터 로딩 — S3에서 판례/법규 데이터를 런타임에 다운로드하여 벡터화
C) 사전 벡터화된 DB — 이미 벡터화된 ChromaDB 데이터를 Docker 볼륨으로 마운트
X) Other (please describe after [Answer]: tag below)

[Answer]: 
OpenSearch에 올려야 하니까 미리 준비해야겠지.
교통사고 분쟁 관련 데이터 샘플이 있나 웹에서 리서치 후 사용. 

---

## Question 5
Requirement 2-4를 하나의 Docker 이미지로 통합할까요, 모듈별로 분리할까요?

A) 단일 이미지 — Video_Analyzer + Fault_Analyzer + Script_Generator를 하나의 컨테이너에 통합
B) 모듈별 분리 — 각 모듈을 별도 Docker 이미지로 분리하고 docker-compose로 연결
C) 2개 분리 — 영상 분석(Req 2)과 AI 분석(Req 3+4)을 분리
X) Other (please describe after [Answer]: tag below)

[Answer]: 
1번과 비슷한 답변일 것 같은데, C로 역할끼리도 분리해야 GPU 유휴 시간을 줄일듯
---

## Question 6
AWS Bedrock에서 사용할 Claude 모델 버전은?

A) Claude 3.5 Sonnet (claude-3-5-sonnet) — 성능/비용 균형
B) Claude 3 Haiku (claude-3-haiku) — 빠르고 저렴
C) Claude 3.5 Haiku (claude-3-5-haiku) — 빠르면서 성능 개선
D) Claude 3 Opus (claude-3-opus) — 최고 성능
X) Other (please describe after [Answer]: tag below)

[Answer]: 
추론이 중요하기 때문에 추론 특화 모델을 써. Claude일 필요는 없어
웹 탐색해서 리서치 이후 진행해
---

## Question 7
영상 분석 결과와 최종 output의 저장 위치는?

A) S3 전용 — 모든 중간/최종 결과를 S3에 저장
B) 로컬 + S3 — 중간 결과는 로컬(/tmp), 최종 결과만 S3
C) 로컬 전용 — Docker 볼륨에 모든 결과 저장 (S3 미사용)
X) Other (please describe after [Answer]: tag below)

[Answer]: 
B
---

## Question 8: Security Extensions
이 프로젝트에 보안 확장 규칙을 적용할까요?

A) Yes — 모든 SECURITY 규칙을 blocking constraint로 적용 (프로덕션 수준 애플리케이션에 권장)
B) No — 모든 SECURITY 규칙 건너뛰기 (PoC, 프로토타입, 실험적 프로젝트에 적합)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 9: Property-Based Testing Extension
이 프로젝트에 Property-Based Testing (PBT) 규칙을 적용할까요?

A) Yes — 모든 PBT 규칙을 blocking constraint로 적용 (비즈니스 로직, 데이터 변환이 있는 프로젝트에 권장)
B) Partial — 순수 함수와 직렬화 round-trip에만 PBT 규칙 적용
C) No — 모든 PBT 규칙 건너뛰기 (단순 CRUD, UI 전용 프로젝트에 적합)
X) Other (please describe after [Answer]: tag below)

[Answer]: Yes
