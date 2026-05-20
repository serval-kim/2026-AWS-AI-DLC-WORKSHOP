# Integration Test Instructions — U6

## Purpose
Test the full integration pipeline: Serval → Adapter → Ssol(mock) → Juan(mock).

## Test Scenarios

### Scenario 1: Mock Serval E2E (빠른 검증, AWS 불필요)
- **Description**: Mock StructuredAnalysis로 Adapter → Ssol → Juan 경로 검증
- **Setup**: 없음 (AWS 호출 안 함)
- **Command**:
  ```bash
  .venv/bin/python integration/scripts/test_integration_e2e.py --mock-serval
  ```
- **Expected**: ALL STAGES PASSED
- **소요시간**: ~5초 (Juan mock TTS 포함)

### Scenario 2: Mock Serval, Juan 스킵 (Adapter만 검증)
- **Description**: Adapter 변환만 단독 검증
- **Setup**: 없음
- **Command**:
  ```bash
  .venv/bin/python integration/scripts/test_integration_e2e.py --mock-serval --skip-juan
  ```
- **Expected**: ALL STAGES PASSED (juan: skipped)
- **소요시간**: <1초

### Scenario 3: Real Serval E2E (실제 AWS 사용)
- **Description**: 실제 S3 영상 → Serval 전체 파이프라인 → Adapter → Ssol → Juan
- **Setup**: 
  - `credentials.env` 설정 완료
  - S3 bucket `accident-blackbox`에 영상 존재
  - OpenSearch endpoint 접근 가능 (RAG 검색용)
- **Command**:
  ```bash
  # 첫 번째 사용 가능한 영상으로 실행
  .venv/bin/python integration/scripts/test_integration_e2e.py --first
  
  # 특정 영상 지정
  .venv/bin/python integration/scripts/test_integration_e2e.py --video accident-videos/sample1.mp4
  ```
- **Expected**: ALL STAGES PASSED
- **소요시간**: ~30-60초 (영상 분석 + LLM 호출)

### Scenario 4: Real Serval, Juan 스킵 (Serval + Adapter만)
- **Description**: Serval 실제 호출 + Adapter 변환까지만 검증 (비용 절감)
- **Setup**: Scenario 3과 동일
- **Command**:
  ```bash
  .venv/bin/python integration/scripts/test_integration_e2e.py --first --skip-juan
  ```
- **Expected**: ALL STAGES PASSED (juan: skipped)
- **소요시간**: ~30-60초

## Validation Checklist

E2E 테스트 성공 시 확인 사항:
- [ ] Serval stage: StructuredAnalysis 생성됨
- [ ] Adapter stage: fault_ratios 합 = 100%
- [ ] Adapter stage: driver_actions 개수 보존됨
- [ ] Adapter stage: accident_type 보존됨
- [ ] Adapter stage: timestamp float→string 변환 정상
- [ ] Ssol stage: mock script 로드 성공
- [ ] Juan stage: output 디렉토리에 mp4/mp3 파일 존재 (mock이어도 placeholder)

## Results Location

- `integration/test_output/e2e_summary.json` — 실행 결과 JSON
- `integration/test_output/output/` — Juan 출력물 (mock mode)

## Cleanup

```bash
rm -rf integration/test_output/
```
