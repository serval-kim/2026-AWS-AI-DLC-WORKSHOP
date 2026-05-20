"""Fault analysis domain models."""

from pydantic import BaseModel, Field


class LegalReference(BaseModel):
    """Legal reference from RAG search."""

    text: str
    source: str  # e.g., "도로교통법 제XX조" or "판례 XXXX-XXXX"
    relevance_score: float = Field(ge=0.0, le=1.0)
    category: str = "law"  # "law" or "precedent"


class FaultRatio(BaseModel):
    """Fault ratio for a single vehicle."""

    vehicle_id: int
    ratio_percent: int = Field(ge=0, le=100)
    key_faults: list[str] = Field(default_factory=list)
    violated_laws: list[str] = Field(default_factory=list)


class FaultResult(BaseModel):
    """Complete fault analysis output (Req 3)."""

    job_id: str
    ratios: list[FaultRatio] = Field(default_factory=list)
    reasoning: str = ""
    references: list[LegalReference] = Field(default_factory=list)
    disclaimer: str = "본 분석은 AI 추정치이며 법적 효력이 없습니다. 정확한 과실비율 판단은 전문가 상담을 권장합니다."
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    undetermined: bool = False
    undetermined_reason: str | None = None
