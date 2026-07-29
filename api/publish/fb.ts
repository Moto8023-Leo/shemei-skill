/**
 * POST /api/publish/fb
 *
 * Publish a post to Facebook Page via Graph API v22.0.
 *
 * Required env: FB_PAGE_ID, FB_ACCESS_TOKEN
 * Optional env: FB_GRAPH_URL (default: https://graph.facebook.com/v22.0)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const FB_GRAPH_URL = process.env.FB_GRAPH_URL || "https://graph.facebook.com/v22.0";
const FB_PAGE_ID = process.env.FB_PAGE_ID || "";
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, image_url } = req.body || {};

  if (!text?.trim()) {
    return res.status(400).json({ success: false, error: "text is required" });
  }

  if (!FB_PAGE_ID || !FB_ACCESS_TOKEN) {
    return res.status(503).json({
      success: false,
      error: "FB_PAGE_ID or FB_ACCESS_TOKEN not configured. Add them in Vercel environment variables.",
    });
  }

  try {
    let apiUrl: string;
    let fetchOptions: RequestInit;

    if (image_url) {
      // Photo post: download image then multipart upload to FB
      // For simplicity with external URLs, use the /photos endpoint with url param
      apiUrl = `${FB_GRAPH_URL}/${FB_PAGE_ID}/photos`;
      const params = new URLSearchParams({
        access_token: FB_ACCESS_TOKEN,
        caption: text,
        published: "true",
        url: image_url, // FB can fetch from a public URL
      });
      apiUrl += `?${params.toString()}`;
      fetchOptions = { method: "POST" };
    } else {
      // Text-only post
      apiUrl = `${FB_GRAPH_URL}/${FB_PAGE_ID}/feed`;
      const params = new URLSearchParams({
        access_token: FB_ACCESS_TOKEN,
        message: text,
      });
      apiUrl += `?${params.toString()}`;
      fetchOptions = { method: "POST" };
    }

    const fbResp = await fetch(apiUrl, fetchOptions);
    const fbData = await fbResp.json() as any;

    if (fbResp.ok && fbData.id) {
      const postId = fbData.id;
      const postIdClean = postId.includes("_") ? postId.split("_")[1] : postId;
      const url = `https://www.facebook.com/${FB_PAGE_ID}/posts/${postIdClean}`;

      return res.status(200).json({
        success: true,
        platforms: ["facebook"],
        url,
        error: null,
        timestamp: new Date().toISOString(),
      });
    }

    const errorMsg = fbData?.error?.message || `FB API error (${fbResp.status})`;
    return res.status(502).json({
      success: false,
      platforms: ["facebook"],
      url: null,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(502).json({
      success: false,
      platforms: ["facebook"],
      url: null,
      error: e.message || "Network error",
      timestamp: new Date().toISOString(),
    });
  }
}
