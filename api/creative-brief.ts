/**
 * POST /api/creative-brief
 *
 * Generate a Creative Brief from a natural-language idea using DeepSeek.
 * Stateless — returns full brief data for the client to hold.
 *
 * Required env: DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL (optional, defaults to api.deepseek.com)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const SYSTEM_PROMPT = `You are a senior overseas social media strategist for consumer mobility brands (electric scooters, e-bikes, personal EVs).
Your job is to transform an operator's natural-language idea into a structured Creative Brief.

Rules:
1. Preserve explicit facts. Never invent product specifications, compatibility claims, discounts, dates, or legal claims.
2. Separate facts from reasonable interpretations and note what's missing.
3. Avoid fear-based safety marketing, absolute safety claims, and exaggerated performance claims.
4. The brief is a SUGGESTION. It will NOT be applied until the operator confirms it.
5. When a critical fact is missing, add it to clarificationQuestions rather than guessing. ALL clarificationQuestions MUST be written in Chinese (中文).
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
  "clarificationQuestions": ["string — 需要用户澄清的问题，必须用中文撰写"]
}`;

function computeConfidence(brief: Record<string, any>) {
  let score = 100;

  // 1. Clarification questions: -15 each, max -45
  const qCount = (brief.clarificationQuestions || []).length;
  const qPenalty = Math.min(qCount * 15, 45);
  score -= qPenalty;

  // 2. Key fields: -10 to -15 each
  const keyFields = ["campaignTheme", "messageAngle", "visualDirection"] as const;
  const keyPenalty = { campaignTheme: 15, messageAngle: 10, visualDirection: 10 };
  const missingKeys: string[] = [];
  for (const f of keyFields) {
    if (!brief[f]?.trim()) {
      score -= keyPenalty[f];
      missingKeys.push(f);
    }
  }

  // 3. Lists: -5 to -10 each
  const listFields = ["audience", "painPoints", "productBenefits"] as const;
  const listPenalty = { audience: 10, painPoints: 5, productBenefits: 5 };
  const missingLists: string[] = [];
  for (const f of listFields) {
    if (!brief[f] || brief[f].length === 0) {
      score -= listPenalty[f];
      missingLists.push(f);
    }
  }

  // 4. Market completeness
  const market = brief.market || {};
  if (!market.country?.trim()) score -= 5;
  if (!market.language?.trim()) score -= 5;

  // 5. Offer unverified
  const offer = brief.offer || {};
  if (offer.label?.trim() && !offer.verified) score -= 5;

  // 6. Bonuses
  if ((brief.avoid || []).length >= 2) score += 3;
  if ((brief.audience || []).length >= 2) score += 2;

  score = Math.max(15, Math.min(100, score));

  return {
    clarificationQuestions: { count: qCount, penalty: qPenalty },
    missingKeyFields: { fields: missingKeys, penalty: missingKeys.reduce((s, f) => s + (keyPenalty[f] || 0), 0) },
    missingLists: { fields: missingLists, penalty: missingLists.reduce((s, f) => s + (listPenalty[f] || 0), 0) },
    market: {
      missing: [
        ...(!market.country?.trim() ? ["country"] : []),
        ...(!market.language?.trim() ? ["language"] : []),
      ],
      penalty: (!market.country?.trim() ? 5 : 0) + (!market.language?.trim() ? 5 : 0),
    },
    offerUnverified: { hasLabel: !!(offer.label?.trim()), penalty: offer.label?.trim() && !offer.verified ? 5 : 0 },
    bonuses: { avoidList: (brief.avoid || []).length >= 2 ? 3 : 0, audienceSegments: (brief.audience || []).length >= 2 ? 2 : 0, total: 0 },
    computedScore: score,
  };
}

function parseJson(text: string): any {
  text = text.trim();
  // Strip markdown fences
  const fence = text.match(/```(?:json)?\s*\n?(.*?)\n?```/s);
  if (fence) text = fence[1].trim();
  // Try direct parse
  try { return JSON.parse(text); } catch {}
  // Extract JSON object
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]);
  throw new Error(`Could not parse JSON: ${text.slice(0, 200)}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { idea, brandId, productId } = req.body || {};
  if (!idea?.trim()) {
    return res.status(400).json({ error: "idea is required" });
  }

  // Demo mode fallback
  if (!DEEPSEEK_KEY) {
    const brief = {
      campaignTheme: "iENYRID Summer City Ride",
      market: { country: "GB", language: "en" },
      audience: ["Urban commuters", "Electric scooter enthusiasts", "Eco-conscious riders"],
      painPoints: ["City traffic congestion", "Last-mile commute challenges", "Rising fuel costs"],
      productBenefits: ["Long-range battery", "Portable folding design", "Smooth ride quality", "Zero emissions"],
      messageAngle: "Your City, Your Freedom",
      emotionalDirection: ["Confident", "Free", "Excited"],
      tone: ["Energetic", "Friendly"],
      visualDirection: "iENYRID electric scooter in a sunny European city street, golden hour light, confident rider, clean composition",
      offer: { label: "Free shipping on orders over 500 EUR", verified: false },
      avoid: ["Fear-based copy", "Absolute safety claims", "Unverified specs", "Competitor bashing"],
      clarificationQuestions: ["你具体想推广哪个型号？", "目标国家是哪里？", "是否正在进行促销活动？"],
    };
    const confidenceFactors = computeConfidence(brief);
    return res.status(200).json({
      taskId: `brief_${Date.now().toString(36)}`,
      brief: { ...brief, confidence: Math.round(confidenceFactors.computedScore) / 100 },
      confidence: Math.round(confidenceFactors.computedScore) / 100,
      confidenceFactors,
      warnings: brief.clarificationQuestions,
      mode: "demo",
      createdAt: new Date().toISOString(),
    });
  }

  // Live mode — call DeepSeek
  try {
    const brandDisplay = (brandId || "iENYRID").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    const prompt = `Operator's idea (original language — preserve meaning, output in English):

"${idea.trim()}"

Brand: ${brandDisplay}
The brand operates in overseas markets (primarily Europe and North America) selling electric scooters and related accessories.

Analyze this idea and produce a Creative Brief.

IMPORTANT: Never invent product specifications, discounts, prices, or compatibility claims. If the operator hasn't explicitly mentioned a discount, do NOT include one. If no specific product model is mentioned, use general brand benefits. All hashtags and brand mentions MUST use the correct brand name.`;

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
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`DeepSeek API error (${resp.status}): ${errText.slice(0, 300)}`);
    }

    const dsData = await resp.json() as any;
    const raw = dsData.choices?.[0]?.message?.content || "";
    const briefData = parseJson(raw);

    const brief = {
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

    const confidenceFactors = computeConfidence(brief);
    brief.confidence = Math.round(confidenceFactors.computedScore) / 100;

    const taskId = `brief_${Date.now().toString(36)}`;

    return res.status(200).json({
      taskId,
      brief,
      confidence: brief.confidence,
      confidenceFactors,
      warnings: brief.clarificationQuestions,
      mode: "live",
      createdAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("creative-brief error:", e);
    return res.status(500).json({ error: e.message || "Generation failed" });
  }
}
