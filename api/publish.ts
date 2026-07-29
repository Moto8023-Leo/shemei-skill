/**
 * POST /api/publish
 *
 * Combined publish endpoint for Facebook + Instagram via Meta Graph API v22.0.
 * Routes: POST /api/publish?action=submit|fb|ig
 *
 * - submit: publishes to FB + IG in parallel, returns synchronous result
 * - fb: publishes to Facebook only (legacy support)
 * - ig: publishes to Instagram only (legacy support)
 *
 * X/Twitter publishing requires Python (twikit/Playwright) — not supported in serverless.
 *
 * Required env: FB_PAGE_ID, FB_ACCESS_TOKEN, IG_USER_ID
 * Optional env: FB_GRAPH_URL (default: https://graph.facebook.com/v22.0)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const FB_GRAPH_URL = process.env.FB_GRAPH_URL || "https://graph.facebook.com/v22.0";
const FB_PAGE_ID = process.env.FB_PAGE_ID || "";
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || "";
const IG_USER_ID = process.env.IG_USER_ID || "";
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || "";
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || "";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Facebook ──

async function publishToFacebook(text: string, imageUrl?: string): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!FB_PAGE_ID || !FB_ACCESS_TOKEN) {
    return { success: false, error: "FB credentials not configured" };
  }

  let apiUrl: string;
  if (imageUrl) {
    apiUrl = `${FB_GRAPH_URL}/${FB_PAGE_ID}/photos`;
    const params = new URLSearchParams({
      access_token: FB_ACCESS_TOKEN,
      caption: text,
      published: "true",
      url: imageUrl,
    });
    apiUrl += `?${params.toString()}`;
  } else {
    apiUrl = `${FB_GRAPH_URL}/${FB_PAGE_ID}/feed`;
    const params = new URLSearchParams({ access_token: FB_ACCESS_TOKEN, message: text });
    apiUrl += `?${params.toString()}`;
  }

  const resp = await fetch(apiUrl, { method: "POST" });
  const data = await resp.json() as any;

  if (resp.ok && data.id) {
    const postId = data.id.includes("_") ? data.id.split("_")[1] : data.id;
    return { success: true, url: `https://www.facebook.com/${FB_PAGE_ID}/posts/${postId}` };
  }
  return { success: false, error: data?.error?.message || `FB API error (${resp.status})` };
}

// ── Instagram (4-step Graph API flow) ──

async function publishToInstagram(text: string, imageUrl: string): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!IG_USER_ID || !FB_PAGE_ID || !FB_ACCESS_TOKEN) {
    return { success: false, error: "IG credentials not configured" };
  }

  // Resolve Feishu URL if needed
  let publicUrl = imageUrl;
  if (imageUrl.includes("open.feishu.cn")) {
    try {
      publicUrl = await resolveFeishuImageUrl(imageUrl);
    } catch (e: any) {
      return { success: false, error: `Feishu image resolution failed: ${e.message}` };
    }
  }

  // Step 1: Upload to FB as unpublished → get CDN URL
  const uploadUrl = `${FB_GRAPH_URL}/${FB_PAGE_ID}/photos`;
  const uploadParams = new URLSearchParams({ access_token: FB_ACCESS_TOKEN, published: "false", url: publicUrl });
  const uploadResp = await fetch(`${uploadUrl}?${uploadParams}`, { method: "POST" });
  const uploadData = await uploadResp.json() as any;
  if (!uploadResp.ok || !uploadData.id) {
    return { success: false, error: `Photo upload: ${uploadData?.error?.message || uploadResp.status}` };
  }

  // Step 1b: Get public CDN URL
  const photoUrl = `${FB_GRAPH_URL}/${uploadData.id}?access_token=${encodeURIComponent(FB_ACCESS_TOKEN)}&fields=images`;
  const photoResp = await fetch(photoUrl);
  const photoData = await photoResp.json() as any;
  const cdnUrl = photoData?.images?.[0]?.source;
  if (!cdnUrl) return { success: false, error: "Failed to get photo CDN URL" };

  // Step 2: Create IG media container
  const containerUrl = `${FB_GRAPH_URL}/${IG_USER_ID}/media`;
  const containerParams = new URLSearchParams({ access_token: FB_ACCESS_TOKEN, image_url: cdnUrl, caption: text });
  const containerResp = await fetch(`${containerUrl}?${containerParams}`, { method: "POST" });
  const containerData = await containerResp.json() as any;
  if (!containerResp.ok || !containerData.id) {
    return { success: false, error: `Container: ${containerData?.error?.message || containerResp.status}` };
  }
  const containerId = containerData.id;

  // Step 3: Poll until FINISHED (max 45s)
  let ready = false;
  const started = Date.now();
  while (Date.now() - started < 45000) {
    const statusUrl = `${FB_GRAPH_URL}/${containerId}?access_token=${encodeURIComponent(FB_ACCESS_TOKEN)}&fields=status_code`;
    const statusResp = await fetch(statusUrl);
    const statusData = await statusResp.json() as any;
    if (statusData?.status_code === "FINISHED") { ready = true; break; }
    if (statusData?.status_code === "ERROR" || statusData?.status_code === "EXPIRED") {
      return { success: false, error: `Container ${statusData.status_code}` };
    }
    await sleep(3000);
  }
  if (!ready) return { success: false, error: "Container polling timed out" };

  // Step 4: Publish
  const publishUrl = `${FB_GRAPH_URL}/${IG_USER_ID}/media_publish`;
  const publishParams = new URLSearchParams({ access_token: FB_ACCESS_TOKEN, creation_id: containerId });
  const publishResp = await fetch(`${publishUrl}?${publishParams}`, { method: "POST" });
  const publishData = await publishResp.json() as any;

  if (publishResp.ok && publishData.id) {
    return { success: true, url: `https://www.instagram.com/p/${publishData.id}/` };
  }
  return { success: false, error: `Publish: ${publishData?.error?.message || publishResp.status}` };
}

// Resolve Feishu internal image URL to a publicly accessible FB CDN URL
async function resolveFeishuImageUrl(feishuUrl: string): Promise<string> {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error("Feishu credentials not configured for image resolution");
  }

  // Step 1: Get Feishu token
  const tokenResp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
  });
  const tokenData = await tokenResp.json() as any;
  if (tokenData.code !== 0) throw new Error(`Feishu auth failed: ${tokenData.msg}`);

  // Step 2: Upload the image to FB as unpublished to get a public CDN URL
  const uploadUrl = `${FB_GRAPH_URL}/${FB_PAGE_ID}/photos`;
  const params = new URLSearchParams({
    access_token: FB_ACCESS_TOKEN,
    published: "false",
    url: feishuUrl,
  });
  const uploadResp = await fetch(`${uploadUrl}?${params}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${tokenData.tenant_access_token}` },
  });
  const uploadData = await uploadResp.json() as any;
  if (!uploadResp.ok || !uploadData.id) {
    throw new Error(`FB upload failed: ${uploadData?.error?.message || uploadResp.status}`);
  }

  // Step 3: Get the public URL from FB
  const photoUrl = `${FB_GRAPH_URL}/${uploadData.id}?access_token=${encodeURIComponent(FB_ACCESS_TOKEN)}&fields=images`;
  const photoResp = await fetch(photoUrl);
  const photoData = await photoResp.json() as any;
  const publicUrl = photoData?.images?.[0]?.source;
  if (!publicUrl) throw new Error("Failed to get public CDN URL from FB");

  return publicUrl;
}

// ── Handler ──

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = (req.query.action as string) || "submit";
  const { text, x_text, image_url } = req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  // ── action=fb — single-platform Facebook publish ──
  if (action === "fb") {
    const result = await publishToFacebook(text, image_url || undefined);
    return res.status(200).json({
      ...result,
      platforms: ["facebook"],
      timestamp: new Date().toISOString(),
    });
  }

  // ── action=ig — single-platform Instagram publish ──
  if (action === "ig") {
    if (!image_url?.trim()) {
      return res.status(400).json({ success: false, error: "image_url is required for Instagram posts" });
    }
    const result = await publishToInstagram(text, image_url);
    return res.status(200).json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  }

  // ── action=submit — FB+IG parallel publish (default) ──
  if (!FB_PAGE_ID || !FB_ACCESS_TOKEN) {
    return res.status(503).json({
      status: "error",
      result: { error: "Facebook credentials not configured. Add FB_PAGE_ID and FB_ACCESS_TOKEN to Vercel env vars." },
    });
  }

  try {
    const [fbResult, igResult] = await Promise.all([
      publishToFacebook(text, image_url || undefined),
      image_url
        ? publishToInstagram(text, image_url)
        : Promise.resolve({ success: false, error: "No image URL provided (required for Instagram)" } as const),
    ]);

    const platforms: Record<string, { success: boolean; url?: string; error?: string }> = {
      fb: fbResult,
      ig: igResult,
      x: {
        success: false,
        error: "X publishing requires local Python (twikit/Playwright). Use the desktop app to publish to X.",
      },
    };

    const allOk = fbResult.success && igResult.success;
    const summaryUrls = Object.values(platforms)
      .filter((p) => p.success && p.url)
      .map((p) => p.url)
      .join("\n");

    return res.status(200).json({
      status: "done",
      result: { platforms, summary: summaryUrls || "No platforms published successfully", allOk },
    });
  } catch (e: any) {
    console.error("publish error:", e);
    return res.status(502).json({ status: "error", result: { error: e.message || "Publish failed" } });
  }
}
