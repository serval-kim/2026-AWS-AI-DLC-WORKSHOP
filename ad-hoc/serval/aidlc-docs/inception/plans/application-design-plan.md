# Application Design Plan

## Design Scope
Requirement 2-4 구현을 위한 2-Container 아키텍처 설계:
- **api-server**: REST API 서버 (FastAPI)
- **video-worker**: GPU 배치 워커 (영상 분석 + AI 분석)

## Plan Checklist

### Part 1: Component Design
- [x] Video_Analyzer 컴포넌트 정의 (프레임 추출, 객체 탐지, 차량 추적, 사고 유형 분류)
- [x] Fault_Analyzer 컴포넌트 정의 (RAG 검색, LLM 과실비율 판단)
- [x] Script_Generator 컴포넌트 정의 (3단 구조 JSON 생성)
- [x] API Controller 컴포넌트 정의 (REST 엔드포인트, 워커 호출)
- [x] Data Ingestion 컴포넌트 정의 (판례/법규 데이터 OpenSearch 적재)

### Part 2: Component Methods
- [x] 각 컴포넌트의 메서드 시그니처 정의
- [x] 입출력 타입 정의
- [x] 에러 처리 인터페이스 정의

### Part 3: Service Layer
- [x] Analysis Pipeline Service 정의 (워커 내 파이프라인 오케스트레이션)
- [x] API Service 정의 (요청 관리, 상태 추적)

### Part 4: Component Dependencies
- [x] 컴포넌트 간 의존성 매트릭스 생성
- [x] 데이터 흐름 다이어그램 생성
- [x] 통신 패턴 정의

### Part 5: Design Validation
- [x] 설계 완전성 검증
- [x] Security Baseline 준수 확인
- [x] PBT 적용 대상 식별

---

## Design Questions

아래 질문에 답변해주세요. [Answer]: 태그 뒤에 선택지를 입력해주세요.

### Question 1
api-server와 video-worker 간 통신 방식은?

A) 동기 HTTP 호출 — api-server가 worker에 HTTP 요청 후 완료까지 대기 (long polling)
B) 비동기 작업 큐 — api-server가 작업을 큐에 넣고 즉시 응답, worker가 큐에서 가져가 처리 (Redis Queue)
C) 비동기 콜백 — api-server가 worker에 요청 후 즉시 응답, worker 완료 시 콜백
X) Other (please describe after [Answer]: tag below)

[Answer]: B+C. 처리 후 콜백을 받아야겠네

### Question 2
분석 작업의 상태 관리 방식은?

A) 인메모리 — api-server 프로세스 내 딕셔너리로 상태 관리 (단순, 재시작 시 유실)
B) Redis — 별도 Redis 컨테이너로 상태 저장 (영속적, 확장 가능)
C) S3 메타데이터 — S3 객체의 메타데이터/태그로 상태 관리 (인프라 최소화)
X) Other (please describe after [Answer]: tag below)

[Answer]: 객체를 공유한다면 C로 관리 가능할 듯

### Question 3
API 인증/인가 방식은? (MVP 수준)

A) 인증 없음 — 로컬 Docker 환경이므로 인증 불필요
B) API Key 기반 — 간단한 API Key 헤더 검증
C) JWT 토큰 — 토큰 기반 인증 (향후 확장 고려)
X) Other (please describe after [Answer]: tag below)

[Answer]: A. 서빙 시 외부망에 노출될 서버가 아니라 괜찮을 듯

### Question 4
영상 분석 파이프라인의 에러 처리 전략은?

A) Fail-Fast — 어느 단계든 실패 시 즉시 전체 파이프라인 중단, 에러 반환
B) Partial Result — 가능한 단계까지 진행 후 부분 결과 반환 (예: 객체 탐지 성공, 추적 실패 시 탐지 결과만 반환)
C) Retry + Fail-Fast — 각 단계 1회 재시도 후 실패 시 중단
X) Other (please describe after [Answer]: tag below)

[Answer]: B.

### Question 5
OpenSearch Serverless 연결 방식은?

A) AWS SDK 직접 연결 — boto3 + opensearch-py로 직접 연결 (credentials.env 사용)
B) 로컬 OpenSearch Docker — 개발 환경에서는 로컬 OpenSearch 컨테이너 사용, 프로덕션에서 Serverless 전환
X) Other (please describe after [Answer]: tag below)

[Answer]:  A

