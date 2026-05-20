# Requirements

## Intent Analysis
- **User Request**: 블랙박스 분석 스크립트(JSON) → 한문철 스타일 해설 영상 자동 생성 모듈
- **Request Type**: New Module (상위 시스템의 영상 생성 컴포넌트)
- **Scope**: Single Component
- **Complexity**: Moderate (외부 API 의존, 비동기 처리, 미디어 파이프라인)

---

## Functional Requirements

### FR-1: JSON 스크립트 파싱
- 입력: intro/analysis/conclusion 씬 배열
- 각 씬의 `duration_sec`이 SSOT
- emphasis, clips 메타데이터 포함

### FR-2: TTS 생성 (duration SSOT 맞춤)
- Polly neural (Seoyeon) 사용
- prosody rate 자동 조절로 목표 duration에 맞춤
- 오차 ±0.5초 이내 → silence padding으로 보정
- 오차 > 0.5초 → trim

### FR-3: 영상 생성 (Nova Reel)
- 씬 duration → ceil(duration/6) 샷 생성
- 마지막 샷: 필요 길이만 트림 (나머지 버림)
- 프레임 연속성: 이전 샷 마지막 프레임 → 다음 샷 시작 이미지
- 첫 샷: 한문철 기본 이미지 사용

### FR-4: 영상 합성
- 씬별: 영상 + TTS 오디오 overlay
- 전체: 씬 영상들 concat → 최종 릴스

### FR-5: 에러 처리
- 샷 생성 실패: 최대 2회 재시도 (1회 동일, 1회 seed 변경)
- 재시도 실패: 전체 파이프라인 fail-fast
- TTS 실패: 1회 재시도 후 fail

---

## Non-Functional Requirements

### NFR-1: 성능
- 15초 영상: 목표 5분 이내, hard limit 8분
- TTS 생성: 씬별 병렬 실행 (영상 생성과 동시)
- 샷 생성: 순차 (프레임 의존), shot당 timeout 3분

### NFR-2: 배포
- 현재: 로컬 CLI (`python pipeline.py script.json`)
- 향후: Step Functions + Lambda 오케스트레이션
- handler.py에 CLI/Lambda 양쪽 진입점 제공

### NFR-3: 상태 관리
- S3 prefix 격리: `jobs/{job_id}/shots|tts|frames|output/`
- 성공 시: output만 보존, 나머지 7일 후 자동 삭제
- 실패 시: 24시간 유지 후 만료

### NFR-4: 테스트
- Unit: boto3 stubber/moto로 mock (비용 $0)
- Integration: 실제 Polly + 사전 녹화 fixture ($0.01/run)
- E2E: 1-2샷 축소 시나리오 (주 1회, ~$5/run)
- `MOCK_VIDEO_GEN=true` 환경변수로 CI에서 API 스킵

### NFR-5: 모니터링
- 파이프라인 진행 상황 stdout 로깅
- 향후: CloudWatch Metrics (shot_generation_seconds, pipeline_duration)

---

## Extension Configuration
| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | No | Requirements Analysis (내부 모듈, 인증 불필요) |
| Property-Based Testing | No | Requirements Analysis (미디어 파이프라인에 부적합) |
