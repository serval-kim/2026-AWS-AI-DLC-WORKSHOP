# Requirements Document

## Introduction

블랙박스 영상을 업로드하면 AI가 사고 상황을 분석하여 과실비율을 판단하고, 한문철 변호사 스타일의 숏폼 릴스 영상을 자동 생성하는 시뮬레이터. MVP 범위에서는 3D 재구성을 제외하고, 핵심 파이프라인인 "영상 분석 → 과실비율 산출 → 스크립트 생성 → 한문철 스타일 릴스 출력"에 집중한다. 본 시스템의 분석 결과는 AI 추정치이며 법적 효력이 없음을 명시한다.

## Implementation Constraints

- **실행 환경**: 모든 모듈은 로컬 Docker 컨테이너로 실행한다 (docker-compose 기반)
- **AWS 인증**: `credentials.env` 파일에 AWS credential을 정의하고, Docker 컨테이너에 환경변수로 주입한다
- **AWS 서비스**: Bedrock (LLM, Embedding), S3 등 필요한 AWS 서비스는 해당 credential로 접근 가능하다
- **LLM**: AWS Bedrock (boto3 bedrock-runtime 사용)
- **언어/프레임워크**: Python 기반 서비스

## Glossary

- **Simulator**: 블랙박스 사고 분석 및 릴스 생성 시스템 전체
- **Video_Uploader**: 사용자가 블랙박스 영상을 업로드하는 모듈
- **Video_Analyzer**: 업로드된 영상에서 프레임을 추출하고 객체(차량, 차선, 신호등)를 탐지하여 사고 상황 데이터를 생성하는 모듈
- **Fault_Analyzer**: 도로교통법 및 판례 RAG와 Claude 모델을 활용하여 과실비율을 판단하는 모듈
- **Script_Generator**: 과실비율 분석 결과를 기반으로 상황 설명 스크립트를 생성하는 모듈
- **Muncheol_Translator**: 분석 스크립트를 한문철 변호사 스타일 화법(문철어)으로 번역하는 모듈
- **Voice_Generator**: 문철어 스크립트를 한문철 스타일 음성(MP3)으로 변환하는 TTS 모듈
- **Reels_Composer**: 원본 영상 클립과 나레이션 음성(MP3)을 결합하여 최종 릴스를 생성하는 모듈
- **문철어**: 한문철 변호사의 화법 특징(직설적 표현, "이건 7:3입니다" 등 판결 선고 톤, 감탄사, 운전자 호칭)을 반영한 말투
- **RAG**: Retrieval-Augmented Generation. 도로교통법 조항 및 교통사고 판례 데이터베이스에서 관련 정보를 검색하여 LLM 응답에 활용하는 기법
- **릴스**: 세로형(9:16) 비율의 60초 이내 숏폼 영상

## Requirements

### Requirement 1: 영상 업로드

**User Story:** 사용자로서, 블랙박스 영상을 업로드하여 사고 분석을 시작할 수 있다.

#### Acceptance Criteria

1. THE Video_Uploader SHALL MP4, AVI, MOV 형식의 영상 파일 업로드를 지원한다
2. WHEN 영상 파일이 업로드되면, THE Video_Uploader SHALL 해당 파일을 S3에 저장하고 고유 분석 ID를 반환한다
3. IF 지원하지 않는 파일 형식이 업로드되면, THEN THE Video_Uploader SHALL 지원 형식 목록과 함께 오류 메시지를 반환한다
4. IF 파일 크기가 500MB를 초과하면, THEN THE Video_Uploader SHALL 파일 크기 제한 초과 오류를 반환한다
5. WHILE 영상이 업로드 중인 동안, THE Video_Uploader SHALL 업로드 진행률을 백분율로 표시한다

### Requirement 2: 영상 분석

**User Story:** 시스템으로서, 업로드된 영상에서 사고 관련 객체와 상황 정보를 추출하여 과실비율 판단에 필요한 데이터를 생성할 수 있다.

#### Acceptance Criteria

1. WHEN 영상 업로드가 완료되면, THE Video_Analyzer SHALL 영상에서 초당 2프레임(2 FPS) 비율로 키프레임을 추출한다
2. WHEN 키프레임이 추출되면, THE Video_Analyzer SHALL 각 프레임에서 차량, 차선, 신호등 객체를 탐지하고 바운딩 박스 좌표와 신뢰도 점수를 생성한다
3. THE Video_Analyzer SHALL 프레임 간 동일 차량을 매칭하여 각 차량의 이동 궤적 데이터를 생성한다
4. WHEN 영상 분석이 완료되면, THE Video_Analyzer SHALL 사고 유형(추돌, 끼어들기, 신호위반 등)을 분류한다
5. IF 영상에서 차량이 탐지되지 않으면, THEN THE Video_Analyzer SHALL 차량 미탐지 오류를 반환하고 분석을 중단한다
6. IF 영상 파일이 손상되어 프레임 추출이 불가능하면, THEN THE Video_Analyzer SHALL 영상 손상 오류를 반환한다

#### Implementation Spec

- **프레임 추출**: FFmpeg (Docker 이미지 내 설치)
- **객체 탐지**: YOLOv8 모델 (ultralytics, GPU/CPU 추론)
- **차량 추적**: ByteTrack 또는 SORT 알고리즘으로 프레임 간 차량 ID 매칭
- **사고 유형 분류**: 탐지된 궤적 데이터를 기반으로 규칙 기반 분류 로직
- **입출력**: S3에서 영상 다운로드 → 분석 결과 JSON을 S3에 저장

### Requirement 3: 과실비율 판단

**User Story:** 사용자로서, AI 기반 과실비율 분석 결과를 확인하여 사고 책임 소재를 파악할 수 있다.

#### Acceptance Criteria

1. WHEN 영상 분석 데이터(차량 궤적, 신호등 상태, 차선 정보, 사고 유형)가 준비되면, THE Fault_Analyzer SHALL 도로교통법 및 판례 데이터베이스(RAG)에서 관련 법규와 유사 판례를 검색한다
2. THE Fault_Analyzer SHALL Claude 모델을 사용하여 각 차량의 과실비율을 백분율로 산출한다
3. THE Fault_Analyzer SHALL 과실비율 판단 근거를 관련 법규 조항 및 유사 판례와 함께 텍스트로 제공한다
4. THE Fault_Analyzer SHALL 분석 결과에 "AI 추정치이며 법적 효력 없음" 면책 문구를 포함한다
5. IF 사고 유형 판별이 불가능하면, THEN THE Fault_Analyzer SHALL 판단 불가 사유를 명시하고 수동 검토를 권고한다

#### Implementation Spec

- **RAG 벡터 DB**: Amazon OpenSearch Serverless 또는 로컬 ChromaDB (Docker)
- **임베딩 모델**: AWS Bedrock - Titan Embeddings
- **판례/법규 데이터**: 도로교통법 조항 및 교통사고 판례를 청크 단위로 벡터화하여 DB에 적재
- **프롬프트 구성**: 영상 분석 JSON + RAG 검색 결과를 컨텍스트로 Claude에 전달, 과실비율 및 근거를 구조화된 JSON으로 응답 요청

### Requirement 4: 구조화된 사고 분석 결과 생성

**User Story:** 시스템으로서, 과실비율 분석 결과를 구조화된 데이터로 정리하여 후속 모듈(나레이션 스크립트, 릴스 편집)에서 활용할 수 있는 분석 output을 생성할 수 있다.

#### Acceptance Criteria

1. WHEN 과실비율 판단이 완료되면, THE Script_Generator SHALL 사고 상황 요약, 개별 운전자별 행동 분석, 사고 타임라인, 과실비율 및 판단 근거를 포함한 구조화된 분석 결과를 생성한다
2. THE Script_Generator SHALL 분석 결과를 도입부(사고 상황 요약), 분석부(운전자별 행동 분석 및 과실 포인트), 결론부(과실비율 및 법적 근거) 3단 구조로 구성한다
3. THE Script_Generator SHALL 분석 결과의 각 구간에 대응하는 원본 영상 타임스탬프(시작/종료 시간)를 포함한다
4. THE Script_Generator SHALL 각 운전자의 핵심 과실 행위와 해당 법규 위반 사항을 개별 항목으로 분리하여 출력한다
5. THE Script_Generator SHALL 분석 결과를 JSON 형식으로 출력하며, 각 구간(도입부/분석부/결론부)이 독립적으로 참조 가능한 구조로 제공한다

#### Implementation Spec

- **입력**: Req 3의 과실비율 판단 결과 JSON + 영상 분석 메타데이터(타임스탬프, 차량 궤적)
- **프롬프트 구성**: 과실비율 결과와 영상 타임라인을 기반으로 3단 구조(도입부/분석부/결론부) JSON 생성을 요청
- **출력 포맷**: JSON Schema로 응답 구조를 강제 (structured output)

### Requirement 5: 문철어 번역

**User Story:** 시스템으로서, 분석 스크립트를 한문철 변호사 스타일 화법으로 번역하여 릴스의 엔터테인먼트 가치를 높일 수 있다.

#### Acceptance Criteria

1. WHEN 분석 스크립트가 생성되면, THE Muncheol_Translator SHALL 스크립트를 한문철 변호사의 화법 특징(직설적 표현, 운전자 호칭, 감탄사, 판결 선고 톤)으로 번역한다
2. THE Muncheol_Translator SHALL 번역된 스크립트에서 핵심 포인트(사고 원인, 과실 판정 순간)를 강조 표시한다
3. THE Muncheol_Translator SHALL 원본 스크립트의 3단 구조(도입부, 분석부, 결론부)와 타임스탬프 매핑을 유지한다
4. THE Muncheol_Translator SHALL 번역된 스크립트의 나레이션 분량을 60초 이내로 유지한다

### Requirement 6: 나레이션 음성 생성

**User Story:** 시스템으로서, 문철어 스크립트를 한문철 스타일 음성으로 변환하여 릴스 나레이션에 사용할 MP3 파일을 생성할 수 있다.

#### Acceptance Criteria

1. WHEN 문철어 번역이 완료되면, THE Voice_Generator SHALL 번역된 스크립트를 TTS(Text-to-Speech)를 통해 단일 MP3 음성 파일로 생성한다
2. THE Voice_Generator SHALL 한문철 변호사의 음성 톤(직설적, 단호한 어조)을 반영한 음성을 생성한다
3. THE Voice_Generator SHALL 스크립트의 강조 포인트에서 억양 및 속도 변화를 적용한다
4. THE Voice_Generator SHALL 생성된 MP3 파일을 S3에 저장하고 파일 URL을 반환한다
5. THE Voice_Generator SHALL 음성 길이를 60초 이내로 제한한다
6. IF TTS 변환에 실패하면, THEN THE Voice_Generator SHALL 오류 사유를 반환하고 재시도 옵션을 제공한다

### Requirement 7: 릴스 영상 제작

**User Story:** 사용자로서, 한문철 스타일 나레이션과 함께 사고를 설명하는 릴스를 자동으로 생성하여 다운로드할 수 있다.

#### Acceptance Criteria

1. WHEN 나레이션 MP3 파일이 준비되면, THE Reels_Composer SHALL 스크립트 타임스탬프에 맞춰 원본 영상 구간과 나레이션 음성을 배치하여 릴스를 구성한다
2. THE Reels_Composer SHALL 도입부에 원본 영상의 사고 장면을 배치한다
3. THE Reels_Composer SHALL 분석부에 원본 영상 하이라이트와 나레이션 음성을 교차 배치한다
4. THE Reels_Composer SHALL 결론부에 과실비율 그래픽과 판결 나레이션을 배치한다
5. THE Reels_Composer SHALL 나레이션 내용을 자막으로 영상에 포함한다
6. THE Reels_Composer SHALL 최종 릴스를 세로형(9:16) 비율, 60초 이내, MP4 형식으로 생성한다
7. WHEN 릴스 생성이 완료되면, THE Reels_Composer SHALL 릴스 영상의 다운로드 URL을 반환한다

### Requirement 8: 파이프라인 상태 관리

**User Story:** 사용자로서, 분석 진행 상태를 실시간으로 확인하여 처리 완료 시점을 파악할 수 있다.

#### Acceptance Criteria

1. WHILE 분석 파이프라인이 실행 중인 동안, THE Simulator SHALL 현재 처리 단계(업로드 → 영상 분석 → 과실비율 판단 → 스크립트 생성 → 음성 생성 → 릴스 제작)를 표시한다
2. WHILE 각 단계가 처리 중인 동안, THE Simulator SHALL 해당 단계의 진행률을 백분율로 표시한다
3. IF 파이프라인 처리 중 오류가 발생하면, THEN THE Simulator SHALL 오류가 발생한 단계와 오류 내용을 사용자에게 표시하고 재시도 옵션을 제공한다
4. WHEN 전체 파이프라인이 완료되면, THE Simulator SHALL 결과 화면에 과실비율 요약, 릴스 미리보기, 다운로드 링크를 표시한다

### Requirement 9: 법적 면책 고지

**User Story:** 사용자로서, 분석 결과의 법적 한계를 명확히 인지하여 적절한 용도로 활용할 수 있다.

#### Acceptance Criteria

1. THE Simulator SHALL 분석 결과 화면에 "본 분석은 AI 추정치이며 법적 효력이 없습니다" 면책 문구를 표시한다
2. THE Simulator SHALL 릴스 영상 내에 "AI 분석 결과 - 참고용" 워터마크를 포함한다
3. WHEN 사용자가 분석을 시작하기 전에, THE Simulator SHALL 면책 조항 동의를 요청한다

---

## Deployment Strategy (배포 전략)

### 배포 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AWS Cloud (us-east-1)                       │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │ CloudFront   │───▶│ S3 (Static)  │    │ ECR                   │  │
│  │ (프론트엔드)  │    │ React SPA    │    │ api-server / worker   │  │
│  └──────────────┘    └──────────────┘    └───────────────────────┘  │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │ ALB          │───▶│ ECS Fargate  │───▶│ ElastiCache Redis     │  │
│  │ (API 라우팅)  │    │ api-server   │    │ (작업 큐)             │  │
│  └──────────────┘    └──────────────┘    └───────────┬───────────┘  │
│                                                      │              │
│  ┌──────────────┐    ┌──────────────┐               ▼              │
│  │ OpenSearch   │◀───│ EC2 (GPU)    │◀── RQ Worker 소비            │
│  │ (법률 RAG)   │    │ worker       │                              │
│  └──────────────┘    │ YOLOv8+추론  │    ┌───────────────────────┐  │
│                      └──────────────┘    │ S3 (데이터)            │  │
│  ┌──────────────┐                        │ 영상, 결과 JSON,       │  │
│  │ Bedrock      │                        │ 릴스 MP4              │  │
│  │ Titan/Claude │                        └───────────────────────┘  │
│  │ Nova Reel    │                                                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 컴포넌트별 배포 구성

| 컴포넌트 | 서비스 | 사양 | 배포 방식 |
|----------|--------|------|-----------|
| 프론트엔드 (blackbox-analyzer) | S3 + CloudFront | 정적 호스팅 | `vite build` → S3 sync |
| API 서버 (integration + serval/api) | ECS Fargate | 0.5 vCPU / 1GB | Blue/Green |
| 분석 워커 (serval/worker) | EC2 `g5.xlarge` | GPU (YOLOv8 추론) | Rolling (Docker) |
| 릴스 생성 (juan) | ECS Fargate | 1 vCPU / 2GB | Rolling |
| 작업 큐 | ElastiCache Redis | `cache.t3.micro` | 관리형 |
| 벡터 DB | OpenSearch 관리형 | 기존 도메인 유지 | — |
| 시크릿 | Secrets Manager | credentials.env 대체 | 컨테이너 환경변수 주입 |

### CI/CD 파이프라인

```
PR 생성 → Lint + Unit Test → Docker Build → ECR Push
                                                │
Main Merge ─────────────────────────────────────┘
    │
    ├─ api-server: ECS Blue/Green Deploy
    ├─ worker: EC2 Docker Pull + Restart
    └─ frontend: S3 Sync + CloudFront Invalidation
```

- **도구**: GitHub Actions
- **테스트 게이트**: Unit Test + PBT 전체 통과 필수
- **롤백**: ECS 이전 태스크 정의로 즉시 롤백 가능

### 스케일링 전략

| 대상 | 트리거 | 액션 |
|------|--------|------|
| API 서버 | 요청 수 > 100 req/s | Fargate 태스크 수 증가 (1→3) |
| GPU 워커 | Redis 큐 깊이 > 5 | EC2 인스턴스 추가 (Spot) |
| GPU 워커 | 큐 비어있음 10분 | 인스턴스 중지 (비용 절감) |

### 비용 최적화

- **GPU 워커**: Spot Instance 활용 (g5.xlarge on-demand $1.006/h → Spot ~$0.35/h)
- **Nova Reel**: Parallel 모드로 샷 동시 생성 (대기 시간 90초/샷 → 90초/씬)
- **S3**: 임시 분석 파일 7일 후 자동 삭제 (라이프사이클 정책)
- **OpenSearch**: 사용량 낮으면 Serverless 전환 검토

### 모니터링

| 영역 | 구현 | 알람 조건 |
|------|------|-----------|
| 로그 | structlog JSON → CloudWatch Logs | 에러율 > 5% |
| 큐 상태 | Redis INFO → CloudWatch Custom Metric | 큐 적체 > 10건 |
| 분석 시간 | job 시작~완료 타임스탬프 | 소요 시간 > 5분 |
| 워커 상태 | ECS/EC2 헬스체크 | 연속 실패 3회 |
| Bedrock | boto3 ClientError 카운트 | throttling > 10회/분 |

### 시크릿 관리

현재 `credentials.env` 파일 기반 → 프로덕션에서는 AWS Secrets Manager로 전환:

| 시크릿 | 현재 | 프로덕션 |
|--------|------|----------|
| AWS 자격증명 | 환경변수 파일 | ECS Task Role (IAM) |
| OpenSearch 비밀번호 | `.env` 파일 | Secrets Manager |
| S3 버킷명 | 하드코딩 | SSM Parameter Store |
