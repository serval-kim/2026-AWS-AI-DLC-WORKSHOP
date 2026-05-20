# Domain Entities — U6: Serval 실제 연결

## Entity Map

```
StructuredAnalysis (Serval output)
├── IntroSection
│   ├── summary: str
│   ├── accident_type: str
│   ├── timestamp: TimestampRange {start, end}
│   └── involved_vehicles: int
├── AnalysisSection
│   ├── driver_actions: list[DriverAction]
│   │   ├── vehicle_id: int
│   │   ├── action: str
│   │   ├── fault_point: str
│   │   ├── violated_law: str
│   │   └── timestamp: TimestampRange {start, end}
│   └── timestamp: TimestampRange
└── ConclusionSection
    ├── fault_ratios: list[dict] (vehicle_id, ratio_percent)
    ├── legal_basis: list[str]
    ├── timestamp: TimestampRange
    └── disclaimer: str

            │
            │ structured_analysis_to_pipeline_input()
            ▼

PipelineInput (dict for Ssol)
├── accident_type: str
├── fault_ratios: list[dict]
├── legal_basis: list[str]
├── video_duration: float
├── collision_timestamp: float
├── driver_actions: list[dict]
│   ├── vehicle_id: int
│   ├── action: str
│   ├── fault_point: str
│   ├── violated_law: str
│   └── timestamp: str  (MM:SS format)
└── disclaimer: str
```

## 기존 엔티티 (Serval — 읽기 전용)

| 엔티티 | 위치 | 용도 |
|--------|------|------|
| `StructuredAnalysis` | `ad-hoc/serval/shared/models/analysis.py` | 최종 분석 결과 (3-part) |
| `VideoAnalysisResult` | `ad-hoc/serval/shared/models/video.py` | 영상 분석 중간 결과 |
| `FaultResult` | `ad-hoc/serval/shared/models/fault.py` | 과실 판정 중간 결과 |
| `TimestampRange` | `ad-hoc/serval/shared/models/analysis.py` | 시간 구간 {start, end} |

## 기존 엔티티 (Integration)

| 엔티티 | 위치 | 용도 |
|--------|------|------|
| `jobs` dict (in-memory) | `integration/server.py` | job 상태 저장 |

## 새 엔티티

| 엔티티 | 위치 | 용도 |
|--------|------|------|
| `ServalAnalysisRunner` | `integration/adapters/serval_runner.py` | Pipeline 래퍼 클래스 |

## Import Path 전략

Serval 모듈을 import하기 위해 `sys.path`에 추가해야 하는 경로:

```python
# ad-hoc/serval/ → shared, worker 접근
sys.path.insert(0, str(BASE_DIR / "ad-hoc" / "serval"))

# ad-hoc/andy/accident-rag/src/ → accident_rag 패키지 (FaultAnalyzer가 사용)
sys.path.insert(0, str(BASE_DIR / "ad-hoc" / "andy" / "accident-rag" / "src"))
```

## 데이터 흐름 타입

```
video_s3_key (str)
    → local_video_path (str, tempfile)
    → VideoAnalysisResult (Pydantic)
    → FaultResult (Pydantic)
    → StructuredAnalysis (Pydantic)
    → pipeline_input (dict)
    → muncheol_script (dict, JSON)
    → output files (mp4, mp3)
```
