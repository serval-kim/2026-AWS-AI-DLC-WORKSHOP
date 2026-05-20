# Component Methods

## APIController

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `create_analysis(video_s3_key: str)` | S3 영상 경로 | `AnalysisJob {job_id, status, created_at}` | 분석 작업 생성, Redis Queue 발행 |
| `get_status(job_id: str)` | 작업 ID | `JobStatus {job_id, status, progress, error?}` | S3 메타데이터에서 상태 조회 |
| `get_result(job_id: str)` | 작업 ID | `AnalysisResult` (전체 JSON) | S3에서 최종 결과 다운로드 |
| `handle_callback(job_id: str, status: str, result_key?: str)` | 콜백 데이터 | `None` | worker 완료 콜백 처리 |

## AnalysisPipeline

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `run(job_id: str, video_s3_key: str)` | 작업 ID + S3 경로 | `PipelineResult {status, partial_results, errors}` | 전체 파이프라인 실행 (Partial Result 전략) |
| `update_status(job_id: str, stage: str, status: str)` | 작업 ID, 단계, 상태 | `None` | S3 메타데이터 상태 업데이트 |
| `send_callback(job_id: str, status: str, result_key?: str)` | 콜백 데이터 | `None` | api-server에 완료 콜백 전송 |

## VideoAnalyzer

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `extract_frames(video_path: str, fps: int = 2)` | 로컬 영상 경로, FPS | `list[FrameData {path, timestamp}]` | FFmpeg 키프레임 추출 |
| `detect_objects(frames: list[FrameData])` | 프레임 목록 | `list[DetectionResult {frame_id, objects}]` | YOLOv8 객체 탐지 |
| `track_vehicles(detections: list[DetectionResult])` | 탐지 결과 | `list[VehicleTrack {vehicle_id, trajectory}]` | ByteTrack 차량 추적 |
| `classify_accident(tracks: list[VehicleTrack])` | 차량 궤적 | `AccidentClassification {type, confidence, details}` | 사고 유형 분류 |
| `analyze(video_s3_key: str)` | S3 영상 경로 | `VideoAnalysisResult` (통합 JSON) | 전체 영상 분석 실행 |

## FaultAnalyzer

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `search_references(analysis: VideoAnalysisResult)` | 영상 분석 결과 | `list[LegalReference {text, source, score}]` | OpenSearch RAG 검색 |
| `analyze_fault(analysis: VideoAnalysisResult, references: list[LegalReference])` | 분석 + 법규 | `FaultResult {ratios, reasoning, disclaimer}` | LLM 과실비율 판단 |
| `run(analysis: VideoAnalysisResult)` | 영상 분석 결과 | `FaultResult` | 전체 과실비율 분석 실행 |

## ScriptGenerator

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `generate_structure(fault_result: FaultResult, video_metadata: VideoMetadata)` | 과실비율 + 메타데이터 | `StructuredAnalysis {intro, analysis, conclusion}` | 3단 구조 JSON 생성 |
| `run(fault_result: FaultResult, video_metadata: VideoMetadata)` | 과실비율 + 메타데이터 | `StructuredAnalysis` | 전체 스크립트 생성 실행 |

## DataIngestion

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `load_data(source_path: str)` | 데이터 소스 경로 | `list[Document {text, metadata}]` | 원본 데이터 로딩 |
| `chunk_documents(documents: list[Document], chunk_size: int)` | 문서 목록 | `list[Chunk {text, metadata, chunk_id}]` | 텍스트 청크 분할 |
| `embed_chunks(chunks: list[Chunk])` | 청크 목록 | `list[EmbeddedChunk {chunk_id, vector, text}]` | Titan Embeddings 벡터화 |
| `ingest_to_opensearch(embedded_chunks: list[EmbeddedChunk])` | 벡터화된 청크 | `IngestResult {total, success, failed}` | OpenSearch 적재 |
| `run(source_path: str)` | 데이터 소스 경로 | `IngestResult` | 전체 적재 파이프라인 실행 |

## S3Client

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `download_file(s3_key: str, local_path: str)` | S3 키, 로컬 경로 | `str` (로컬 경로) | 파일 다운로드 |
| `upload_file(local_path: str, s3_key: str)` | 로컬 경로, S3 키 | `str` (S3 키) | 파일 업로드 |
| `upload_json(data: dict, s3_key: str)` | JSON 데이터, S3 키 | `str` (S3 키) | JSON 직접 업로드 |
| `get_job_status(job_id: str)` | 작업 ID | `JobStatus` | 메타데이터에서 상태 조회 |
| `set_job_status(job_id: str, status: str, metadata: dict)` | 작업 ID, 상태 | `None` | 메타데이터 상태 업데이트 |

## OpenSearchClient

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `create_index(index_name: str, dimension: int)` | 인덱스명, 벡터 차원 | `None` | k-NN 인덱스 생성 |
| `bulk_index(index_name: str, documents: list[dict])` | 인덱스명, 문서 목록 | `BulkResult {success, failed}` | 벌크 문서 적재 |
| `search(index_name: str, query_vector: list[float], k: int)` | 인덱스명, 쿼리 벡터, k | `list[SearchHit {text, score, metadata}]` | 벡터 유사도 검색 |

## BedrockClient

| Method | Input | Output | Purpose |
|--------|-------|--------|---------|
| `invoke_with_thinking(prompt: str, context: str, max_tokens: int)` | 프롬프트, 컨텍스트 | `LLMResponse {content, thinking, usage}` | Extended Thinking LLM 호출 |
| `generate_embedding(text: str)` | 텍스트 | `list[float]` | Titan Embeddings 벡터 생성 |
| `generate_embeddings_batch(texts: list[str])` | 텍스트 목록 | `list[list[float]]` | 배치 벡터 생성 |
