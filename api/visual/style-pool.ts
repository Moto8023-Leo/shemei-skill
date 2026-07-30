/**
 * GET /api/visual/style-pool
 *
 * Returns visual style dimension pools for AI image generation prompts.
 * Data mirror of scripts/studio_data.py visualPools / visualPoolsEn.
 * Stateless — no external API calls needed.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const visualPools: Record<string, string[]> = {
  scenes: [
    "现代欧洲办公区", "干净城市自行车道", "安静住宅街区",
    "河畔通勤路线", "校园周边街道", "极简摄影棚",
    "现代交通枢纽", "周末郊野入口",
  ],
  times: [
    "清晨蓝调时刻", "柔和上午光线", "明亮阴天",
    "午后侧光", "傍晚城市灯光初亮",
  ],
  weather: [
    "干爽晴朗", "雨后路面微反光", "轻薄云层",
    "清透秋日空气", "温和春日光线",
  ],
  angles: [
    "低机位三分之四侧面", "平视侧面英雄构图", "轻微俯拍生活方式构图",
    "长焦压缩街景", "近景产品细节与环境结合",
  ],
  people: [
    "无人，强调产品本身",
    "一位年轻成年通勤者在旁准备出发",
    "一位成熟用户佩戴头盔站在安全距离",
    "背景少量行人但不遮挡产品",
    "骑行者刚停靠且双脚着地",
  ],
  placements: [
    "产品位于画面中央偏右", "产品位于画面中央偏左",
    "产品横向完整展示", "产品处于前景三分之一位置",
  ],
  whitespace: [
    "左侧保留文字安全区", "右上方保留文字安全区",
    "底部保留促销信息安全区", "背景留白充足且产品占比突出",
  ],
  lighting: [
    "高级自然光与真实阴影", "明亮科技电商光线",
    "高对比性能氛围但不过暗", "克制柔和高级极简光线",
    "清晰商业摄影光线",
  ],
};

const visualPoolsEn: Record<string, string[]> = {
  scenes: [
    "modern European office district", "clean urban bike lane",
    "quiet residential street", "riverside commuter route",
    "campus-area street", "minimalist photo studio",
    "modern transit hub", "weekend countryside trailhead",
  ],
  times: [
    "early morning blue hour", "soft morning light", "bright overcast",
    "afternoon side light", "early evening city lights",
  ],
  weather: [
    "dry and clear", "light rain with subtle road reflections",
    "thin cloud cover", "crisp autumn air", "mild spring sunlight",
  ],
  angles: [
    "low-angle three-quarter side view", "eye-level side hero composition",
    "slight top-down lifestyle angle", "telephoto compressed street view",
    "close-up product detail with environment",
  ],
  people: [
    "no people, product-only focus",
    "a young adult commuter standing beside the scooter, ready to go",
    "a mature rider wearing a helmet at a safe distance",
    "a few pedestrians in the background, not blocking the product",
    "a rider just dismounted, both feet on the ground",
  ],
  placements: [
    "product positioned center-right", "product positioned center-left",
    "product displayed full-width horizontally",
    "product in the foreground lower third",
  ],
  whitespace: [
    "text-safe zone on the left", "text-safe zone on the upper right",
    "promotional text-safe zone at the bottom",
    "generous background whitespace with prominent product ratio",
  ],
  lighting: [
    "premium natural light with real shadows",
    "bright tech e-commerce lighting",
    "high-contrast performance mood, not too dark",
    "restrained soft premium minimalist lighting",
    "crisp commercial photography lighting",
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const language = (req.query.language as string) || "zh";

  try {
    if (language === "en") {
      return res.status(200).json({ pools: visualPoolsEn });
    }
    return res.status(200).json({ pools: visualPools });
  } catch (e: any) {
    console.error("visual/style-pool error:", e);
    return res.status(500).json({ error: e.message || "Failed to load visual pools" });
  }
}
