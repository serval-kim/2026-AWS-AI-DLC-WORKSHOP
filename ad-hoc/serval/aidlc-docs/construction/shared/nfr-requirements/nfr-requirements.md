# NFR Requirements

## Context
로컬 Docker 환경에서 실행되는 MVP. 외부망 미노출, 단일 사용자/소규모 팀 사용.

---

## Performance Requirements

| Metric | Target | Rationale |
|--------|--------|-----------|
| 영상 분석 처리 시간 | 영상 길이의 3배 이내 | 30초 영상 → 90초 이내 처리 |
| LLM 응답 시간 | 30초 이내 (Extended Thinking 포함) | Bedrock API 타임아웃 고려 |
| API 응답 시간 (POST /analyze) | 500ms 이내 | 큐 발행만 수행, 즉시 응답 |
| API 응답 시간 (GET /status) | 200ms 이내 | S3 메타데이터 조회 |
| 프레임 추출 속도 | 실시간 이상 | FFmpeg 최적화 |
| YOLOv8 추론 (GPU) | 30ms/frame 이내 | batch inference 활용 |
| YOLOv8 추론 (CPU) | 500ms/frame 이내 | CPU fallback 허용 |

---

## Scalability Requirements

| Aspect | Requirement | Notes |
|--------|-------------|-------|
| 동시 처리 작업 | 1개 (MVP) | 단일 워커, 큐 기반 순차 처리 |
| 큐 백로그 | 최대 10개 작업 | Redis Queue 크기 제한 |
| 영상 크기 | 최대 500MB | S3 업로드 제한과 동일 |
| 영상 길이 | 최대 5분 | 프레임 수 = 5*60*2 = 600프레임 |

---

## Availability Requirements

| Aspect | Requirement | Notes |
|--------|-------------|-------|
| 가용성 목표 | Best-effort (MVP) | 로컬 Docker, SLA 없음 |
| 장애 복구 | docker-compose restart | 수동 재시작 |
| 데이터 영속성 | S3 (AWS 관리) | 로컬 데이터는 임시 |
| 상태 복구 | S3 메타데이터 기반 | 워커 재시작 시 PROCESSING 작업 재처리 가능 |

---

## Security Requirements

| Rule | Requirement | Implementation |
|------|-------------|----------------|
| SECURITY-01 | S3 암호화 (at rest + in transit) | AWS 기본 SSE-S3, HTTPS 전용 |
| SECURITY-03 | 구조화된 로깅 | Python structlog, JSON 포맷 |
| SECURITY-05 | 입력 검증 | FastAPI Pydantic 모델, 파일 크기/형식 검증 |
| SECURITY-09 | 에러 응답 보안 | 내부 스택트레이스 미노출, 일반 에러 메시지 |
| SECURITY-10 | 의존성 핀닝 | requirements.txt 정확한 버전 고정 |
| SECURITY-11 | 보안 로직 분리 | 클라이언트 모듈 별도 분리 |
| SECURITY-13 | 안전한 역직렬화 | Pydantic 모델 기반 파싱만 허용 |
| SECURITY-15 | 예외 처리 | 글로벌 에러 핸들러, 리소스 정리 |

**N/A (로컬 MVP)**:
- SECURITY-02 (네트워크 중간자 없음)
- SECURITY-04 (HTML 서빙 없음)
- SECURITY-06 (IAM — credentials.env 직접 사용)
- SECURITY-07 (네트워크 설정 — Docker 내부)
- SECURITY-08 (인증 없음 — 사용자 결정)
- SECURITY-12 (사용자 인증 없음)
- SECURITY-14 (모니터링/알림 — MVP 범위 외)

---

## Reliability Requirements

| Aspect | Requirement | Implementation |
|--------|-------------|----------------|
| 에러 처리 | Partial Result 전략 | 단계별 독립 실행, 부분 결과 저장 |
| 재시도 | LLM 호출 1회 재시도, 콜백 3회 재시도 | Exponential backoff |
| 타임아웃 | LLM 60초, S3 30초, OpenSearch 15초 | 각 외부 호출별 설정 |
| 리소스 정리 | /tmp 프레임 파일 삭제 | 파이프라인 완료/실패 시 cleanup |
| 로깅 | 모든 단계 시작/완료/에러 로깅 | structlog, correlation_id=job_id |

---

## Maintainability Requirements

| Aspect | Requirement | Implementation |
|--------|-------------|----------------|
| 코드 구조 | 모노레포, 모듈 분리 | shared/, worker/, api/ |
| 타입 안전성 | Python type hints + Pydantic | 런타임 검증 포함 |
| 테스트 | Unit + PBT + Integration | pytest + hypothesis |
| 문서화 | docstring + API docs | FastAPI 자동 OpenAPI 문서 |
| 설정 관리 | 환경변수 기반 | pydantic-settings |

---

## PBT Requirements (PBT-09)

| Aspect | Decision |
|--------|----------|
| Framework | Hypothesis (Python) |
| Integration | pytest + hypothesis |
| CI 포함 | Yes (build-and-test 지침에 포함) |
| Seed 로깅 | Yes (실패 시 재현 가능) |
| Shrinking | 기본 활성화 |
