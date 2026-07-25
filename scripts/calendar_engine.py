"""
2026 Marketing Calendar Engine — ported from ienyrid-social-studio-cn/server/services/calendar.mjs.
Covers 7 EU countries: GB, DE, FR, ES, IT, NL, BE.
Marketing nodes + public holidays with phase detection (warmup / active / last-chance).

Usage:
    from scripts.calendar_engine import get_campaign_events, resolve_campaign
    events = get_campaign_events("GB")
    campaign = resolve_campaign(country_code="GB", campaign_mode="auto")
"""

import datetime

# ---------------------------------------------------------------
# Marketing campaign nodes
# ---------------------------------------------------------------
MARKETING = [
    {
        "id": "new-year", "name": "新年焕新", "start": "01-01", "end": "01-15",
        "countries": "ALL",
        "recommendation": "突出新年通勤升级、效率与全新出发。",
    },
    {
        "id": "valentines", "name": "情人节出行", "start": "02-01", "end": "02-14",
        "countries": "ALL",
        "recommendation": "使用轻松生活方式视觉，强调共同探索，避免过度硬促销。",
    },
    {
        "id": "spring", "name": "春季出行季", "start": "03-15", "end": "04-30",
        "countries": "ALL",
        "recommendation": "强调天气转暖、城市短途出行与便捷折叠。",
    },
    {
        "id": "earth-day", "name": "绿色出行主题", "start": "04-10", "end": "04-22",
        "countries": "ALL",
        "recommendation": "强调更聪明的城市出行方式，避免未经证明的环保绝对化表述。",
    },
    {
        "id": "summer", "name": "夏季促销", "start": "07-01", "end": "08-31",
        "countries": "ALL",
        "recommendation": "结合夏季城市探索、周末短途与清晰优惠信息。",
    },
    {
        "id": "back-school", "name": "返校季", "start": "08-01", "end": "09-15",
        "countries": ["GB", "DE", "FR", "ES", "IT", "NL", "BE"],
        "recommendation": "面向成年学生、家长和通勤人群，突出便携、续航与日常效率。",
    },
    {
        "id": "autumn", "name": "秋季通勤焕新", "start": "09-16", "end": "10-20",
        "countries": "ALL",
        "recommendation": "使用清透秋日城市视觉，突出可靠性、灯光与悬挂。",
    },
    {
        "id": "black-friday", "name": "黑色星期五", "start": "11-13", "end": "11-30",
        "countries": "ALL",
        "recommendation": "使用高对比促销版式，清晰展示优惠力度、优惠码与截止时间。",
    },
    {
        "id": "christmas", "name": "圣诞与年末礼遇", "start": "12-01", "end": "12-26",
        "countries": "ALL",
        "recommendation": "使用克制节日元素，突出礼赠、年末通勤升级与交付时效。",
    },
]

# ---------------------------------------------------------------
# Public holidays for 2026
# ---------------------------------------------------------------
PUBLIC_HOLIDAYS_2026 = {
    "GB": [
        ("2026-01-01", "New Year's Day"), ("2026-04-03", "Good Friday"),
        ("2026-04-06", "Easter Monday"), ("2026-05-04", "Early May Bank Holiday"),
        ("2026-05-25", "Spring Bank Holiday"), ("2026-08-31", "Summer Bank Holiday"),
        ("2026-12-25", "Christmas Day"), ("2026-12-28", "Boxing Day (substitute day)"),
    ],
    "DE": [
        ("2026-01-01", "Neujahr"), ("2026-04-03", "Karfreitag"),
        ("2026-04-06", "Ostermontag"), ("2026-05-01", "Tag der Arbeit"),
        ("2026-05-14", "Christi Himmelfahrt"), ("2026-05-25", "Pfingstmontag"),
        ("2026-10-03", "Tag der Deutschen Einheit"),
        ("2026-12-25", "1. Weihnachtstag"), ("2026-12-26", "2. Weihnachtstag"),
    ],
    "FR": [
        ("2026-01-01", "Jour de l'An"), ("2026-04-06", "Lundi de Pâques"),
        ("2026-05-01", "Fête du Travail"), ("2026-05-08", "Victoire 1945"),
        ("2026-05-14", "Ascension"), ("2026-05-25", "Lundi de Pentecôte"),
        ("2026-07-14", "Fête nationale"), ("2026-08-15", "Assomption"),
        ("2026-11-01", "Toussaint"), ("2026-11-11", "Armistice"),
        ("2026-12-25", "Noël"),
    ],
    "ES": [
        ("2026-01-01", "Año Nuevo"), ("2026-01-06", "Epifanía del Señor"),
        ("2026-04-03", "Viernes Santo"), ("2026-05-01", "Fiesta del Trabajo"),
        ("2026-08-15", "Asunción de la Virgen"), ("2026-10-12", "Fiesta Nacional de España"),
        ("2026-11-01", "Todos los Santos"), ("2026-12-06", "Día de la Constitución"),
        ("2026-12-08", "Inmaculada Concepción"), ("2026-12-25", "Navidad"),
    ],
    "IT": [
        ("2026-01-01", "Capodanno"), ("2026-01-06", "Epifania"),
        ("2026-04-06", "Lunedì dell'Angelo"), ("2026-04-25", "Festa della Liberazione"),
        ("2026-05-01", "Festa del Lavoro"), ("2026-06-02", "Festa della Repubblica"),
        ("2026-08-15", "Ferragosto"), ("2026-11-01", "Ognissanti"),
        ("2026-12-08", "Immacolata Concezione"),
        ("2026-12-25", "Natale"), ("2026-12-26", "Santo Stefano"),
    ],
    "NL": [
        ("2026-01-01", "Nieuwjaarsdag"), ("2026-04-03", "Goede Vrijdag"),
        ("2026-04-06", "Tweede Paasdag"), ("2026-04-27", "Koningsdag"),
        ("2026-05-05", "Bevrijdingsdag"), ("2026-05-14", "Hemelvaartsdag"),
        ("2026-05-25", "Tweede Pinksterdag"),
        ("2026-12-25", "Eerste Kerstdag"), ("2026-12-26", "Tweede Kerstdag"),
    ],
    "BE": [
        ("2026-01-01", "Nieuwjaar / Nouvel An"), ("2026-04-06", "Paasmaandag / Lundi de Pâques"),
        ("2026-05-01", "Dag van de Arbeid / Fête du Travail"),
        ("2026-05-14", "Hemelvaart / Ascension"),
        ("2026-05-25", "Pinkstermaandag / Lundi de Pentecôte"),
        ("2026-07-21", "Nationale Feestdag / Fête nationale"),
        ("2026-08-15", "O.L.V. Hemelvaart / Assomption"),
        ("2026-11-01", "Allerheiligen / Toussaint"),
        ("2026-11-11", "Wapenstilstand / Armistice"),
        ("2026-12-25", "Kerstmis / Noël"),
    ],
}


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------
def _date_to_ordinal(value) -> int:
    """Convert date or ISO string to UTC ordinal day stamp."""
    if isinstance(value, str):
        dt = datetime.datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=datetime.timezone.utc)
    else:
        dt = value
    return dt.toordinal()


def _days_between(a, b) -> int:
    """Days between two dates or ISO strings."""
    return _date_to_ordinal(b) - _date_to_ordinal(a)


def _iso(date: datetime.date) -> str:
    return date.isoformat()


def _phase(now: datetime.date, start: datetime.date, end: datetime.date) -> str | None:
    until_start = _days_between(now, start)
    until_end = _days_between(now, end)
    if until_start > 0 and until_start <= 14:
        return "预热"
    if until_start <= 0 and until_end >= 0:
        return "最后机会" if until_end <= 2 else "进行中"
    return None


# ---------------------------------------------------------------
# Public API
# ---------------------------------------------------------------
def get_campaign_events(country_code: str, now: datetime.date | None = None) -> list[dict]:
    """
    Get all active/warmup/last-chance campaign events for a country.
    营销节点 + 法定节日, sorted by urgency (最后机会 > 进行中 > 预热).
    """
    if now is None:
        now = datetime.date.today()

    country = country_code.upper()
    result = []

    # Marketing events
    for item in MARKETING:
        if item.get("countries") != "ALL" and country not in item.get("countries", []):
            continue
        year = now.year
        start = datetime.date.fromisoformat(f"{year}-{item['start']}")
        end = datetime.date.fromisoformat(f"{year}-{item['end']}")
        ph = _phase(now, start, end)
        if not ph:
            continue
        days = max(0, _days_between(now, start))
        result.append({
            "id": f"{item['id']}-{country}-{year}",
            "name": f"{item['name']} {year}",
            "country": country,
            "startDate": _iso(start),
            "endDate": _iso(end),
            "phase": ph,
            "daysUntil": days,
            "type": "营销节点",
            "recommendation": item["recommendation"],
        })

    # Public holidays
    if now.year == 2026 and country in PUBLIC_HOLIDAYS_2026:
        for date_str, name in PUBLIC_HOLIDAYS_2026[country]:
            start = datetime.date.fromisoformat(date_str)
            end = start
            ph = _phase(now, start, end)
            if not ph:
                continue
            days = max(0, _days_between(now, start))
            result.append({
                "id": f"holiday-{country}-{date_str}",
                "name": name,
                "country": country,
                "startDate": date_str,
                "endDate": date_str,
                "phase": ph,
                "daysUntil": days,
                "type": "法定节日",
                "recommendation": "以当地节日为轻量语境；若与产品关联不强，应避免生硬蹭热点。",
            })

    # Sort: last-chance first, then active, then warmup
    rank = {"最后机会": 0, "进行中": 1, "预热": 2, "常规": 3}
    result.sort(key=lambda e: (rank.get(e["phase"], 99), e["daysUntil"]))
    return result


def resolve_campaign(
    country_code: str = "GB",
    campaign_mode: str = "auto",
    manual_campaign: str = "",
    now: datetime.date | None = None,
) -> dict | None:
    """
    Resolve the current campaign based on mode.
    Returns None for 'evergreen' mode.
    """
    if now is None:
        now = datetime.date.today()

    if campaign_mode == "evergreen":
        return None

    if campaign_mode == "manual":
        name = manual_campaign.strip() or "自定义活动"
        return {
            "id": f"manual-{int(now.strftime('%Y%m%d'))}",
            "name": name,
            "country": country_code.upper(),
            "startDate": _iso(now),
            "endDate": _iso(now),
            "phase": "进行中",
            "daysUntil": 0,
            "type": "营销节点",
            "recommendation": "围绕自定义活动生成内容，并保持优惠、日期和 CTA 一致。",
        }

    events = get_campaign_events(country_code, now)
    return events[0] if events else None


def calendar_disclaimer() -> str:
    return "2026 节日数据用于营销规划参考；西班牙、德国、比利时等国家存在地区差异，发布前请按目标地区复核。"
