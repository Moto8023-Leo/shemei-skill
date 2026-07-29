import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mode = process.env.DEEPSEEK_API_KEY ? "live" : "demo";

  res.status(200).json({
    ok: true,
    mode,
    uptime: 0,
    timestamp: new Date().toISOString(),
  });
}
