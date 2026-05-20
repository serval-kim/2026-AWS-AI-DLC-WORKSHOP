# 테스트 결과 (2026-05-20)

## 환경

- OpenSearch: `accident-rag2` 도메인 (관리형, FGAC + Basic Auth)
- Endpoint: `https://search-accident-rag2-eoeaysuk3gdwj4nbzagzbzt7da.us-east-1.es.amazonaws.com`
- Embedding: `amazon.titan-embed-text-v2:0` (1024차원)
- LLM: `us.anthropic.claude-haiku-4-5-20251001-v1:0` (inference profile)
- 데이터: `law.pdf` (도로교통법, 227청크 중 10개 적재)

## Ingest 결과

```json
{
  "pdf": "law.pdf",
  "total_chunks_extracted": 227,
  "chunks_embedded": 10,
  "chunks_indexed": 10,
  "index": "accident-law",
  "embed_model": "amazon.titan-embed-text-v2:0",
  "dimensions": 1024
}
```

## Query 테스트

**입력**: "야간에 횡단보도 신호가 적색일 때 무단횡단하던 보행자를 직진 차량이 충격"

**Verdict 출력**:

```json
{
  "fault_ratio": { "vehicle": 30, "pedestrian": 70 },
  "rationale": "보행자가 횡단보도 신호 적색 상태에서 무단횡단한 것이 주된 과실입니다. 다만 차량도 야간 주행 시 보행자 출현에 대비한 안전운전 의무가 있으므로 일부 과실이 인정됩니다.",
  "legal_basis": [
    {
      "article_no": "제2조 제12호",
      "article_title": "횡단보도의 정의",
      "quote": "횡단보도란 보행자가 도로를 횡단할 수 있도록 안전표지로 표시한 도로의 부분을 말한다.",
      "source": "law.pdf"
    },
    {
      "article_no": "제2조 제15호",
      "article_title": "신호기의 정의",
      "quote": "신호기란 도로교통에서 문자·기호 또는 등화를 사용하여 진행·정지·방향전환·주의 등의 신호를 표시하는 장치를 말한다.",
      "source": "law.pdf"
    }
  ],
  "confidence": "low",
  "notes": "제공된 컨텍스트는 정의 조항만 포함하고 있으며, 보행자의 신호 위반 시 과실비율, 야간 운전자의 주의의무 등을 규정한 실질적 조항이 없습니다. 정확한 과실비율 판단을 위해서는 자동차사고 과실비율 인정기준 및 관련 판례를 참고해야 합니다."
}
```

## 분석

- 10개 청크만 적재했기 때문에 제2조(정의) 위주로만 검색됨
- confidence: low — 실질적 과실비율 조항(제27조 보행자 보호, 제5조 신호 준수 등)이 포함되면 개선 예상
- 전체 227개 적재 시 관련 조항이 검색되어 정확도 향상 기대
- 파이프라인 자체는 정상 동작 확인 완료
