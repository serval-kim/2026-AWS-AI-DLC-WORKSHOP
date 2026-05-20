"""Property-Based Tests for adapter and timestamp conversions.

PBT Rules Compliance:
- PBT-02: Round-trip properties (RT-1, RT-2)
- PBT-03: Invariant properties (INV-1 through INV-4)
- PBT-04: Idempotency (IDEM-1)
- PBT-07: Domain-specific generators
- PBT-08: Shrinking + seed reproducibility (Hypothesis default)
- PBT-09: Framework = Hypothesis (Python)
- PBT-10: Complements example-based tests in test_serval_runner.py
"""

from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

from shared.models.analysis import (
    AnalysisSection,
    ConclusionSection,
    DriverAction,
    IntroSection,
    StructuredAnalysis,
    TimestampRange,
)
from adapters.serval_to_ssol import structured_analysis_to_pipeline_input
from utils import float_to_ts, ts_to_float


# =============================================================================
# Domain Generators (PBT-07)
# =============================================================================

timestamp_floats = st.floats(min_value=0.0, max_value=600.0, allow_nan=False, allow_infinity=False)
"""Valid timestamp values: 0 to 10 minutes."""

# Only integers and .5 values for clean round-trip (float_to_ts only preserves 1 decimal)
roundtrip_safe_floats = st.one_of(
    st.integers(min_value=0, max_value=600).map(float),
    st.integers(min_value=0, max_value=1200).map(lambda x: x / 2.0),
)
"""Floats that survive float_to_ts → ts_to_float round-trip cleanly."""


def timestamp_range_strategy(max_end: float = 60.0):
    """Generate valid TimestampRange with start <= end."""
    return st.builds(
        TimestampRange,
        start=st.floats(min_value=0.0, max_value=max_end / 2, allow_nan=False, allow_infinity=False),
        end=st.floats(min_value=max_end / 2, max_value=max_end, allow_nan=False, allow_infinity=False),
    )


def driver_action_strategy():
    """Generate valid DriverAction instances."""
    return st.builds(
        DriverAction,
        vehicle_id=st.integers(min_value=0, max_value=5),
        action=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=("L", "N"))),
        fault_point=st.text(min_size=1, max_size=30, alphabet=st.characters(whitelist_categories=("L", "N"))),
        violated_law=st.text(min_size=0, max_size=30),
        timestamp=timestamp_range_strategy(max_end=30.0),
    )


def fault_ratio_strategy(n_vehicles: int = 2):
    """Generate fault_ratios list that sums to 100%."""
    if n_vehicles == 2:
        return st.integers(min_value=0, max_value=100).map(
            lambda r: [
                {"vehicle_id": 0, "ratio_percent": r},
                {"vehicle_id": 1, "ratio_percent": 100 - r},
            ]
        )
    return st.just([{"vehicle_id": 0, "ratio_percent": 50}, {"vehicle_id": 1, "ratio_percent": 50}])


def structured_analysis_strategy():
    """Generate valid StructuredAnalysis instances (PBT-07: domain generator)."""
    return st.builds(
        StructuredAnalysis,
        job_id=st.text(min_size=4, max_size=8, alphabet="abcdef0123456789"),
        intro=st.builds(
            IntroSection,
            summary=st.text(min_size=5, max_size=50),
            accident_type=st.sampled_from(["추돌", "차선변경", "신호위반", "교차로", "정면충돌"]),
            timestamp=timestamp_range_strategy(max_end=60.0),
            involved_vehicles=st.integers(min_value=2, max_value=4),
        ),
        analysis=st.builds(
            AnalysisSection,
            driver_actions=st.lists(driver_action_strategy(), min_size=1, max_size=5),
            timestamp=timestamp_range_strategy(max_end=60.0),
        ),
        conclusion=st.builds(
            ConclusionSection,
            fault_ratios=fault_ratio_strategy(),
            legal_basis=st.lists(
                st.text(min_size=5, max_size=20, alphabet=st.characters(whitelist_categories=("L", "N"))),
                min_size=1,
                max_size=3,
            ),
            timestamp=timestamp_range_strategy(max_end=60.0),
            disclaimer=st.just("본 분석은 AI 추정치이며 법적 효력이 없습니다."),
        ),
    )


# =============================================================================
# RT-1: Timestamp Round-Trip (PBT-02)
# =============================================================================


@given(seconds=roundtrip_safe_floats)
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_timestamp_roundtrip(seconds: float):
    """float_to_ts(x) → ts_to_float → x (round-trip property).

    Note: Only exact for integer and .5 values due to 1-decimal formatting.
    """
    ts_str = float_to_ts(seconds)
    recovered = ts_to_float(ts_str)
    assert abs(recovered - seconds) < 0.05, (
        f"Round-trip failed: {seconds} → '{ts_str}' → {recovered}"
    )


# =============================================================================
# RT-2: StructuredAnalysis Serialize/Deserialize Round-Trip (PBT-02)
# =============================================================================


@given(analysis=structured_analysis_strategy())
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_structured_analysis_roundtrip(analysis: StructuredAnalysis):
    """StructuredAnalysis model_dump → model_validate = identity."""
    dumped = analysis.model_dump(mode="json")
    recovered = StructuredAnalysis.model_validate(dumped)

    assert recovered.job_id == analysis.job_id
    assert recovered.intro.accident_type == analysis.intro.accident_type
    assert len(recovered.analysis.driver_actions) == len(analysis.analysis.driver_actions)
    assert recovered.conclusion.fault_ratios == analysis.conclusion.fault_ratios


# =============================================================================
# INV-1: Fault Ratios Sum Preservation (PBT-03)
# =============================================================================


@given(analysis=structured_analysis_strategy())
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_fault_ratios_sum_preserved(analysis: StructuredAnalysis):
    """Adapter preserves fault_ratios sum = 100%."""
    result = structured_analysis_to_pipeline_input(analysis)
    input_sum = sum(r.get("ratio_percent", 0) for r in analysis.conclusion.fault_ratios)
    output_sum = sum(r.get("ratio_percent", 0) for r in result["fault_ratios"])
    assert input_sum == output_sum


# =============================================================================
# INV-2: Driver Actions Count Preservation (PBT-03)
# =============================================================================


@given(analysis=structured_analysis_strategy())
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_driver_actions_count_preserved(analysis: StructuredAnalysis):
    """Adapter preserves the number of driver_actions."""
    result = structured_analysis_to_pipeline_input(analysis)
    assert len(result["driver_actions"]) == len(analysis.analysis.driver_actions)


# =============================================================================
# INV-3: Accident Type Preservation (PBT-03)
# =============================================================================


@given(analysis=structured_analysis_strategy())
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_accident_type_preserved(analysis: StructuredAnalysis):
    """Adapter preserves accident_type unchanged."""
    result = structured_analysis_to_pipeline_input(analysis)
    assert result["accident_type"] == analysis.intro.accident_type


# =============================================================================
# INV-4: video_duration >= collision_timestamp (PBT-03)
# =============================================================================


@given(analysis=structured_analysis_strategy())
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_video_duration_gte_collision(analysis: StructuredAnalysis):
    """Output video_duration (intro.end) and collision_timestamp (analysis.end) relationship.

    Note: This validates the adapter correctly maps these fields.
    The actual >= constraint depends on input data correctness.
    """
    result = structured_analysis_to_pipeline_input(analysis)
    # Verify the mapping is correct (not the domain constraint)
    assert result["video_duration"] == analysis.intro.timestamp.end
    assert result["collision_timestamp"] == analysis.analysis.timestamp.end


# =============================================================================
# IDEM-1: Adapter is a Pure Function (PBT-04)
# =============================================================================


@given(analysis=structured_analysis_strategy())
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_adapter_idempotent(analysis: StructuredAnalysis):
    """Adapter conversion is deterministic (pure function, no side effects)."""
    result1 = structured_analysis_to_pipeline_input(analysis)
    result2 = structured_analysis_to_pipeline_input(analysis)
    assert result1 == result2
