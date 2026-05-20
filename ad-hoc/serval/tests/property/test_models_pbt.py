"""Property-based tests for domain models (PBT-02, PBT-03)."""

from hypothesis import given, settings as hyp_settings
from hypothesis import strategies as st

from shared.models.job import AnalysisJob, JobStatus
from shared.models.video import (
    BoundingBox,
    VideoAnalysisResult,
    AccidentClassification,
    AccidentType,
)
from shared.models.fault import FaultRatio, FaultResult
from shared.models.analysis import StructuredAnalysis, IntroSection, AnalysisSection, ConclusionSection, TimestampRange

from tests.property.conftest import (
    bounding_box_strategy,
    confidence,
    fault_ratios_strategy,
    timestamp_range_strategy,
    job_status_strategy,
)


class TestModelRoundTrip:
    """PBT-02: Round-trip serialization/deserialization."""

    @given(
        job_id=st.text(min_size=1, max_size=36, alphabet=st.characters(whitelist_categories=("L", "N", "Pd"))),
        s3_key=st.text(min_size=1, max_size=100, alphabet=st.characters(whitelist_categories=("L", "N", "Pd", "Pc"))),
        status=job_status_strategy,
    )
    @hyp_settings(max_examples=50)
    def test_analysis_job_roundtrip(self, job_id, s3_key, status):
        """AnalysisJob serialization roundtrip preserves all fields."""
        job = AnalysisJob(job_id=job_id, video_s3_key=s3_key, status=status)
        data = job.model_dump(mode="json")
        restored = AnalysisJob.model_validate(data)
        assert restored.job_id == job.job_id
        assert restored.video_s3_key == job.video_s3_key
        assert restored.status == job.status

    @given(bbox_data=bounding_box_strategy())
    @hyp_settings(max_examples=50)
    def test_bounding_box_roundtrip(self, bbox_data):
        """BoundingBox serialization roundtrip preserves all fields."""
        bbox = BoundingBox(**bbox_data)
        data = bbox.model_dump(mode="json")
        restored = BoundingBox.model_validate(data)
        assert restored.x1 == bbox.x1
        assert restored.y1 == bbox.y1
        assert restored.confidence == bbox.confidence
        assert restored.class_name == bbox.class_name

    @given(
        job_id=st.text(min_size=1, max_size=36, alphabet=st.characters(whitelist_categories=("L", "N"))),
    )
    @hyp_settings(max_examples=30)
    def test_video_analysis_result_roundtrip(self, job_id):
        """VideoAnalysisResult serialization roundtrip."""
        result = VideoAnalysisResult(job_id=job_id, video_duration=30.0, total_frames=60)
        data = result.model_dump(mode="json")
        restored = VideoAnalysisResult.model_validate(data)
        assert restored.job_id == result.job_id
        assert restored.ego_vehicle_id == 0


class TestFaultRatioInvariants:
    """PBT-03: Fault ratio invariants."""

    @given(ratios_data=fault_ratios_strategy())
    @hyp_settings(max_examples=100)
    def test_fault_ratios_sum_to_100(self, ratios_data):
        """Invariant: fault ratios must always sum to 100."""
        ratios = [FaultRatio(**r) for r in ratios_data]
        total = sum(r.ratio_percent for r in ratios)
        assert total == 100, f"Ratios sum to {total}, expected 100"

    @given(ratios_data=fault_ratios_strategy())
    @hyp_settings(max_examples=50)
    def test_fault_result_always_has_disclaimer(self, ratios_data):
        """Invariant: FaultResult always contains disclaimer."""
        ratios = [FaultRatio(**r) for r in ratios_data]
        result = FaultResult(job_id="test", ratios=ratios)
        assert result.disclaimer != ""
        assert "법적 효력" in result.disclaimer


class TestTimestampInvariants:
    """PBT-03: Timestamp invariants."""

    @given(ts_data=timestamp_range_strategy())
    @hyp_settings(max_examples=100)
    def test_timestamp_start_before_end(self, ts_data):
        """Invariant: timestamp start is always before end."""
        ts = TimestampRange(**ts_data)
        assert ts.start < ts.end

    @given(ts_data=timestamp_range_strategy())
    @hyp_settings(max_examples=50)
    def test_structured_analysis_timestamps_valid(self, ts_data):
        """Invariant: all sections have valid timestamps."""
        ts = TimestampRange(**ts_data)
        analysis = StructuredAnalysis(
            job_id="test",
            intro=IntroSection(summary="test", accident_type="rear_end", timestamp=ts),
            analysis=AnalysisSection(timestamp=ts),
            conclusion=ConclusionSection(timestamp=ts),
        )
        assert analysis.intro.timestamp.start < analysis.intro.timestamp.end
        assert analysis.analysis.timestamp.start < analysis.analysis.timestamp.end
        assert analysis.conclusion.timestamp.start < analysis.conclusion.timestamp.end


class TestBoundingBoxInvariants:
    """PBT-03: BoundingBox coordinate invariants."""

    @given(bbox_data=bounding_box_strategy())
    @hyp_settings(max_examples=100)
    def test_bbox_x2_greater_than_x1(self, bbox_data):
        """Invariant: x2 > x1 for all bounding boxes."""
        bbox = BoundingBox(**bbox_data)
        assert bbox.x2 > bbox.x1

    @given(bbox_data=bounding_box_strategy())
    @hyp_settings(max_examples=100)
    def test_bbox_y2_greater_than_y1(self, bbox_data):
        """Invariant: y2 > y1 for all bounding boxes."""
        bbox = BoundingBox(**bbox_data)
        assert bbox.y2 > bbox.y1

    @given(bbox_data=bounding_box_strategy())
    @hyp_settings(max_examples=100)
    def test_bbox_confidence_in_range(self, bbox_data):
        """Invariant: confidence is always in [0, 1]."""
        bbox = BoundingBox(**bbox_data)
        assert 0.0 <= bbox.confidence <= 1.0
