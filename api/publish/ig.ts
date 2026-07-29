/**
 * POST /api/publish/ig
 *
 * Publish to Instagram via Facebook Graph API bridge (4-step flow).
 * 1. Upload image to FB Page as unpublished → get CDN URL
 * 2. Create IG media container
 * 3. Poll container until FINISHED
 * 4. Publish container → return media URL
 *
 * Required env: FB_PAGE_ID, FB_ACCESS_TOKEN, IG_USER_ID
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const FB_GRAPH_URL = process.env.FB_GRAPH_URL || "https://graph.facebook.com/v22.0";
const FB_PAGE_ID = process.env.FB_PAGE_ID || "";
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || "";
const IG_USER_ID = process.env.IG_USER_ID || "";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, image_url } = req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({ success: false, error: "text (caption) is required" });
  }
  if (!image_url?.trim()) {
    return res.status(400).json({ success: false, error: "image_url is required for Instagram posts" });
  }

  if (!FB_PAGE_ID || !FB_ACCESS_TOKEN || !IG_USER_ID) {
    return res.status(503).json({
      success: false,
      error: "FB_PAGE_ID, FB_ACCESS_TOKEN, or IG_USER_ID not configured. Add them in Vercel environment variables.",
    });
  }

  try {
    // Step 1: Upload image to FB Page as unpublished → get CDN URL
    const uploadUrl = `${FB_GRAPH_URL}/${FB_PAGE_ID}/photos`;
    const uploadParams = new URLSearchParams({
      access_token: FB_ACCESS_TOKEN,
      published: "false",
      url: image_url,
    });

    const uploadResp = await fetch(`${uploadUrl}?${uploadParams}`, { method: "POST" });
    const uploadData = await uploadResp.json() as any;

    if (!uploadResp.ok || !uploadData.id) {
      const err = uploadData?.error?.message || `FB photo upload failed (${uploadResp.status})`;
      return res.status(502).json({ success: false, error: `Step 1 (upload photo): ${err}` });
    }

    const photoId = uploadData.id;

    // Step 1b: Get photo CDN URL
    const photoUrl = `${FB_GRAPH_URL}/${photoId}?access_token=${encodeURIComponent(FB_ACCESS_TOKEN)}&fields=images`;
    const photoResp = await fetch(photoUrl);
    const photoData = await photoResp.json() as any;
    const publicUrl = photoData?.images?.[0]?.source;

    if (!publicUrl) {
      return res.status(502).json({ success: false, error: "Step 1b (get photo URL): no public URL returned" });
    }

    // Step 2: Create IG media container
    const containerUrl = `${FB_GRAPH_URL}/${IG_USER_ID}/media`;
    const containerParams = new URLSearchParams({
      access_token: FB_ACCESS_TOKEN,
      image_url: publicUrl,
      caption: text,
    });

    const containerResp = await fetch(`${containerUrl}?${containerParams}`, { method: "POST" });
    const containerData = await containerResp.json() as any;

    if (!containerResp.ok || !containerData.id) {
      const err = containerData?.error?.message || `IG container creation failed (${containerResp.status})`;
      return res.status(502).json({ success: false, error: `Step 2 (create container): ${err}` });
    }

    const containerId = containerData.id;

    // Step 3: Poll container until FINISHED (max 60s)
    const maxWait = 60000;
    const started = Date.now();
    let isReady = false;

    while (Date.now() - started < maxWait) {
      const statusUrl = `${FB_GRAPH_URL}/${containerId}?access_token=${encodeURIComponent(FB_ACCESS_TOKEN)}&fields=status_code,status`;
      const statusResp = await fetch(statusUrl);
      const statusData = await statusResp.json() as any;
      const statusCode = statusData?.status_code || statusData?.status;

      if (statusCode === "FINISHED") {
        isReady = true;
        break;
      }
      if (statusCode === "ERROR" || statusCode === "EXPIRED") {
        return res.status(502).json({ success: false, error: `Step 3 (container): ${statusCode}` });
      }

      await sleep(3000);
    }

    if (!isReady) {
      return res.status(502).json({ success: false, error: "Step 3 (container): timed out waiting for FINISHED" });
    }

    // Step 4: Publish
    const publishUrl = `${FB_GRAPH_URL}/${IG_USER_ID}/media_publish`;
    const publishParams = new URLSearchParams({
      access_token: FB_ACCESS_TOKEN,
      creation_id: containerId,
    });

    const publishResp = await fetch(`${publishUrl}?${publishParams}`, { method: "POST" });
    const publishData = await publishResp.json() as any;

    if (publishResp.ok && publishData.id) {
      return res.status(200).json({
        success: true,
        url: `https://www.instagram.com/p/${publishData.id}/`,
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    const err = publishData?.error?.message || `IG publish failed (${publishResp.status})`;
    return res.status(502).json({ success: false, error: `Step 4 (publish): ${err}` });
  } catch (e: any) {
    return res.status(502).json({
      success: false,
      error: e.message || "Network error",
      timestamp: new Date().toISOString(),
    });
  }
}
