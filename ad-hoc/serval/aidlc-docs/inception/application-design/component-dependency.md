# Component Dependencies

## Dependency Matrix

| Component | Depends On | Depended By |
|-----------|-----------|-------------|
| APIController | S3Client, Redis | (External clients) |
| AnalysisPipeline | VideoAnalyzer, FaultAnalyzer, ScriptGenerator, S3Client, Redis | APIController (via callback) |
| VideoAnalyzer | S3Client | AnalysisPipeline |
| FaultAnalyzer | OpenSearchClient, BedrockClient | AnalysisPipeline |
| ScriptGenerator | BedrockClient | AnalysisPipeline |
| DataIngestion | OpenSearchClient, BedrockClient | (CLI, 초기 셋업) |
| S3Client | boto3 (S3) | APIController, AnalysisPipeline, VideoAnalyzer |
| OpenSearchClient | opensearch-py, boto3 | FaultAnalyzer, DataIngestion |
| BedrockClient | boto3 (bedrock-runtime) | FaultAnalyzer, ScriptGenerator, DataIngestion |

---

## Communication Patterns

### Container 간 통신

```
+------------------+       Redis Queue       +------------------------+
|   api-server     |  ---- (publish) ------> |    video-worker        |
|                  |                          |                        |
|   POST /analyze  |                          |   AnalysisPipeline     |
|   GET /status    |  <--- (HTTP callback) -- |   (queue consumer)     |
|   GET /result    |                          |                        |
+------------------+                          +------------------------+
        |                                              |
        |  S3 (status metadata)                        |  S3 (results)
        v                                              v
   +----------------------------------------------------------+
   |                        AWS S3                             |
   +----------------------------------------------------------+
                                    |
                                    |  (video-worker only)
                                    v
   +----------------------------------------------------------+
   |              Amazon OpenSearch Serverless                  |
   +----------------------------------------------------------+
                                    |
                                    v
   +----------------------------------------------------------+
   |                    AWS Bedrock                             |
   |          (Claude Sonnet 4 + Titan Embeddings)             |
   +----------------------------------------------------------+
```

### Data Flow

```
1. Client → api-server: POST /analyze {video_s3_key}
2. api-server → Redis: PUBLISH job {job_id, video_s3_key}
3. api-server → S3: SET metadata (status=PENDING)
4. api-server → Client: {job_id, status: PENDING}

5. video-worker ← Redis: CONSUME job
6. video-worker → S3: SET metadata (status=PROCESSING)
7. video-worker → S3: DOWNLOAD video
8. video-worker: VideoAnalyzer.analyze() → frames → detections → tracks → classification
9. video-worker → S3: UPLOAD video_analysis.json
10. video-worker → OpenSearch: SEARCH related laws/cases
11. video-worker → Bedrock: INVOKE LLM (fault analysis)
12. video-worker → S3: UPLOAD fault_result.json
13. video-worker → Bedrock: INVOKE LLM (script generation)
14. video-worker → S3: UPLOAD structured_analysis.json
15. video-worker → S3: SET metadata (status=COMPLETED)
16. video-worker → api-server: POST /callback {job_id, status, result_key}

17. Client → api-server: GET /result/{job_id}
18. api-server → S3: GET structured_analysis.json
19. api-server → Client: {structured_analysis JSON}
```

---

## Container Composition (docker-compose)

| Service | Image | Ports | Dependencies |
|---------|-------|-------|-------------|
| api-server | accident-api:latest | 8000:8000 | redis |
| video-worker | accident-worker:latest | — | redis |
| redis | redis:7-alpine | 6379:6379 | — |

### Shared Resources
- **Redis**: 작업 큐 (api-server ↔ video-worker)
- **S3**: 영상 저장, 결과 저장, 상태 메타데이터 (외부 AWS)
- **OpenSearch Serverless**: 벡터 DB (외부 AWS)
- **Bedrock**: LLM + Embeddings (외부 AWS)
- **credentials.env**: AWS 인증 정보 (모든 컨테이너에 주입)
