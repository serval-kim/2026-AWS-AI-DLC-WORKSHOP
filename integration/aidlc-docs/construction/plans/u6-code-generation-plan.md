# Code Generation Plan — U6: Serval 실제 연결

## Unit Context
- **Unit**: U6 — Serval AnalysisPipeline 실제 연결
- **Workspace Root**: `/Users/serval.cat/Work/AWS-WORKSHOP/`
- **Target Directory**: `integration/`
- **Project Type**: Brownfield (기존 파일 수정 + 신규 파일 생성)

## Dependencies
- `ad-hoc/serval/` — VideoAnalyzer, FaultAnalyzer, ScriptGenerator (읽기 전용 import)
- `ad-hoc/andy/accident-rag/src/` — accident_rag 패키지 (FaultAnalyzer가 사용)
- `integration/utils.py` — 기존 타임스탬프 변환 함수 (U1 완료)

## Steps

### Step 1: ServalAnalysisRunner 생성
- [x] 파일 생성: `integration/adapters/serval_runner.py`
- [x] ServalAnalysisRunner 클래스: 3-stage pipeline 래퍼
- [x] sys.path 설정 (serval, accident-rag)
- [x] tempfile 관리 (다운로드 영상 정리)
- [x] stage별 에러 처리 (BR-2 규칙 적용)
- [x] structlog 로깅 (SECURITY-03)

### Step 2: Adapter 수정 — StructuredAnalysis 직접 수용
- [x] 파일 수정: `integration/adapters/serval_to_ssol.py`
- [x] 함수 시그니처: `dict` → `StructuredAnalysis` Pydantic 모델
- [x] 기존 dict 기반 접근 → Pydantic attribute 접근으로 변경
- [x] 입력 검증 강화 (SECURITY-05)

### Step 3: API 수정 — run_pipeline에 Serval 호출 연결
- [x] 파일 수정: `integration/api.py`
- [x] MOCK_SERVAL 분기 추가
- [x] ServalAnalysisRunner 호출 → StructuredAnalysis → adapter → Ssol
- [x] Partial Result 처리: status partial/failed 반환
- [x] 에러 응답 sanitize (SECURITY-09)

### Step 4: Server 수정 — /analyze 엔드포인트에 video_s3_key 수용
- [x] 파일 수정: `integration/server.py`
- [x] POST /analyze body에 `video_s3_key` 파라미터 추가
- [x] Pydantic request model 추가 (SECURITY-05)
- [x] BackgroundTasks에 Serval 파이프라인 연결

### Step 5: PBT 테스트 — Round-Trip & Invariant
- [x] 파일 생성: `integration/tests/test_pbt_adapter.py`
- [x] RT-1: `ts_to_float(float_to_ts(x)) == x` (Hypothesis strategy)
- [x] RT-2: `StructuredAnalysis` serialize/deserialize round-trip
- [x] INV-1: fault_ratios 합 보존 (100%)
- [x] INV-2: driver_actions 개수 보존
- [x] INV-3: accident_type 보존
- [x] INV-4: video_duration >= collision_timestamp
- [x] Domain generator: StructuredAnalysis fixture factory (PBT-07)
- [x] Seed-based reproducibility 설정 (PBT-08)

### Step 6: Example-Based 테스트 (PBT-10 보완)
- [x] 파일 생성: `integration/tests/test_serval_runner.py`
- [x] mock으로 ServalAnalysisRunner 단위 테스트
- [x] 성공 케이스: full pipeline → StructuredAnalysis 반환
- [x] 실패 케이스: VideoAnalyzer 실패 → None 반환
- [x] Partial 케이스: FaultResult.undetermined → None 반환

### Step 7: 코드 요약 문서
- [x] 파일 생성: `integration/aidlc-docs/construction/u6-serval-connection/code/code-summary.md`
- [x] 수정 파일 목록 + 신규 파일 목록
- [x] PBT compliance 요약
- [x] Security compliance 요약
