# Components

## Component Overview

| Component | Container | Responsibility |
|-----------|-----------|---------------|
| APIController | api-server | REST API 엔드포인트, 작업 큐 발행, 상태 조회 |
| AnalysisPipeline | video-worker | 파이프라인 오케스트레이션, 단계별 실행 관리 |
| VideoAnalyzer | video-worker | 프레임 추출, 객체 탐지, 차량 추적, 사고 유형 분류 |
| FaultAnalyzer | video-worker | RAG 검색, LLM 과실비율 판단 |
| ScriptGenerator | video-worker | 3단 구조 JSON 생성 (도입부/분석부/결론부) |
| DataIngestion | video-worker (CLI) | 판례/법규 데이터 OpenSearch 적재 스크립트 |
| S3Client | shared | S3 업로드/다운로드, 메타데이터 상태 관리 |
| OpenSearchClient | video-worker | OpenSearch Serverless 벡터 검색/적재 |
| BedrockClient | video-worker | LLM 호출 (Extended Thinking), Embedding 생성 |

---

## Component Details

### 1. APIController
- **Container**: api-server
- **Purpose**: 외부 클라이언트의 분석 요청을 수신하고, Redis Queue에 작업을 발행하며, S3 메타데이터 기반 상태를 조회하여 반환
- **Responsibilities**:
  - POST /analyze — 분석 요청 수신, 작업 ID 생성, Redis Queue에 발행
  - GET /status/{job_id} — S3 메타데이터에서 작업 상태 조회
  - GET /result/{job_id} — S3에서 최종 분석 결과 JSON 반환
  - POST /callback (internal) — worker 완료 콜백 수신

### 2. AnalysisPipeline
- **Container**: video-worker
- **Purpose**: Redis Queue에서 작업을 가져와 VideoAnalyzer → FaultAnalyzer → ScriptGenerator 순서로 파이프라인 실행, 각 단계 결과를 S3에 저장
- **Responsibilities**:
  - Redis Queue에서 작업 소비
  - 파이프라인 단계별 실행 및 에러 처리 (Partial Result 전략)
  - S3 메타데이터로 상태 업데이트
  - 완료/실패 시 api-server에 콜백 전송

### 3. VideoAnalyzer
- **Container**: video-worker
- **Purpose**: S3에서 영상을 다운로드하여 프레임 추출, 객체 탐지(YOLOv8), 차량 추적(ByteTrack), 사고 유형 분류를 수행
- **Responsibilities**:
  - FFmpeg으로 2 FPS 키프레임 추출
  - YOLOv8으로 차량/차선/신호등 탐지 (바운딩 박스 + 신뢰도)
  - ByteTrack으로 프레임 간 차량 ID 매칭 및 궤적 생성
  - 규칙 기반 사고 유형 분류
  - 차량 미탐지/영상 손상 에러 처리

### 4. FaultAnalyzer
- **Container**: video-worker
- **Purpose**: 영상 분석 결과를 기반으로 OpenSearch에서 관련 법규/판례를 검색하고, LLM(Extended Thinking)으로 과실비율을 산출
- **Responsibilities**:
  - 영상 분석 JSON에서 쿼리 생성
  - OpenSearch Serverless에서 관련 법규/판례 벡터 검색
  - Bedrock LLM에 컨텍스트(분석 데이터 + RAG 결과) 전달
  - 과실비율 + 판단 근거 JSON 생성
  - 면책 문구 포함
  - 판단 불가 시 사유 명시

### 5. ScriptGenerator
- **Container**: video-worker
- **Purpose**: 과실비율 분석 결과를 3단 구조(도입부/분석부/결론부) JSON으로 구조화하여 후속 모듈에서 활용 가능한 형태로 출력
- **Responsibilities**:
  - 도입부: 사고 상황 요약 + 타임스탬프
  - 분석부: 운전자별 행동 분석 + 과실 포인트 + 타임스탬프
  - 결론부: 과실비율 + 법적 근거 + 타임스탬프
  - JSON Schema 강제 (structured output)
  - 각 구간 독립 참조 가능 구조

### 6. DataIngestion
- **Container**: video-worker (CLI 모드)
- **Purpose**: 판례/법규 데이터를 수집하여 청크 분할 → Titan Embeddings 벡터화 → OpenSearch Serverless에 적재
- **Responsibilities**:
  - 데이터 소스 로딩 (TAAS, 과실비율 인정기준표, 도로교통법)
  - 텍스트 청크 분할 (적절한 크기)
  - Bedrock Titan Embeddings로 벡터 생성
  - OpenSearch Serverless에 인덱스 생성 및 문서 적재

### 7. S3Client (Shared Utility)
- **Container**: api-server + video-worker
- **Purpose**: S3 파일 업로드/다운로드 및 객체 메타데이터 기반 상태 관리
- **Responsibilities**:
  - 영상 파일 다운로드
  - 분석 결과 JSON 업로드
  - 객체 태그/메타데이터로 작업 상태 관리 (PENDING/PROCESSING/COMPLETED/FAILED)

### 8. OpenSearchClient
- **Container**: video-worker
- **Purpose**: Amazon OpenSearch Serverless에 벡터 검색 및 문서 적재
- **Responsibilities**:
  - 인덱스 생성/관리
  - 벡터 유사도 검색 (k-NN)
  - 문서 벌크 적재

### 9. BedrockClient
- **Container**: video-worker
- **Purpose**: AWS Bedrock API 호출 — LLM 추론(Extended Thinking) 및 Embedding 생성
- **Responsibilities**:
  - Claude Sonnet 4 Extended Thinking 호출 (과실비율 판단, 스크립트 생성)
  - Titan Embeddings 호출 (벡터 생성)
  - 요청/응답 직렬화
  - 에러 처리 및 재시도
