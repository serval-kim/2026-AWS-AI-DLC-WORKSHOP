# Integration Test Instructions

## Purpose
api-server ↔ Redis ↔ video-worker 간 통합 동작을 검증합니다.

---

## Setup Integration Test Environment

### 1. Start Services
```bash
docker-compose up -d redis api-server video-worker
```

### 2. Wait for Services Ready
```bash
# API 서버 준비 확인
until curl -s http://localhost:8000/health | grep -q "healthy"; do sleep 1; done
echo "API server ready"
```

---

## Test Scenarios

### Scenario 1: Full Pipeline (Happy Path)

**Prerequisites**: S3에 테스트 영상 업로드 완료

```bash
# 1. 분석 요청
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"video_s3_key": "videos/test/sample.mp4"}'

# Expected: {"job_id": "<uuid>", "status": "PENDING", "message": "Analysis job created"}

# 2. 상태 확인 (폴링)
curl http://localhost:8000/status/<job_id>

# Expected: status가 PENDING → PROCESSING → COMPLETED/PARTIAL로 전이

# 3. 결과 조회
curl http://localhost:8000/result/<job_id>

# Expected: structured_analysis JSON 반환
```

### Scenario 2: Invalid Video (Error Path)

```bash
# 존재하지 않는 영상
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"video_s3_key": "videos/nonexistent.mp4"}'

# Expected: 404 {"detail": "Video not found: videos/nonexistent.mp4"}
```

### Scenario 3: Worker Callback

```bash
# Worker 완료 후 콜백 수신 확인
# docker-compose logs api-server | grep "callback_received"
```

---

## Verify Service Interactions

| Check | Command | Expected |
|-------|---------|----------|
| API Health | `curl localhost:8000/health` | `{"status":"healthy"}` |
| Redis Connected | `docker-compose exec redis redis-cli ping` | `PONG` |
| Queue Created | `docker-compose exec redis redis-cli keys '*'` | Queue key 존재 |
| Worker Running | `docker-compose logs video-worker` | "worker_starting" 로그 |

---

## Cleanup

```bash
docker-compose down -v
```
