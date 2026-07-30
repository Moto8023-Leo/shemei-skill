/**
 * POST /api/generate
 *
 * Combined AI generation endpoint using DeepSeek.
 * Routes: POST /api/generate?action=brief|content|stream
 *
 * - action=brief: Generate Creative Brief from idea
 * - action=stream: SSE streaming content generation from brief data
 *
 * Stateless — client sends full brief data in the request body.
 *
 * Required env: DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL (optional)
 * Vercel config: maxDuration: 55 (Pro plan required for >10s)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

// ── System prompts ──

const BRIEF_SYSTEM = `You are a senior overseas social media strategist for consumer mobility brands (electric scooters, e-bikes, personal EVs).
Your job is to transform an operator's natural-language idea into a structured Creative Brief.

Rules:
1. Preserve explicit facts. Never invent product specifications, compatibility claims, discounts, dates, or legal claims.
2. Separate facts from reasonable interpretations and note what's missing.
3. Avoid fear-based safety marketing, absolute safety claims, and exaggerated performance claims.
4. The brief is a SUGGESTION. It will NOT be applied until the operator confirms it.
5. When a critical fact is missing, add it to clarificationQuestions rather than guessing. ALL clarificationQuestions MUST be written in Chinese.
6. Only write content for the specific brand mentioned in the context. Do NOT reference other brands.
7. If the operator doesn't mention a discount, do NOT invent one. Set offer.label to an empty string.
8. All hashtag suggestions must include the correct brand name (e.g. #iENYRID).
9. Return VALID JSON ONLY, matching the schema below. No markdown, no commentary.

Output JSON schema:
{
  "campaignTheme": "string — catchy campaign theme name in English",
  "market": { "country": "string — ISO country code", "language": "string — BCP-47 language tag" },
  "audience": ["string — target audience segments"],
  "painPoints": ["string — specific user pain points this addresses"],
  "productBenefits": ["string — which product features solve those pain points"],
  "messageAngle": "string — the angle/core message, 5-8 words max",
  "emotionalDirection": ["string — emotional tones to strike"],
  "tone": ["string — tone descriptors in English"],
  "visualDirection": "string — visual style description for image generation",
  "offer": { "label": "string — promotion text", "verified": false },
  "avoid": ["string — topics/phrases to avoid"],
  "clarificationQuestions": ["string — must be in Chinese"]
}`;

const CONTENT_SYSTEM = `You are a world-class social media copywriter specializing in electric scooters and personal mobility brands.
You receive a confirmed Creative Brief and must produce platform-native content for 4 channels.
Use only verified facts from the brief. Do NOT invent specs, prices, or compatibility claims.

BRAND-SPECIFIC RULES:
- Every hashtag MUST include the brand name (e.g. #iENYRID, not generic #ElectricScooter).
- Never mention other brands, products, or part categories not in the brief.
- If no discount/promo code was specified, do NOT include one.

Platform Rules:
- Facebook: primary text (35-55 words), headline (8-12 words), hashtags (3-5 tags)
- Instagram: caption with hook, body, hashtags (3-5 tags)
- X (Twitter): one post <=280 chars, 2-3 hashtags
- Image Prompt: production-ready AI image prompt (80-150 words) + negative prompt

Return VALID JSON ONLY:
{
  "facebook": { "title": "...", "body": "...", "footer": "..." },
  "instagram": { "title": "...", "body": "...", "footer": "..." },
  "x": { "title": "", "body": "...", "footer": "..." },
  "image": { "title": "Image Prompt", "body": "...", "footer": "..." }
}`;

// ── Helpers ──

function parseJson(text: string): any {
  text = text.trim();
  const fence = text.match(/```(?:json)?\s*\n?(.*?)\n?```/s);
  if (fence) text = fence[1].trim();
  try { return JSON.parse(text); } catch {}
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]);
  return {};
}

function computeConfidence(brief: Record<string, any>) {
  let score = 100;
  const qCount = (brief.clarificationQuestions || []).length;
  score -= Math.min(qCount * 15, 45);

  const keyDefs: Record<string, number> = { campaignTheme: 15, messageAngle: 10, visualDirection: 10 };
  const missingKeys: string[] = [];
  for (const [k, penalty] of Object.entries(keyDefs)) {
    if (!brief[k]?.trim()) { score -= penalty; missingKeys.push(k); }
  }

  const listDefs: Record<string, number> = { audience: 10, painPoints: 5, productBenefits: 5 };
  const missingLists: string[] = [];
  for (const [k, penalty] of Object.entries(listDefs)) {
    if (!brief[k] || brief[k].length === 0) { score -= penalty; missingLists.push(k); }
  }

  const market = brief.market || {};
  if (!market.country?.trim()) score -= 5;
  if (!market.language?.trim()) score -= 5;

  const offer = brief.offer || {};
  if (offer.label?.trim() && !offer.verified) score -= 5;

  if ((brief.avoid || []).length >= 2) score += 3;
  if ((brief.audience || []).length >= 2) score += 2;

  score = Math.max(15, Math.min(100, score));
  return {
    clarificationQuestions: { count: qCount, penalty: Math.min(qCount * 15, 45) },
    missingKeyFields: { fields: missingKeys, penalty: missingKeys.reduce((s, f) => s + (keyDefs[f] || 0), 0) },
    missingLists: { fields: missingLists, penalty: missingLists.reduce((s, f) => s + (listDefs[f] || 0), 0) },
    market: {
      missing: [...(!market.country?.trim() ? ["country"] : []), ...(!market.language?.trim() ? ["language"] : [])],
      penalty: (!market.country?.trim() ? 5 : 0) + (!market.language?.trim() ? 5 : 0),
    },
    offerUnverified: { hasLabel: !!(offer.label?.trim()), penalty: offer.label?.trim() && !offer.verified ? 5 : 0 },
    bonuses: { avoidList: (brief.avoid || []).length >= 2 ? 3 : 0, audienceSegments: (brief.audience || []).length >= 2 ? 2 : 0, total: 0 },
    computedScore: score,
  };
}

function sse(data: any): string { return `data: ${JSON.stringify(data)}\n\n`; }

// ── Handler ──

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = (req.query.action as string) || "brief";

  // ── action=brief — Creative Brief generation ──
  if (action === "brief") {
    const { idea, brandId } = req.body || {};
    if (!idea?.trim()) {
      return res.status(400).json({ error: "idea is required" });
    }

    if (!DEEPSEEK_KEY) {
      const brief: any = {
        campaignTheme: "iENYRID Summer City Ride",
        market: { country: "GB", language: "en" },
        audience: ["Urban commuters", "Electric scooter enthusiasts", "Eco-conscious riders"],
        painPoints: ["City traffic congestion", "Last-mile commute challenges"],
        productBenefits: ["Long-range battery", "Portable folding design", "Smooth ride quality"],
        messageAngle: "Your City, Your Freedom",
        emotionalDirection: ["Confident", "Free", "Excited"],
        tone: ["Energetic", "Friendly"],
        visualDirection: "iENYRID electric scooter in a sunny European city street, golden hour light",
        offer: { label: "Free shipping on orders over 500 EUR", verified: false },
        avoid: ["Fear-based copy", "Absolute safety claims", "Unverified specs"],
        clarificationQuestions: ["你具体想推广哪个型号？", "目标国家是哪里？"],
      };
      const cf = computeConfidence(brief);
      return res.status(200).json({
        taskId: `brief_${Date.now().toString(36)}`,
        brief: { ...brief, confidence: Math.round(cf.computedScore) / 100 },
        confidence: Math.round(cf.computedScore) / 100,
        confidenceFactors: cf,
        warnings: brief.clarificationQuestions,
        mode: "demo",
        createdAt: new Date().toISOString(),
      });
    }

    try {
      const brandDisplay = (brandId || "iENYRID").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const prompt = `Operator's idea:\n\n"${idea.trim()}"\n\nBrand: ${brandDisplay}\nThe brand operates in overseas markets (primarily Europe/North America) selling electric scooters.\n\nAnalyze this idea and produce a Creative Brief.\n\nIMPORTANT: Never invent specs, discounts, or prices. All hashtags MUST include the correct brand name.`;

      const resp = await fetch(`${DEEPSEEK_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "system", content: BRIEF_SYSTEM }, { role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
      if (!resp.ok) throw new Error(`DeepSeek error (${resp.status})`);

      const dsData = await resp.json() as any;
      const raw = dsData.choices?.[0]?.message?.content || "";
      const briefData = parseJson(raw);

      const brief: any = {
        campaignTheme: briefData.campaignTheme || "",
        market: briefData.market || { country: "US", language: "en" },
        audience: briefData.audience || [],
        painPoints: briefData.painPoints || [],
        productBenefits: briefData.productBenefits || [],
        messageAngle: briefData.messageAngle || "",
        emotionalDirection: briefData.emotionalDirection || [],
        tone: briefData.tone || [],
        visualDirection: briefData.visualDirection || "",
        offer: briefData.offer || { label: "", verified: false },
        avoid: briefData.avoid || [],
        clarificationQuestions: briefData.clarificationQuestions || [],
      };
      const cf = computeConfidence(brief);
      brief.confidence = Math.round(cf.computedScore) / 100;

      return res.status(200).json({
        taskId: `brief_${Date.now().toString(36)}`,
        brief,
        confidence: brief.confidence,
        confidenceFactors: cf,
        warnings: brief.clarificationQuestions,
        mode: "live",
        createdAt: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error("generate/brief error:", e);
      return res.status(500).json({ error: e.message || "Generation failed" });
    }
  }

  // ── action=stream — SSE content generation ──
  if (action === "stream") {
    const { brief } = req.body || {};
    if (!brief) {
      return res.status(400).json({ error: "brief is required" });
    }

    if (!DEEPSEEK_KEY) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write(sse({ type: "status", key: "copy", status: "running" }));
      setTimeout(() => {
        res.write(sse({ type: "status", key: "image", status: "running" }));
        res.write(sse({
          facebook: { title: "Your City, Your Freedom. Ride iENYRID.", body: "Discover the joy of zipping through city streets with iENYRID electric scooters.", footer: "#iENYRID #ElectricScooter #CityCommute #RideFree" },
          instagram: { title: "Freedom on two wheels.", body: "From last-mile commutes to weekend explorations.", footer: "#iENYRID #ScooterLife #UrbanMobility #RideElectric" },
          x: { title: "", body: "Zip through the city with iENYRID. Long range, foldable.", footer: "#iENYRID #EScooter" },
          image: { title: "Image Prompt", body: brief.visualDirection || "Urban environment, golden hour light.", footer: "Avoid: incorrect proportions." },
        }));
        setTimeout(() => { res.write(sse({ type: "status", key: "done", status: "done" })); res.end(); }, 500);
      }, 500);
      return;
    }

    // Live SSE streaming
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      const prompt = `Generate social media content from this Creative Brief:\n\nCampaign Theme: ${brief.campaignTheme || ""}\nTarget Market: ${brief.market?.country || "US"} · ${brief.market?.language || "en"}\nTarget Audience: ${(brief.audience || []).join(", ")}\nPain Points: ${(brief.painPoints || []).join(", ")}\nProduct Benefits: ${(brief.productBenefits || []).join(", ")}\nMessage Angle: ${brief.messageAngle || ""}\nEmotional Direction: ${(brief.emotionalDirection || []).join(", ")}\nTone: ${(brief.tone || []).join(", ")}\nVisual Direction: ${brief.visualDirection || ""}\nOffer: ${brief.offer?.label || "No offer"}\nAvoid: ${(brief.avoid || []).join(", ")}\n\nProduce platform-specific content for Facebook, Instagram, X, and Image Prompt. All text MUST be in English.`;

      res.write(sse({ type: "status", key: "copy", status: "running" }));

      const resp = await fetch(`${DEEPSEEK_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "system", content: CONTENT_SYSTEM }, { role: "user", content: prompt }],
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
      const contentData = parseJson(dsData.choices?.[0]?.message?.content || "");

      const defaults: Record<string, any> = {
        facebook: { title: brief.messageAngle || "Upgrade Your Ride", body: "Discover the difference.", footer: "#iENYRID #ElectricScooter #RideBetter" },
        instagram: { title: "Ride with confidence", body: "Smoother rides, better control.", footer: "#iENYRID #ScooterLife #RideBetter" },
        x: { title: "", body: (brief.messageAngle || "Better control for your ride.").slice(0, 250), footer: "#iENYRID #EScooter" },
        image: { title: "Image Prompt", body: brief.visualDirection || "Urban environment, golden hour.", footer: "Avoid: incorrect proportions." },
      };

      const generated: Record<string, any> = {};
      for (const key of ["facebook", "instagram", "x", "image"]) {
        const asset = contentData[key] || {};
        generated[key] = { title: asset.title || defaults[key].title, body: asset.body || defaults[key].body, footer: asset.footer || defaults[key].footer };
      }

      res.write(sse({ type: "status", key: "image", status: "running" }));
      res.write(sse({ facebook: generated.facebook, instagram: generated.instagram, x: generated.x, image: generated.image }));
      res.write(sse({ type: "status", key: "done", status: "done" }));
      res.end();
    } catch (e: any) {
      console.error("generate/stream error:", e);
      res.write(sse({ type: "error", message: e.message || "Generation failed" }));
      res.end();
    }
    return;
  }

  // Unknown action
  return res.status(400).json({ error: `Unknown action: ${action}` });
}
