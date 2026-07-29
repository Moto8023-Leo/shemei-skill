/**
 * GET /api/events?country=&date=
 * Marketing calendar campaign resolver (mirrors scripts/calendar_engine.py)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ---- Static campaign data (from calendar_engine.py) ----
interface Campaign {
  id: string;
  name: string;
  country: string;
  startDate: string;
  endDate: string;
  phase: string;
  daysUntil: number;
  type: string;
  recommendation: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
};

function getCampaigns(now: Date): Campaign[] {
  const year = now.getFullYear();
  const today = formatDate(now);

  // Generate campaigns for all supported countries
  const templates: { name: string; type: string; startOffset: number; endOffset: number }[] = [
    { name: "Spring Renewal", type: "季节性活动", startOffset: daysDiff("2026-03-01", today), endOffset: daysDiff("2026-04-15", today) },
    { name: "Easter Flash Sale", type: "节日促销", startOffset: daysDiff("2026-04-10", today), endOffset: daysDiff("2026-04-20", today) },
    { name: "Summer Freedom", type: "季节性活动", startOffset: daysDiff("2026-06-01", today), endOffset: daysDiff("2026-08-31", today) },
    { name: "Back to School", type: "返校季", startOffset: daysDiff("2026-08-15", today), endOffset: daysDiff("2026-09-15", today) },
    { name: "Black Friday", type: "大促", startOffset: daysDiff("2026-11-20", today), endOffset: daysDiff("2026-11-30", today) },
    { name: "Christmas Gift", type: "节日促销", startOffset: daysDiff("2026-12-01", today), endOffset: daysDiff("2026-12-25", today) },
    { name: "New Year Launch", type: "新品推广", startOffset: daysDiff("2027-01-01", today), endOffset: daysDiff("2027-01-31", today) },
  ];

  const countries = Object.keys(COUNTRY_NAMES);
  const campaigns: Campaign[] = [];

  for (const t of templates) {
    // Parse fixed dates
    const startDate = toDateString(t.startOffset, year);
    const endDate = toDateString(t.endOffset, year);

    const daysUntil = daysDiff(formatDate(new Date()), startDate);
    let phase: string;
    if (daysUntil < 0) {
      phase = daysDiff(formatDate(new Date()), endDate) > 0 ? "已结束" : "进行中";
    } else if (daysUntil <= 14) {
      phase = "预热";
    } else if (daysUntil <= 0) {
      phase = "进行中";
    } else {
      phase = daysDiff(formatDate(new Date()), endDate) > 0 ? "已结束" : "即将到来";
    }

    const recommendation = getRecommendation(t.type, phase);

    for (const country of countries) {
      campaigns.push({
        id: `${country}-${t.name.replace(/\s+/g, "-").toLowerCase()}-${year}`,
        name: `${t.name} ${year}`,
        country,
        startDate,
        endDate,
        phase,
        daysUntil: Math.max(0, daysUntil),
        type: t.type,
        recommendation,
      });
    }
  }

  return campaigns;
}

function getRecommendation(type: string, phase: string): string {
  if (phase === "预热") return "预热期：造势、悬念、提前订阅";
  if (phase === "进行中") return "爆发期：限时优惠、紧迫感、库存告急";
  if (phase === "已结束") return "";
  if (type === "大促") return "大促强折扣 + 满减阶梯";
  if (type === "返校季") return "学生通勤 + 便携安全 + 限时学生折扣";
  if (type === "节日促销") return "节日礼遇 + 限时优惠 + 节日主题视觉";
  return "场景化推广 + 日常种草";
}

// ---- Helpers ----

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysDiff(from: string, to: string): number {
  const f = new Date(from);
  const t = new Date(to);
  return Math.ceil((f.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}

function toDateString(dayOffset: number, year: number): string {
  // Convert daysDiff-like offset back to actual date
  const d = new Date(year, 0, 1 + dayOffset + 30); // approximate
  return formatDate(d);
}

// ---- Handler ----

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const country = (req.query.country as string || "GB").toUpperCase();
  const dateStr = (req.query.date as string) || "";

  if (!COUNTRY_NAMES[country]) {
    return res.status(400).json({ error: `Unsupported country: ${country}`, events: [] });
  }

  const now = dateStr ? new Date(dateStr) : new Date();
  const all = getCampaigns(now);

  // Filter by country
  const events = all.filter((e) => e.country === country);

  res.status(200).json({
    events,
    disclaimer: "Campaign dates are indicative. Please verify before scheduling.",
  });
}
