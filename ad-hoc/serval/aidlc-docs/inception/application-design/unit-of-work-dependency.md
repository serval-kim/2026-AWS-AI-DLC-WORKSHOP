# Unit of Work Dependencies

## Dependency Matrix

| Unit | Depends On | Depended By | Communication |
|------|-----------|-------------|---------------|
| shared | — | api-server, video-worker | Python import |
| video-worker | shared, Redis | api-server (via callback) | Redis Queue (consume), HTTP (callback) |
| api-server | shared, Redis | (External clients) | Redis Queue (publish), HTTP (serve) |

---

## Dependency Diagram

```
+----------+       +----------------+       +---------------+
|  shared  | <---- |  video-worker  | ----> |  api-server   |
| (models, |       | (pipeline,     |       | (FastAPI,     |
|  clients)|       |  analyzers)    |       |  routes)      |
+----------+       +----------------+       +---------------+
                          ^                        |
                          |    Redis Queue          |
                          +------------------------+
                                (publish → consume)
```

---

## Integration Points

| From | To | Mechanism | Data |
|------|----|-----------|------|
| api-server | Redis | PUBLISH | `{job_id, video_s3_key, callback_url}` |
| Redis | video-worker | CONSUME | `{job_id, video_s3_key, callback_url}` |
| video-worker | api-server | HTTP POST /callback | `{job_id, status, result_key, errors}` |
| api-server | S3 | boto3 | 상태 조회, 결과 다운로드 |
| video-worker | S3 | boto3 | 영상 다운로드, 결과 업로드, 상태 업데이트 |
| video-worker | OpenSearch | opensearch-py | RAG 검색, 데이터 적재 |
| video-worker | Bedrock | boto3 | LLM 호출, Embedding 생성 |

---

## Build Order

| Order | Unit | Rationale |
|-------|------|-----------|
| 1 | shared | 다른 모든 유닛의 기반 — 모델, 클라이언트 |
| 2 | video-worker | 핵심 비즈니스 로직 — 영상 분석 + AI 분석 |
| 3 | api-server | 서빙 레이어 — worker 완료 후 통합 |

---

## Shared Resources (External)

| Resource | Used By | Purpose |
|----------|---------|---------|
| Redis 7 | api-server, video-worker | 작업 큐 (메시지 브로커) |
| AWS S3 | api-server, video-worker | 영상/결과 저장, 상태 관리 |
| AWS OpenSearch Serverless | video-worker | 벡터 검색 (RAG) |
| AWS Bedrock | video-worker | LLM + Embeddings |
