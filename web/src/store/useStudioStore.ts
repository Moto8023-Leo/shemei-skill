// Studio Store — form parameters, generation, publish, draft management
import { create } from 'zustand';
import type { EventRef } from './useAppStore';
import { composeAllImages } from '../utils/canvasOverlay';

export interface GeneratedContent {
  title: string;
  facebookText: string;
  instagramText: string;
  xText: string;
  hashtags: string[];
  imagePrompt: string;
  negativePrompt: string;
  overlay: {
    eyebrow: string;
    headline: string;
    support: string;
    offer: string;
    cta: string;
  };
  images: Record<string, string> | null;
  event: EventRef | null;
  styleSummary: string;
  quality: QualityResult | null;
  taskId: string;
  createdAt: string;
  mode: string;
}

export interface QualityResult {
  score: number;
  level: string;
  items: { label: string; value: string; status: string; tier?: string; fix?: string; note?: string }[];
  blocking?: { label: string; value: string; status: string; tier?: string; fix?: string }[];
  warnings?: { label: string; value: string; status: string; tier?: string }[];
  manual?: { label: string; value: string; status: string; tier?: string; note?: string }[];
  passed?: { label: string; value: string; status: string; tier?: string }[];
  hasBlocking?: boolean;
  hasWarnings?: boolean;
  hasManual?: boolean;
}

export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface StudioState {
  // Brand
  selectedBrand: string;

  // Form
  selectedProduct: string;

  selectedCountry: string;
  language: string;
  currency: string;
  campaignMode: 'auto' | 'manual' | 'evergreen';
  manualCampaign: string;
  discount: string;
  discountCode: string;
  cta: string;
  tone: string;
  visualDna: string[];
  scenePreference: string;
  overlayTemplate: string;
  overlayPosition: string;
  platforms: string[];
  extraRequirements: string;

  // Uploads
  productImage: string | null;
  productImageName: string;
  productImageSize: string;
  logoImage: string | null;
  logoImageName: string;
  logoImageSize: string;

  // UI state
  busy: boolean;
  generating: boolean;
  publishing: boolean;

  // Results
  content: GeneratedContent | null;
  activePlatform: string;
  activeImage: string;
  publishResults: Record<string, PublishResult>;

  // Actions
  setField: (key: string, value: any) => void;
  setProductImage: (dataUrl: string | null, name?: string, size?: string) => void;
  setLogoImage: (dataUrl: string | null, name?: string, size?: string) => void;
  clearImage: (type: 'product' | 'logo') => void;
  toggleVisualDna: (tag: string) => void;
  togglePlatform: (platform: string) => void;
  saveDraft: () => void;
  loadDraft: () => boolean;
  resetForm: () => void;
  generate: () => Promise<void>;
  publish: () => Promise<void>;
  syncFeishu: () => Promise<void>;
  getFullText: (platform?: string) => string;
}

const initialState = {
  selectedBrand: 'ienyrid',
  selectedProduct: '',
  selectedCountry: 'GB',
  language: 'English',
  currency: 'GBP',
  campaignMode: 'auto' as const,
  manualCampaign: '',
  discount: '10% OFF',
  discountCode: 'OFF40',
  cta: 'SHOP NOW',
  tone: '热情有力',
  visualDna: ['城市通勤', '性能机械', '明亮科技'],
  scenePreference: '受控随机',
  overlayTemplate: '促销',
  overlayPosition: '左侧',
  platforms: ['facebook', 'instagram', 'x'],
  extraRequirements: '',
  productImage: null,
  productImageName: '点击上传或拖入图片',
  productImageSize: '建议透明底 PNG 或 45° 高清图，最大 10MB',
  logoImage: null,
  logoImageName: '点击上传品牌 Logo',
  logoImageSize: '建议透明底 PNG',
  busy: false,
  generating: false,
  publishing: false,
  content: null,
  activePlatform: 'facebook',
  activeImage: 'master',
  publishResults: {},
};

export const useStudioStore = create<StudioState>((set, get) => ({
  ...initialState,

  setField: (key, value) => set({ [key]: value }),

  setProductImage: (dataUrl, name, size) => set({
    productImage: dataUrl,
    productImageName: name || (dataUrl ? '已选择图片' : initialState.productImageName),
    productImageSize: size || (dataUrl ? '' : initialState.productImageSize),
  }),

  setLogoImage: (dataUrl, name, size) => set({
    logoImage: dataUrl,
    logoImageName: name || (dataUrl ? '已选择 Logo' : initialState.logoImageName),
    logoImageSize: size || (dataUrl ? '' : initialState.logoImageSize),
  }),

  clearImage: (type) => {
    if (type === 'product') {
      set({
        productImage: null,
        productImageName: initialState.productImageName,
        productImageSize: initialState.productImageSize,
      });
    } else {
      set({
        logoImage: null,
        logoImageName: initialState.logoImageName,
        logoImageSize: initialState.logoImageSize,
      });
    }
  },

  toggleVisualDna: (tag) => {
    const current = get().visualDna;
    if (current.includes(tag)) {
      if (current.length <= 1) return; // minimum 1
      set({ visualDna: current.filter(t => t !== tag) });
    } else {
      set({ visualDna: [...current, tag] });
    }
  },

  togglePlatform: (platform) => {
    const current = get().platforms;
    if (current.includes(platform)) {
      if (current.length <= 1) return;
      set({ platforms: current.filter(p => p !== platform) });
    } else {
      set({ platforms: [...current, platform] });
    }
  },

  saveDraft: () => {
    const s = get();
    const draft: Record<string, any> = {};
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'function') continue;
      draft[k] = v;
    }
    try { localStorage.setItem('shemei-studio-draft', JSON.stringify(draft)); } catch {}

    // Server-side auto-save
    _debouncedServerSave(JSON.stringify(draft));
  },

  loadDraft: () => {
    try {
      const raw = localStorage.getItem('shemei-studio-draft');
      if (!raw) return false;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return false;
      const allowed = new Set(Object.keys(initialState));
      const restored: Record<string, any> = {};
      for (const [k, v] of Object.entries(draft)) {
        if (allowed.has(k) && typeof v !== 'function') restored[k] = v;
      }
      set(restored);
      return true;
    } catch { return false; }
  },

  resetForm: () => {
    try { localStorage.removeItem('shemei-studio-draft'); } catch {}
    set({ ...initialState, content: null, publishResults: {}, busy: false });
  },

  generate: async () => {
    const s = get();
    set({ generating: true, content: null, publishResults: {} });
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: s.selectedProduct || 'iENYRID ES1',
          brand: s.selectedBrand || 'iENYRID',
          pain_point: s.visualDna[0] || '续航焦虑',
          ad_type: '单品推广',
          scene_style: s.scenePreference,
          discount: s.discount,
          promotion: s.discount,
          discount_code: s.discountCode,
          cta: s.cta,
          tone: s.tone,
          platform: s.platforms.join('+').toUpperCase(),
          country: s.selectedCountry || 'GB',
          campaign_mode: s.campaignMode || 'auto',
          manual_campaign: s.manualCampaign || '',
          extra_requirements: s.extraRequirements || '',
        }),
      });
      const data = await resp.json();
      // Save to history
      try {
        await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: data.taskId,
            brandId: s.selectedBrand,
            productId: s.selectedProduct,
            title: data.title,
            facebookText: data.facebookText,
            styleSummary: data.styleSummary,
            createdAt: data.createdAt,
          }),
        });
      } catch {}
      const resultData = { ...data };
      set({ content: resultData, activePlatform: 'facebook', activeImage: 'master' });

      // Resolve product image:
      //   1. Frontend upload (s.productImage)
      //   2. Feishu product table image for THIS model (fetched via API)
      //   3. Generate branded placeholder as last resort
      let productImageSource = s.productImage || null;

      if (!productImageSource && s.selectedProduct) {
        try {
          const imgResp = await fetch(
            `/api/product-image/${encodeURIComponent(s.selectedProduct)}?brand=${encodeURIComponent(s.selectedBrand)}`
          );
          const imgData = await imgResp.json();
          if (imgData.image_url) {
            // Fetch the image and convert to data URL for Canvas
            const blobResp = await fetch(imgData.image_url);
            const blob = await blobResp.blob();
            productImageSource = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
        } catch (e) {
          console.warn('Feishu product image fetch failed:', e);
        }
      }

      if (productImageSource) {
        // Canvas: compose overlay onto product image
        if (data.overlay) {
          try {
            const images = await composeAllImages(
              productImageSource,
              data.overlay,
              {
                overlayTemplate: s.overlayTemplate,
                overlayPosition: s.overlayPosition,
              },
              s.logoImage
            );
            set({ content: { ...resultData, images } });
          } catch (e) {
            console.warn('Canvas composition skipped:', e);
          }
        }
      } else {
        // No image available at all — generate branded placeholder
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 1280; canvas.height = 960;
          const ctx = canvas.getContext('2d')!;
          const grad = ctx.createLinearGradient(0, 0, 1280, 960);
          grad.addColorStop(0, '#0a1628');
          grad.addColorStop(1, '#1a2a4a');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1280, 960);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 48px Inter, PingFang SC, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(s.selectedProduct || 'iENYRID', 640, 420);
          ctx.font = '24px Inter, PingFang SC, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillText(data.title || 'Electric Scooter', 640, 480);
          ctx.fillStyle = 'rgba(36,107,253,0.3)';
          ctx.fillRect(0, 800, 1280, 160);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 28px Inter, PingFang SC, sans-serif';
          ctx.fillText(data.overlay?.headline || 'GO FURTHER', 640, 880);

          const master = canvas.toDataURL('image/jpeg', 0.9);
          const sizes = [
            ['portrait', 1080, 1350],
            ['square', 1080, 1080],
            ['landscape', 1600, 900],
          ] as const;
          const images: Record<string, string> = { master };
          for (const [key, w, h] of sizes) {
            const c2 = document.createElement('canvas');
            c2.width = w; c2.height = h;
            const c = c2.getContext('2d')!;
            const g2 = c.createLinearGradient(0, 0, w, h);
            g2.addColorStop(0, '#0a1628');
            g2.addColorStop(1, '#1a2a4a');
            c.fillStyle = g2;
            c.fillRect(0, 0, w, h);
            c.fillStyle = '#fff';
            c.font = `bold ${Math.round(32 * w / 1080)}px Inter, PingFang SC, sans-serif`;
            c.textAlign = 'center';
            c.fillText(s.selectedProduct || 'iENYRID', w/2, h/2 - 20);
            c.font = `${Math.round(18 * w / 1080)}px Inter, PingFang SC, sans-serif`;
            c.fillStyle = 'rgba(255,255,255,0.5)';
            c.fillText(data.title || '', w/2, h/2 + 30);
            images[key] = c2.toDataURL('image/jpeg', 0.9);
          }
          set({ content: { ...resultData, images } });
        } catch (e) {
          console.warn('Placeholder image creation failed:', e);
        }
      }
    } catch (e: any) {
      console.error('Generate failed:', e);
    } finally {
      set({ generating: false });
    }
  },

  publish: async () => {
    const { content, selectedBrand, selectedProduct, discount, discountCode, cta, tone, platforms } = get();
    if (!content) return;
    set({ publishing: true, publishResults: {} });
    try {
      const resp = await fetch('/api/publish/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content.facebookText,
          x_text: content.xText,
          brand: selectedBrand,
          model_name: selectedProduct,
          title: content.title,
          tags: (content.hashtags || []).join(' '),
          body: content.facebookText,
          image_prompt: content.imagePrompt,
          pain_point: get().visualDna[0] || '',
          ad_type: '单品推广',
          scene_style: get().scenePreference,
          discount,
          promotion: discount,
          cta,
          tone,
          platform: platforms.join('+').toUpperCase(),
        }),
      });
      const data = await resp.json();
      set({ publishResults: data });
    } catch (e: any) {
      console.error('Publish failed:', e);
    } finally {
      set({ publishing: false });
    }
  },

  syncFeishu: async () => {
    const { content, selectedBrand, selectedProduct } = get();
    if (!content) return;
    try {
      await fetch('/api/feishu/writeback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_name: selectedProduct,
          title: content.title,
          body: content.facebookText,
          tags: (content.hashtags || []).join(' '),
          x_text: content.xText,
          image_prompt: content.imagePrompt,
          result_text: '已回写',
          brand: selectedBrand,
        }),
      });
    } catch (e: any) {
      console.error('Feishu sync failed:', e);
    }
  },

  getFullText: (platform = 'facebook') => {
    const c = get().content;
    if (!c) return '';
    if (platform === 'x') return c.xText;
    if (platform === 'instagram') return c.instagramText || c.facebookText;
    return c.facebookText;
  },
}));

// Debounced server-side draft auto-save (1.5s delay, 30s retry on failure)
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _lastSaveBody = '';

function _debouncedServerSave(body: string) {
  _lastSaveBody = body;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => _doServerSave(body), 1500);
}

async function _doServerSave(body: string) {
  try {
    await fetch('/api/drafts/studio-draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.parse(body)),
    });
  } catch {
    // Retry after ~30s
    setTimeout(() => {
      if (_lastSaveBody === body) _doServerSave(body);
    }, 30000);
  }
}
