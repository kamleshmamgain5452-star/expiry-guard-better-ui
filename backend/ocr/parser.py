import calendar
import re
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional, Tuple

from backend.models.scan import ScanResponse


EXPIRY_KEYWORDS = (
    "exp",
    "expiry",
    "expires",
    "best before",
    "use before",
    "use by",
    "valid upto",
    "consume before",
    "समाप्ति",
    "समाप्त",
    "उपयोग",
)

MFD_KEYWORDS = (
    "mfd",
    "mfg",
    "manufacturing",
    "manufactured",
    "manufacture",
    "pkd",
    "packed",
    "packing",
    "निर्माण",
    "बनाया",
    "पैक",
)

MONTH_LOOKUP: Dict[str, int] = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

MONTH_PATTERN = (
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    "jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
)

DATE_PATTERNS = (
    re.compile(r"\b([0-3]?\d[/-][01]?\d[/-](?:20)?\d{2})\b", re.IGNORECASE),
    re.compile(r"\b([0-3]?\d\.[01]?\d\.(?:20)?\d{2})\b", re.IGNORECASE),
    re.compile(rf"\b([0-3]?\d\s+(?:{MONTH_PATTERN})\s+(?:20)?\d{{2}})\b", re.IGNORECASE),
    re.compile(r"\b([01]?\d[/-](?:20)?\d{2})\b", re.IGNORECASE),
)

BARCODE_PATTERN = re.compile(r"\b(\d{8,14})\b")


def parse_ocr_result(
    lines: List[str],
    ocr_confidence: float,
    barcode: Optional[str] = None,
) -> ScanResponse:
    import json
    normalized_lines = [line.strip() for line in lines if line.strip()]
    
    # Intercept Groq structured data
    structured_data = {}
    remaining_lines = []
    for line in normalized_lines:
        if line.startswith("__GROQ_STRUCTURED__:"):
            try:
                json_str = line[len("__GROQ_STRUCTURED__:"):]
                structured_data = json.loads(json_str)
            except Exception:
                pass
        else:
            remaining_lines.append(line)

    # 1. Product Name (prefer structured data, fallback to regex)
    product_name = structured_data.get("product_name")
    if not product_name:
        product_name = extract_product_name(remaining_lines) or "Packaged Product"

    # 2. Dates (prefer structured data, fallback to regex)
    expiry_date = structured_data.get("expiry_date")
    mfd_date = structured_data.get("mfd_date")
    
    # Fallback date extraction if not provided by Groq
    if not expiry_date or not mfd_date:
        regex_expiry, regex_mfd = extract_dates(remaining_lines)
        if not expiry_date:
            expiry_date = regex_expiry
        if not mfd_date:
            mfd_date = regex_mfd

    # Normalize formats
    if expiry_date:
        expiry_date = normalize_date(expiry_date)
    if mfd_date:
        mfd_date = normalize_date(mfd_date)

    # 2.b Support Relative Expiry Durations
    mfd_missing_for_duration = False
    is_relative_computed = False
    if not expiry_date:
        computed_expiry, missing_mfd = parse_relative_expiry(remaining_lines, mfd_date)
        if computed_expiry:
            expiry_date = computed_expiry
            is_relative_computed = True
        elif missing_mfd:
            mfd_missing_for_duration = True

    # 3. Barcodes
    # Merging logic:
    # 1. If barcode was detected on frontend (via camera ZXing), clean and use it first!
    # 2. Otherwise, if backend Groq OCR extracted a barcode, use that.
    # 3. Otherwise, use regex barcode extraction from lines.
    merged_barcode = clean_barcode(barcode)
    if not merged_barcode:
        merged_barcode = clean_barcode(structured_data.get("barcode"))
    if not merged_barcode:
        merged_barcode = extract_barcode(remaining_lines)

    # 4. Confidence
    # Use Groq OCR confidence directly if present, adjusted by date availability
    confidence = calculate_confidence(ocr_confidence, expiry_date, mfd_date)
    if is_relative_computed:
        confidence = max(confidence, 0.95)

    return ScanResponse(
        product_name=product_name,
        expiry_date=expiry_date,
        mfd_date=mfd_date,
        barcode=merged_barcode,
        confidence=confidence,
        status=status_from_expiry(expiry_date),
        raw_text=remaining_lines,
        mfd_missing_for_duration=mfd_missing_for_duration,
    )


def extract_dates(lines: List[str]) -> Tuple[Optional[str], Optional[str]]:
    expiry_date: Optional[str] = None
    mfd_date: Optional[str] = None

    for index, line in enumerate(lines):
        context = " ".join([line, lines[index + 1] if index + 1 < len(lines) else ""])
        dates = find_dates(context)
        if not dates:
            continue
        lowered = context.lower()
        if expiry_date is None and contains_keyword(lowered, EXPIRY_KEYWORDS):
            expiry_date = dates[0]
        if mfd_date is None and contains_keyword(lowered, MFD_KEYWORDS):
            mfd_date = dates[0]

    all_dates = find_dates(" ".join(lines))
    parsed_dates = [(value, parse_date(value)) for value in all_dates]
    parsed_dates = [(value, parsed) for value, parsed in parsed_dates if parsed]

    if expiry_date is None and parsed_dates:
        expiry_date = max(parsed_dates, key=lambda item: item[1])[0]

    if mfd_date is None and len(parsed_dates) > 1:
        mfd_date = min(parsed_dates, key=lambda item: item[1])[0]

    return expiry_date, mfd_date


def find_dates(text: str) -> List[str]:
    values: List[str] = []
    for pattern in DATE_PATTERNS:
        for match in pattern.findall(text):
            normalized = normalize_date(match)
            if normalized and normalized not in values:
                values.append(normalized)
    return values


def normalize_date(raw: str) -> Optional[str]:
    clean = " ".join(raw.replace(".", "/").split())

    numeric = re.match(r"^([0-3]?\d)[/-]([01]?\d)[/-]((?:20)?\d{2})$", clean)
    if numeric:
        day, month, year = int(numeric.group(1)), int(numeric.group(2)), normalize_year(numeric.group(3))
        if is_valid_date(year, month, day):
            return f"{day:02d}/{month:02d}/{year}"
        return None

    named = re.match(rf"^([0-3]?\d)\s+({MONTH_PATTERN})\s+((?:20)?\d{{2}})$", clean, re.IGNORECASE)
    if named:
        day = int(named.group(1))
        month = MONTH_LOOKUP.get(named.group(2).lower()[:3])
        year = normalize_year(named.group(3))
        if month and is_valid_date(year, month, day):
            return f"{day:02d}/{month:02d}/{year}"
        return None

    month_year = re.match(r"^([01]?\d)[/-]((?:20)?\d{2})$", clean)
    if month_year:
        month = int(month_year.group(1))
        year = normalize_year(month_year.group(2))
        if 1 <= month <= 12:
            last_day = calendar.monthrange(year, month)[1]
            return f"{last_day:02d}/{month:02d}/{year}"

    return None


def parse_date(value: str) -> Optional[date]:
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except ValueError:
        return None


def status_from_expiry(expiry_date: Optional[str]):
    # Kept in sync with utils/dates.ts statusFromExpiry:
    # no date -> safe, past date -> expired, within a week -> near_expiry, else safe.
    parsed = parse_date(expiry_date) if expiry_date else None
    if not parsed:
        return "safe"
    days_remaining = (parsed - date.today()).days
    if days_remaining < 0:
        return "expired"
    if days_remaining <= 7:
        return "near_expiry"
    return "safe"


def extract_barcode(lines: Iterable[str]) -> Optional[str]:
    for line in lines:
        match = BARCODE_PATTERN.search(line.replace(" ", ""))
        if match:
            return match.group(1)
    return None


def clean_barcode(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits if 8 <= len(digits) <= 14 else None


def extract_product_name(lines: List[str]) -> Optional[str]:
    for line in lines[:8]:
        clean = re.sub(r"[^0-9A-Za-z\u0900-\u097F &+.-]", " ", line)
        clean = " ".join(clean.split())
        lowered = clean.lower()
        if not clean or len(clean) < 3 or len(clean) > 48:
            continue
        if contains_keyword(lowered, EXPIRY_KEYWORDS + MFD_KEYWORDS):
            continue
        if find_dates(clean) or clean_barcode(clean):
            continue
        return clean.title() if clean.isupper() else clean
    return None


def calculate_confidence(
    ocr_confidence: float,
    expiry_date: Optional[str],
    mfd_date: Optional[str],
) -> float:
    score = max(0.0, min(1.0, ocr_confidence))
    if expiry_date:
        score += 0.08
    else:
        score -= 0.22
    if mfd_date:
        score += 0.04
    return round(max(0.0, min(0.99, score)), 2)


def contains_keyword(text: str, keywords: Iterable[str]) -> bool:
    return any(keyword in text for keyword in keywords)


def normalize_year(value: str) -> int:
    year = int(value)
    return 2000 + year if year < 100 else year


def is_valid_date(year: int, month: int, day: int) -> bool:
    try:
        date(year, month, day)
        return True
    except ValueError:
        return False


def normalize_unit(unit_raw: str) -> Optional[str]:
    u = unit_raw.lower()
    if u in ('month', 'mth', 'mon', 'months', 'mths', 'mons'):
        return 'months'
    if u in ('year', 'yr', 'years', 'yrs'):
        return 'years'
    if u in ('day', 'days'):
        return 'days'
    if u in ('week', 'weeks'):
        return 'weeks'
    return None


def compute_expiry_date(mfd_str: str, value: int, unit: str) -> Optional[str]:
    try:
        mfd = datetime.strptime(mfd_str, "%d/%m/%Y").date()
    except ValueError:
        return None

    if unit == 'days':
        from datetime import timedelta
        exp = mfd + timedelta(days=value)
        return exp.strftime("%d/%m/%Y")
    elif unit == 'weeks':
        from datetime import timedelta
        exp = mfd + timedelta(days=value * 7)
        return exp.strftime("%d/%m/%Y")
    elif unit == 'months':
        target_year = mfd.year + (mfd.month - 1 + value) // 12
        target_month = (mfd.month - 1 + value) % 12 + 1
        
        last_day = calendar.monthrange(target_year, target_month)[1]
        orig_last_day = calendar.monthrange(mfd.year, mfd.month)[1]
        
        if mfd.day == orig_last_day:
            target_day = last_day
        else:
            target_day = min(mfd.day, last_day)
            
        exp = date(target_year, target_month, target_day)
        return exp.strftime("%d/%m/%Y")
    elif unit == 'years':
        target_year = mfd.year + value
        target_month = mfd.month
        
        last_day = calendar.monthrange(target_year, target_month)[1]
        orig_last_day = calendar.monthrange(mfd.year, mfd.month)[1]
        
        if mfd.day == orig_last_day:
            target_day = last_day
        else:
            target_day = min(mfd.day, last_day)
            
        exp = date(target_year, target_month, target_day)
        return exp.strftime("%d/%m/%Y")
        
    return None


def parse_relative_expiry(
    lines: List[str],
    mfd_date: Optional[str]
) -> Tuple[Optional[str], bool]:
    """
    Search raw text lines for duration-based relative expiry rules.
    Returns: (computed_expiry_date, mfd_missing_for_duration)
    """
    patterns = [
        re.compile(r'(?:best\s+before|shelf\s+life|use\s+within|use\s+before|expires?|valid\s+(?:for|upto)|expiry|exp|use\s+by)\s*:?\s*(\d+)\s*(month|mth|mon|year|yr|day|week)s?\b', re.IGNORECASE),
        re.compile(r'\b(\d+)\s*(month|mth|mon|year|yr|day|week)s?\s+(?:from|after|of)\s+(?:manufacture|mfg|mfd|pkd|pack|pkg|date\s+of\s+manufacture)\b', re.IGNORECASE),
        re.compile(r'\b(\d+)\s*(month|mth|mon|year|yr|day|week)s?\b', re.IGNORECASE)
    ]
    
    duration_value = None
    duration_unit = None
    
    for line in lines:
        line_lower = line.lower()
        
        # 1. Try first two strong context patterns
        match = patterns[0].search(line_lower) or patterns[1].search(line_lower)
        if match:
            duration_value = int(match.group(1))
            duration_unit = normalize_unit(match.group(2))
            if duration_unit:
                break
                
        # 2. Fallback to generic pattern if line has context keywords
        context_keywords = [
            "best before", "shelf life", "use within", "use before", 
            "expires", "valid", "expiry", "exp", "from manufacture", 
            "from packaging", "after packaging", "from mfg"
        ]
        if any(kw in line_lower for kw in context_keywords):
            match = patterns[2].search(line_lower)
            if match:
                duration_value = int(match.group(1))
                duration_unit = normalize_unit(match.group(2))
                if duration_unit:
                    break
                    
    if not duration_value or not duration_unit:
        return None, False
        
    if not mfd_date:
        return None, True
        
    computed = compute_expiry_date(mfd_date, duration_value, duration_unit)
    return computed, False
