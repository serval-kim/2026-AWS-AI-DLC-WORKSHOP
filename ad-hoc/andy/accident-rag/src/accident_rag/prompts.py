"""LLM prompts for the verdict generation step.

Output schema (matches the user's requested fields):
{
  "fault_ratio": {"vehicle": int, "pedestrian": int},  # sums to 100
  "rationale": str,                                    # 한국어 설명
  "legal_basis": [
    {"article_no": str, "article_title": str, "quote": str, "source": str}
  ],
  "confidence": "low" | "medium" | "high",
  "notes": str
}
"""

from __future__ import annotations

VERDICT_SYSTEM_PROMPT = """당신은 한국 도로교통법과 자동차사고 과실비율 인정기준에 정통한 법률 보조 AI다.
사용자가 제공한 사고 상황을 검토하고, 검색된 법령 발췌(컨텍스트)만을 근거로 차량 대 보행자(또는 차량 대 차량) 과실비율을 추정한다.

규칙:
1. 컨텍스트에 없는 조항은 인용하지 말 것. 모르는 경우 confidence를 "low" 로 설정하고 notes에 한계를 적는다.
2. 결과는 반드시 단일 JSON 객체로만 출력. 코드펜스, 머리말, 후기 금지.
3. fault_ratio.vehicle + fault_ratio.pedestrian 의 합은 정확히 100 이어야 한다 (차량 대 차량인 경우에도 vehicle/pedestrian 키를 그대로 사용하지 말고, vehicle_a / vehicle_b 로 응답하라).
4. legal_basis 배열의 각 항목은 article_no(예 "제27조"), article_title, 30~120자 내외 quote, source(파일명 또는 출처 식별자)를 포함한다.
5. 추정에 실질적 영향을 준 조항만 인용한다. 과잉 인용 금지.
6. 모든 텍스트는 한국어로 작성한다."""


VERDICT_USER_TEMPLATE = """사고 상황(자유 텍스트):
\"\"\"{accident_text}\"\"\"

다음은 OpenSearch 벡터검색으로 가져온 관련 법령 발췌 (k={k})이다. 각 항목은
인덱스, 조 번호, 조 제목, 본문 순으로 표시되며, 본문은 청크 단위로 잘려 있을 수 있다.

[CONTEXT_START]
{context_block}
[CONTEXT_END]

위 컨텍스트만을 근거로 다음 JSON 스키마를 채워 응답하라:

{{
  "fault_ratio": {{"vehicle": <0-100 정수>, "pedestrian": <0-100 정수>}},
  "rationale": "<한국어로 200자 내외 설명>",
  "legal_basis": [
    {{
      "article_no": "<예: 제27조>",
      "article_title": "<조 제목>",
      "quote": "<해당 조항에서 30~120자 직접 인용>",
      "source": "<예: law.pdf>"
    }}
  ],
  "confidence": "low|medium|high",
  "notes": "<불확실성, 추가 확인 필요 사항>"
}}

JSON 객체 하나만 출력."""


def build_context_block(hits: list[dict]) -> str:
    """Format retrieved chunks for the LLM prompt."""
    lines: list[str] = []
    for i, h in enumerate(hits, start=1):
        article = h.get("article_no", "?")
        title = h.get("article_title", "")
        source = h.get("source", "?")
        text = (h.get("text") or "").strip()
        # 너무 긴 청크는 잘라 토큰 절약
        if len(text) > 1200:
            text = text[:1200] + " …"
        lines.append(f"[{i}] {article} ({title}) — source={source}\n{text}")
    return "\n\n".join(lines) if lines else "(검색 결과 없음)"
