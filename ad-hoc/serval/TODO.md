# 추가 작업 예정 (TODO)

## 우선순위 높음
- [ ] GitHub Actions 워크플로우 파일 생성 (`.github/workflows/ci.yml`, `deploy.yml`)
- [ ] 다른 영상 3개로 추가 E2E 테스트 (다양한 사고 유형 검증)
- [ ] Docker 이미지 빌드 테스트 (`docker-compose build`)

## 우선순위 중간
- [ ] ByteTrack 추적 정확도 개선 (FPS 높이기 또는 optical flow 기반 보완)
- [ ] 사고 유형 분류 규칙 고도화 (더 많은 패턴 추가)
- [ ] LLM 프롬프트 튜닝 (과실비율 정확도 향상)
- [ ] 모델 업그레이드: DeepSeek R1 → Claude Sonnet 4 (inference profile 활성화 후)
- [ ] 에러 처리 강화 (네트워크 타임아웃, S3 접근 실패 등)

## 우선순위 낮음
- [ ] EC2 인스턴스 프로비저닝 (api-server + GPU worker)
- [ ] ECR 리포지토리 생성 + 이미지 푸시
- [ ] CloudWatch 로그 드라이버 설정
- [ ] 비용 최적화 (Spot Instance, 워커 자동 시작/중지)
- [ ] API 문서 (FastAPI 자동 생성 OpenAPI spec 검증)
- [ ] 부하 테스트 (동시 요청 처리)

## 완료된 항목
- [x] AI-DLC 전체 워크플로우 (INCEPTION + CONSTRUCTION)
- [x] 코드 생성 (shared + worker + api)
- [x] Unit Tests + PBT Tests (28/28 pass)
- [x] E2E 파이프라인 검증 (실제 블랙박스 영상)
- [x] Docker Compose 설정
- [x] Infrastructure Design 문서화
