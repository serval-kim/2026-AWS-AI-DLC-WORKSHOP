"""StructuredAnalysis → 문철어 스크립트 변환 (Bedrock Claude 1회 호출).

ad-hoc/ssol/mock-pipeline.py의 ONE_SHOT_PROMPT를 그대로 사용. 별도 ssol 서비스/프로세스 불필요.
"""
import json
import os
import re

import boto3


_PROMPT_HEADER = """당신은 한문철 변호사의 화법을 완벽하게 재현하는 교통사고 분석 나레이터입니다.

아래 과실비율 분석 데이터를 받아서, 바로 한문철 변호사 스타일("문철어")의 숏폼 나레이션 스크립트를 생성하세요.

## 한문철 화법 특징

### 도입부 패턴
- "자 이 영상 보시죠" / "이거 보세요 이거" / "자 여기 블랙박스 영상입니다"
- 바로 팩트부터 던짐, 불필요한 인사 없음

### 분석부 패턴
- 운전자 호칭: "이 차", "이 분", "뒤에 차", "앞에 차"
- 감탄사: "아~", "에이~", "이게 뭡니까", "보세요 보세요"
- 영상 포인팅: "여기 보시면", "이 순간", "바로 이때"
- 잘못 지적: 직설적 단정 ("이건 완전히 잘못된 거예요", "이러면 안 되는 거예요")
- 반복 강조: "보세요", "이거 봐요"

### 결론부 패턴
- 판결 선고 톤: "이건 7:3입니다", "과실비율 70 대 30이에요"
- 근거 제시: 법 조항 간단 언급 + 상식적 설명
- 마무리: 교훈/경고 ("안전거리 꼭 지키세요", "핸드폰 보면 이렇게 됩니다")

### 전체 톤
- 직설적, 단호하지만 교육적
- 약간의 비꼬기/한탄 섞임
- 말 빠르고 리듬감 있음
- 법률 용어는 쉽게 풀어서 설명

## 규칙
1. 3단 구조: 도입부(상황 요약), 분석부(운전자별 행동 분석), 결론부(과실비율 및 근거)
2. 총 분량: 60초 이내 나레이션 (약 200~250자)
3. 각 구간에 원본 영상 타임스탬프 매핑
4. 핵심 포인트에 **강조** 표시
5. JSON 형식 출력

## 출력 JSON 형식

clips의 effect 종류: "normal"(원속 재생), "slow_2x"(2배 슬로우모션), "slow_4x"(4배 슬로우), "replay"(같은 구간 다시 재생), "freeze"(정지화면)

```json
{
  "script": {
    "intro": {
      "text": "문철어 도입부",
      "duration_sec": 10,
      "emphasis": ["강조 키워드"],
      "clips": [
        {"start": "00:00", "end": "00:03", "effect": "normal", "desc": "주행 장면"}
      ]
    },
    "analysis": {
      "text": "문철어 분석부",
      "duration_sec": 35,
      "emphasis": ["강조 키워드"],
      "clips": [
        {"start": "00:01", "end": "00:03", "effect": "normal", "desc": "사고 전 상황"},
        {"start": "00:03", "end": "00:05", "effect": "slow_2x", "desc": "사고 순간 슬로우"}
      ]
    },
    "conclusion": {
      "text": "문철어 결론부",
      "duration_sec": 15,
      "emphasis": ["강조 키워드"],
      "clips": [
        {"start": "00:04", "end": "00:05", "effect": "freeze", "desc": "충돌 순간 정지"}
      ]
    }
  },
  "total_duration_sec": 60,
  "style_notes": "적용된 문철어 패턴 설명"
}
```

## 과실비율 분석 데이터
"""

_MODEL_ID = "us.anthropic.claude-sonnet-4-20250514-v1:0"


def translate_to_muncheol(structured_analysis: dict) -> dict:
    """StructuredAnalysis dict → 문철어 스크립트 dict (1회 Bedrock 호출)."""
    client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
        "messages": [{
            "role": "user",
            "content": _PROMPT_HEADER + json.dumps(structured_analysis, ensure_ascii=False, indent=2, default=str),
        }],
    })

    response = client.invoke_model(
        modelId=_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )

    text = json.loads(response["body"].read())["content"][0]["text"]
    return _extract_json(text)


def _extract_json(text: str) -> dict:
    match = re.search(r"```json\s*\n(.*?)\n```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1))

    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        return json.loads(text[start:end])

    raise ValueError(f"문철어 JSON 파싱 실패: {text[:300]}")
