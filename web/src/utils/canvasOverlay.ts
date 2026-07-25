/**
 * Canvas Poster Overlay Engine — fully rewritten.
 * Outputs poster-style compositions: dark card panels, layered typography,
 * campaign badges, product specs, and CTA buttons that feel like real ads.
 */

export interface OverlayData {
  eyebrow: string;
  headline: string;
  support: string;
  offer: string;
  cta: string;
}

export interface OverlayForm {
  overlayTemplate: string;   // '促销' | '极简' | '卖点'
  overlayPosition: string;   // '左侧' | '右侧' | '底部'
  // Drag-editable positions (as fractions 0–1 of canvas width/height)
  overlayX?: number;          // Card X position (default: auto from overlayPosition)
  overlayY?: number;          // Card Y position (default: auto)
  overlayWidth?: number;      // Card width ratio (default: 0.48 for side, 1.0 for bottom)
  overlayFontScale?: number;  // Font scale multiplier (default: 1.0)
  overlayOpacity?: number;     // Card opacity (default: 0.82)
  overlayAlignment?: 'left' | 'center' | 'right';  // Text alignment within card (default: left)
}

// ── helpers ──────────────────────────────────────────────────

function coverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  ctx.drawImage(
    img,
    (img.naturalWidth - sw) / 2,
    (img.naturalHeight - sh) / 2,
    sw, sh, 0, 0, w, h,
  );
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines = 4,
): string[] {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(trial).width > maxW) {
      out.push(cur); cur = w;
      if (out.length === maxLines - 1) break;
    } else cur = trial;
  }
  if (cur && out.length < maxLines) out.push(cur);
  if (out.join(' ').split(/\s+/).length < words.length) {
    const last = out[out.length - 1] || '';
    out[out.length - 1] = last.replace(/…$/, '') + '…';
  }
  return out;
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// ── main poster overlay ──────────────────────────────────────

function drawPosterOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  overlay: OverlayData,
  form: OverlayForm,
  logo: HTMLImageElement | null,
) {
  const s = Math.max(0.85, Math.min(1.35, W / 1200));
  const pad = 48 * s;
  const position = form.overlayPosition;

  // Drag-editable overrides (clamped to canvas bounds)
  const fontScale = Math.max(0.5, Math.min(2.5, form.overlayFontScale || 1.0));
  const cardOpacity = Math.max(0.3, Math.min(0.95, form.overlayOpacity || 0.82));
  const alignment = form.overlayAlignment || 'left';

  const useBottom = position === '底部';

  // ── 1. subtle full-image vignette (focuses eye to text zone) ──
  const vignette = ctx.createRadialGradient(
    useBottom ? W / 2 : W * 0.25, useBottom ? H : H * 0.5, W * 0.35,
    useBottom ? W / 2 : W * 0.35, useBottom ? H * 0.9 : H * 0.55, W * 1.1,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // ── 2. text panel (dark glass card) ──
  let panelX: number, panelY: number, panelW: number, panelMaxTextW: number;

  if (useBottom) {
    // Full-width bottom card
    panelW = W - pad * 2;
    panelX = pad;
    panelY = H - 310 * s;
    panelMaxTextW = panelW - pad * 1.8;
  } else if (position === '右侧') {
    panelW = W * 0.48;
    panelX = W - panelW - pad;
    panelY = H * 0.18;
    panelMaxTextW = panelW - pad * 1.6;
  } else {
    // 左侧 (default)
    panelW = W * 0.48;
    panelX = pad;
    panelY = H * 0.18;
    panelMaxTextW = panelW - pad * 1.6;
  }

  // Dark glass card background (with drag-overridable opacity)
  ctx.fillStyle = `rgba(10, 18, 33, ${cardOpacity})`;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  fillRoundedRect(ctx, panelX, panelY, panelW, H - panelY - pad, 16 * s);
  ctx.stroke();

  // Card inner padding
  const cx = panelX + pad * 0.9;
  let cy = panelY + pad * 0.9;

  // ── 3. eyebrow tag (small coloured badge) ──
  const eyebrowText = String(overlay.eyebrow || 'URBAN MOBILITY').toUpperCase();
  ctx.font = `700 ${Math.round(13 * s * fontScale)}px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const eWidth = ctx.measureText(eyebrowText).width + 18 * s;
  ctx.fillStyle = '#246bfd';
  fillRoundedRect(ctx, cx, cy, eWidth, 26 * s, 6 * s);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(eyebrowText, cx + 9 * s, cy + 13 * s, panelMaxTextW);
  cy += 42 * s;

  // ── 4. headline (bold, large, expressive — like a real poster) ──
  const headlineText = String(overlay.headline || 'GO FURTHER.');
  // Split long headlines into Title Case for better readability
  const hdWords = headlineText.replace(/[^\w\sÀ-ɏ]/g, '').trim();
  ctx.font = `900 ${Math.round(44 * s * fontScale)}px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = '#ffffff';
  const hdLines = wrapLines(ctx, hdWords, panelMaxTextW, 4);
  hdLines.forEach((line, i) => {
    ctx.fillText(line, cx, cy + i * (50 * s), panelMaxTextW);
  });
  cy += hdLines.length * (50 * s) + 14 * s;

  // ── 5. thin separator line ──
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + panelMaxTextW * 0.35, cy);
  ctx.stroke();
  cy += 16 * s;

  // ── 6. support line (product specs — smaller, lighter) ──
  ctx.font = `400 ${Math.round(15 * s * fontScale)}px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(overlay.support || '', cx, cy, panelMaxTextW);
  cy += 26 * s;

  // ── 7. offer / price badge (prominent — campaign-aware) ──
  if (form.overlayTemplate !== '极简') {
    const offerText = overlay.offer || '';
    if (offerText) {
      ctx.font = `700 ${Math.round(18 * s * fontScale)}px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`;
      const oW = Math.min(panelMaxTextW, ctx.measureText(offerText).width + 28 * s);
      ctx.fillStyle = '#ff6b22';
      fillRoundedRect(ctx, cx, cy, oW, 36 * s, 6 * s);
      ctx.fillStyle = '#fff';
      ctx.fillText(offerText, cx + 14 * s, cy + 24 * s, oW - 20 * s);
      cy += 52 * s;
    }
  }

  // ── 8. CTA button ──
  const ctaText = (overlay.cta || 'SHOP NOW').toUpperCase();
  ctx.font = `800 ${Math.round(17 * s * fontScale)}px "Inter", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const ctaW = ctx.measureText(ctaText).width + 32 * s;
  ctx.fillStyle = '#246bfd';
  fillRoundedRect(ctx, cx, cy, ctaW, 40 * s, 8 * s);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(ctaText, cx + 16 * s, cy + 26 * s, ctaW - 20 * s);

  // ── 9. logo (top-right of card, if provided) ──
  if (logo && logo.naturalWidth > 0) {
    const logoTargetW = Math.min(W * 0.1, logo.naturalWidth * 0.6);
    const logoTargetH = logoTargetW * (logo.naturalHeight / logo.naturalWidth);
    const logoX = panelX + panelW - logoTargetW - pad * 0.5;
    const logoY = panelY + pad * 0.5;
    ctx.drawImage(logo, logoX, logoY, logoTargetW, logoTargetH);
  }
}

// ── variant factory ──────────────────────────────────────────

async function makeVariant(
  image: HTMLImageElement,
  logo: HTMLImageElement | null,
  w: number, h: number,
  overlay: OverlayData,
  form: OverlayForm,
  withText: boolean,
): Promise<string> {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#10161f';
  ctx.fillRect(0, 0, w, h);
  coverFit(ctx, image, w, h);
  if (withText) drawPosterOverlay(ctx, w, h, overlay, form, logo);
  return c.toDataURL('image/jpeg', 0.93);
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

// ── public API ───────────────────────────────────────────────

export async function composeAllImages(
  masterSrc: string,
  overlay: OverlayData,
  form: OverlayForm,
  logoDataUrl?: string | null,
): Promise<Record<string, string>> {
  const image = await loadImg(masterSrc);
  const logo = logoDataUrl ? await loadImg(logoDataUrl) : null;

  const [master, portrait, square, landscape] = await Promise.all([
    makeVariant(image, null, 1280, 960, overlay, form, false),
    makeVariant(image, logo, 1080, 1350, overlay, form, true),
    makeVariant(image, logo, 1080, 1080, overlay, form, true),
    makeVariant(image, logo, 1600, 900, overlay, form, true),
  ]);

  return { master, portrait, square, landscape };
}
