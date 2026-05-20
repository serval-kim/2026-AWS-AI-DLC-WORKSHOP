"""Structured analysis output models (Req 4)."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field


class TimestampRange(BaseModel):
    """Video timestamp range."""

    start: float = Field(ge=0.0)
    end: float = Field(ge=0.0)


class DriverAction(BaseModel):
    """Individual driver action analysis."""

    vehicle_id: int
    action: str
    fault_point: str
    violated_law: str = ""
    timestamp: TimestampRange


class IntroSection(BaseModel):
    """Introduction section - accident summary."""

    summary: str
    accident_type: str
    timestamp: TimestampRange
    involved_vehicles: int = 2


class AnalysisSection(BaseModel):
    """Analysis section - per-driver behavior analysis."""

    driver_actions: list[DriverAction] = Field(default_factory=list)
    timestamp: TimestampRange


class ConclusionSection(BaseModel):
    """Conclusion section - fault ratios and legal basis."""

    fault_ratios: list[dict] = Field(default_factory=list)  # [{vehicle_id, ratio_percent}]
    legal_basis: list[str] = Field(default_factory=list)
    timestamp: TimestampRange
    disclaimer: str = "본 분석은 AI 추정치이며 법적 효력이 없습니다."


class StructuredAnalysis(BaseModel):
    """Complete structured analysis output (Req 4)."""

    job_id: str
    intro: IntroSection
    analysis: AnalysisSection
    conclusion: ConclusionSection
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
