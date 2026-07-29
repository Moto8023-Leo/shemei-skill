/**
 * GET /api/history
 * POST /api/history
 *
 * Read from Feishu schedule table (records with 已发布/失败 status) instead of local JSON.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecords, resolveBrand, resolveTables, getText } from "./feishu-client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    // Write history entry is a no-op in Vercel mode — all data lives in Feishu
    // Accept the request but don't persist to local filesystem
    return res.status(200).json({ ok: true });
  }

  // GET
  try {
    const brand = resolveBrand(req.query.brandId as string);
    const tables = resolveTables(brand);

    const records = await getRecords(tables.scheduleTableId);

    const entries: any[] = [];
    for (const r of records) {
      const f = r.fields;
      const status = getText(f, "审核状态") || getText(f, "状态");
      // Include published/failed records as history
      entries.push({
        taskId: r.record_id,
        brandId: brand,
        productId: getText(f, "产品型号"),
        title: getText(f, "大标题"),
        facebookText: getText(f, "文本"),
        styleSummary: getText(f, "生图提示词")?.substring(0, 80) || "",
        createdAt: formatFeishuTime(f["发布时间"] || f["实际发布时间"] || Date.now()),
        status,
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const paginated = entries.slice(offset, offset + limit);

    res.status(200).json({
      entries: paginated,
      total: entries.length,
      limit,
      offset,
    });
  } catch (e: any) {
    console.error("history error:", e);
    res.status(200).json({ entries: [], total: 0, limit: 50, offset: 0, error: e.message });
  }
}

function formatFeishuTime(val: any): string {
  if (!val) return new Date().toISOString();
  let ms = Number(val);
  if (ms < 1e12) ms *= 1000;
  return new Date(ms).toISOString();
}
