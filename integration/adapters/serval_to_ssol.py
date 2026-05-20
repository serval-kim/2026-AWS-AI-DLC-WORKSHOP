"""Serval StructuredAnalysis → Ssol mock_pipeline 입력 변환"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ad-hoc", "serval"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ad-hoc", "ssol"))

from utils import float_to_ts


def structured_analysis_to_pipeline_input(analysis: dict) -> dict:
    """
    Serval의 StructuredAnalysis dict → Ssol mock_pipeline이 기대하는 입력 형식.
    """
    return {
        "accident_type": analysis["intro"]["accident_type"],
        "fault_ratios": analysis["conclusion"]["fault_ratios"],
        "legal_basis": analysis["conclusion"]["legal_basis"],
        "video_duration": analysis["intro"]["timestamp"]["end"],
        "collision_timestamp": analysis["analysis"]["timestamp"]["end"],
        "driver_actions": [
            {
                "vehicle_id": da["vehicle_id"],
                "action": da["action"],
                "fault_point": da["fault_point"],
                "violated_law": da["violated_law"],
                "timestamp": float_to_ts(da["timestamp"]["start"]),
            }
            for da in analysis["analysis"]["driver_actions"]
        ],
        "disclaimer": analysis["conclusion"].get("disclaimer", ""),
    }


def pipeline_input_to_script_prompt(data: dict) -> str:
    """Ssol의 LLM 프롬프트용 텍스트 생성 (mock_pipeline 대체)"""
    ratios = ", ".join(
        f"차량{r.get('vehicle_id', '?')}: {r.get('ratio_percent', '?')}%"
        for r in data.get("fault_ratios", [])
    )
    actions = "\n".join(
        f"- 차량{da['vehicle_id']}: {da['action']} ({da['fault_point']})"
        for da in data.get("driver_actions", [])
    )
    laws = ", ".join(data.get("legal_basis", []))

    return f"""사고 유형: {data['accident_type']}
과실비율: {ratios}
관련 법규: {laws}
영상 길이: {data['video_duration']}초
충돌 시점: {data['collision_timestamp']}초

운전자 행동:
{actions}
"""
