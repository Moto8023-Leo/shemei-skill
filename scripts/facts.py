"""
Fact Safety Engine — validates product specs for regulatory compliance.

Ported from AI-Social-Operator-Studio v2.3 facts.service.ts.

Core responsibilities:
  1. Detect range values in specs (e.g., "45-55km", "40-65KM")
  2. Convert to localized "UP TO X" safe expressions
  3. Validate generated copy doesn't contain unsafe bare ranges
  4. Block publication when safety violations are found

European/UK advertising standards require that range claims explicitly state
the maximum achievable value, not an ambiguous interval.
"""

import re
import logging

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Range detection patterns
# ------------------------------------------------------------------

# Matches: "45-55km", "40-65KM", "40 - 65 km", "45~55公里", etc.
RANGE_PATTERN = re.compile(
    r'(\d+(?:\.\d+)?)\s*[-–—~to至到]\s*(\d+(?:\.\d+)?)\s*'
    r'(km|KM|公里|千米|英里|mile|miles|mi)',
    re.IGNORECASE,
)

# Matches raw range numbers in text (e.g., "45-55" in range context)
BARE_RANGE_PATTERN = re.compile(
    r'(?<!\d)(\d{2,3})\s*[-–—~]\s*(\d{2,3})\s*'
    r'(?=(?:km|KM|公里|千米|英里|mile|miles|mi|\)|$|\s|\.|,))',
    re.IGNORECASE,
)

# ------------------------------------------------------------------
# Localized "up to" expressions
# ------------------------------------------------------------------

UP_TO_MAP: dict[str, str] = {
    # ISO 639-1 code → language code used in copy
    "GB": "UP TO",
    "US": "UP TO",
    "AU": "UP TO",
    "CA": "UP TO",
    "DE": "BIS ZU",
    "FR": "JUSQU'À",
    "ES": "HASTA",
    "IT": "FINO A",
    "NL": "TOT",
    "BE": "UP TO",  # Belgium — use English or French depending on region; default English
    "PT": "ATÉ",
    "SE": "UPP TILL",
    "DK": "OP TIL",
    "NO": "OPPTIL",
    "FI": "JOPA",
    "PL": "DO",
    "CZ": "AŽ",
}

# When country is unknown, use English
DEFAULT_UP_TO = "UP TO"


def safe_range_expression(value: str, country_code: str = "GB") -> str:
    """
    Convert a range value like "45-55km" to "UP TO 55KM RANGE".
    Returns the safe expression, or the original value if not a range.
    """
    m = RANGE_PATTERN.search(value)
    if not m:
        return value

    max_val = m.group(2)
    unit = m.group(3).upper()
    if unit in ("公里", "千米"):
        unit = "KM"
    elif unit in ("英里", "MILE", "MILES", "MI"):
        unit = "MILES"

    prefix = UP_TO_MAP.get(country_code.upper(), DEFAULT_UP_TO)
    return f"{prefix} {max_val}{unit} RANGE"


def extract_max_range(spec_value: str) -> int | None:
    """
    Extract the maximum range value from a spec string.
    Returns the numeric max, or None if not a range.
    Examples:
        "45-55km" → 55
        "up to 65km" → 65
        "40km" → 40
    """
    # Check for range
    m = RANGE_PATTERN.search(spec_value)
    if m:
        return int(float(m.group(2)))

    # Check for "up to" style
    m = re.search(r'(?:up\s*to|bis\s*zu|hasta|jusqu\'à|fino\s*a)\s*(\d+(?:\.\d+)?)\s*(?:km|KM|公里|mile|miles)', spec_value, re.IGNORECASE)
    if m:
        return int(float(m.group(1)))

    # Check for bare number + unit
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:km|KM|公里)', spec_value, re.IGNORECASE)
    if m:
        return int(float(m.group(1)))

    return None


def has_unsafe_range(text: str) -> bool:
    """
    Check if text contains an unsafe/ambiguous range expression.
    Returns True if a bare range like "45-55km" is found without a qualifier.
    """
    if not text:
        return False

    # Check for bare ranges
    m = RANGE_PATTERN.search(text)
    if not m:
        return False

    # If the range is preceded by an "up to" qualifier, it's safe
    start_pos = m.start()
    prefix = text[max(0, start_pos - 30):start_pos].lower()
    safe_prefixes = ['up to', 'bis zu', "jusqu'à", 'jusqua', 'hasta', 'fino a', 'tot ', 'até', 'upp till', 'op til', 'opptil', 'jopa']

    for sp in safe_prefixes:
        if sp in prefix:
            return False

    return True


def find_unsafe_ranges(text: str) -> list[dict]:
    """
    Find all unsafe range expressions in text and return details.
    Returns list of {match, position, suggestion} dicts.
    """
    if not text:
        return []

    unsafe = []
    for m in RANGE_PATTERN.finditer(text):
        start_pos = m.start()
        prefix = text[max(0, start_pos - 30):start_pos].lower()
        safe_prefixes = ['up to', 'bis zu', "jusqu'à", 'jusqua', 'hasta', 'fino a', 'tot ', 'até', 'upp till', 'op til', 'opptil', 'jopa']

        is_safe = any(sp in prefix for sp in safe_prefixes)
        if not is_safe:
            max_val = m.group(2)
            unit = m.group(3).upper()
            if unit in ("公里", "千米"):
                unit = "KM"
            unsafe.append({
                "match": m.group(0),
                "position": m.start(),
                "max_value": max_val,
                "unit": unit,
                "suggestion": f"UP TO {max_val}{unit} RANGE",
            })

    return unsafe


def validate_content_safety(
    body: str,
    x_text: str,
    title: str = "",
    image_prompt: str = "",
    country_code: str = "GB",
) -> dict:
    """
    Full content safety validation.
    Returns {"safe": bool, "violations": list, "blocking": bool}
    """
    violations = []

    for field_name, text in [("body", body), ("x_text", x_text), ("title", title), ("image_prompt", image_prompt)]:
        if not text:
            continue
        unsafe_ranges = find_unsafe_ranges(text)
        for ur in unsafe_ranges:
            violations.append({
                "field": field_name,
                "type": "unsafe_range",
                "match": ur["match"],
                "suggestion": ur["suggestion"],
                "severity": "blocking",
            })

    # Also check for absolute safety claims
    absolute_claims = [
        (r'(?i)\b(safest|100%\s*safe|guaranteed\s*safe|absolutely\s*safe)\b', "Absolute safety claim — must remove"),
        (r'(?i)\b(never\s*fails|never\s*break|unbreakable|indestructible)\b', "Absolute durability claim — must qualify"),
        (r'(?i)\b(best\s*in\s*the\s*world|world\'?s?\s*best|#1\s*in\s*the\s*world)\b', "Unsubstantiated 'best' claim — must remove"),
    ]

    for pattern, description in absolute_claims:
        for field_name, text in [("body", body), ("x_text", x_text), ("title", title), ("image_prompt", image_prompt)]:
            if not text:
                continue
            m = re.search(pattern, text)
            if m:
                violations.append({
                    "field": field_name,
                    "type": "absolute_claim",
                    "match": m.group(0),
                    "suggestion": description,
                    "severity": "blocking",
                })

    blocking = any(v["severity"] == "blocking" for v in violations)

    return {
        "safe": len(violations) == 0,
        "violations": violations,
        "blocking": blocking,
    }


def build_range_safety_rules(model_name: str, country_code: str = "GB") -> str:
    """
    Build the range safety rules section to inject into AI prompts.
    Returns prompt text.
    """
    from scripts.product_engine import get_product

    prod = get_product(model_name) or {}
    range_val = str(prod.get("续航里程", prod.get("range", "")))
    max_range = extract_max_range(range_val)

    if max_range is None:
        return ""

    prefix = UP_TO_MAP.get(country_code.upper(), DEFAULT_UP_TO)
    safe_expr = f"{prefix} {max_range}KM RANGE"

    return f"""
【RANGE SAFETY RULES — CRITICAL COMPLIANCE】
The product's battery range is specified as "{range_val}".
This is a RANGE VALUE. For regulatory compliance in {country_code}:
- You MUST ONLY use the maximum value: "{safe_expr}"
- NEVER write the raw range "{range_val}" in ANY output (title, body, x_text, image_prompt, tags)
- ALWAYS qualify with "{prefix}": e.g., "{safe_expr}"
- If someone asks about range, say "{safe_expr}" — never the interval
- This is a HARD BLOCKING constraint. Violating it will prevent publishing."""


def build_absolute_claims_rules() -> str:
    """Build rules to prevent absolute claims."""
    return """
【ABSOLUTE CLAIMS RULES】
- NEVER use: "safest", "100% safe", "guaranteed safe", "never fails", "unbreakable", "indestructible"
- NEVER use: "best in the world", "world's best", "#1 in the world" without citation
- INSTEAD use: "advanced safety", "reliable", "durable", "built to last", "top-rated"
- Use qualifiers: "one of the safest", "among the best", etc."""


# ------------------------------------------------------------------
# Quick check for product spec safety
# ------------------------------------------------------------------

def check_product_safety(model_name: str) -> dict:
    """
    Check a product's specs for safety issues.
    Returns {"safe": bool, "issues": list}
    """
    from scripts.product_engine import get_product

    prod = get_product(model_name) or {}
    issues = []

    # Check range field
    for key in ("续航里程", "range", "Range"):
        val = prod.get(key, "")
        if val and RANGE_PATTERN.search(str(val)):
            max_r = extract_max_range(str(val))
            safe = safe_range_expression(str(val))
            issues.append({
                "field": key,
                "raw_value": str(val),
                "max_value": max_r,
                "safe_expression": safe,
                "type": "range_spec",
                "severity": "warning",
            })
            break

    # Check for missing safety specs
    if not prod.get("刹车类型") and not prod.get("刹车系统"):
        issues.append({
            "field": "刹车类型",
            "raw_value": "MISSING",
            "type": "missing_safety_spec",
            "severity": "warning",
        })

    return {
        "safe": not any(i["severity"] == "blocking" for i in issues),
        "issues": issues,
    }
