/**
 * GET /api/publish-records?brand=&limit=
 *
 * Read publish history from Feishu schedule table.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRecords, resolveBrand, resolveTables, getText } from "./feishu-client";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const brand = resolveBrand(req.query.brand as string);
    const tables = resolveTables(brand);

    const records = await getRecords(tables.scheduleTableId);

    const publishRecords: any[] = [];
    for (const r of records) {
      const f = r.fields;
      const status = getText(f, "审核状态") || getText(f, "状态") || "";
      // Include records that have been published or failed
      if (status && status !== "已发布" && status !== "失败" && status !== "已确认" && status !== "草稿") {
        // Also include records with content regardless of status
        if (!getText(f, "文本")) continue;
      }

      const scheduleTime = f["发布时间"];
      publishRecords.push({
        record_id: r.record_id,
        title: getText(f, "大标题"),
        platform: getText(f, "平台"),
        status: status || "待发布",
        url: getText(f, "发布结果"),
        model: getText(f, "产品型号"),
        schedule_time: toMs(scheduleTime),
        brand,
        source: "feishu",
      });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    publishRecords.sort((a, b) => b.schedule_time - a.schedule_time);

    res.status(200).json({
      records: publishRecords.slice(0, limit),
      total: publishRecords.length,
    });
  } catch (e: any) {
    console.error("publish-records error:", e);
    res.status(200).json({ records: [], total: 0, error: e.message });
  }
}

function toMs(val: any): number {
  if (!val) return 0;
  let n = Number(val);
  if (n < 1e12) n *= 1000;
  return n;
}
