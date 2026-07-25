"""
Studio Data — brands, products, countries, visual pools, negative prompts.
Ported from ienyrid-social-studio-cn/server/data.mjs.

Usage:
    from scripts.studio_data import brands, countries, visualPools, lockedNegativePrompt
"""

# ---------------------------------------------------------------
# Brands (extended from brand_config.py with positioning & visual DNA)
# ---------------------------------------------------------------
brands = [
    {
        "id": "ienyrid",
        "name": "iENYRID",
        "website": "https://www.ienyrid-eu.com/",
        "tone": "热情有力",
        "positioning": ["城市通勤", "户外越野"],
        "audiences": ["年轻成人", "成人", "成熟用户"],
        "visualDna": ["城市通勤", "性能机械", "明亮科技"],
        "visualDnaEn": {
            "城市通勤": "urban commuting",
            "性能机械": "performance machine",
            "明亮科技": "bright tech",
            "高级极简": "premium minimalist",
            "户外探索": "outdoor exploration",
        },
        "forbidden": ["侮辱性词汇", "歧视性词汇", "低俗表达", "虚假承诺"],
    }
]

# ---------------------------------------------------------------
# Products (hardcoded fallback — live data comes from Feishu)
# ---------------------------------------------------------------
products = [
    {
        "id": "ienyrid-es1",
        "brandId": "ienyrid",
        "model": "iENYRID ES1",
        "motor": "2400W",
        "battery": "48V 20.8Ah",
        "range": "60km",
        "topSpeed": "60km/h",
        "brakes": "前后碟刹 + E-ABS",
        "tires": "10 英寸轮胎",
        "suspension": "双液压弹簧减震",
        "foldable": True,
        "maxLoad": "120kg",
        "price": 669,
        "currency": "EUR",
        "url": "https://www.ienyrid-eu.com/products/ienyrid-es1-electric-scooter",
        "sellingPoints": ["60km 长续航", "2400W 动力", "双碟刹", "可折叠", "城市与轻越野"],
        "structureLock": "黑色车架、双轮、直立车把、宽踏板、前后悬挂和原始灯光位置必须与参考图一致。",
    },
    {
        "id": "ienyrid-m4-pro-s-max",
        "brandId": "ienyrid",
        "model": "iENYRID M4 Pro S+ Max",
        "motor": "800W",
        "battery": "48V 20Ah",
        "range": "40–65km",
        "topSpeed": "45km/h",
        "brakes": "前后碟刹 + E-ABS",
        "tires": "10 英寸轮胎",
        "suspension": "前后双弹簧减震",
        "foldable": True,
        "maxLoad": "120kg",
        "price": 579,
        "currency": "EUR",
        "url": "https://www.ienyrid-eu.com/products/ienyrid-m4-pro-s-max-800w-electric-scooter-with-seat-20ah",
        "sellingPoints": ["最高 65km 续航", "舒适座椅", "前后悬挂", "城市通勤", "折叠设计"],
        "structureLock": "黑色车架、座椅、双轮、车把、踏板、悬挂和灯光位置必须与参考图一致，不得移除座椅。",
    },
]

# ---------------------------------------------------------------
# Countries / Markets
# ---------------------------------------------------------------
countries = [
    {"code": "GB", "name": "英国", "nameEn": "United Kingdom", "flag": "🇬🇧", "language": "English", "currency": "GBP", "locale": "en-GB", "spelling": "British English"},
    {"code": "DE", "name": "德国", "nameEn": "Germany", "flag": "🇩🇪", "language": "Deutsch", "currency": "EUR", "locale": "de-DE", "spelling": "German"},
    {"code": "FR", "name": "法国", "nameEn": "France", "flag": "🇫🇷", "language": "Français", "currency": "EUR", "locale": "fr-FR", "spelling": "French"},
    {"code": "ES", "name": "西班牙", "nameEn": "Spain", "flag": "🇪🇸", "language": "Español", "currency": "EUR", "locale": "es-ES", "spelling": "Spanish"},
    {"code": "IT", "name": "意大利", "nameEn": "Italy", "flag": "🇮🇹", "language": "Italiano", "currency": "EUR", "locale": "it-IT", "spelling": "Italian"},
    {"code": "NL", "name": "荷兰", "nameEn": "Netherlands", "flag": "🇳🇱", "language": "Nederlands", "currency": "EUR", "locale": "nl-NL", "spelling": "Dutch"},
    {"code": "BE", "name": "比利时", "nameEn": "Belgium", "flag": "🇧🇪", "language": "English", "currency": "EUR", "locale": "en-BE", "spelling": "International English"},
]

# ---------------------------------------------------------------
# Visual Pools (Chinese — for UI display)
# ---------------------------------------------------------------
visualPools = {
    "scenes": [
        "现代欧洲办公区", "干净城市自行车道", "安静住宅街区",
        "河畔通勤路线", "校园周边街道", "极简摄影棚",
        "现代交通枢纽", "周末郊野入口",
    ],
    "times": [
        "清晨蓝调时刻", "柔和上午光线", "明亮阴天",
        "午后侧光", "傍晚城市灯光初亮",
    ],
    "weather": [
        "干爽晴朗", "雨后路面微反光", "轻薄云层",
        "清透秋日空气", "温和春日光线",
    ],
    "angles": [
        "低机位三分之四侧面", "平视侧面英雄构图", "轻微俯拍生活方式构图",
        "长焦压缩街景", "近景产品细节与环境结合",
    ],
    "people": [
        "无人，强调产品本身",
        "一位年轻成年通勤者在旁准备出发",
        "一位成熟用户佩戴头盔站在安全距离",
        "背景少量行人但不遮挡产品",
        "骑行者刚停靠且双脚着地",
    ],
    "placements": [
        "产品位于画面中央偏右", "产品位于画面中央偏左",
        "产品横向完整展示", "产品处于前景三分之一位置",
    ],
    "whitespace": [
        "左侧保留文字安全区", "右上方保留文字安全区",
        "底部保留促销信息安全区", "背景留白充足且产品占比突出",
    ],
    "lighting": [
        "高级自然光与真实阴影", "明亮科技电商光线",
        "高对比性能氛围但不过暗", "克制柔和高级极简光线",
        "清晰商业摄影光线",
    ],
}

# ---------------------------------------------------------------
# Visual Pools (English — for AI prompts)
# ---------------------------------------------------------------
visualPoolsEn = {
    "scenes": [
        "modern European office district", "clean urban bike lane",
        "quiet residential street", "riverside commuter route",
        "campus-area street", "minimalist photo studio",
        "modern transit hub", "weekend countryside trailhead",
    ],
    "times": [
        "early morning blue hour", "soft morning light", "bright overcast",
        "afternoon side light", "early evening city lights",
    ],
    "weather": [
        "dry and clear", "light rain with subtle road reflections",
        "thin cloud cover", "crisp autumn air", "mild spring sunlight",
    ],
    "angles": [
        "low-angle three-quarter side view", "eye-level side hero composition",
        "slight top-down lifestyle angle", "telephoto compressed street view",
        "close-up product detail with environment",
    ],
    "people": [
        "no people, product-only focus",
        "a young adult commuter standing beside the scooter, ready to go",
        "a mature rider wearing a helmet at a safe distance",
        "a few pedestrians in the background, not blocking the product",
        "a rider just dismounted, both feet on the ground",
    ],
    "placements": [
        "product positioned center-right", "product positioned center-left",
        "product displayed full-width horizontally",
        "product in the foreground lower third",
    ],
    "whitespace": [
        "text-safe zone on the left", "text-safe zone on the upper right",
        "promotional text-safe zone at the bottom",
        "generous background whitespace with prominent product ratio",
    ],
    "lighting": [
        "premium natural light with real shadows",
        "bright tech e-commerce lighting",
        "high-contrast performance mood, not too dark",
        "restrained soft premium minimalist lighting",
        "crisp commercial photography lighting",
    ],
}

# ---------------------------------------------------------------
# Locked Negative Prompt (structure protection)
# ---------------------------------------------------------------
lockedNegativePrompt = " ".join([
    "Preserve the exact identity, geometry, proportions, frame construction, wheel count, wheel size, handlebar, deck, suspension, lighting, braking system, seat and all visible components of the reference scooter.",
    "Do not redesign, deform, bend, melt, shorten or extend the scooter.",
    "No duplicated components, no extra wheels, no missing parts, no warped frame, no incorrect wheel alignment, no invented accessories and no changed product colour.",
    "Do not generate text, letters, numbers, watermarks, brand marks or logos inside the image.",
    "People, props and environmental objects must not cover the key product structure.",
])

# ---------------------------------------------------------------
# Language text templates for demo/fallback copy
# ---------------------------------------------------------------
languageText = {
    "English": {
        "headline": "GO FURTHER. WORRY LESS.",
        "support": "Built for the everyday city ride.",
        "shop": "Shop now",
        "intro": lambda p: f"Meet the {p.get('model','')}: {p.get('range','')} range and {p.get('motor','')} power for confident everyday mobility.",
        "body": lambda p: f"{p.get('range','')} range, {p.get('brakes','')} and a foldable design make it ready for real city routines.",
        "close": "A practical upgrade for commuting, errands and weekend city rides.",
    },
    "Deutsch": {
        "headline": "WEITER FAHREN. WENIGER SORGEN.",
        "support": "Für deinen täglichen Weg durch die Stadt.",
        "shop": "Jetzt entdecken",
        "intro": lambda p: f"Entdecke den {p.get('model','')}: {p.get('range','')} Reichweite und {p.get('motor','')} Leistung für zuverlässige Alltagsmobilität.",
        "body": lambda p: f"{p.get('range','')} Reichweite, {p.get('brakes','')} und faltbares Design machen ihn bereit für den echten Stadtalltag.",
        "close": "Ein praktisches Upgrade für Pendeln, Besorgungen und Wochenendausflüge in der Stadt.",
    },
    "Français": {
        "headline": "ALLEZ PLUS LOIN.",
        "support": "Pensée pour vos trajets urbains.",
        "shop": "Découvrir",
        "intro": lambda p: f"Découvrez le {p.get('model','')} : {p.get('range','')} d'autonomie et {p.get('motor','')} de puissance pour vos trajets quotidiens.",
        "body": lambda p: f"{p.get('range','')} d'autonomie, {p.get('brakes','')} et son design pliable le rendent prêt pour la vraie vie urbaine.",
        "close": "Une amélioration pratique pour les trajets domicile-travail, les courses et les balades du week-end.",
    },
    "Español": {
        "headline": "LLEGA MÁS LEJOS.",
        "support": "Diseñado para tu movilidad urbana diaria.",
        "shop": "Descúbrelo",
        "intro": lambda p: f"Descubre el {p.get('model','')}: {p.get('range','')} de autonomía y {p.get('motor','')} de potencia para moverte cada día con confianza.",
        "body": lambda p: f"{p.get('range','')} de autonomía, {p.get('brakes','')} y diseño plegable lo hacen ideal para la rutina urbana real.",
        "close": "Una mejora práctica para desplazamientos, recados y paseos urbanos de fin de semana.",
    },
    "Italiano": {
        "headline": "VAI PIÙ LONTANO.",
        "support": "Pensato per gli spostamenti urbani.",
        "shop": "Scopri ora",
        "intro": lambda p: f"Scopri {p.get('model','')}: {p.get('range','')} di autonomia e {p.get('motor','')} di potenza per la mobilità quotidiana.",
        "body": lambda p: f"{p.get('range','')} di autonomia, {p.get('brakes','')} e design pieghevole lo rendono pronto per la vera routine cittadina.",
        "close": "Un upgrade pratico per spostamenti, commissioni e gite urbane del fine settimana.",
    },
    "Nederlands": {
        "headline": "VERDER RIJDEN. MINDER ZORGEN.",
        "support": "Gemaakt voor dagelijks stadsverkeer.",
        "shop": "Bekijk nu",
        "intro": lambda p: f"Ontdek de {p.get('model','')}: {p.get('range','')} bereik en {p.get('motor','')} vermogen voor betrouwbare dagelijkse mobiliteit.",
        "body": lambda p: f"{p.get('range','')} bereik, {p.get('brakes','')} en opvouwbaar ontwerp maken hem klaar voor echte stadsroutines.",
        "close": "Een praktische upgrade voor woon-werkverkeer, boodschappen en weekendritten in de stad.",
    },
}
