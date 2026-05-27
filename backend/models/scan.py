from typing import List, Literal, Optional

from pydantic import BaseModel, Field


ExpiryStatus = Literal["safe", "near_expiry", "expired"]


class ScanResponse(BaseModel):
    product_name: str = Field(default="Packaged Product")
    expiry_date: Optional[str] = None
    mfd_date: Optional[str] = None
    barcode: Optional[str] = None
    confidence: float = Field(ge=0, le=1)
    status: ExpiryStatus
    raw_text: List[str] = Field(default_factory=list)
    mfd_missing_for_duration: Optional[bool] = None


class OCRText(BaseModel):
    lines: List[str]
    confidence: float
