# Requirements Document — Requirement 2-4 Implementation

## Intent Analysis

| Dimension | Value |
|-----------|-------|
| **User Request** | Requirement 2-4 (영상 분석, 과실비율 판단, 구조화된 분석 결과 생성)를 Docker 이미지로 서빙 |
| **Request Type** | New Project (Greenfield) |
| **Scope** | Multiple Components — Video_Analyzer, Fault_Analyzer, Script_Generator |
| **Complexity** | Complex — ML 모델(YOLOv8), RAG 파이프라인, LLM 추론, Docker 멀티 컨테이너 |

---

## Architecture Decision: 2-Container Split

사용자 결정에 따라 시스템을 2개의 Docker 이미지로 분리:

| Container | 역할 | 리소스 |
|-----------|------|--------|
| **api-server** | REST API 서버 (FastAPI) — 분석 요청 수신, 워커 호출, 결과 반환 | CPU 경량 |
| **video-worker** | GPU 배치 워커 — 영상 분석(YOLOv8) + AI 분석(과실비율 + 스크립트 생성) | GPU 선택적 |

**설계 근거**: GPU 유휴 시간 최소화를 위해 API 서버와 GPU 워커를 분리. API 서버는 요청을 받아 S3 경로를 워커에 전달하고, 워커는 배치 처리 후 결과를 S3에 저장.

---

## Functional Requirements

### FR-1: 영상 분석 (Video_Analyzer) — Requirement 2

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | 영상에서 2 FPS 비율로 키프레임 추출 (FFmpeg) | Must |
| FR-1.2 | 각 프레임에서 차량, 차선, 신호등 객체 탐지 (YOLOv8) — 바운딩 박스 + 신뢰도 점수 | Must |
| FR-1.3 | 프레임 간 동일 차량 매칭 — 이동 궤적 데이터 생성 (ByteTrack/SORT) | Must |
| FR-1.4 | 사고 유형 분류 (추돌, 끼어들기, 신호위반 등) — 규칙 기반 로직 | Must |
| FR-1.5 | 차량 미탐지 시 오류 반환 및 분석 중단 | Must |
| FR-1.6 | 영상 손상 시 오류 반환 | Must |

**입력**: S3 영상 파일 경로
**출력**: 분석 결과 JSON → S3 저장

### FR-2: 과실비율 판단 (Fault_Analyzer) — Requirement 3

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | 영상 분석 데이터 기반 RAG 검색 — 도로교통법 및 판례 데이터베이스 (Amazon OpenSearch Serverless) | Must |
| FR-2.2 | 추론 특화 LLM으로 각 차량 과실비율 백분율 산출 | Must |
| FR-2.3 | 과실비율 판단 근거 — 관련 법규 조항 + 유사 판례 텍스트 제공 | Must |
| FR-2.4 | "AI 추정치이며 법적 효력 없음" 면책 문구 포함 | Must |
| FR-2.5 | 사고 유형 판별 불가 시 판단 불가 사유 명시 + 수동 검토 권고 | Must |

**RAG 구성**:
- 벡터 DB: Amazon OpenSearch Serverless
- 임베딩 모델: AWS Bedrock — Titan Embeddings
- 데이터 소스: 도로교통공단 TAAS 교통사고 정보 + 손해보험협회 과실비율 인정기준표 + 도로교통법 조항 (웹 리서치 기반 수집)

### FR-3: 구조화된 분석 결과 생성 (Script_Generator) — Requirement 4

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | 3단 구조 분석 결과 생성: 도입부(사고 상황 요약), 분석부(운전자별 행동 분석), 결론부(과실비율 + 법적 근거) | Must |
| FR-3.2 | 각 구간에 원본 영상 타임스탬프(시작/종료 시간) 포함 | Must |
| FR-3.3 | 각 운전자의 핵심 과실 행위 + 법규 위반 사항 개별 항목 분리 | Must |
| FR-3.4 | JSON 형식 출력 — 각 구간 독립 참조 가능 구조 (JSON Schema 강제) | Must |

---

## Non-Functional Requirements

### NFR-1: LLM 모델 선택

| 항목 | 결정 |
|------|------|
| **모델** | AWS Bedrock 추론 특화 모델 사용 |
| **1차 선택** | Claude Sonnet 4 (Extended Thinking 활성화) — 복잡한 법적 추론에 적합 |
| **대안** | Amazon Nova Premier — complex reasoning 특화, 비용 효율적 |
| **근거** | 과실비율 판단은 법규 해석 + 상황 분석 + 판례 비교가 필요한 복잡 추론 작업 |

> 리서치 결과: AWS Bedrock에서 Extended Thinking을 지원하는 모델은 Claude Opus 4.5, Claude Opus 4, Claude Sonnet 4 등이며, Amazon Nova Premier는 complex reasoning과 agentic workflow에 특화된 모델입니다. 비용/성능 균형을 고려하여 Claude Sonnet 4 (Extended Thinking)를 1차 선택으로 권장합니다.
> Sources: [AWS Bedrock Extended Thinking docs](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-extended-thinking.html), [Nova Premier model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-premier.html)

### NFR-2: GPU 지원

| 항목 | 결정 |
|------|------|
| **정책** | GPU 선택적 — GPU 있으면 CUDA 사용, 없으면 CPU fallback |
| **Docker 이미지** | NVIDIA CUDA 베이스 이미지 + CPU fallback 로직 |
| **YOLOv8** | `ultralytics` 패키지 — 자동 디바이스 감지 |

### NFR-3: 저장소

| 항목 | 결정 |
|------|------|
| **중간 결과** | 로컬 `/tmp` (프레임 이미지, 임시 JSON) |
| **최종 결과** | S3 (분석 결과 JSON, 과실비율 JSON, 구조화된 output JSON) |

### NFR-4: 판례/법규 데이터 준비

| 항목 | 결정 |
|------|------|
| **데이터 소스** | 웹 리서치 기반 수집 — 도로교통공단 TAAS, 손해보험협회 과실비율 인정기준, 도로교통법 |
| **적재 방식** | 데이터 수집 → 청크 분할 → Titan Embeddings 벡터화 → OpenSearch Serverless 적재 |
| **시드 스크립트** | Docker 이미지에 데이터 적재 스크립트 포함 (초기 셋업 시 실행) |

> 리서치 결과: 공공데이터포털(data.go.kr)에서 도로교통공단 TAAS 교통사고 정보 API가 제공됩니다. 손해보험협회의 과실비율 인정기준표는 공개 문서로 존재합니다. 이를 기반으로 샘플 데이터를 구성하여 OpenSearch에 적재하는 방식을 채택합니다.
> Sources: [TAAS 교통사고분석시스템](http://taas.koroad.or.kr), [공공데이터포털](https://data.go.kr)

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.11+ |
| API Framework | FastAPI |
| Video Processing | FFmpeg, OpenCV |
| Object Detection | YOLOv8 (ultralytics) |
| Object Tracking | ByteTrack |
| LLM | AWS Bedrock — Claude Sonnet 4 (Extended Thinking) |
| Embeddings | AWS Bedrock — Titan Embeddings |
| Vector DB | Amazon OpenSearch Serverless |
| Storage | AWS S3 |
| Container | Docker + docker-compose |
| AWS SDK | boto3 (bedrock-runtime, s3, opensearch) |

---

## Container Architecture

```
+------------------+         +------------------------+
|   api-server     |         |    video-worker        |
|   (FastAPI)      |         |    (Batch Processor)   |
+------------------+         +------------------------+
| - POST /analyze  |  HTTP   | - FFmpeg               |
| - GET /status    |-------->| - YOLOv8 + ByteTrack   |
| - GET /result    |         | - Bedrock (LLM + RAG)  |
+------------------+         | - OpenSearch Client     |
        |                    +------------------------+
        |                             |
        v                             v
   +----------+                 +----------+
   |    S3    |<----------------|    S3    |
   +----------+                 +----------+
```

**통신 방식**: api-server → video-worker 호출 (HTTP 또는 docker-compose 내부 네트워크)

---

## Constraints

1. 모든 모듈은 로컬 Docker 컨테이너로 실행 (docker-compose 기반)
2. AWS 인증은 `credentials.env` 파일로 환경변수 주입
3. Python 기반 서비스
4. 분석 결과는 AI 추정치이며 법적 효력 없음 명시

---

## Out of Scope (이번 구현 제외)

- Requirement 1 (영상 업로드 UI)
- Requirement 5-7 (문철어 번역, 음성 생성, 릴스 제작)
- Requirement 8 (파이프라인 상태 관리 UI)
- Requirement 9 (법적 면책 고지 UI)
- 3D 재구성
