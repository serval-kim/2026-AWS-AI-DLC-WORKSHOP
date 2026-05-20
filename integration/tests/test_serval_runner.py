"""Example-based tests for ServalAnalysisRunner.

PBT-10 Compliance: These example-based tests complement the property-based
tests in test_pbt_adapter.py by pinning specific business-critical scenarios.
"""

from unittest.mock import MagicMock, patch
import pytest

from shared.models.analysis import (
    AnalysisSection,
    ConclusionSection,
    DriverAction,
    IntroSection,
    StructuredAnalysis,
    TimestampRange,
)
from shared.models.fault import FaultRatio, FaultResult
from shared.models.video import (
    AccidentClassification,
    AccidentType,
    VideoAnalysisResult,
)
from adapters.serval_runner import ServalAnalysisRunner, ServalAnalysisResult


# =============================================================================
# Fixtures
# =============================================================================


def make_video_analysis(job_id: str = "test-001") -> VideoAnalysisResult:
    """Create a minimal VideoAnalysisResult for testing."""
    return VideoAnalysisResult(
        job_id=job_id,
        video_duration=6.0,
        total_frames=12,
        fps_extracted=2,
        accident=AccidentClassification(
            accident_type=AccidentType.REAR_END,
            confidence=0.85,
            involved_vehicles=[0, 1],
            collision_timestamp=4.5,
            details="뒤차가 앞차를 추돌",
        ),
    )


def make_fault_result(job_id: str = "test-001") -> FaultResult:
    """Create a FaultResult with determined ratios."""
    return FaultResult(
        job_id=job_id,
        ratios=[
            FaultRatio(vehicle_id=0, ratio_percent=30, key_faults=["급정거"], violated_laws=["도로교통법 제49조"]),
            FaultRatio(vehicle_id=1, ratio_percent=70, key_faults=["안전거리 미확보"], violated_laws=["도로교통법 제19조"]),
        ],
        reasoning="뒤차의 안전거리 미확보가 주된 원인",
        confidence=0.8,
        undetermined=False,
    )


def make_structured_analysis(job_id: str = "test-001") -> StructuredAnalysis:
    """Create a complete StructuredAnalysis."""
    return StructuredAnalysis(
        job_id=job_id,
        intro=IntroSection(
            summary="2차로에서 추돌 사고 발생",
            accident_type="추돌",
            timestamp=TimestampRange(start=0.0, end=6.0),
            involved_vehicles=2,
        ),
        analysis=AnalysisSection(
            driver_actions=[
                DriverAction(
                    vehicle_id=0,
                    action="급정거",
                    fault_point="전방주시 태만",
                    violated_law="도로교통법 제49조",
                    timestamp=TimestampRange(start=2.0, end=3.0),
                ),
                DriverAction(
                    vehicle_id=1,
                    action="안전거리 미확보",
                    fault_point="안전거리 미확보",
                    violated_law="도로교통법 제19조",
                    timestamp=TimestampRange(start=1.0, end=4.0),
                ),
            ],
            timestamp=TimestampRange(start=0.0, end=4.5),
        ),
        conclusion=ConclusionSection(
            fault_ratios=[
                {"vehicle_id": 0, "ratio_percent": 30},
                {"vehicle_id": 1, "ratio_percent": 70},
            ],
            legal_basis=["도로교통법 제19조", "도로교통법 제49조"],
            timestamp=TimestampRange(start=4.5, end=6.0),
        ),
    )


# =============================================================================
# ServalAnalysisRunner Tests
# =============================================================================


class TestServalAnalysisRunnerSuccess:
    """Test successful full pipeline execution."""

    @patch("adapters.serval_runner.ScriptGenerator")
    @patch("adapters.serval_runner.FaultAnalyzer")
    @patch("adapters.serval_runner.VideoAnalyzer")
    @patch("adapters.serval_runner.S3Client")
    def test_full_pipeline_success(self, mock_s3_cls, mock_va_cls, mock_fa_cls, mock_sg_cls):
        """Full pipeline: VideoAnalyzer → FaultAnalyzer → ScriptGenerator → StructuredAnalysis."""
        # Setup mocks
        mock_s3 = mock_s3_cls.return_value
        mock_s3.download_file.return_value = "/tmp/test/input.mp4"

        mock_va = mock_va_cls.return_value
        video_analysis = make_video_analysis()
        mock_va.analyze.return_value = video_analysis

        mock_fa = mock_fa_cls.return_value
        fault_result = make_fault_result()
        mock_fa.run.return_value = fault_result

        mock_sg = mock_sg_cls.return_value
        structured = make_structured_analysis()
        mock_sg.run.return_value = structured

        # Execute
        runner = ServalAnalysisRunner()
        result = runner.run("videos/test.mp4", "test-001")

        # Verify
        assert result.success is True
        assert result.status == "completed"
        assert result.structured_analysis is not None
        assert result.structured_analysis.job_id == "test-001"
        assert len(result.errors) == 0

    @patch("adapters.serval_runner.ScriptGenerator")
    @patch("adapters.serval_runner.FaultAnalyzer")
    @patch("adapters.serval_runner.VideoAnalyzer")
    @patch("adapters.serval_runner.S3Client")
    def test_partial_results_tracked(self, mock_s3_cls, mock_va_cls, mock_fa_cls, mock_sg_cls):
        """Partial results are populated as stages complete."""
        mock_s3 = mock_s3_cls.return_value
        mock_s3.download_file.return_value = "/tmp/test/input.mp4"

        mock_va = mock_va_cls.return_value
        mock_va.analyze.return_value = make_video_analysis()

        mock_fa = mock_fa_cls.return_value
        mock_fa.run.return_value = make_fault_result()

        mock_sg = mock_sg_cls.return_value
        mock_sg.run.return_value = make_structured_analysis()

        runner = ServalAnalysisRunner()
        result = runner.run("videos/test.mp4", "test-001")

        assert "video_analysis" in result.partial_results
        assert "fault_result" in result.partial_results


class TestServalAnalysisRunnerFailure:
    """Test failure scenarios following BR-2 rules."""

    @patch("adapters.serval_runner.VideoAnalyzer")
    @patch("adapters.serval_runner.S3Client")
    def test_video_analysis_failure_non_recoverable(self, mock_s3_cls, mock_va_cls):
        """BR-2.1: Non-recoverable video error → FAILED, no partial results."""
        mock_s3 = mock_s3_cls.return_value
        mock_s3.download_file.return_value = "/tmp/test/input.mp4"

        mock_va = mock_va_cls.return_value
        mock_va.analyze.side_effect = RuntimeError("NO_VEHICLE: No vehicles detected")

        runner = ServalAnalysisRunner()
        result = runner.run("videos/test.mp4", "test-001")

        assert result.success is False
        assert result.status == "failed"
        assert len(result.errors) == 1
        assert result.errors[0].error_type == "NO_VEHICLE"
        assert result.errors[0].recoverable is False

    @patch("adapters.serval_runner.FaultAnalyzer")
    @patch("adapters.serval_runner.VideoAnalyzer")
    @patch("adapters.serval_runner.S3Client")
    def test_fault_analysis_failure_partial(self, mock_s3_cls, mock_va_cls, mock_fa_cls):
        """BR-2.3: FaultAnalyzer fails → PARTIAL with video_analysis only."""
        mock_s3 = mock_s3_cls.return_value
        mock_s3.download_file.return_value = "/tmp/test/input.mp4"

        mock_va = mock_va_cls.return_value
        mock_va.analyze.return_value = make_video_analysis()

        mock_fa = mock_fa_cls.return_value
        mock_fa.run.side_effect = RuntimeError("LLM timeout")

        runner = ServalAnalysisRunner()
        result = runner.run("videos/test.mp4", "test-001")

        assert result.success is False
        assert result.status == "partial"
        assert "video_analysis" in result.partial_results
        assert len(result.errors) == 1
        assert result.errors[0].stage == "fault_analysis"

    @patch("adapters.serval_runner.FaultAnalyzer")
    @patch("adapters.serval_runner.VideoAnalyzer")
    @patch("adapters.serval_runner.S3Client")
    def test_fault_undetermined_partial(self, mock_s3_cls, mock_va_cls, mock_fa_cls):
        """BR-2.5: FaultResult.undetermined → PARTIAL, no script generation."""
        mock_s3 = mock_s3_cls.return_value
        mock_s3.download_file.return_value = "/tmp/test/input.mp4"

        mock_va = mock_va_cls.return_value
        mock_va.analyze.return_value = make_video_analysis()

        mock_fa = mock_fa_cls.return_value
        mock_fa.run.return_value = FaultResult(
            job_id="test-001",
            undetermined=True,
            undetermined_reason="사고 유형 판별 불가",
        )

        runner = ServalAnalysisRunner()
        result = runner.run("videos/test.mp4", "test-001")

        assert result.success is False
        assert result.status == "partial"
        assert "video_analysis" in result.partial_results
        assert "fault_result" in result.partial_results


# =============================================================================
# Adapter Example-Based Tests (PBT-10)
# =============================================================================


class TestAdapterExamples:
    """Concrete examples complementing PBT tests."""

    def test_basic_conversion(self):
        """Known good conversion case."""
        from adapters.serval_to_ssol import structured_analysis_to_pipeline_input

        analysis = make_structured_analysis()
        result = structured_analysis_to_pipeline_input(analysis)

        assert result["accident_type"] == "추돌"
        assert result["video_duration"] == 6.0
        assert result["collision_timestamp"] == 4.5
        assert len(result["driver_actions"]) == 2
        assert len(result["fault_ratios"]) == 2
        assert sum(r["ratio_percent"] for r in result["fault_ratios"]) == 100

    def test_timestamp_conversion_in_driver_actions(self):
        """Driver action timestamps are converted from float to MM:SS format."""
        from adapters.serval_to_ssol import structured_analysis_to_pipeline_input

        analysis = make_structured_analysis()
        result = structured_analysis_to_pipeline_input(analysis)

        # First driver action starts at 2.0 seconds
        assert result["driver_actions"][0]["timestamp"] == "00:02"
        # Second driver action starts at 1.0 seconds
        assert result["driver_actions"][1]["timestamp"] == "00:01"

    def test_empty_driver_actions(self):
        """Handle analysis with no driver actions."""
        from adapters.serval_to_ssol import structured_analysis_to_pipeline_input

        analysis = StructuredAnalysis(
            job_id="test-empty",
            intro=IntroSection(
                summary="Empty test",
                accident_type="unknown",
                timestamp=TimestampRange(start=0.0, end=5.0),
            ),
            analysis=AnalysisSection(
                driver_actions=[],
                timestamp=TimestampRange(start=0.0, end=5.0),
            ),
            conclusion=ConclusionSection(
                fault_ratios=[],
                legal_basis=[],
                timestamp=TimestampRange(start=5.0, end=5.0),
            ),
        )

        result = structured_analysis_to_pipeline_input(analysis)
        assert result["driver_actions"] == []
        assert result["fault_ratios"] == []
