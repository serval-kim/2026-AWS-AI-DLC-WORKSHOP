# Business Rules

## BR-1: Video Analysis Rules

### BR-1.0: Input Video Assumptions
블랙박스 영상 분석의 전제 조건:

**촬영 시점**:
- 전방 블랙박스 영상 (운전자 시점, 전방 도로 촬영)
- 고정 카메라 위치 (차량 대시보드/룸미러 부착)
- **자차(블랙박스 장착 차량)는 영상에 보이지 않지만, 카메라 위치 = 자차 위치**
- 자차는 항상 사고 당사자 중 하나로 간주 (vehicle_id = 0, "ego vehicle")
- 자차의 이동은 영상 내 배경/객체의 상대적 움직임으로 추정

**영상 품질**:
- 최소 해상도: 144p (256x144) — 정확도 저하 허용, 저해상도 블랙박스 지원
- 권장 해상도: 720p (1280x720) 이상 — 최적 탐지 정확도
- 프레임레이트: 원본 15 FPS 이상 (추출은 2 FPS)
- 주간 촬영 기준 (야간/저조도는 탐지 정확도 저하 가능)
- 심한 역광/안개/폭우 시 탐지 정확도 보장 불가

**촬영 각도**:
- 수평 시야각: 약 120~170도 (일반 블랙박스 화각)
- 카메라 높이: 차량 전면 유리 상단 (약 1.2~1.5m)
- 전방 도로면이 영상의 하단 1/3~1/2 차지

**사고 장면 요구사항**:
- 사고 관련 차량이 최소 1대 이상 영상에 포착
- 충돌 전후 최소 5초 이상의 영상 존재
- 사고 차량이 프레임 내에서 식별 가능한 크기 (최소 50x50 픽셀)

**제한 사항 (분석 정확도 저하)**:
- 후방/측면 블랙박스 영상 → 전방 기준 분류 규칙 부적합
- 360도 카메라 영상 → 왜곡 보정 미지원
- CCTV/고정 카메라 영상 → 시점 차이로 궤적 분석 부정확
- 편집/합성된 영상 → 타임스탬프 불일치 가능

### BR-1.1: Frame Extraction
- 추출 비율: 2 FPS (초당 2프레임)
- 지원 형식: MP4, AVI, MOV
- 최대 파일 크기: 500MB
- 프레임 추출 실패 시: `CORRUPTED_VIDEO` 에러, 파이프라인 중단

### BR-1.2: Object Detection
- 탐지 대상: 차량(car, truck, bus, motorcycle), 차선(lane), 신호등(traffic_light)
- 최소 신뢰도 임계값: 0.5 (50% 이상만 유효 탐지로 간주)
- 바운딩 박스: 정규화 좌표 (0.0~1.0) 또는 픽셀 좌표
- 차량 미탐지 판정: 전체 프레임의 80% 이상에서 차량 0대 → `NO_VEHICLE` 에러

### BR-1.3: Vehicle Tracking
- 추적 알고리즘: ByteTrack
- 동일 차량 매칭 기준: IoU (Intersection over Union) ≥ 0.3
- 최소 추적 길이: 5프레임 이상 연속 탐지된 차량만 유효 궤적으로 간주
- 궤적 데이터: 프레임별 중심점 좌표 + 바운딩 박스

### BR-1.4: Accident Classification
- **자차(ego vehicle) 개념**:
  - 블랙박스 장착 차량 = 카메라 위치 = 항상 사고 당사자 중 하나
  - vehicle_id = 0은 항상 자차 (영상에 보이지 않지만 물리적으로 존재)
  - 자차 위치: 영상 하단 중앙 고정 (카메라 마운트 위치 기준)
  - 자차 이동: 배경/상대 차량의 상대적 움직임으로 추정
  - 자차는 YOLOv8 탐지 대상이 아님 — 암묵적 존재로 처리
- 분류 기준 (규칙 기반, 자차 포함):
  - **추돌 (rear_end)**: 자차→상대 또는 상대→자차 접근 + 거리 급감
  - **끼어들기 (lane_change)**: 상대 차량 차선 변경 중 자차와 근접 또는 그 반대
  - **신호위반 (signal_violation)**: 적색 신호 상태에서 교차로 진입 (자차 또는 상대)
  - **교차로 (intersection)**: 교차로 영역 내 자차와 상대 차량 궤적 교차
  - **정면충돌 (head_on)**: 상대 차량이 자차 방향으로 역주행 접근
  - **측면충돌 (side_collision)**: 수직 방향 접근 + 거리 급감
- 복수 규칙 매칭 시: confidence 높은 것 선택
- 분류 불가 시: `UNKNOWN` 타입, confidence = 0.0

---

## BR-2: Fault Analysis Rules

### BR-2.1: RAG Search
- 검색 쿼리 구성: 사고 유형 + 차량 행동 요약 텍스트를 임베딩
- 검색 결과 수: top-k = 5 (상위 5개 관련 법규/판례)
- 최소 유사도 점수: 0.7 이상만 컨텍스트에 포함
- 검색 실패 시: RAG 없이 LLM 분석 시도 (Partial Result)

### BR-2.2: Fault Ratio Calculation
- 과실비율 합계: 항상 100% (모든 관련 차량의 비율 합)
- 최소 2대 이상의 차량이 관련되어야 과실비율 산출 가능
- 단독 사고 시: 해당 차량 100%
- 판단 불가 조건:
  - 사고 유형이 UNKNOWN이고 차량 궤적 데이터 불충분
  - LLM 응답이 구조화된 형식을 따르지 않는 경우

### BR-2.3: Disclaimer
- 모든 과실비율 결과에 면책 문구 필수 포함
- 면책 문구: "본 분석은 AI 추정치이며 법적 효력이 없습니다. 정확한 과실비율 판단은 전문가 상담을 권장합니다."

---

## BR-3: Structured Analysis Rules

### BR-3.1: Three-Part Structure
- **도입부 (intro)**: 사고 상황 요약 (1-2문장), 사고 유형, 관련 차량 수, 타임스탬프
- **분석부 (analysis)**: 운전자별 행동 분석, 각 과실 포인트, 위반 법규, 타임스탬프
- **결론부 (conclusion)**: 최종 과실비율, 법적 근거 요약, 면책 문구, 타임스탬프

### BR-3.2: Timestamp Mapping
- 각 구간의 타임스탬프는 원본 영상의 시간(초)으로 표현
- 도입부: 사고 발생 전후 구간 (collision_timestamp ± 5초)
- 분석부: 각 운전자 행동이 발생한 시간 구간
- 결론부: 전체 영상 구간

### BR-3.3: JSON Schema Enforcement
- 출력은 반드시 정의된 JSON Schema를 준수
- 각 구간(intro/analysis/conclusion)은 독립적으로 참조 가능
- 필수 필드 누락 시 LLM 재호출 (최대 2회)

---

## BR-4: Pipeline Orchestration Rules

### BR-4.1: Partial Result Strategy
- 각 단계는 독립적으로 실행 가능
- 이전 단계 실패 시 판단 기준:
  - 프레임 추출 실패 → 전체 중단 (recoverable = false)
  - 객체 탐지 실패 → 프레임 데이터만 저장 (recoverable = true)
  - 차량 추적 실패 → 탐지 결과까지 저장 (recoverable = true)
  - 사고 분류 실패 → 추적 결과까지 저장 (recoverable = true)
  - RAG 검색 실패 → RAG 없이 LLM 시도 (recoverable = true)
  - LLM 호출 실패 → 영상 분석 결과까지 저장 (recoverable = true)
  - 스크립트 생성 실패 → 과실비율 결과까지 저장 (recoverable = true)

### BR-4.2: Status Transitions
```
PENDING → PROCESSING → COMPLETED (전체 성공)
PENDING → PROCESSING → PARTIAL (일부 성공)
PENDING → PROCESSING → FAILED (치명적 실패)
```

### BR-4.3: Callback Rules
- 파이프라인 완료(성공/부분/실패) 시 반드시 콜백 전송
- 콜백 실패 시: 3회 재시도 (exponential backoff)
- 콜백 데이터: `{job_id, status, result_keys, errors}`

---

## BR-5: Data Ingestion Rules

### BR-5.1: Document Chunking
- 청크 크기: 500~1000 토큰
- 오버랩: 100 토큰 (문맥 유지)
- 메타데이터 보존: 출처(법규/판례), 조항 번호, 카테고리

### BR-5.2: Embedding
- 모델: Titan Embeddings (AWS Bedrock)
- 벡터 차원: 모델 기본값 (1536)
- 배치 크기: 25개 텍스트/요청

### BR-5.3: OpenSearch Index
- 인덱스명: `legal-references`
- 검색 알고리즘: k-NN (코사인 유사도)
- 필드: vector, text, source, category, metadata
