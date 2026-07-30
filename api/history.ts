/**
 * GET /api/history
 *
 * Returns generation history entries.
 * On Vercel: reads from Feishu schedule table (no local file access).
 * Falls back gracefully to empty array on any error.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecords, resolveBrand, resolveTables, getText } from "./feishu-client";

interface HistoryEntry {
  taskId: string;
  brandId: string;
  productId: string;
  title: string;
  facebookText: string;
  styleSummary: string;
  createdAt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const brandParam = (req.query.brandId as string) || "";
  const productParam = (req.query.productId as string) || "";
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
  const offset = parseInt(req.query.offset as string) || 0;

  const entries: HistoryEntry[] = [];

  // Try Feishu schedule table — treat records with "已发布"/"已生成" status as history
  try {
    const brand = resolveBrand(brandParam || undefined);
    const tables = resolveTables(brand);
    const records = await getRecords(tables.scheduleTableId);

    for (const r of records) {
      const f = r.fields || {};
      const status = (getText(f, "审核状态") || getText(f, "状态") || "").toString();
      // Only include records that have been generated or published
      if (!status || status === "草稿") continue;

      const modelName = getText(f, "产品型号");
      if (productParam && !modelName.includes(productParam)) continue;
      if (brandParam && brand !== (brandParam || "").toLowerCase()) continue;

      entries.push({
        taskId: r.record_id || `feishu_${Date.now()}`,
        brandId: brand,
        productId: modelName,
        title: getText(f, "大标题"),
        facebookText: getText(f, "文本"),
        styleSummary: getText(f, "文案语气") || getText(f, "场景风格") || "",
        createdAt: getText(f, "发布时间") || new Date().toISOString(),
      });
    }
  } catch (e: any) {
    console.warn("history: Feishu fetch failed, returning empty", e.message);
  }

  // Sort newest first
  entries.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const total = entries.length;
  const paged = entries.slice(offset, offset + limit);

  return res.status(200).json({ entries: paged, total });
}
