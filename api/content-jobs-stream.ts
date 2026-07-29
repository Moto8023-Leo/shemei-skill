/**
 * POST /api/content-jobs/stream
 *
 * Generate social media content from a confirmed Creative Brief via SSE streaming.
 * Client sends the full brief in the request body — no server-side session needed.
 *
 * Required env: DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL (optional)
 * Vercel config: maxDuration: 55 (Pro plan required for >10s)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const SYSTEM_PROMPT = `You are a world-class social media copywriter specializing in electric scooters and personal mobility brands.

You receive a confirmed Creative Brief and must produce platform-native content for 4 channels.
Use only verified facts from the brief. Do NOT invent specs, prices, or compatibility claims.

BRAND-SPECIFIC RULES:
- Every hashtag MUST include the brand name (e.g. #iENYRID, not generic #ElectricScooter).
- Never mention other brands, products, or part categories not in the brief.
- If no discount/promo code was specified, do NOT include one.
- Use the actual product name and specs from the brief context.

Platform Rules:
- Facebook: primary text (35-55 words), headline (8-12 words), hashtags (3-5 tags, all brand-specific)
- Instagram: caption with hook, body, hashtags (3-5 tags, all brand-specific)
- X (Twitter): one post <=280 chars, 2-3 hashtags, all brand-specific
- Image Prompt: production-ready AI image prompt (80-150 words) + negative prompt

Tone must follow the brief. Respect avoidance rules. Do not repeat the same opening sentence across platforms.

Return VALID JSON ONLY:
{
  "facebook": { "title": "...", "body": "...", "footer": "..." },
  "instagram": { "title": "...", "body": "...", "footer": "..." },
  "x": { "title": "", "body": "...", "footer": "..." },
  "image": { "title": "Image Prompt", "body": "...", "footer": "..." }
}`;

function parseJson(text: string): any {
  text = text.trim();
  const fence = text.match(/```(?:json)?\s*\n?(.*?)\n?```/s);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch {}
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]);
  return {};
}

function sse(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { brief } = req.body || {};
  if (!brief) {
    return res.status(400).json({ error: "brief is required" });
  }

  // Demo mode
  if (!DEEPSEEK_KEY) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write(sse({ type: "status", key: "copy", status: "running" }));
    res.write(sse({
      facebook: {
        title: "Your City, Your Freedom. Ride iENYRID.",
        body: "Discover the joy of zipping through city streets with iENYRID electric scooters. Long-range battery, portable folding design, and a smooth ride that makes every commute feel like an adventure.\n\nFree shipping on orders over 500 EUR.",
        footer: "#iENYRID #ElectricScooter #CityCommute #RideFree",
      },
    }));

    setTimeout(() => {
      res.write(sse({ type: "status", key: "image", status: "running" }));
      res.write(sse({
        instagram: {
          title: "Freedom on two wheels. ☀️",
          body: "From last-mile commutes to weekend explorations, iENYRID gets you there with style and confidence.\n\nLong battery life. Foldable design. Pure electric freedom.\n\nFree shipping on orders over 500 EUR.",
          footer: "#iENYRID #ScooterLife #UrbanMobility #RideElectric",
        },
        x: {
          title: "",
          body: "Zip through the city with iENYRID. Long range, foldable, and free shipping on orders over 500 EUR.",
          footer: "#iENYRID #EScooter",
        },
        image: {
          title: "Image Prompt",
          body: "Premium summer lifestyle shot of an iENYRID electric scooter on a sunny city street. Confident rider, golden hour light. Clean product composition showing the scooter's design lines. Space for headline.",
          footer: "Avoid: incorrect proportions, unsafe riding posture, fake UI overlays, warped wheels.",
        },
      }));

      setTimeout(() => {
        res.write(sse({ type: "status", key: "done", status: "done" }));
        res.end();
      }, 500);
    }, 500);

    return;
  }

  // Live mode — SSE streaming
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    const prompt = `Generate social media content from this confirmed Creative Brief:

Campaign Theme: ${brief.campaignTheme || ""}
Target Market: ${brief.market?.country || "US"} · ${brief.market?.language || "en"}
Target Audience: ${(brief.audience || []).join(", ")}
Pain Points: ${(brief.painPoints || []).join(", ")}
Product Benefits: ${(brief.productBenefits || []).join(", ")}
Message Angle: ${brief.messageAngle || ""}
Emotional Direction: ${(brief.emotionalDirection || []).join(", ")}
Tone: ${(brief.tone || []).join(", ")}
Visual Direction: ${brief.visualDirection || ""}
Offer: ${brief.offer?.label || "No offer specified"}
Avoid: ${(brief.avoid || []).join(", ")}

Produce platform-specific content for Facebook, Instagram, X, and Image Prompt.
All text MUST be in English.`;

    // Phase 1: copy generation
    res.write(sse({ type: "status", key: "copy", status: "running" }));

    const resp = await fetch(`${DEEPSEEK_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.85,
        max_tokens: 3000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      res.write(sse({ type: "error", message: `DeepSeek error (${resp.status}): ${errText.slice(0, 200)}` }));
      res.end();
      return;
    }

    const dsData = await resp.json() as any;
    const raw = dsData.choices?.[0]?.message?.content || "";
    const contentData = parseJson(raw);

    // Build defaults from brief
    const defaults = {
      facebook: {
        title: brief.messageAngle || "Upgrade Your Ride",
        body: "Discover the difference with our latest upgrade.",
        footer: `#iENYRID #ElectricScooter #RideBetter`,
      },
      instagram: {
        title: "Ride with confidence ☀️",
        body: "Smoother rides, better control.",
        footer: `#iENYRID #ScooterLife #RideBetter`,
      },
      x: {
        title: "",
        body: (brief.messageAngle || "Better control for your ride.").slice(0, 250),
        footer: `#iENYRID #EScooter`,
      },
      image: {
        title: "Image Prompt",
        body: brief.visualDirection || "Urban environment, golden hour, clean composition.",
        footer: "Avoid: incorrect proportions, unsafe posture.",
      },
    };

    const generated: Record<string, any> = {};
    for (const key of ["facebook", "instagram", "x", "image"]) {
      const asset = contentData[key] || {};
      const d = defaults[key];
      generated[key] = {
        title: asset.title || d.title,
        body: asset.body || d.body,
        footer: asset.footer || d.footer,
      };
    }

    // Phase 2: image prompt + final data
    res.write(sse({ type: "status", key: "image", status: "running" }));

    // Send Instagram + X + image in one batch
    res.write(sse({
      instagram: generated.instagram,
      x: generated.x,
      image: generated.image,
    }));

    // Done
    res.write(sse({ type: "status", key: "done", status: "done" }));
    res.end();
  } catch (e: any) {
    console.error("content-jobs/stream error:", e);
    res.write(sse({ type: "error", message: e.message || "Generation failed" }));
    res.end();
  }
}
