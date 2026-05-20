# Domain Entities — shared

## Core Entities

### AnalysisJob
분석 작업의 생명주기를 나타내는 핵심 엔티티.

```python
class JobStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"

class AnalysisJob:
    job_id: str              # UUID
    video_s3_key: str        # 입력 영상 S3 경로
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    callback_url: str        # api-server 콜백 URL
    current_stage: str       # 현재 처리 단계
    errors: list[StageError] # 단계별 에러 목록
    result_keys: ResultKeys  # S3 결과 파일 경로들
```

### ResultKeys
각 단계의 S3 결과 파일 경로.

```python
class ResultKeys:
    video_analysis: str | None    # results/{job_id}/video_analysis.json
    fault_result: str | None      # results/{job_id}/fault_result.json
    structured_analysis: str | None  # results/{job_id}/structured_analysis.json
```

### StageError
파이프라인 단계별 에러 정보.

```python
class StageError:
    stage: str          # "video_analysis", "fault_analysis", "script_generation"
    error_type: str     # "NO_VEHICLE", "CORRUPTED_VIDEO", "LLM_FAILURE" 등
    message: str
    timestamp: datetime
    recoverable: bool   # Partial Result에서 계속 진행 가능 여부
```

---

## Video Analysis Entities

### FrameData
추출된 프레임 정보.

```python
class FrameData:
    frame_id: int
    timestamp: float      # 영상 내 시간 (초)
    image_path: str       # 로컬 임시 파일 경로
```

### BoundingBox
객체 탐지 바운딩 박스.

```python
class BoundingBox:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float     # 0.0 ~ 1.0
    class_name: str       # "car", "truck", "lane", "traffic_light"
    class_id: int
```

### DetectionResult
단일 프레임의 탐지 결과.

```python
class DetectionResult:
    frame_id: int
    timestamp: float
    objects: list[BoundingBox]
```

### VehicleTrack
프레임 간 추적된 차량 궤적.

```python
class TrackPoint:
    frame_id: int
    timestamp: float
    bbox: BoundingBox
    center_x: float
    center_y: float

class VehicleTrack:
    vehicle_id: int
    track_points: list[TrackPoint]
    first_seen: float     # 최초 등장 시간
    last_seen: float      # 마지막 등장 시간
```

### TrafficLightState
신호등 상태 정보.

```python
class TrafficLightState:
    frame_id: int
    timestamp: float
    state: str            # "red", "yellow", "green", "unknown"
    confidence: float
    bbox: BoundingBox
```

### AccidentClassification
사고 유형 분류 결과.

```python
class AccidentType(str, Enum):
    REAR_END = "rear_end"           # 추돌
    LANE_CHANGE = "lane_change"     # 끼어들기
    SIGNAL_VIOLATION = "signal_violation"  # 신호위반
    INTERSECTION = "intersection"   # 교차로 사고
    HEAD_ON = "head_on"             # 정면충돌
    SIDE_COLLISION = "side_collision"  # 측면충돌
    UNKNOWN = "unknown"

class AccidentClassification:
    accident_type: AccidentType
    confidence: float
    involved_vehicles: list[int]    # vehicle_id 목록
    collision_timestamp: float      # 충돌 추정 시간
    details: str                    # 분류 근거 설명
```

### VideoAnalysisResult
영상 분석 전체 결과 (Req 2 output).

```python
class VideoAnalysisResult:
    job_id: str
    video_duration: float
    total_frames: int
    fps_extracted: int
    detections: list[DetectionResult]
    vehicle_tracks: list[VehicleTrack]
    traffic_lights: list[TrafficLightState]
    accident: AccidentClassification
    metadata: VideoMetadata
```

### VideoMetadata
영상 메타데이터.

```python
class VideoMetadata:
    duration: float
    width: int
    height: int
    fps: float
    codec: str
```

---

## Fault Analysis Entities

### LegalReference
RAG 검색으로 찾은 법규/판례 참조.

```python
class LegalReference:
    text: str             # 법규/판례 원문 텍스트
    source: str           # "도로교통법 제XX조" 또는 "판례 XXXX-XXXX"
    relevance_score: float  # 유사도 점수
    category: str         # "law", "precedent"
```

### FaultRatio
개별 차량의 과실비율.

```python
class FaultRatio:
    vehicle_id: int
    ratio_percent: int    # 0-100, 전체 합 = 100
    key_faults: list[str] # 핵심 과실 행위 목록
    violated_laws: list[str]  # 위반 법규 목록
```

### FaultResult
과실비율 판단 전체 결과 (Req 3 output).

```python
class FaultResult:
    job_id: str
    ratios: list[FaultRatio]
    reasoning: str        # 판단 근거 텍스트
    references: list[LegalReference]  # 참조된 법규/판례
    disclaimer: str       # "AI 추정치이며 법적 효력 없음"
    confidence: float     # 판단 신뢰도
    undetermined: bool    # 판단 불가 여부
    undetermined_reason: str | None  # 판단 불가 사유
```

---

## Structured Analysis Entities

### AnalysisSection
3단 구조의 개별 구간.

```python
class TimestampRange:
    start: float          # 시작 시간 (초)
    end: float            # 종료 시간 (초)

class DriverAction:
    vehicle_id: int
    action: str           # 행동 설명
    fault_point: str      # 과실 포인트
    violated_law: str     # 위반 법규
    timestamp: TimestampRange

class IntroSection:
    summary: str          # 사고 상황 요약
    accident_type: str
    timestamp: TimestampRange
    involved_vehicles: int

class AnalysisSection:
    driver_actions: list[DriverAction]
    timestamp: TimestampRange

class ConclusionSection:
    fault_ratios: list[FaultRatio]
    legal_basis: list[str]
    timestamp: TimestampRange
    disclaimer: str
```

### StructuredAnalysis
구조화된 분석 결과 전체 (Req 4 output).

```python
class StructuredAnalysis:
    job_id: str
    intro: IntroSection       # 도입부
    analysis: AnalysisSection # 분석부
    conclusion: ConclusionSection  # 결론부
    generated_at: datetime
```
