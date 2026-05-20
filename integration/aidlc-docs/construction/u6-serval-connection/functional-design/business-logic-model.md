# Business Logic Model — U6: Serval 실제 연결

## 1. 호출 흐름

```
POST /analyze (video_s3_key)
    │
    ▼ BackgroundTasks
run_pipeline(video_s3_key)
    │
    ├─ MOCK_SERVAL=true?  ──▶ _load_mock_script()  (기존 동작, 롤백용)
    │
    ▼ MOCK_SERVAL=false (default)
ServalAnalysisRunner.run(video_s3_key, job_id)
    │
    ├─ Stage 1: VideoAnalyzer.analyze(local_video, job_id)
    │       └─ 영상 다운로드 (S3) → YOLO 탐지 → 차량추적 → 사고분류
    │       └─ Output: VideoAnalysisResult
    │
    ├─ Stage 2: FaultAnalyzer.run(video_analysis)
    │       └─ RAG 검색 (OpenSearch) → LLM 판정 (Bedrock)
    │       └─ Output: FaultResult
    │
    ├─ Stage 3: ScriptGenerator.run(fault_result, video_analysis)
    │       └─ LLM 호출 → 3-part 구조화
    │       └─ Output: StructuredAnalysis
    │
    ▼
structured_analysis_to_pipeline_input(structured_analysis)
    │
    ▼ pipeline_input dict
Ssol mock_pipeline  →  muncheol-script.json
    │
    ▼
Juan pipeline  →  reels.mp4 + tts.mp3
```

## 2. 핵심 변경점

### 2.1 새 클래스: `ServalAnalysisRunner`

**위치**: `integration/adapters/serval_runner.py`

**역할**: Serval의 3-stage pipeline을 integration 컨텍스트에서 실행하는 래퍼. 원본 `AnalysisPipeline`과 다른 점:
- Redis Queue 의존 제거 (직접 호출)
- S3 callback 제거 (inline 결과 반환)
- S3에서 영상 다운로드만 사용

```python
class ServalAnalysisRunner:
    """Integration-scoped Serval pipeline runner (no Redis, no callbacks)."""

    def run(self, video_s3_key: str, job_id: str) -> StructuredAnalysis | None:
        """Run Serval pipeline stages and return StructuredAnalysis."""
        # 1. S3에서 영상 다운로드 → tempfile
        # 2. VideoAnalyzer.analyze(local_path, job_id)
        # 3. FaultAnalyzer.run(video_analysis)
        # 4. ScriptGenerator.run(fault_result, video_analysis)
        # 5. Return StructuredAnalysis (or None if undetermined/failed)
```

### 2.2 수정: `integration/api.py` — `run_pipeline()`

**변경 전**: `analysis_result`이 None이면 `_load_mock_script()` 사용
**변경 후**:
```python
def run_pipeline(video_s3_key: str) -> dict:
    # 1. ServalAnalysisRunner.run(video_s3_key, job_id) → StructuredAnalysis
    # 2. structured_analysis_to_pipeline_input(analysis) → pipeline_input
    # 3. Ssol 호출 → muncheol-script.json
    # 4. Juan 호출 → output files
```

### 2.3 수정: `integration/adapters/serval_to_ssol.py`

**변경 전**: `dict` 입력 (수동 dict 구성 필요)
**변경 후**: `StructuredAnalysis` Pydantic 모델 직접 수용

```python
def structured_analysis_to_pipeline_input(analysis: StructuredAnalysis) -> dict:
    """StructuredAnalysis 모델 → Ssol pipeline 입력 dict."""
```

## 3. Mock/Real 분기 전략

| 환경 변수 | 값 | 동작 |
|-----------|------|------|
| `MOCK_SERVAL` | `true` | mock script 로드 (기존 동작, 빠른 테스트) |
| `MOCK_SERVAL` | `false` (default) | Serval 실제 호출 |
| `MOCK_VIDEO_GEN` | `true` | Juan의 Nova Reel 스킵 (비용 절감) |
| `MOCK_VIDEO_GEN` | `false` | Juan 실제 영상 생성 |

## 4. Testable Properties (PBT-01)

### 4.1 Round-Trip Properties (PBT-02)
| Property | 설명 | 함수 쌍 |
|----------|------|---------|
| RT-1 | 타임스탬프 변환 round-trip | `ts_to_float(float_to_ts(x)) == x` for valid x |
| RT-2 | StructuredAnalysis serialize/deserialize | `StructuredAnalysis.model_validate(sa.model_dump()) == sa` |

### 4.2 Invariant Properties (PBT-03)
| Property | 설명 | 불변식 |
|----------|------|--------|
| INV-1 | Adapter 변환 시 fault_ratios 합 보존 | `sum(input.ratios) == sum(output.fault_ratios)` (=100) |
| INV-2 | Adapter 변환 시 driver_actions 개수 보존 | `len(input.driver_actions) == len(output.driver_actions)` |
| INV-3 | Adapter 변환 시 accident_type 보존 | `input.intro.accident_type == output["accident_type"]` |
| INV-4 | video_duration > collision_timestamp | `output["video_duration"] >= output["collision_timestamp"]` |

### 4.3 Idempotency Properties (PBT-04)
| Property | 설명 |
|----------|------|
| IDEM-1 | Adapter 변환은 순수 함수 → `f(x) == f(x)` 항상 (부작용 없음 확인) |

### 4.4 No Applicable Properties (N/A)
- **PBT-05 (Oracle)**: N/A — 참조 구현 없음
- **PBT-06 (Stateful)**: N/A — 상태 없는 변환 레이어
