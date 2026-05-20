"""
Mock Pipeline: 과실비율 데이터 → 한문철 스타일 스크립트 변환 PoC
================================================================
Step 1: Mock 과실비율 분석 데이터 생성
Step 2: 중립 분석 스크립트 생성 (Script_Generator)
Step 3: 한문철 스타일 변환 (Muncheol_Translator)

사전 설치:
  pip install boto3 anthropic

사용법:
  python mock-pipeline.py
  python mock-pipeline.py --one-shot  # 2단계 합쳐서 바로 문철어 생성
"""

import argparse
import json
import os
import sys
from pathlib import Path

# ============================================================
# Step 1: Mock 데이터
# ============================================================

MOCK_FAULT_DATA = {
    "analysis_id": "mock-001",
    "accident_type": "추돌",
    "vehicles": [
        {
            "id": "A",
            "role": "가해",
            "vehicle_type": "승용차 (흰색 소나타)",
            "action": "전방 주시 태만 상태에서 급정거한 앞차를 추돌",
            "speed_estimate": "약 60km/h",
            "violations": ["안전거리 미확보", "전방주시 의무 위반"],
        },
        {
            "id": "B",
            "role": "피해",
            "vehicle_type": "SUV (검정 투싼)",
            "action": "정상 주행 중 전방 보행자 출현으로 급정거",
            "speed_estimate": "약 50km/h → 0km/h",
            "violations": ["급제동 시 비상등 미점등"],
        },
    ],
    "fault_ratio": {"A": 70, "B": 30},
    "legal_basis": [
        "도로교통법 제19조 제1항 (안전거리 확보 의무)",
        "도로교통법 제49조 제1항 제1호 (전방주시 의무)",
        "대법원 2018다234567 판례: 추돌사고 시 후행차 기본과실 70%",
        "B차량 급제동 시 비상등 미점등으로 과실 상계 적용",
    ],
    "timeline": [
        {"timestamp": "00:01", "event": "A, B 차량 편도 2차로 도로 주행 중"},
        {"timestamp": "00:03", "event": "B차량 전방 무단횡단 보행자 발견"},
        {"timestamp": "00:03.5", "event": "B차량 급정거 (비상등 미점등)"},
        {"timestamp": "00:04", "event": "A차량 핸드폰 조작 중 전방 상황 인지 실패"},
        {"timestamp": "00:05", "event": "A차량 B차량 후미 추돌 (시속 약 40km/h)"},
        {"timestamp": "00:06", "event": "충돌 후 A차량 정지, B차량 전방 2m 밀림"},
    ],
    "disclaimer": "본 분석은 AI 추정치이며 법적 효력이 없습니다.",
}


def get_mock_data() -> dict:
    """Mock 과실비율 분석 데이터를 반환한다."""
    print("[Step 1] Mock 과실비율 데이터 로드")
    print(f"  사고 유형: {MOCK_FAULT_DATA['accident_type']}")
    print(f"  과실비율: A({MOCK_FAULT_DATA['fault_ratio']['A']}%) : B({MOCK_FAULT_DATA['fault_ratio']['B']}%)")
    print()
    return MOCK_FAULT_DATA


# ============================================================
# Step 2: Script_Generator - 중립 분석 스크립트 생성
# ============================================================

SCRIPT_GENERATOR_PROMPT = """당신은 교통사고 분석 나레이션 스크립트 작성 전문가입니다.

아래 과실비율 분석 데이터를 기반으로, 숏폼 영상(60초)용 나레이션 스크립트를 작성하세요.

## 규칙
1. 3단 구조로 작성: 도입부(상황 요약), 분석부(운전자별 행동 분석), 결론부(과실비율 및 근거)
2. 총 분량: 나레이션 기준 60초 이내 (약 200~250자)
3. 각 구간에 대응하는 원본 영상 타임스탬프를 명시
4. 중립적이고 객관적인 톤으로 작성
5. JSON 형식으로 출력

## 출력 JSON 형식

clips의 effect 종류: "normal"(원속 재생), "slow_2x"(2배 슬로우모션), "slow_4x"(4배 슬로우), "replay"(같은 구간 다시 재생), "freeze"(정지화면)

```json
{
  "script": {
    "intro": {
      "text": "도입부 나레이션 텍스트",
      "duration_sec": 10,
      "clips": [
        {"start": "00:00", "end": "00:03", "effect": "normal", "desc": "주행 장면"}
      ]
    },
    "analysis": {
      "text": "분석부 나레이션 텍스트",
      "duration_sec": 35,
      "clips": [
        {"start": "00:01", "end": "00:03", "effect": "normal", "desc": "사고 전 상황"},
        {"start": "00:03", "end": "00:05", "effect": "slow_2x", "desc": "사고 순간 슬로우"},
        {"start": "00:03", "end": "00:05", "effect": "replay", "desc": "다시 보기"}
      ]
    },
    "conclusion": {
      "text": "결론부 나레이션 텍스트",
      "duration_sec": 15,
      "clips": [
        {"start": "00:04", "end": "00:05", "effect": "freeze", "desc": "충돌 순간 정지"},
        {"start": "00:00", "end": "00:06", "effect": "slow_4x", "desc": "전체 요약 슬로우"}
      ]
    }
  },
  "total_duration_sec": 60,
  "word_count": 250
}
```

## 과실비율 분석 데이터
"""

MUNCHEOL_TRANSLATOR_PROMPT = """당신은 한문철 변호사의 화법을 완벽하게 재현하는 전문가입니다.

아래 중립적 분석 스크립트를 한문철 변호사 스타일("문철어")로 번역하세요.

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
1. 원본의 3단 구조(도입/분석/결론)와 타임스탬프 매핑을 유지
2. 60초 이내 나레이션 분량 유지
3. 핵심 포인트(사고 원인, 과실 판정 순간)에 **강조** 표시
4. JSON 형식 유지

## 출력 JSON 형식

clips의 effect 종류: "normal"(원속 재생), "slow_2x"(2배 슬로우모션), "slow_4x"(4배 슬로우), "replay"(같은 구간 다시 재생), "freeze"(정지화면)

```json
{
  "script": {
    "intro": {
      "text": "문철어 도입부",
      "duration_sec": 10,
      "emphasis": ["강조할 키워드"],
      "clips": [
        {"start": "00:00", "end": "00:03", "effect": "normal", "desc": "주행 장면"}
      ]
    },
    "analysis": {
      "text": "문철어 분석부",
      "duration_sec": 35,
      "emphasis": ["강조할 키워드"],
      "clips": [
        {"start": "00:01", "end": "00:03", "effect": "normal", "desc": "사고 전 상황"},
        {"start": "00:03", "end": "00:05", "effect": "slow_2x", "desc": "사고 순간 슬로우"},
        {"start": "00:03", "end": "00:05", "effect": "replay", "desc": "다시 보기"}
      ]
    },
    "conclusion": {
      "text": "문철어 결론부",
      "duration_sec": 15,
      "emphasis": ["강조할 키워드"],
      "clips": [
        {"start": "00:04", "end": "00:05", "effect": "freeze", "desc": "충돌 순간 정지"},
        {"start": "00:00", "end": "00:06", "effect": "slow_4x", "desc": "전체 요약 슬로우"}
      ]
    }
  },
  "total_duration_sec": 60,
  "style_notes": "적용된 문철어 패턴 설명"
}
```

## 원본 중립 스크립트
"""

ONE_SHOT_PROMPT = """당신은 한문철 변호사의 화법을 완벽하게 재현하는 교통사고 분석 나레이터입니다.

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

## Few-shot 예시

### 예시 입력
사고유형: 신호위반 직진 vs 좌회전
과실비율: 신호위반 차량 100%

### 예시 출력
```
[도입부]
자 이 영상 보시죠. 교차로에서 좌회전하는 차, 그리고 직진하는 차. 근데 문제는요...

[분석부]  
여기 보세요. 이 직진 차, 신호가 뭡니까? 빨간불이에요 빨간불. 아 근데 그냥 가요 그냥. 
이거 보세요 속도도 안 줄여요. 에이~ 이건 뭡니까 이게.
좌회전 차는요, 좌회전 신호 받고 정상적으로 진행한 거예요. 아무 잘못 없어요.

[결론부]
이건요, 100대 0입니다. 빨간불에 그냥 직진한 이 차, 100% 과실이에요.
신호는 왜 있는 겁니까. 지키라고 있는 거예요. 제발 신호 지킵시다.
```

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
        {"start": "00:03", "end": "00:05", "effect": "slow_2x", "desc": "사고 순간 슬로우"},
        {"start": "00:03", "end": "00:05", "effect": "replay", "desc": "다시 보기"}
      ]
    },
    "conclusion": {
      "text": "문철어 결론부",
      "duration_sec": 15,
      "emphasis": ["강조 키워드"],
      "clips": [
        {"start": "00:04", "end": "00:05", "effect": "freeze", "desc": "충돌 순간 정지"},
        {"start": "00:00", "end": "00:06", "effect": "slow_4x", "desc": "전체 요약 슬로우"}
      ]
    }
  },
  "total_duration_sec": 60,
  "style_notes": "적용된 문철어 패턴 설명"
}
```

## 과실비율 분석 데이터
"""


# ============================================================
# Bedrock 클라이언트 헬퍼
# ============================================================
def _call_claude(prompt: str) -> str:
    """AWS Bedrock을 통해 Claude를 호출한다."""
    import boto3

    client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    })

    response = client.invoke_model(
        modelId="us.anthropic.claude-sonnet-4-20250514-v1:0",
        contentType="application/json",
        accept="application/json",
        body=body,
    )

    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


# ============================================================
# Step 2 실행: 중립 스크립트 생성
# ============================================================
def generate_neutral_script(fault_data: dict) -> dict:
    """과실비율 데이터로 중립 분석 스크립트를 생성한다."""
    print("[Step 2] 중립 분석 스크립트 생성 중 (Bedrock Claude)...")

    prompt = SCRIPT_GENERATOR_PROMPT + json.dumps(fault_data, ensure_ascii=False, indent=2)

    try:
        response_text = _call_claude(prompt)
        script_json = _extract_json(response_text)
        print("  ✅ 중립 스크립트 생성 완료")
        print(f"  📝 도입부: {script_json['script']['intro']['text'][:50]}...")
        print()
        return script_json

    except Exception as e:
        print(f"  ❌ Bedrock API 에러: {e}")
        sys.exit(1)


# ============================================================
# Step 3 실행: 문철어 변환
# ============================================================
def translate_to_muncheol(neutral_script: dict) -> dict:
    """중립 스크립트를 한문철 스타일로 변환한다."""
    print("[Step 3] 문철어 변환 중 (Bedrock Claude)...")

    prompt = MUNCHEOL_TRANSLATOR_PROMPT + json.dumps(neutral_script, ensure_ascii=False, indent=2)

    try:
        response_text = _call_claude(prompt)
        muncheol_json = _extract_json(response_text)
        print("  ✅ 문철어 변환 완료")
        print(f"  🎤 도입부: {muncheol_json['script']['intro']['text'][:50]}...")
        print()
        return muncheol_json

    except Exception as e:
        print(f"  ❌ Bedrock API 에러: {e}")
        sys.exit(1)


# ============================================================
# One-shot: 바로 문철어 생성
# ============================================================
def generate_muncheol_direct(fault_data: dict) -> dict:
    """과실비율 데이터에서 바로 문철어 스크립트를 생성한다 (1회 호출)."""
    print("[One-shot] 과실비율 데이터 → 문철어 스크립트 직접 생성 중 (Bedrock Claude)...")

    prompt = ONE_SHOT_PROMPT + json.dumps(fault_data, ensure_ascii=False, indent=2)

    try:
        response_text = _call_claude(prompt)
        muncheol_json = _extract_json(response_text)
        print("  ✅ 문철어 스크립트 생성 완료")
        print(f"  🎤 도입부: {muncheol_json['script']['intro']['text'][:50]}...")
        print()
        return muncheol_json

    except Exception as e:
        print(f"  ❌ Bedrock API 에러: {e}")
        sys.exit(1)


# ============================================================
# 유틸리티
# ============================================================
def _extract_json(text: str) -> dict:
    """응답 텍스트에서 JSON 블록을 추출한다."""
    # ```json ... ``` 블록 찾기
    import re

    json_match = re.search(r"```json\s*\n(.*?)\n```", text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group(1))

    # 블록 없으면 전체를 JSON으로 파싱 시도
    # { 로 시작하는 부분 찾기
    brace_start = text.find("{")
    brace_end = text.rfind("}") + 1
    if brace_start != -1 and brace_end > brace_start:
        return json.loads(text[brace_start:brace_end])

    raise ValueError(f"JSON 파싱 실패. 응답:\n{text[:500]}")


def print_result(result: dict, label: str):
    """결과를 보기 좋게 출력한다."""
    print("=" * 60)
    print(f"📋 {label}")
    print("=" * 60)

    script = result.get("script", {})

    for section_key, section_name in [("intro", "도입부"), ("analysis", "분석부"), ("conclusion", "결론부")]:
        section = script.get(section_key, {})
        print(f"\n▶ [{section_name}] ({section.get('duration_sec', '?')}초)")

        # clips 배열 출력
        clips = section.get("clips", [])
        if clips:
            for i, clip in enumerate(clips):
                effect_str = clip.get("effect", "normal")
                print(f"  🎬 클립{i+1}: {clip.get('start','?')}~{clip.get('end','?')} [{effect_str}] {clip.get('desc','')}")
        else:
            # 구버전 호환 (video_timestamp)
            ts = section.get("video_timestamp", {})
            if ts:
                print(f"  영상구간: {ts.get('start', '?')} ~ {ts.get('end', '?')}")

        print(f"  📝 {section.get('text', '(없음)')}")
        if section.get("emphasis"):
            print(f"  💡 강조: {', '.join(section['emphasis'])}")

    print(f"\n⏱️  총 길이: {result.get('total_duration_sec', '?')}초")
    if result.get("style_notes"):
        print(f"📝 스타일 노트: {result['style_notes']}")
    print()


def save_result(result: dict, filename: str):
    """결과를 JSON 파일로 저장한다."""
    output_dir = Path(__file__).parent / "mock-output"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / filename
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"💾 저장됨: {output_path}")


# ============================================================
# Main
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="Mock Pipeline: 과실비율 → 문철어 스크립트")
    parser.add_argument("--one-shot", action="store_true", help="2단계 합쳐서 바로 문철어 생성 (API 1회 호출)")
    parser.add_argument("--dry-run", action="store_true", help="API 호출 없이 mock 데이터만 확인")
    parser.add_argument("--mock-response", action="store_true", help="API 없이 mock 응답으로 전체 흐름 검증")
    parser.add_argument("--bedrock", action="store_true", help="AWS Bedrock Claude 사용 (API 키 불필요, AWS 자격증명 필요)")
    args = parser.parse_args()

    print()
    print("🚗💥 Mock Pipeline: 과실비율 데이터 → 한문철 스타일 스크립트")
    print("=" * 60)
    print()

    # Step 1: Mock 데이터 로드
    fault_data = get_mock_data()

    if args.dry_run:
        print("[Dry Run] Mock 데이터 확인:")
        print(json.dumps(fault_data, ensure_ascii=False, indent=2))
        print("\n✅ Dry run 완료. --dry-run 빼고 실행하면 Claude API 호출합니다.")
        return

    if args.one_shot:
        # One-shot: 바로 문철어 생성
        muncheol_script = generate_muncheol_direct(fault_data)
        print_result(muncheol_script, "문철어 스크립트 (One-shot)")
        save_result(muncheol_script, "muncheol-script-oneshot.json")
    else:
        # 2단계: 중립 → 문철어
        neutral_script = generate_neutral_script(fault_data)
        print_result(neutral_script, "중립 분석 스크립트")
        save_result(neutral_script, "neutral-script.json")

        muncheol_script = translate_to_muncheol(neutral_script)
        print_result(muncheol_script, "문철어 스크립트 (2-step)")
        save_result(muncheol_script, "muncheol-script-2step.json")

    print("=" * 60)
    print("✅ 파이프라인 완료!")
    print()
    print("📊 비교 실행하려면:")
    print("  python mock-pipeline.py           # 2단계 (중립→문철어)")
    print("  python mock-pipeline.py --one-shot # 1단계 (바로 문철어)")
    print("  python mock-pipeline.py --dry-run  # API 없이 데이터만 확인")
    print("=" * 60)


if __name__ == "__main__":
    main()
