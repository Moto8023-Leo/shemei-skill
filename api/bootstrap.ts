/**
 * GET /api/bootstrap
 * Combined init data: brands, products, countries, events, service status.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecords, resolveBrand, resolveTables, getText, getImageUrl } from "./feishu-client";

// ---- Static brand profiles (from studio_data.py) ----
const STUDIO_BRANDS = [
  {
    id: "ienyrid",
    name: "iENYRID",
    website: "https://www.ienyrid-eu.com/",
    tone: "热情有力",
    positioning: ["城市通勤", "户外越野"],
    audiences: ["年轻成人", "成人", "成熟用户"],
    visualDna: ["城市通勤", "性能机械", "明亮科技"],
    visualDnaEn: {
      "城市通勤": "urban commuting",
      "性能机械": "performance machine",
      "明亮科技": "bright tech",
      "高级极简": "premium minimalist",
      "户外探索": "outdoor exploration",
    },
    forbidden: ["侮辱性词汇", "歧视性词汇", "低俗表达", "虚假承诺"],
  },
];

// ---- Static countries (from studio_data.py) ----
const STUDIO_COUNTRIES = [
  { code: "GB", name: "英国", nameEn: "United Kingdom", flag: "🇬🇧", language: "English", currency: "GBP", locale: "en-GB", spelling: "British English" },
  { code: "DE", name: "德国", nameEn: "Germany", flag: "🇩🇪", language: "German", currency: "EUR", locale: "de-DE", spelling: "German" },
  { code: "FR", name: "法国", nameEn: "France", flag: "🇫🇷", language: "French", currency: "EUR", locale: "fr-FR", spelling: "French" },
  { code: "ES", name: "西班牙", nameEn: "Spain", flag: "🇪🇸", language: "Spanish", currency: "EUR", locale: "es-ES", spelling: "Spanish" },
  { code: "IT", name: "意大利", nameEn: "Italy", flag: "🇮🇹", language: "Italian", currency: "EUR", locale: "it-IT", spelling: "Italian" },
  { code: "NL", name: "荷兰", nameEn: "Netherlands", flag: "🇳🇱", language: "Dutch", currency: "EUR", locale: "nl-NL", spelling: "Dutch" },
  { code: "BE", name: "比利时", nameEn: "Belgium", flag: "🇧🇪", language: "Dutch/French", currency: "EUR", locale: "nl-BE", spelling: "Dutch/French" },
];

// ---- Static products (fallback if Feishu unavailable) ----
const FALLBACK_PRODUCTS = [
  {
    id: "ienyrid-es1",
    brandId: "ienyrid",
    model: "iENYRID ES1",
    motor: "2400W",
    battery: "48V 20.8Ah",
    range: "60km",
    topSpeed: "60km/h",
    brakes: "前后碟刹 + E-ABS",
    tires: "10 英寸轮胎",
    suspension: "双液压弹簧减震",
    foldable: true,
    maxLoad: "120kg",
    price: 669,
    currency: "EUR",
    url: "https://www.ienyrid-eu.com/products/ienyrid-es1-electric-scooter",
    sellingPoints: ["60km 长续航", "2400W 动力", "双碟刹", "可折叠", "城市与轻越野"],
    structureLock: "黑色车架、双轮、直立车把、宽踏板、前后悬挂和原始灯光位置必须与参考图一致。",
    hasImage: false,
  },
  {
    id: "ienyrid-m4-pro-s-max",
    brandId: "ienyrid",
    model: "iENYRID M4 Pro S+ Max",
    motor: "800W",
    battery: "48V 20Ah",
    range: "40–65km",
    topSpeed: "45km/h",
    brakes: "前后碟刹 + E-ABS",
    tires: "10 英寸轮胎",
    suspension: "前后双弹簧减震",
    foldable: true,
    maxLoad: "120kg",
    price: 579,
    currency: "EUR",
    url: "https://www.ienyrid-eu.com/products/ienyrid-m4-pro-s-max-800w-electric-scooter-with-seat-20ah",
    sellingPoints: ["最高 65km 续航", "舒适座椅", "前后悬挂", "城市通勤", "折叠设计"],
    structureLock: "黑色车架、座椅、双轮、车把、踏板、悬挂和灯光位置必须与参考图一致，不得移除座椅。",
    hasImage: false,
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const brandParam = (req.query.brand as string) || "ienyrid";
  const brand = resolveBrand(brandParam);
  const tables = resolveTables(brand);

  // Get service status from env vars
  const demoMode = !process.env.DEEPSEEK_API_KEY;
  const serviceStatus = {
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    feishu: !!(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET),
    meta: !!(process.env.FB_PAGE_ID && process.env.FB_ACCESS_TOKEN),
  };

  // Fetch products from Feishu
  let products: any[] = FALLBACK_PRODUCTS;
  try {
    const records = await getRecords(tables.productTableId);
    const feishuProducts: any[] = [];
    for (const r of records) {
      const f = r.fields;
      const modelName = getText(f, "型号名称");
      if (!modelName) continue;

      feishuProducts.push({
        id: `${brand}-${modelName.replace(/\s+/g, "-").toLowerCase()}`,
        brandId: brand,
        model: modelName,
        motor: getText(f, "电机功率"),
        battery: getText(f, "电池容量"),
        range: getText(f, "续航里程"),
        topSpeed: getText(f, "最高速度"),
        brakes: getText(f, "刹车系统"),
        tires: getText(f, "轮胎规格"),
        suspension: getText(f, "减震系统"),
        foldable: getText(f, "产品卖点").includes("折叠"),
        maxLoad: getText(f, "整车重量"),
        price: parseFloat(getText(f, "售价")) || undefined,
        currency: "EUR",
        url: getText(f, "产品链接"),
        sellingPoints: getText(f, "产品卖点") ? [getText(f, "产品卖点")] : [],
        structureLock: "",
        hasImage: !!getImageUrl(f, "产品图片"),
        imageUrl: getImageUrl(f, "产品图片"),
      });
    }
    if (feishuProducts.length > 0) {
      products = feishuProducts;
    }
  } catch (e) {
    console.warn("bootstrap: feishu products fetch failed, using fallback", e);
  }

  // Simple calendar events (minimal for bootstrap)
  const events: any[] = [];

  res.status(200).json({
    mode: demoMode ? "demo" : "live",
    brands: STUDIO_BRANDS,
    products,
    countries: STUDIO_COUNTRIES,
    currentDate: new Date().toISOString().split("T")[0],
    events,
    serviceStatus,
    calendarDisclaimer: "Campaign dates are indicative. Please verify before scheduling.",
    limits: { maxUploadMb: 10 },
  });
}
