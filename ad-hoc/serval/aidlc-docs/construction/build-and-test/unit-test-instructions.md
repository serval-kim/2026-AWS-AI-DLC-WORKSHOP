# Unit Test Execution

## Run All Unit Tests

```bash
# venv 활성화
source .venv/bin/activate

# 전체 테스트 실행
pytest tests/ -v --tb=short

# 단위 테스트만
pytest tests/unit/ -v

# PBT 테스트만
pytest tests/property/ -v

# 특정 모듈
pytest tests/unit/shared/ -v
```

## Expected Results

- **Total Tests**: 28+
- **Unit Tests**: 18 (models, config)
- **PBT Tests**: 10 (roundtrip, invariants)
- **Expected**: All pass, 0 failures

## Test Coverage

```bash
pip install pytest-cov
pytest tests/ --cov=shared --cov=worker --cov=api --cov-report=term-missing
```

## PBT Seed Logging (PBT-08)

Hypothesis는 실패 시 자동으로 seed를 출력합니다:
```
Falsifying example: test_fault_ratios_sum_to_100(...)
You can reproduce this example by temporarily adding @reproduce_failure(...)
```

CI에서 seed 고정:
```bash
pytest tests/property/ --hypothesis-seed=12345
```

## Fix Failing Tests

1. 테스트 출력에서 실패 원인 확인
2. `--tb=long` 옵션으로 상세 트레이스백 확인
3. PBT 실패 시 shrunk minimal example 확인
4. 코드 수정 후 재실행
