/**
 * GET /api/models?brand=
 * Read product table via Feishu, return normalized model list.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecords, resolveBrand, resolveTables, getText, getImageUrl } from "./feishu-client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const brand = resolveBrand(req.query.brand as string);
    const tables = resolveTables(brand);

    const records = await getRecords(tables.productTableId);

    const models = [];
    for (const r of records) {
      const f = r.fields;
      const name = getText(f, "型号名称");
      if (!name) continue;

      models.push({
        name,
        brand: getText(f, "品牌"),
        motor: getText(f, "电机功率"),
        battery: getText(f, "电池容量"),
        range: getText(f, "续航里程"),
        speed: getText(f, "最高速度"),
        weight: getText(f, "整车重量"),
        climb: getText(f, "爬坡角度"),
        price: getText(f, "售价"),
        selling_point: getText(f, "产品卖点"),
        advantage: getText(f, "竞品优势"),
        link: getText(f, "产品链接"),
        has_image: !!getImageUrl(f, "产品图片"),
      });
    }

    res.status(200).json({ models, brand });
  } catch (e: any) {
    console.error("models error:", e);
    res.status(500).json({ error: e.message, models: [], brand: req.query.brand || "" });
  }
}
