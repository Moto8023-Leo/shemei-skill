/**
 * GET /api/product-image/:modelName?brand=
 * Lookup Feishu product table for the first image URL of a model.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecords, resolveBrand, resolveTables, getText, getImageUrl } from "../feishu-client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const modelName = req.query.modelName as string;
    const brand = resolveBrand(req.query.brand as string);
    const tables = resolveTables(brand);

    if (!modelName) {
      return res.status(400).json({ image_url: "", error: "modelName required" });
    }

    const records = await getRecords(tables.productTableId);

    for (const r of records) {
      const f = r.fields;
      const name = getText(f, "型号名称");
      if (name === modelName || name.includes(modelName) || modelName.includes(name)) {
        const imgUrl = getImageUrl(f, "产品图片");
        if (imgUrl) {
          return res.status(200).json({ image_url: imgUrl });
        }
      }
    }

    res.status(200).json({ image_url: "" });
  } catch (e: any) {
    console.error("product-image error:", e);
    res.status(200).json({ image_url: "", error: e.message });
  }
}
