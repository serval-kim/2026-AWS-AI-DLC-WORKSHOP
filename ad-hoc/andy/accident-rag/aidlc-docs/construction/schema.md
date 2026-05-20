# 스키마 및 연동 문서

## OpenSearch 인덱스 스키마

인덱스명: `accident-law`

```json
{
  "settings": {
    "index": { "knn": true }
  },
  "mappings": {
    "properties": {
      "embedding": {
        "type": "knn_vector",
        "dimension": 1024,
        "method": {
          "name": "hnsw",
          "engine": "faiss",
          "space_type": "cosinesimil",
          "parameters": { "ef_construction": 256, "m": 16 }
        }
      },
      "text":          { "type": "text" },
      "chunk_id":      { "type": "keyword" },
      "article_no":    { "type": "keyword" },
      "article_title": { "type": "keyword" },
      "source":        { "type": "keyword" },
      "page_hint":     { "type": "integer" }
    }
  }
}
```

## 청크 문서 예시

```json
{
  "chunk_id": "law.pdf::제27조::0",
  "article_no": "제27조",
  "article_title": "보행자의 보호",
  "text": "제27조(보행자의 보호) ① 모든 차 또는 노면전차의 운전자는 보행자가 ...",
  "source": "law.pdf",
  "page_hint": 15,
  "embedding": [0.0123, -0.0456, ...]
}
```

## Verdict 응답 스키마 (LLM 출력)

```json
{
  "fault_ratio": {
    "vehicle": "<0-100 정수>",
    "pedestrian": "<0-100 정수, 합계 100>"
  },
  "rationale": "<한국어 200자 내외 설명>",
  "legal_basis": [
    {
      "article_no": "<예: 제27조>",
      "article_title": "<조 제목>",
      "quote": "<해당 조항에서 30~120자 직접 인용>",
      "source": "<예: law.pdf>"
    }
  ],
  "confidence": "low | medium | high",
  "notes": "<불확실성, 추가 확인 필요 사항>"
}
```

## 연동 방법

### 1. Ingest (적재)

```bash
python -m accident_rag.cli ingest \
    --pdf ~/Downloads/law.pdf \
    --limit 10 \
    --recreate-index
```

내부 흐름:
1. `pdf_loader.load_chunks()` → 조문 단위 청킹
2. `EmbeddingClient.embed_many()` → Bedrock Titan V2 호출 (순차)
3. `OpenSearchVectorStore.ensure_index()` → 인덱스 생성 (없으면)
4. `OpenSearchVectorStore.bulk_upsert()` → 벡터 + 메타데이터 적재

### 2. Query (검색 + 생성)

```bash
python -m accident_rag.cli query \
    --text "야간 횡단보도 무단횡단 보행자를 직진 차량이 충격" \
    --k 5
```

내부 흐름:
1. `EmbeddingClient.embed_one(query)` → 쿼리 벡터화
2. `OpenSearchVectorStore.knn_search(qvec, k=5)` → top-k 검색
3. `prompts.build_context_block(hits)` → 컨텍스트 포맷팅
4. `_converse(bedrock, system=VERDICT_SYSTEM_PROMPT, user=...)` → Claude 호출
5. JSON 파싱 → `VerdictResponse` 반환

### 3. Python API 직접 호출

```python
from accident_rag import ingest_pdf, answer_query

# 적재
summary = ingest_pdf("~/Downloads/law.pdf", limit=10, recreate_index=True)

# 질의
result = answer_query("야간 무단횡단 보행자 사고", k=5)
print(result.verdict)
```

## 인증 설정

| 방식 | 환경 변수 | 용도 |
|---|---|---|
| Basic Auth | `OPENSEARCH_BASIC_AUTH_USER`, `OPENSEARCH_BASIC_AUTH_PASSWORD` | FGAC master user |
| SigV4 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | IAM 인증 |

Basic Auth가 설정되어 있으면 SigV4보다 우선 사용됨.

## OpenSearch 엔드포인트

```
https://search-accident-rag2-eoeaysuk3gdwj4nbzagzbzt7da.us-east-1.es.amazonaws.com
```
