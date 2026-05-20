"""Serval StructuredAnalysis → Ssol pipeline 입력 변환.

Accepts the Pydantic StructuredAnalysis model directly from Serval's
ScriptGenerator output and converts it to the dict format expected by
Ssol's mock_pipeline.
"""

import sys
from pathlib import Path

_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_SERVAL_PATH = str(_BASE_DIR / "ad-hoc" / "serval")
if _SERVAL_PATH not in sys.path:
    sys.path.insert(0, _SERVAL_PATH)

from shared.models.analysis import StructuredAnalysis

from utils import float_to_ts


def structured_analysis_to_pipeline_input(analysis: StructuredAnalysis) -> dict:
    """Convert Serval's StructuredAnalysis → Ssol mock_pipeline input format.

    Args:
        analysis: Pydantic StructuredAnalysis model from Serval.

    Returns:
        Dict matching the interface contract expected by Ssol pipeline.
    """
    return {
        "accident_type": analysis.intro.accident_type,
        "fault_ratios": analysis.conclusion.fault_ratios,
        "legal_basis": analysis.conclusion.legal_basis,
        "video_duration": analysis.intro.timestamp.end,
        "collision_timestamp": analysis.analysis.timestamp.end,
        "driver_actions": [
            {
                "vehicle_id": da.vehicle_id,
                "action": da.action,
                "fault_point": da.fault_point,
                "violated_law": da.violated_law,
                "timestamp": float_to_ts(da.timestamp.start),
            }
            for da in analysis.analysis.driver_actions
        ],
        "disclaimer": analysis.conclusion.disclaimer,
    }


def pipeline_input_to_script_prompt(data: dict) -> str:
    """Generate text prompt for Ssol's LLM (mock_pipeline replacement).

    Args:
        data: Pipeline input dict from structured_analysis_to_pipeline_input.

    Returns:
        Formatted Korean text summarizing the accident for script generation.
    """
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
