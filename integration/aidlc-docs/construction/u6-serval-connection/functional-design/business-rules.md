# Business Rules — U6: Serval 실제 연결

## BR-1: Pipeline 실행 조건

| Rule | 설명 | 처리 |
|------|------|------|
| BR-1.1 | video_s3_key가 존재하지 않으면 실행 중단 | HTTP 404 반환 |
| BR-1.2 | MOCK_SERVAL=true이면 Serval 호출 건너뜀 | mock script 로드 |
| BR-1.3 | VideoAnalysis 실패 시 후속 단계 스킵 | 에러 기록 + 상태 FAILED |

## BR-2: Serval Pipeline 에러 처리 (Partial Result Strategy)

| Rule | Stage 실패 | 동작 | 최종 상태 |
|------|------------|------|-----------|
| BR-2.1 | VideoAnalyzer 실패 (NO_VEHICLE, CORRUPTED_VIDEO) | 비복구 → 즉시 중단 | FAILED |
| BR-2.2 | VideoAnalyzer 실패 (기타) | 복구 가능 → 에러 기록, 중단 | FAILED |
| BR-2.3 | FaultAnalyzer 실패 | 에러 기록, script gen 스킵 | PARTIAL (video_analysis만) |
| BR-2.4 | ScriptGenerator 실패 | 에러 기록 | PARTIAL (video + fault만) |
| BR-2.5 | FaultResult.undetermined == True | script gen 스킵 | PARTIAL |

## BR-3: Adapter 변환 규칙

| Rule | 입력 | 출력 | 검증 |
|------|------|------|------|
| BR-3.1 | `intro.accident_type` | `accident_type` (string) | 빈 문자열 불가 |
| BR-3.2 | `conclusion.fault_ratios` (list[dict]) | `fault_ratios` (list[dict]) | 합 = 100% |
| BR-3.3 | `conclusion.legal_basis` (list[str]) | `legal_basis` (list[str]) | 복사 |
| BR-3.4 | `intro.timestamp.end` (float) | `video_duration` (float) | > 0 |
| BR-3.5 | `analysis.timestamp.end` (float) | `collision_timestamp` (float) | >= 0, <= video_duration |
| BR-3.6 | `analysis.driver_actions` | `driver_actions` (변환) | timestamp float→string |
| BR-3.7 | `conclusion.disclaimer` | `disclaimer` (string) | 기본값 존재 |

## BR-4: 타임스탬프 변환 규칙

| Rule | 입력 | 출력 | 예시 |
|------|------|------|------|
| BR-4.1 | 0.0 | "00:00" | - |
| BR-4.2 | 정수 초 | "MM:SS" (소수점 없음) | 65.0 → "01:05" |
| BR-4.3 | 소수 초 | "MM:SS.f" (소수점 1자리) | 3.5 → "00:03.5" |
| BR-4.4 | 음수 | 불허 — ValueError 발생 | -1.0 → ERROR |

## BR-5: 응답 형식

| Rule | 조건 | 응답 |
|------|------|------|
| BR-5.1 | 완전 성공 | `{status: "completed", script, videoPath, audioPaths}` |
| BR-5.2 | Partial (analysis만) | `{status: "partial", partial_results: {...}, errors: [...]}` |
| BR-5.3 | 실패 | `{status: "failed", errors: [...]}` |
| BR-5.4 | 에러 응답 노출 제한 | 스택트레이스/내부 경로 노출 금지 (SECURITY-09) |

## BR-6: 환경 분리

| Rule | 환경 | 설명 |
|------|------|------|
| BR-6.1 | 자격증명 | credentials.env에서만 로드, 코드 하드코딩 금지 (SECURITY-12) |
| BR-6.2 | 로깅 | structlog 사용, job_id correlation (SECURITY-03) |
| BR-6.3 | S3 bucket | 환경변수 `S3_BUCKET` 또는 settings.bucket_name |
