"""Script generation module - structured 3-part analysis output."""

import json

from shared.clients import BedrockClient
from shared.config import settings
from shared.logging import get_logger
from shared.models.analysis import (
    AnalysisSection,
    ConclusionSection,
    DriverAction,
    IntroSection,
    StructuredAnalysis,
    TimestampRange,
)
from shared.models.fault import FaultResult
from shared.models.video import VideoAnalysisResult
from worker.prompts.script_generation import build_script_generation_prompt

logger = get_logger(__name__)


class ScriptGenerator:
    """Generates structured 3-part analysis output (Req 4)."""

    def __init__(self, bedrock: BedrockClient | None = None) -> None:
        self._bedrock = bedrock or BedrockClient()

    def generate_structure(
        self,
        fault_result: FaultResult,
        video_analysis: VideoAnalysisResult,
    ) -> StructuredAnalysis:
        """Generate structured 3-part analysis JSON."""
        logger.info("script_generation_start", job_id=fault_result.job_id)

        # Build context
        fault_summary = self._summarize_fault_result(fault_result)
        video_summary = self._summarize_video_metadata(video_analysis)

        # Build prompt
        prompt = build_script_generation_prompt(fault_summary, video_summary)

        # Invoke LLM with retries
        for attempt in range(settings.llm_max_retries + 1):
            try:
                response = self._bedrock.invoke_with_thinking(prompt)
                result = self._parse_script_response(response.content, fault_result.job_id)
                logger.info("script_generation_complete", job_id=fault_result.job_id, attempt=attempt + 1)
                return result
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.warning("script_generation_parse_error", attempt=attempt + 1, error=str(e))
                if attempt == settings.llm_max_retries:
                    raise RuntimeError(f"Script generation failed after {settings.llm_max_retries + 1} attempts: {e}")

        raise RuntimeError("Script generation failed: unexpected state")

    def run(self, fault_result: FaultResult, video_analysis: VideoAnalysisResult) -> StructuredAnalysis:
        """Run script generation."""
        return self.generate_structure(fault_result, video_analysis)

    def _summarize_fault_result(self, fault_result: FaultResult) -> str:
        """Summarize fault result for LLM context."""
        parts = []
        for ratio in fault_result.ratios:
            faults_str = ", ".join(ratio.key_faults) if ratio.key_faults else "없음"
            laws_str = ", ".join(ratio.violated_laws) if ratio.violated_laws else "없음"
            vehicle_label = "자차(블랙박스)" if ratio.vehicle_id == 0 else f"상대차량 {ratio.vehicle_id}"
            parts.append(
                f"- {vehicle_label}: 과실 {ratio.ratio_percent}% "
                f"(과실: {faults_str}, 위반법규: {laws_str})"
            )

        return (
            f"과실비율 판단 결과:\n"
            + "\n".join(parts)
            + f"\n\n판단 근거: {fault_result.reasoning}"
        )

    def _summarize_video_metadata(self, video_analysis: VideoAnalysisResult) -> str:
        """Summarize video metadata and timeline for LLM context."""
        parts = [
            f"영상 길이: {video_analysis.video_duration:.1f}초",
            f"사고 유형: {video_analysis.accident.accident_type}",
            f"충돌 추정 시간: {video_analysis.accident.collision_timestamp:.1f}초",
            f"관련 차량 수: {len(video_analysis.accident.involved_vehicles)}대",
        ]

        # Add track timeline info
        for track in video_analysis.vehicle_tracks[:5]:
            parts.append(f"차량 {track.vehicle_id}: {track.first_seen:.1f}초 ~ {track.last_seen:.1f}초")

        return "\n".join(parts)

    def _parse_script_response(self, content: str, job_id: str) -> StructuredAnalysis:
        """Parse LLM response into StructuredAnalysis."""
        # Extract JSON
        json_str = content
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0].strip()

        data = json.loads(json_str)

        # Parse intro
        intro_data = data["intro"]
        intro = IntroSection(
            summary=intro_data["summary"],
            accident_type=intro_data["accident_type"],
            timestamp=TimestampRange(**intro_data["timestamp"]),
            involved_vehicles=intro_data.get("involved_vehicles", 2),
        )

        # Parse analysis
        analysis_data = data["analysis"]
        driver_actions = [
            DriverAction(
                vehicle_id=da["vehicle_id"],
                action=da["action"],
                fault_point=da["fault_point"],
                violated_law=da.get("violated_law", ""),
                timestamp=TimestampRange(**da["timestamp"]),
            )
            for da in analysis_data.get("driver_actions", [])
        ]
        analysis = AnalysisSection(
            driver_actions=driver_actions,
            timestamp=TimestampRange(**analysis_data["timestamp"]),
        )

        # Parse conclusion
        conclusion_data = data["conclusion"]
        conclusion = ConclusionSection(
            fault_ratios=conclusion_data.get("fault_ratios", []),
            legal_basis=conclusion_data.get("legal_basis", []),
            timestamp=TimestampRange(**conclusion_data["timestamp"]),
            disclaimer=conclusion_data.get("disclaimer", "본 분석은 AI 추정치이며 법적 효력이 없습니다."),
        )

        return StructuredAnalysis(
            job_id=job_id,
            intro=intro,
            analysis=analysis,
            conclusion=conclusion,
        )
