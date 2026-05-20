# accident-rag

도로교통법 PDF를 청킹/임베딩하여 OpenSearch에 적재하고, 사고 상황 텍스트를 입력하면 **과실비율 + 법적 근거**를 JSON으로 반환하는 RAG PoC.

## 아키텍처

```text
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  law.pdf     │────▶│  Bedrock          │────▶│  OpenSearch          │
│  (도로교통법) │     │  Titan Embed V2   │     │  k-NN (HNSW/cosine)  │
└──────────────┘     │  1024차원          │     │  index: accident-law │
                     └──────────────────┘     └──────────────────────┘
                                                         │
                                                         ▼ top-k
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  사고 상황    │────▶│  Bedrock          │────▶│  Claude Haiku 4.5    │
│  (자유 텍스트)│     │  Titan Embed V2   │     │  (Converse API)      │
└──────────────┘     └──────────────────┘     └──────────────────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────────┐
                                              │  Verdict JSON        │
                                              │  {fault_ratio,       │
                                              │   legal_basis, ...}  │
                                              └──────────────────────┘
```

## 구성 요소

| 단계 | 모듈 | 모델/도구 |
|---|---|---|
| PDF 청킹 | `pdf_loader.py` | pypdf + 조문 헤더(`제N조`) 분할 |
| 임베딩 | `embeddings.py` | Bedrock Titan Text Embeddings V2 (1024차원) |
| 벡터 저장 | `opensearch_store.py` | OpenSearch k-NN (HNSW, cosine, FAISS) |
| 검색+생성 | `query.py` | Bedrock Converse + Claude Haiku 4.5 |
| CLI | `cli.py` | `ingest`, `query`, `doctor` 서브커맨드 |

## 설치

```bash
cd ad-hoc/andy/accident-rag
python -m venv .venv && source .venv/bin/activate
pip install -e .
```

## 환경 변수 (.env)

```dotenv
AWS_REGION=us-east-1
OPENSEARCH_ENDPOINT=https://search-accident-rag-5i3qffvel7idyzfaixos2n4iiu.aos.us-east-1.on.aws
OPENSEARCH_INDEX=accident-law
OPENSEARCH_SERVERLESS=0
OPENSEARCH_BASIC_AUTH_USER=admin
OPENSEARCH_BASIC_AUTH_PASSWORD=<your-password>
```

인증 우선순위:
1. `OPENSEARCH_BASIC_AUTH_USER` + `PASSWORD` 가 있으면 Basic Auth (FGAC master user)
2. 없으면 SigV4 (IAM 자격증명 체인)

## 사용

### 1. PDF → OpenSearch 적재

```bash
python -m accident_rag.cli ingest --pdf ~/Downloads/law.pdf --limit 10 --recreate-index
```

### 2. 사고 상황 → 과실비율 + 법 근거

```bash
python -m accident_rag.cli query \
    --text "야간에 횡단보도 신호가 적색일 때 무단횡단하던 보행자를 직진 차량이 충격"
```

### 3. 연결 진단

```bash
python -m accident_rag.cli doctor
```

## 응답 스키마

`query` 명령의 `verdict` 필드 구조:

```json
{
  "fault_ratio": {
    "vehicle": 30,
    "pedestrian": 70
  },
  "rationale": "보행자가 적색 신호에 무단횡단하여 ...",
  "legal_basis": [
    {
      "article_no": "제27조",
      "article_title": "보행자의 보호",
      "quote": "모든 차 또는 노면전차의 운전자는 보행자가 횡단보도를 통행하고 있을 때에는...",
      "source": "law.pdf"
    }
  ],
  "confidence": "medium",
  "notes": "실제 과실비율은 사고 세부 상황에 따라 달라질 수 있음"
}
```

### 전체 응답 구조

```json
{
  "query": "<입력 텍스트>",
  "verdict": { ... },
  "raw_text": "<LLM 원문 출력>",
  "retrieved": [
    {
      "score": 0.87,
      "chunk_id": "law.pdf::제27조::0",
      "article_no": "제27조",
      "article_title": "보행자의 보호",
      "text": "...",
      "source": "law.pdf",
      "page_hint": 15
    }
  ],
  "model_id": "anthropic.claude-haiku-4-5-20251001-v1:0"
}
```

## OpenSearch 인덱스 매핑

```json
{
  "settings": { "index": { "knn": true } },
  "mappings": {
    "properties": {
      "embedding":      { "type": "knn_vector", "dimension": 1024, "method": { "name": "hnsw", "engine": "faiss", "space_type": "cosinesimil" } },
      "text":           { "type": "text" },
      "chunk_id":       { "type": "keyword" },
      "article_no":     { "type": "keyword" },
      "article_title":  { "type": "keyword" },
      "source":         { "type": "keyword" },
      "page_hint":      { "type": "integer" }
    }
  }
}
```

## 제약 / 향후 개선

- 현재 도로교통법 본문만 임베딩. 손해보험협회 과실비율 인정기준, 판례 추가 시 정확도 향상 예상.
- Titan V2 임베딩은 순차 호출 (Bedrock batch API 미지원). 대량 적재 시 `--sleep-between` 으로 throttle 관리.
- Claude Haiku 4.5 기본. 더 정밀한 답변이 필요하면 `--llm-model-id anthropic.claude-sonnet-4-6` 등으로 교체 가능.
