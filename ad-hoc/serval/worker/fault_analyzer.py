"""Fault analysis module - RAG search and LLM-based fault ratio determination.

Uses the accident_rag package (ad-hoc/andy/accident-rag) for:
- OpenSearch k-NN vector search against traffic law database
- LLM verdict generation with legal references
"""

import json
import sys
from pathlib import Path

# Add accident-rag package to path
_ACCIDENT_RAG_PATH = str(Path(__file__).parent.parent.parent.parent / "andy" / "accident-rag" / "src")
if _ACCIDENT_RAG_PATH not in sys.path:
    sys.path.insert(0, _ACCIDENT_RAG_PATH)

from shared.clients import BedrockClient
from shared.config import settings
from shared.logging import get_logger
from shared.models.fault import FaultRatio, FaultResult, LegalReference
from shared.models.video import VideoAnalysisResult
from worker.prompts.fault_analysis import build_fault_analysis_prompt

logger = get_logger(__name__)


class FaultAnalyzer:
    """Determines fault ratios using accident_rag package for RAG + LLM analysis."""

    def __init__(self, bedrock: BedrockClient | None = None) -> None:
        self._bedrock = bedrock or BedrockClient()

    def search_references(self, analysis: VideoAnalysisResult) -> list[LegalReference]:
        """Search for relevant legal references using accident_rag package."""
        logger.info("rag_search_start", job_id=analysis.job_id, accident_type=analysis.accident.accident_type)

        try:
            from accident_rag import answer_query

            # Build query from video analysis
            query_text = self._build_search_query(analysis)

            # Use accident_rag's answer_query for RAG search + verdict
            response = answer_query(query_text, k=settings.rag_top_k)

            # Convert retrieved chunks to LegalReference format
            references = []
            for hit in response.retrieved:
                score = hit.get("score", 0.0)
                if score >= settings.rag_min_score:
                    references.append(LegalReference(
                        text=hit.get("text", ""),
                        source=f"{hit.get('article_no', '')} {hit.get('article_title', '')}".strip(),
                        relevance_score=min(score, 1.0),
                        category="law",
                    ))

            logger.info("rag_search_complete", references_found=len(references))
            return references

        except ImportError:
            logger.warning("accident_rag package not available, skipping RAG search")
            return []
        except Exception as e:
            logger.warning("rag_search_failed", error=str(e))
            return []

    def search_and_verdict(self, analysis: VideoAnalysisResult) -> tuple[list[LegalReference], dict | None]:
        """Search references AND get LLM verdict from accident_rag in one call."""
        logger.info("rag_verdict_start", job_id=analysis.job_id)

        try:
            from accident_rag import answer_query

            query_text = self._build_search_query(analysis)
            response = answer_query(query_text, k=settings.rag_top_k)

            # Extract references
            references = []
            for hit in response.retrieved:
                score = hit.get("score", 0.0)
                if score >= settings.rag_min_score:
                    references.append(LegalReference(
                        text=hit.get("text", ""),
                        source=f"{hit.get('article_no', '')} {hit.get('article_title', '')}".strip(),
                        relevance_score=min(score, 1.0),
                        category="law",
                    ))

            logger.info("rag_verdict_complete", references=len(references), has_verdict=bool(response.verdict))
            return references, response.verdict

        except ImportError:
            logger.warning("accident_rag package not available")
            return [], None
        except Exception as e:
            logger.warning("rag_verdict_failed", error=str(e))
            return [], None

    def analyze_fault(
        self,
        analysis: VideoAnalysisResult,
        references: list[LegalReference],
    ) -> FaultResult:
        """Analyze fault ratios using LLM with Extended Thinking."""
        logger.info("fault_analysis_start", job_id=analysis.job_id)

        # Build context
        video_summary = self._summarize_video_analysis(analysis)
        legal_context = self._format_legal_references(references)

        # Build prompt
        prompt = build_fault_analysis_prompt(video_summary, legal_context)

        # Invoke LLM with retries
        for attempt in range(settings.llm_max_retries + 1):
            try:
                response = self._bedrock.invoke_with_thinking(prompt)
                result = self._parse_fault_response(response.content, analysis.job_id)
                logger.info("fault_analysis_complete", job_id=analysis.job_id, attempt=attempt + 1)
                return result
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.warning("fault_analysis_parse_error", attempt=attempt + 1, error=str(e))
                if attempt == settings.llm_max_retries:
                    return FaultResult(
                        job_id=analysis.job_id,
                        undetermined=True,
                        undetermined_reason=f"LLM 응답 파싱 실패: {str(e)}",
                    )

        return FaultResult(job_id=analysis.job_id, undetermined=True, undetermined_reason="Max retries exceeded")

    def run(self, analysis: VideoAnalysisResult) -> FaultResult:
        """Run complete fault analysis using accident_rag for RAG + verdict."""
        # Check if accident type is determinable
        if analysis.accident.accident_type == "unknown" and analysis.accident.confidence == 0.0:
            if not analysis.vehicle_tracks:
                return FaultResult(
                    job_id=analysis.job_id,
                    undetermined=True,
                    undetermined_reason="사고 유형 판별 불가: 차량 궤적 데이터 불충분",
                )

        # Try accident_rag's integrated RAG + verdict first
        references, verdict = self.search_and_verdict(analysis)

        if verdict and verdict.get("fault_ratio"):
            # Validate that ratios sum to 100 before using
            fault_ratio = verdict.get("fault_ratio", {})
            ratio_sum = sum(v for v in fault_ratio.values() if isinstance(v, (int, float)))
            if ratio_sum == 100:
                # Use accident_rag's verdict directly
                result = self._convert_verdict_to_fault_result(verdict, analysis.job_id)
                result.references = references
                logger.info("fault_analysis_from_rag_verdict", job_id=analysis.job_id)
                return result
            else:
                logger.warning("rag_verdict_invalid_ratios", sum=ratio_sum, verdict=verdict)

        # Fallback: use our own LLM call with references as context
        logger.info("fallback_to_direct_llm", job_id=analysis.job_id)
        result = self.analyze_fault(analysis, references)
        result.references = references
        return result

    def _build_search_query(self, analysis: VideoAnalysisResult) -> str:
        """Build a search query from video analysis results."""
        parts = [f"교통사고 유형: {analysis.accident.accident_type}"]

        if analysis.accident.details:
            parts.append(f"상황: {analysis.accident.details}")

        parts.append(f"관련 차량 수: {len(analysis.accident.involved_vehicles)}대")

        if analysis.vehicle_tracks:
            parts.append("차량 궤적 데이터 존재")

        return " ".join(parts)

    def _convert_verdict_to_fault_result(self, verdict: dict, job_id: str) -> FaultResult:
        """Convert accident_rag verdict JSON to FaultResult model."""
        fault_ratio = verdict.get("fault_ratio", {})
        ratios = []

        # Handle vehicle_a/vehicle_b or vehicle/pedestrian format
        if "vehicle_a" in fault_ratio:
            ratios.append(FaultRatio(vehicle_id=0, ratio_percent=fault_ratio.get("vehicle_a", 50)))
            ratios.append(FaultRatio(vehicle_id=1, ratio_percent=fault_ratio.get("vehicle_b", 50)))
        elif "vehicle" in fault_ratio:
            ratios.append(FaultRatio(vehicle_id=0, ratio_percent=fault_ratio.get("vehicle", 50)))
            ratios.append(FaultRatio(vehicle_id=1, ratio_percent=fault_ratio.get("pedestrian", 50)))
        else:
            # Try to parse any key-value pairs as ratios
            for i, (key, val) in enumerate(fault_ratio.items()):
                if isinstance(val, (int, float)):
                    ratios.append(FaultRatio(vehicle_id=i, ratio_percent=int(val)))

        # Extract legal basis as key_faults
        legal_basis = verdict.get("legal_basis", [])
        for ratio in ratios:
            ratio.violated_laws = [
                lb.get("article_no", "") for lb in legal_basis if lb.get("article_no")
            ]

        # Map confidence string to float
        confidence_map = {"low": 0.3, "medium": 0.6, "high": 0.9}
        confidence = confidence_map.get(verdict.get("confidence", "medium"), 0.5)

        return FaultResult(
            job_id=job_id,
            ratios=ratios,
            reasoning=verdict.get("rationale", ""),
            confidence=confidence,
            undetermined=False,
        )

    def _summarize_video_analysis(self, analysis: VideoAnalysisResult) -> str:
        """Create a text summary of video analysis for LLM context."""
        summary_parts = [
            f"사고 유형: {analysis.accident.accident_type}",
            f"사고 신뢰도: {analysis.accident.confidence:.2f}",
            f"관련 차량: {len(analysis.accident.involved_vehicles)}대 (vehicle_id=0은 자차/블랙박스 차량)",
            f"영상 길이: {analysis.video_duration:.1f}초",
            f"분석 프레임 수: {analysis.total_frames}",
        ]

        if analysis.accident.details:
            summary_parts.append(f"사고 상세: {analysis.accident.details}")

        if analysis.accident.collision_timestamp > 0:
            summary_parts.append(f"충돌 추정 시간: {analysis.accident.collision_timestamp:.1f}초")

        # Vehicle track summaries
        for track in analysis.vehicle_tracks[:5]:  # Limit to top 5
            duration = track.last_seen - track.first_seen
            summary_parts.append(
                f"차량 {track.vehicle_id}: {track.first_seen:.1f}초~{track.last_seen:.1f}초 "
                f"(추적 {duration:.1f}초, {len(track.track_points)} 포인트)"
            )

        # Traffic light info
        if analysis.traffic_lights:
            red_count = sum(1 for tl in analysis.traffic_lights if tl.state == "red")
            summary_parts.append(f"신호등 탐지: {len(analysis.traffic_lights)}회 (적색: {red_count}회)")

        return "\n".join(summary_parts)

    def _format_legal_references(self, references: list[LegalReference]) -> str:
        """Format legal references for LLM context."""
        if not references:
            return "관련 법규/판례 검색 결과 없음. 일반적인 도로교통법 원칙에 따라 판단하세요."

        parts = []
        for i, ref in enumerate(references, 1):
            parts.append(f"[{i}] ({ref.category}) {ref.source}\n{ref.text}\n(유사도: {ref.relevance_score:.2f})")

        return "\n\n".join(parts)

    def _parse_fault_response(self, content: str, job_id: str) -> FaultResult:
        """Parse LLM response into FaultResult."""
        # Extract JSON from response (may be wrapped in markdown code block)
        json_str = content
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0].strip()

        data = json.loads(json_str)

        ratios = [FaultRatio(**r) for r in data.get("ratios", [])]

        # Validate ratios sum to 100
        if ratios:
            total = sum(r.ratio_percent for r in ratios)
            if total != 100:
                raise ValueError(f"Fault ratios sum to {total}, expected 100")

        return FaultResult(
            job_id=job_id,
            ratios=ratios,
            reasoning=data.get("reasoning", ""),
            confidence=data.get("confidence", 0.0),
            undetermined=data.get("undetermined", False),
            undetermined_reason=data.get("undetermined_reason"),
        )
