# Unit of Work — Requirement Mapping

## Requirement-to-Unit Mapping

| Requirement | Unit | Coverage |
|-------------|------|----------|
| Req 2: 영상 분석 | video-worker | VideoAnalyzer (프레임 추출, 객체 탐지, 차량 추적, 사고 유형 분류) |
| Req 3: 과실비율 판단 | video-worker | FaultAnalyzer (RAG 검색, LLM 과실비율 산출) |
| Req 4: 구조화된 분석 결과 | video-worker | ScriptGenerator (3단 구조 JSON 생성) |
| Cross-cutting: API 서빙 | api-server | APIController (REST 엔드포인트, 상태 관리) |
| Cross-cutting: 데이터 적재 | video-worker (CLI) | DataIngestion (판례/법규 → OpenSearch) |
| Cross-cutting: 공통 인프라 | shared | S3Client, BedrockClient, OpenSearchClient, 모델 |

---

## Acceptance Criteria Mapping

### Req 2 → video-worker

| AC | Component | Method |
|----|-----------|--------|
| AC 2.1: 2 FPS 키프레임 추출 | VideoAnalyzer | extract_frames() |
| AC 2.2: 객체 탐지 (바운딩 박스 + 신뢰도) | VideoAnalyzer | detect_objects() |
| AC 2.3: 차량 궤적 매칭 | VideoAnalyzer | track_vehicles() |
| AC 2.4: 사고 유형 분류 | VideoAnalyzer | classify_accident() |
| AC 2.5: 차량 미탐지 에러 | VideoAnalyzer | analyze() (에러 처리) |
| AC 2.6: 영상 손상 에러 | VideoAnalyzer | extract_frames() (에러 처리) |

### Req 3 → video-worker

| AC | Component | Method |
|----|-----------|--------|
| AC 3.1: RAG 검색 (법규 + 판례) | FaultAnalyzer | search_references() |
| AC 3.2: 과실비율 백분율 산출 | FaultAnalyzer | analyze_fault() |
| AC 3.3: 판단 근거 텍스트 | FaultAnalyzer | analyze_fault() |
| AC 3.4: 면책 문구 포함 | FaultAnalyzer | analyze_fault() |
| AC 3.5: 판단 불가 시 사유 명시 | FaultAnalyzer | analyze_fault() (에러 처리) |

### Req 4 → video-worker

| AC | Component | Method |
|----|-----------|--------|
| AC 4.1: 3단 구조 분석 결과 | ScriptGenerator | generate_structure() |
| AC 4.2: 타임스탬프 포함 | ScriptGenerator | generate_structure() |
| AC 4.3: 운전자별 과실 행위 분리 | ScriptGenerator | generate_structure() |
| AC 4.4: JSON 형식 출력 | ScriptGenerator | generate_structure() |

---

## PBT Coverage per Unit

| Unit | PBT Target | Property Category |
|------|-----------|-------------------|
| shared | S3Client upload/download | Round-trip |
| shared | 모델 직렬화/역직렬화 | Round-trip |
| video-worker | 프레임 추출 수 = duration * fps | Invariant |
| video-worker | 과실비율 합계 = 100% | Invariant |
| video-worker | 3단 구조 JSON Schema 준수 | Invariant |
| video-worker | 사고 유형 분류 결과 유효성 | Easy Verification |
| api-server | 상태 전이 규칙 (PENDING→PROCESSING→COMPLETED) | Invariant |
