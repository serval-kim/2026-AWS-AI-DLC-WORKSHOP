"""Fault analysis module - RAG search and LLM-based fault ratio determination."""

import json

from shared.clients import BedrockClient, OpenSearchClient
from shared.config import settings
from shared.logging import get_logger
from shared.models.fault import FaultRatio, FaultResult, LegalReference
from shared.models.video import VideoAnalysisResult
from worker.prompts.fault_analysis import build_fault_analysis_prompt

logger = get_logger(__name__)


class FaultAnalyzer:
    """Determines fault ratios using RAG + LLM analysis."""

    def __init__(self, bedrock: BedrockClient | None = None, opensearch: OpenSearchClient | None = None) -> None:
        self._bedrock = bedrock or BedrockClient()
        self._opensearch = opensearch or OpenSearchClient()

    def search_references(self, analysis: VideoAnalysisResult) -> list[LegalReference]:
        """Search OpenSearch for relevant legal references using RAG."""
        logger.info("rag_search_start", job_id=analysis.job_id, accident_type=analysis.accident.accident_type)

        # Build search query from analysis
        query_text = self._build_search_query(analysis)

        # Generate embedding for query
        query_vector = self._bedrock.generate_embedding(query_text)

        # Search OpenSearch
        try:
            results = self._opensearch.search(query_vector, k=settings.rag_top_k)
        except Exception as e:
            logger.warning("rag_search_failed", error=str(e))
            return []

        # Filter by minimum score and convert to LegalReference
        references = []
        for hit in results:
            if hit["score"] >= settings.rag_min_score:
                references.append(LegalReference(
                    text=hit["text"],
                    source=hit["source"],
                    relevance_score=hit["score"],
                    category=hit.get("category", "law"),
                ))

        logger.info("rag_search_complete", references_found=len(references))
        return references

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
        """Run complete fault analysis (RAG + LLM)."""
        # Check if accident type is determinable
        if analysis.accident.accident_type == "unknown" and analysis.accident.confidence == 0.0:
            if not analysis.vehicle_tracks:
                return FaultResult(
                    job_id=analysis.job_id,
                    undetermined=True,
                    undetermined_reason="사고 유형 판별 불가: 차량 궤적 데이터 불충분",
                )

        # Step 1: RAG search
        references = self.search_references(analysis)

        # Step 2: LLM fault analysis (proceeds even without RAG results)
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
