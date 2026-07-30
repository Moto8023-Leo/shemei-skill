/**
 * GET /api/publish-records
 *
 * Returns publish history from Feishu schedule table.
 * Merges records with "已发布" or "失败" status.
 * On Vercel there is no local history.json — Feishu-only.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecords, resolveBrand, resolveTables, getText } from "./feishu-client";

interface PublishRecord {
  record_id: string;
  title: string;
  platform: string;
  status: string;
  url: string;
  model: string;
  schedule_time: number;
  brand: string;
  source: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const brandParam = (req.query.brand as string) || "";
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

  const records: PublishRecord[] = [];
  const brand = resolveBrand(brandParam || undefined);

  // Read from Feishu schedule table
  try {
    const tables = resolveTables(brand);
    const raw = await getRecords(tables.scheduleTableId);

    for (const item of raw) {
      const f = item.fields || {};
      const status = (getText(f, "审核状态") || getText(f, "状态") || "").toString();
      // Only include published or failed records
      if (status && status !== "已发布" && status !== "失败") continue;

      const tsRaw = f["发布时间"];
      let scheduleTime = 0;
      if (typeof tsRaw === "number") {
        scheduleTime = tsRaw > 1e12 ? tsRaw : tsRaw * 1000;
      } else if (typeof tsRaw === "string") {
        scheduleTime = Date.parse(tsRaw) || 0;
      }

      records.push({
        record_id: item.record_id || "",
        title: getText(f, "大标题"),
        platform: getText(f, "平台"),
        status: status || "待发布",
        url: getText(f, "发布结果"),
        model: getText(f, "产品型号"),
        schedule_time: scheduleTime,
        brand,
        source: "feishu",
      });
    }
  } catch (e: any) {
    console.warn("publish-records: Feishu fetch failed", e.message);
  }

  // Sort newest first
  records.sort((a, b) => (b.schedule_time || 0) - (a.schedule_time || 0));

  // Dedupe by record_id
  const seen = new Set<string>();
  const deduped: PublishRecord[] = [];
  for (const r of records) {
    if (r.record_id && seen.has(r.record_id)) continue;
    if (r.record_id) seen.add(r.record_id);
    deduped.push(r);
  }

  return res.status(200).json({
    records: deduped.slice(0, limit),
    total: deduped.length,
  });
}
