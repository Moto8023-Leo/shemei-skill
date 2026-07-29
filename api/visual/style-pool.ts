/**
 * GET /api/visual/style-pool?language=
 * Return hardcoded visual style dimension pools (from studio_data.py)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const visualPoolsZh = [
  { key: "城市通勤", label: "城市通勤", description: "都市白领日常通勤，现代感街道和公共交通交织的场景" },
  { key: "性能机械", label: "性能机械", description: "工业厂房、机械部件、动力系统的特写与展示" },
  { key: "自然户外", label: "自然户外", description: "山地、海滩、森林等自然景观中的骑行场景" },
  { key: "极简纯色", label: "极简纯色", description: "纯色背景、几何构图、突出产品本身的极简风格" },
  { key: "暖光生活", label: "暖光生活", description: "金色时刻光线、温馨生活环境、咖啡馆和公园场景" },
  { key: "夜光霓虹", label: "夜光霓虹", description: "城市夜景、霓虹灯光、雨后街道反光" },
  { key: "假日休闲", label: "假日休闲", description: "假期氛围、休闲时光、购物和旅游场景" },
  { key: "竞速运动", label: "竞速运动", description: "动态模糊、速度感、运动摄影风格" },
];

const visualPoolsEn = [
  { key: "urban-commute", label: "Urban Commute", description: "Modern city streets, transit hubs, daily professional commuting" },
  { key: "tech-mechanical", label: "Tech & Mechanical", description: "Industrial settings, mechanical details, powertrain close-ups" },
  { key: "outdoor-nature", label: "Outdoor & Nature", description: "Mountain trails, beach paths, forest rides" },
  { key: "minimal-pure", label: "Minimal & Pure", description: "Solid backgrounds, geometric composition, product-focused" },
  { key: "golden-lifestyle", label: "Golden Lifestyle", description: "Golden hour light, cozy environments, café & park scenes" },
  { key: "neon-night", label: "Neon Night", description: "City nightscapes, neon reflections, wet streets after rain" },
  { key: "holiday-leisure", label: "Holiday Leisure", description: "Vacation vibes, leisure time, shopping & travel settings" },
  { key: "sport-speed", label: "Sport & Speed", description: "Motion blur, speed sensation, sports photography style" },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const lang = (req.query.language as string) || "zh";
  res.status(200).json({
    pools: lang === "en" ? visualPoolsEn : visualPoolsZh,
  });
}
