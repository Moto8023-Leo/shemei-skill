"""
Product Parameter Engine — electric scooter model database.
Mirrors XOD's ruleEngine.ts architecture.

Each model has a full spec sheet. When a model is selected in Feishu,
all params are auto-loaded into the AI prompt context.

Add new models by adding entries below. No code changes needed elsewhere.
"""

# ============================================================
# 产品参数库 — 一行一型号
# ============================================================

PRODUCT_DATABASE: dict[str, dict] = {
    "iENYRID ES1": {
        "品牌": "iENYRID",
        "型号": "ES1",
        "电机功率": "500W 无刷电机",
        "电池容量": "48V 13Ah 锂电池",
        "续航里程": "45-55km",
        "最高速度": "45km/h",
        "刹车类型": "前后碟刹 + E-ABS 电子刹车",
        "轮胎尺寸": "10寸 防爆蜂窝实心胎",
        "整车重量": "18.5kg",
        "是否可折叠": "支持一键折叠",
        "最大承重": "120kg",
        "爬坡角度": "30°",
        "充电时间": "5-6小时",
        "颜色选项": "酷黑 / 极简白",
        "减震系统": "前后双弹簧减震",
        "防水等级": "IP54",
        "灯光系统": "LED 前灯 + 刹车尾灯",
        "显示屏": "LCD 液晶屏（速度/电量/里程）",
        "适用场景": "城市通勤 / 校园代步 / 短途出行",
        "售价": "$499",
        "产品卖点": "500W大功率电机 · 45-55km长续航 · 轻便可折叠 · 双重碟刹 · 防爆轮胎 · 前后减震",
        "竞品对比优势": "同价位续航最长、电机功率最大、免充气防爆轮胎",
    },
}

# ============================================================
# 用户痛点映射 → 核心卖点 + 广告角度
# ============================================================

PAIN_POINT_MAP: dict[str, dict] = {
    "续航焦虑": {
        "coreSellingPoint": "45-55km 超长续航，告别里程焦虑",
        "adAngle": "长续航通勤方案",
        "englishSlogan": "45-55km Range — Ride All Day Without Worry",
    },
    "爬坡无力": {
        "coreSellingPoint": "500W 大功率电机，30°陡坡轻松征服",
        "adAngle": "强劲动力爬坡方案",
        "englishSlogan": "500W Motor — Conquer 30° Hills with Ease",
    },
    "刹车不安全": {
        "coreSellingPoint": "前后碟刹 + E-ABS，双重制动安全无忧",
        "adAngle": "安全制动升级方案",
        "englishSlogan": "Dual Disc Brakes + E-ABS — Confident Stopping Power",
    },
    "减震差": {
        "coreSellingPoint": "前后双弹簧减震，颠簸路段如履平地",
        "adAngle": "舒适减震方案",
        "englishSlogan": "Dual Suspension — Smooth Ride on Any Terrain",
    },
    "太重不便携": {
        "coreSellingPoint": "18.5kg 轻量化车身，一键折叠轻松收纳",
        "adAngle": "便携通勤方案",
        "englishSlogan": "18.5kg Lightweight — Fold & Go Anywhere",
    },
    "无痛点": {
        "coreSellingPoint": "",
        "adAngle": "全能高端电动滑板车",
        "englishSlogan": "The Ultimate Electric Scooter Experience",
    },
}

# ============================================================
# 折扣活动映射
# ============================================================

DISCOUNT_MAP: dict[str, str] = {
    "无活动": "",
    "夏季促销": "Summer Sale",
    "黑五": "Black Friday",
    "新品上市": "New Arrival",
    "限时优惠": "Limited Time Offer",
    "年终大促": "Year-End Sale",
}

# ============================================================
# 促销信息映射
# ============================================================

PROMOTION_MAP: dict[str, str] = {
    "无促销": "",
    "5%折扣": "5% OFF",
    "8%折扣": "8% OFF",
    "10%折扣": "10% OFF",
    "15%折扣": "15% OFF",
    "包邮": "Free Shipping",
}

# ============================================================
# CTA 映射
# ============================================================

CTA_MAP: dict[str, str] = {
    "立即购买": "BUY NOW",
    "了解更多": "LEARN MORE",
    "限时抢购": "SHOP NOW",
    "立即升级": "UPGRADE NOW",
    "查看详情": "LEARN MORE",
}

# ============================================================
# 广告类型映射
# ============================================================

AD_TYPE_MAP: dict[str, str] = {
    "单品推广": "聚焦单款车型，突出核心卖点和价格",
    "品牌推广": "拔高品牌调性，展示整体产品线和技术实力",
    "促销推广": "强调折扣和限时感，紧迫感强",
    "新品推广": "突出新品亮点，制造首发期待感",
}

# ============================================================
# 场景风格映射
# ============================================================

SCENE_STYLE_MAP: dict[str, str] = {
    "城市通勤": "modern city street, clean asphalt, office buildings background, morning golden hour light, professional urban commuter vibe",
    "户外探险": "scenic mountain road, blue sky, nature backdrop, adventurous outdoor lifestyle, bright sunlight",
    "校园代步": "university campus, green lawns, modern buildings, young student lifestyle, warm afternoon light",
    "雨天出行": "wet city street after rain, reflections on pavement, dramatic cloudy sky with sun rays breaking through, waterproof confidence",
    "夜间": "night city ride, neon lights reflecting on wet streets, LED headlight beam visible, cinematic urban night atmosphere",
    "展示棚拍": "clean studio backdrop, professional product photography lighting, minimal and premium, focus on product details",
}

# ============================================================
# 平台推荐尺寸
# ============================================================

PLATFORM_SIZE_MAP: dict[str, str] = {
    "FB": "1080×1080 方图 (适合信息流)",
    "IG": "1080×1080 方图或 1080×1350 竖版 (适合Feed)",
    "X": "1200×675 横版 (适合时间线)",
}

# ============================================================
# 文案语气映射
# ============================================================

TONE_MAP: dict[str, str] = {
    "专业自信": "Professional, authoritative, data-driven, trustworthy",
    "激情澎湃": "Exciting, energetic, action-oriented, adrenaline-filled",
    "简洁直接": "Clean, minimal, straight-to-the-point, no fluff",
    "亲和有趣": "Friendly, conversational, relatable, fun, emoji-rich",
}


def get_product(model_name: str) -> dict | None:
    """Get full product spec by model name. Feishu first, local fallback.
    Uses fuzzy matching: "iENYRID M4 Pro S+ Max" matches "M4 Pro S+ Max"."""
    try:
        import os
        from dotenv import load_dotenv
        load_dotenv()
        from scripts.feishu_driver import FeishuDriver
        driver = FeishuDriver()
        p_table_id = os.getenv("FEISHU_PRODUCT_TABLE_ID", "tblHbkPBjJ3uQOf9")
        saved = driver.table_id
        driver.table_id = p_table_id
        records = driver._get_all_records()
        driver.table_id = saved
        for r in records:
            fields = r.get("fields", {})
            name = fields.get("型号名称", "")
            if not name:
                continue
            # Match: exact, or model_name ends with/short name exists in full name
            if name == model_name or model_name.endswith(name) or name in model_name:
                return dict(fields)
    except Exception:
        pass
    return PRODUCT_DATABASE.get(model_name)


def list_models() -> list[str]:
    """List all models from Feishu, local fallback."""
    try:
        import os
        from dotenv import load_dotenv
        load_dotenv()
        from scripts.feishu_driver import FeishuDriver
        driver = FeishuDriver()
        p_table_id = os.getenv("FEISHU_PRODUCT_TABLE_ID", "tblHbkPBjJ3uQOf9")
        saved = driver.table_id
        driver.table_id = p_table_id
        records = driver._get_all_records()
        driver.table_id = saved
        models = []
        for r in records:
            name = r.get("fields", {}).get("型号名称", "")
            if name:
                models.append(name)
        if models:
            return models
    except Exception:
        pass
    return list(PRODUCT_DATABASE.keys())


def get_pain_point(pain: str) -> dict | None:
    """Get pain point mapping."""
    return PAIN_POINT_MAP.get(pain)


def get_discount(activity: str) -> str:
    return DISCOUNT_MAP.get(activity, "")


def get_promotion(promo: str) -> str:
    return PROMOTION_MAP.get(promo, "")


def get_cta(cta: str) -> str:
    return CTA_MAP.get(cta, cta.upper())


def get_scene(scene: str) -> str:
    return SCENE_STYLE_MAP.get(scene, SCENE_STYLE_MAP["城市通勤"])


def get_ad_type(ad_type: str) -> str:
    return AD_TYPE_MAP.get(ad_type, "")


def get_tone(tone: str) -> str:
    return TONE_MAP.get(tone, TONE_MAP["亲和有趣"])


def list_pain_points() -> list[str]:
    return list(PAIN_POINT_MAP.keys())
