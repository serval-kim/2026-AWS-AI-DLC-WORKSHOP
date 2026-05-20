# Requirements: accident-rag

## 목적

교통사고 과실비율 산정을 보조하기 위한 RAG(Retrieval-Augmented Generation) 시스템.
도로교통법 PDF를 벡터화하여 OpenSearch에 적재하고, 사고 상황 텍스트를 입력하면
과실비율 + 법적 근거를 구조화 JSON으로 반환한다.

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-1 | 도로교통법 PDF를 조문 단위로 청킹 | P0 |
| FR-2 | 청크를 Bedrock Titan Embed V2로 임베딩 (1024차원) | P0 |
| FR-3 | 임베딩 벡터를 OpenSearch k-NN 인덱스에 적재 | P0 |
| FR-4 | 사고 상황 텍스트 → 임베딩 → top-k 검색 | P0 |
| FR-5 | 검색 결과 + 사고 상황을 Bedrock LLM에 전달하여 과실비율 JSON 생성 | P0 |
| FR-6 | CLI로 ingest / query / doctor 서브커맨드 제공 | P0 |
| FR-7 | 적재 건수 제한 (PoC: 10건) | P0 |

## 비기능 요구사항

| ID | 요구사항 |
|---|---|
| NFR-1 | OpenSearch 인증: Basic Auth (FGAC) 또는 SigV4 자동 선택 |
| NFR-2 | 임베딩 호출 throttle 지원 (sleep-between 옵션) |
| NFR-3 | .env 기반 설정, 비밀은 git-ignore |

## 데이터 소스

- `~/Downloads/law.pdf` (도로교통법 전문, 국가법령정보센터 PDF)

## 기술 스택

- Python 3.10+
- AWS Bedrock: Titan Text Embeddings V2, Claude Haiku 4.5 (inference profile: `us.anthropic.claude-haiku-4-5-20251001-v1:0`)
- OpenSearch (관리형, FGAC + Basic Auth)
- pypdf, opensearch-py, requests-aws4auth, boto3
