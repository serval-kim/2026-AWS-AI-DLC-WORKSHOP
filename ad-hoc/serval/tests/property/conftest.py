"""Hypothesis strategies for domain models."""

from hypothesis import strategies as st

from shared.models.job import JobStatus
from shared.models.video import AccidentType


# --- Primitive strategies ---

positive_float = st.floats(min_value=0.0, max_value=1000.0, allow_nan=False, allow_infinity=False)
confidence = st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)
percentage = st.integers(min_value=0, max_value=100)
pixel_coord = st.floats(min_value=0.0, max_value=1920.0, allow_nan=False, allow_infinity=False)
timestamp = st.floats(min_value=0.0, max_value=300.0, allow_nan=False, allow_infinity=False)  # max 5 min
vehicle_id = st.integers(min_value=0, max_value=20)
frame_id = st.integers(min_value=0, max_value=600)  # max 5min * 2fps


# --- Composite strategies ---

@st.composite
def bounding_box_strategy(draw):
    """Generate valid BoundingBox data."""
    x1 = draw(st.floats(min_value=0.0, max_value=900.0, allow_nan=False, allow_infinity=False))
    y1 = draw(st.floats(min_value=0.0, max_value=900.0, allow_nan=False, allow_infinity=False))
    x2 = draw(st.floats(min_value=x1 + 1.0, max_value=1920.0, allow_nan=False, allow_infinity=False))
    y2 = draw(st.floats(min_value=y1 + 1.0, max_value=1080.0, allow_nan=False, allow_infinity=False))
    conf = draw(confidence)
    class_name = draw(st.sampled_from(["car", "truck", "bus", "motorcycle", "lane", "traffic_light"]))
    class_id = draw(st.integers(min_value=0, max_value=5))
    return {
        "x1": x1, "y1": y1, "x2": x2, "y2": y2,
        "confidence": conf, "class_name": class_name, "class_id": class_id,
    }


@st.composite
def fault_ratios_strategy(draw):
    """Generate valid fault ratios that sum to 100."""
    num_vehicles = draw(st.integers(min_value=2, max_value=4))
    # Generate ratios that sum to 100
    points = sorted(draw(st.lists(
        st.integers(min_value=1, max_value=99),
        min_size=num_vehicles - 1,
        max_size=num_vehicles - 1,
    ).map(lambda pts: sorted(set(pts)))))

    # Ensure we have enough split points
    if len(points) < num_vehicles - 1:
        points = list(range(100 // num_vehicles, 100, 100 // num_vehicles))[:num_vehicles - 1]

    ratios = []
    prev = 0
    for i, p in enumerate(points):
        ratios.append({"vehicle_id": i, "ratio_percent": p - prev})
        prev = p
    ratios.append({"vehicle_id": len(points), "ratio_percent": 100 - prev})

    return ratios


@st.composite
def timestamp_range_strategy(draw):
    """Generate valid TimestampRange where start < end."""
    start = draw(st.floats(min_value=0.0, max_value=290.0, allow_nan=False, allow_infinity=False))
    end = draw(st.floats(min_value=start + 0.1, max_value=300.0, allow_nan=False, allow_infinity=False))
    return {"start": start, "end": end}


job_status_strategy = st.sampled_from(list(JobStatus))
accident_type_strategy = st.sampled_from(list(AccidentType))
