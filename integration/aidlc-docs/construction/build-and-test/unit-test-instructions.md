# Unit Test Execution — U6

## Run Unit Tests

### 1. Execute All Unit Tests

```bash
# Workspace root에서 실행
.venv/bin/python -m pytest integration/tests/ -v --tb=short
```

### 2. Execute PBT Tests Only

```bash
.venv/bin/python -m pytest integration/tests/test_pbt_adapter.py -v
```

### 3. Execute Example-Based Tests Only

```bash
.venv/bin/python -m pytest integration/tests/test_serval_runner.py -v
```

### 4. Run with Seed for Reproducibility (PBT-08)

```bash
# 특정 seed로 재현
.venv/bin/python -m pytest integration/tests/test_pbt_adapter.py -v --hypothesis-seed=12345
```

## Expected Results

- **PBT 테스트**: 7 tests pass
  - `test_timestamp_roundtrip` — RT-1
  - `test_structured_analysis_roundtrip` — RT-2
  - `test_fault_ratios_sum_preserved` — INV-1
  - `test_driver_actions_count_preserved` — INV-2
  - `test_accident_type_preserved` — INV-3
  - `test_video_duration_gte_collision` — INV-4
  - `test_adapter_idempotent` — IDEM-1

- **Example-Based 테스트**: 8 tests pass
  - `TestServalAnalysisRunnerSuccess::test_full_pipeline_success`
  - `TestServalAnalysisRunnerSuccess::test_partial_results_tracked`
  - `TestServalAnalysisRunnerFailure::test_video_analysis_failure_non_recoverable`
  - `TestServalAnalysisRunnerFailure::test_fault_analysis_failure_partial`
  - `TestServalAnalysisRunnerFailure::test_fault_undetermined_partial`
  - `TestAdapterExamples::test_basic_conversion`
  - `TestAdapterExamples::test_timestamp_conversion_in_driver_actions`
  - `TestAdapterExamples::test_empty_driver_actions`

- **Total**: 15 tests, 0 failures

### 5. Fix Failing Tests

If PBT tests fail:
1. Note the seed value in the output (Hypothesis prints it on failure)
2. Rerun with `--hypothesis-seed=<seed>` to reproduce
3. Check the shrunk minimal failing input
4. Fix the code issue
5. Rerun to confirm
