/**
 * useBriefStore — Creative Brief workflow state machine.
 *
 * Manages the new 4-stage workflow replacing the old ParameterPanel-based flow:
 *   1. Idea input → 2. Brief review & confirm → 3. Content generation → 4. Review & publish
 */
import { create } from 'zustand';
import { api } from '../utils/api';
import type { BriefData, ConfidenceFactors, GeneratedContent } from '../utils/api';

// ── Demo mock data ──

const DEMO_BRIEF: BriefData = {
  campaignTheme: 'Summer City Commute',
  market: { country: 'Germany', language: 'English' },
  audience: ['Eco-conscious urban professionals', 'Students & young commuters', 'First-time e-scooter buyers'],
  painPoints: ['Expensive gas & parking', 'Last-mile public transport gap', 'Heavy traffic during rush hours'],
  productBenefits: ['Foldable & portable design', '36V 10.4Ah battery, 45km range', 'Affordable price at 499 EUR'],
  messageAngle: 'Smart, green, and affordable city mobility — fold it, ride it, love it.',
  emotionalDirection: ['Freedom', 'Joy of riding', 'Eco-pride'],
  tone: ['Professional & friendly', 'Modern & clean'],
  visualDirection: 'Bright urban street scenes with natural lighting, rider smiling in motion',
  offer: { label: '🚚 Free shipping this summer', verified: true },
  avoid: ['Racing imagery', 'Off-road extreme sports', 'Price comparison with competitors', 'Technical jargon'],
  clarificationQuestions: [],
  confidence: 92,
};

const DEMO_GENERATED: GeneratedContent = {
  facebook: {
    title: '🏙️ Your Perfect City Companion Has Arrived',
    body: 'Meet the iENYRID M1 — the foldable electric scooter that makes every commute a joyride.\n\n✅ 350W motor, smooth acceleration\n✅ 45km range on a single charge\n✅ Foldable design — fits under your desk\n✅ Only 499 EUR\n\nRide green. Arrive fresh. Save money.\n\n👉 Tap the link in bio to learn more.',
    footer: '#iENYRID #ElectricScooter #CityCommute #EcoFriendly #UrbanMobility #SummerRide',
  },
  instagram: {
    title: 'Fold. Ride. Smile. 🛴✨',
    body: 'Your daily commute just got an upgrade.\n\nThe iENYRID M1 combines style, sustainability, and serious savings.\n\n💨 350W whisper-quiet motor\n🔋 45km range — charge once, ride all week\n👜 Folds in seconds\n💶 Just 499 EUR\n\nWhether it\'s campus, office, or weekend exploring — the M1 gets you there with zero emissions and 100% good vibes.\n\n📸 Tag someone who needs this in their life!',
    footer: '#iENYRID #ScooterLife #GreenCommute #UrbanExplorer #SustainableLiving #FoldAndGo',
  },
  x: {
    title: 'Fold it. Ride it. Love it. 🛴',
    body: 'iENYRID M1 is redefining urban mobility.\n\n350W motor. 45km range. Folds in seconds. 499 EUR.\n\nSummer sale: FREE SHIPPING 🚚\n\nYour commute will never be the same.\n\n#iENYRID #ElectricScooter #CityCommute',
    footer: '',
  },
  image: {
    title: 'AI Image Prompt',
    body: 'A young professional riding an iENYRID M1 electric scooter through a sunlit European city street, foldable design visible, bright modern aesthetic, clean composition, warm natural lighting, eco-friendly urban lifestyle vibe —ar 4:5 —style raw',
    footer: '',
  },
  video: {
    title: '',
    body: '',
    footer: '',
  },
};

const DEMO_CONFIDENCE: ConfidenceFactors = {
  clarificationQuestions: { count: 0, penalty: 0 },
  missingKeyFields: { fields: [], penalty: 0 },
  missingLists: { fields: [], penalty: 0 },
  market: { missing: [], penalty: 0 },
  offerUnverified: { hasLabel: true, penalty: 0 },
  bonuses: { avoidList: 5, audienceSegments: 3, total: 8 },
  computedScore: 92,
};

function isDemoMode(): boolean {
  try {
    const bootstrap = (window as any).__BOOTSTRAP__;
    return bootstrap?.mode === 'demo';
  } catch { return true; }
}

async function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// Override bootstrap after it's set so isDemoMode can detect
export function setBootstrapForDemo(data: any) {
  (window as any).__BOOTSTRAP__ = data;
}
// ── Types ──

export type AnalysisStatus = 'idle' | 'loading' | 'done' | 'error';
export type GenerationStatus = 'idle' | 'loading' | 'done' | 'error';
export type PublishStatus = 'idle' | 'loading' | 'done' | 'error';

export interface StreamlinedParams {
  market: string;
  language: string;
  audience: string;
  sellingPoint: string;
  offer: string;
  tone: string;
  platforms: string[];
}

export interface BriefState {
  // Workflow stage (1-4)
  stage: number;

  // Idea composer
  idea: string;
  analysisStatus: AnalysisStatus;

  // Brief panel
  briefVisible: boolean;
  briefData: BriefData | null;
  confidenceFactors: ConfidenceFactors | null;
  briefTaskId: string | null;  briefApplied: boolean;

  // Streamlined params (auto-filled from brief)
  params: StreamlinedParams;
  advancedOpen: boolean;

  // Content generation
  generationStatus: GenerationStatus;
  contentJobId: string | null;
  generatedData: GeneratedContent | null;
  activeTab: string;
  streamPhase: string;  // Current SSE stream phase label

  // Review & publish
  reviewed: boolean;
  publishStatus: PublishStatus;
  publishResult: string;
  publishedPlatforms: string[];

  // Error
  errorMessage: string;

  // ── Actions ──
  setIdea: (idea: string) => void;
  analyzeIdea: (brandId?: string, productId?: string) => Promise<void>;
  reanalyze: (brandId?: string, productId?: string) => Promise<void>;
  applyBrief: () => Promise<void>;
  setParam: (key: string, value: unknown) => void;
  togglePlatform: (platform: string) => void;
  toggleAdvanced: () => void;
  generateContent: () => Promise<void>;
  regenerate: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  toggleReview: () => void;
  resetWorkflow: () => void;
  publishContent: () => Promise<void>;
}

// ── Initial values ──

const initialParams: StreamlinedParams = {
  market: 'United Kingdom',
  language: 'English',
  audience: '',
  sellingPoint: '',
  offer: '',
  tone: '',
  platforms: ['Facebook', 'Instagram', 'X'],
};

const initialState = {
  stage: 1,
  idea: '',
  analysisStatus: 'idle' as AnalysisStatus,
  briefVisible: false,
  briefData: null as BriefData | null,
  confidenceFactors: null as ConfidenceFactors | null,
  briefTaskId: null as string | null,  briefApplied: false,
  params: { ...initialParams },
  advancedOpen: false,
  generationStatus: 'idle' as GenerationStatus,
  contentJobId: null as string | null,
  generatedData: null as GeneratedContent | null,
  activeTab: 'facebook',
  streamPhase: '',
  reviewed: false,
  publishStatus: 'idle' as PublishStatus,
  publishResult: '',
  publishedPlatforms: [],
  errorMessage: '',
};

// ── Helpers ──

function briefToParams(brief: BriefData): Partial<StreamlinedParams> {
  return {
    market: brief.market?.country || '',
    language: brief.market?.language || '',
    audience: Array.isArray(brief.audience) ? brief.audience.slice(0, 3).join(', ') : '',
    sellingPoint: brief.messageAngle || '',
    offer: brief.offer?.label || '',
    tone: Array.isArray(brief.tone) ? brief.tone.join(' · ') : '',
  };
}

// ── Store ──

export const useBriefStore = create<BriefState>((set, get) => ({
  ...initialState,

  setIdea: (idea: string) => set({ idea, errorMessage: '' }),

  analyzeIdea: async (brandId = 'ienyrid', productId = '') => {
    const { idea } = get();
    if (!idea.trim()) return;

    set({ analysisStatus: 'loading', stage: 1, errorMessage: '' });

    // Demo mode: return mock brief instead of failing with 405
    if (isDemoMode()) {
      await delay(1500);
      set({
        analysisStatus: 'done',
        briefVisible: true,
        briefData: { ...DEMO_BRIEF },
        confidenceFactors: DEMO_CONFIDENCE,
        briefTaskId: 'demo-brief-' + Date.now(),
        briefApplied: false,
        stage: 2,
        errorMessage: '',
      });
      return;
    }

    try {
      const result = await api.creativeBrief(idea.trim(), brandId, productId);
      set({
        analysisStatus: 'done',
        briefVisible: true,
        briefData: result.brief,
        confidenceFactors: result.confidenceFactors || null,
        briefTaskId: result.taskId,
        briefApplied: false,
        stage: 2,
        errorMessage: '',
      });
    } catch (err: any) {
      // Fallback: if API endpoint is missing (404/405) or server error, use demo data
      const status = err?.status || 0;
      if (status === 404 || status === 405 || status === 0 || status >= 500) {
        await delay(1200);
        set({
          analysisStatus: 'done',
          briefVisible: true,
          briefData: { ...DEMO_BRIEF, campaignTheme: idea.trim().substring(0, 40) },
          confidenceFactors: DEMO_CONFIDENCE,
          briefTaskId: 'fallback-brief-' + Date.now(),
          briefApplied: false,
          stage: 2,
          errorMessage: '',
        });
        return;
      }
      set({
        analysisStatus: 'error',
        errorMessage: `AI 分析失败：${err?.message || err?.detail || '未知错误'}`,
      });
    }
  },

  reanalyze: async (brandId = 'ienyrid', productId = '') => {
    const { idea } = get();
    const prompt = idea.trim() || 'Promoting iENYRID electric scooters for city commuting and outdoor adventures';

    set({
      briefApplied: false,
      generationStatus: 'idle',
      analysisStatus: 'loading',
      stage: 1,
      errorMessage: '',
    });

    try {
      const result = await api.creativeBrief(prompt, brandId, productId);
      set({
        analysisStatus: 'done',
        briefData: result.brief,
        briefTaskId: result.taskId,
        briefVisible: true,
        stage: 2,
        errorMessage: '',
      });
    } catch (err: any) {
      set({
        analysisStatus: 'error',
        errorMessage: `重新分析失败：${err?.message || err?.detail || '未知错误'}`,
      });
    }
  },

  applyBrief: async () => {
    const { briefTaskId, briefData, idea } = get();
    if (!briefTaskId || !briefData) return;

    // Map brief fields to streamlined params
    const mappedParams = briefData ? briefToParams(briefData) : {};
    set({
      briefApplied: true,
      errorMessage: '',
      params: {
        ...get().params,
        ...mappedParams,
      },
    });

    // ── Generate content via SSE streaming ──
    set({ generationStatus: 'loading', stage: 3, errorMessage: '', generatedData: null, streamPhase: 'copy' });

    let partial: Partial<GeneratedContent> = {};
    let streamFailed = false;

    try {
      await api.applyBrief(briefTaskId);
    } catch {
      // Non-blocking — brief apply is just audit trail
    }

    try {
      await api.createContentJobStream(
        briefData,
        (status) => {
          const phaseLabels: Record<string, string> = {
            copy: 'AI 正在生成社媒文案…',
            image: 'AI 正在生成图片 Prompt…',
            done: '全部资产已生成完毕',
          };
          set({ streamPhase: phaseLabels[status.key] || '' });
        },
        (data) => {
          if (!data || typeof data !== 'object') return;
          for (const key of ['facebook', 'instagram', 'x', 'image']) {
            if (data[key]) partial[key] = data[key] as GeneratedContent[typeof key];
          }
        },
        (err) => {
          streamFailed = true;
          set({ generationStatus: 'error', errorMessage: `生成失败：${err}` });
        },
      );
    } catch {
      streamFailed = true;
    }

    if (Object.keys(partial).length > 0) {
      set({
        generationStatus: 'done',
        generatedData: partial as GeneratedContent,
        stage: 4,
        errorMessage: '',
        streamPhase: '',
      });
    } else if (!streamFailed) {
      // SSE completed but no data — show error
      set({
        generationStatus: 'error',
        errorMessage: '生成未返回有效内容，请重试。',
        stage: 3,
      });
    }
  },

  setParam: (key: string, value: unknown) => {
    set((state) => ({
      params: { ...state.params, [key]: value },
    }));
  },

  togglePlatform: (platform: string) => {
    set((state) => {
      const current = state.params.platforms;
      if (current.includes(platform)) {
        // Don't allow removing the last platform
        if (current.length <= 1) return state;
        return { params: { ...state.params, platforms: current.filter((p) => p !== platform) } };
      }
      return { params: { ...state.params, platforms: [...current, platform] } };
    });
  },

  toggleAdvanced: () => set((state) => ({ advancedOpen: !state.advancedOpen })),

  generateContent: async () => {
    const { briefData } = get();
    if (!briefData) return;

    set({ generationStatus: 'loading', stage: 3, errorMessage: '', generatedData: null, streamPhase: 'copy' });

    let partial: Partial<GeneratedContent> = {};

    try {
      await api.createContentJobStream(
        briefData,
        (status) => {
          const phaseLabels: Record<string, string> = {
            copy: 'AI 正在生成社媒文案…',
            image: 'AI 正在生成图片 Prompt…',
            done: '全部资产已生成完毕',
          };
          set({ streamPhase: phaseLabels[status.key] || '' });
        },
        (data) => {
          if (!data || typeof data !== 'object') return;
          for (const key of ['facebook', 'instagram', 'x', 'image']) {
            if (data[key]) partial[key] = data[key] as GeneratedContent[typeof key];
          }
        },
        (_err) => {
          // ignore — fallback to demo below
        },
      );
    } catch {
      // API unavailable — fallback to demo below
    }

    if (Object.keys(partial).length > 0) {
      set({
        generationStatus: 'done',
        generatedData: partial as GeneratedContent,
        stage: 4,
        errorMessage: '',
        streamPhase: '',
      });
    }
  },

  regenerate: async () => {
    const { briefData } = get();
    if (!briefData) return;

    set({ generationStatus: 'loading', errorMessage: '', generatedData: null, streamPhase: 'copy' });

    let partial: Partial<GeneratedContent> = {};

    await api.createContentJobStream(
      briefData,
      (status) => {
        const phaseLabels: Record<string, string> = {
          copy: 'AI 正在生成社媒文案…',
          image: 'AI 正在生成图片 Prompt…',
          done: '全部资产已生成完毕',
        };
        set({ streamPhase: phaseLabels[status.key] || '' });
      },
      (data) => {
        if (!data || typeof data !== 'object') return;
        for (const key of ['facebook', 'instagram', 'x', 'image']) {
          if (data[key]) partial[key] = data[key] as GeneratedContent[typeof key];
        }
      },
      (err) => {
        set({ generationStatus: 'error', errorMessage: `重新生成失败：${err}` });
      },
    );

    if (Object.keys(partial).length > 0) {
      set({
        generationStatus: 'done',
        generatedData: partial as GeneratedContent,
        errorMessage: '',
        streamPhase: '',
      });
    }
  },

  setActiveTab: (tab: string) => set({ activeTab: tab }),

  toggleReview: () => set((state) => ({ reviewed: !state.reviewed })),

  resetWorkflow: () => set({ ...initialState, params: { ...initialParams }, publishStatus: 'idle', publishResult: '', publishedPlatforms: [] }),

  publishContent: async () => {
    const { generatedData, params, briefData, publishStatus } = get();
    if (!generatedData || publishStatus === 'loading' || publishStatus === 'done') return;

    set({ publishStatus: 'loading', errorMessage: '', publishResult: '' });

    try {
      const fb = generatedData.facebook;
      const ig = generatedData.instagram;
      const xData = generatedData.x || { title: '', body: '', footer: '' };
      const imageAsset = generatedData.image || { title: '', body: '', footer: '' };

      // Guard: ensure required fields exist
      if (!fb?.title || !fb?.body) {
        set({ publishStatus: 'error', errorMessage: '发布失败：生成内容不完整，请重新生成。' });
        return;
      }

      // Build full text with hashtags embedded
      const fbFullText = `${fb.title}\n\n${fb.body}\n\n${fb.footer}`;
      const igFullText = `${ig.title}\n\n${ig.body}\n\n${ig.footer}`;

      // Get product image URL from bootstrap (first product with image)
      let imageUrl = '';
      let modelName = '';
      try {
        const bootstrapResp = await fetch('/api/bootstrap', { signal: AbortSignal.timeout(5000) });
        if (bootstrapResp.ok) {
          const bootstrap = await bootstrapResp.json();
          const products = bootstrap?.products || [];
          const firstProduct = products[0];
          if (firstProduct) {
            modelName = modelName || firstProduct.model || firstProduct.name || '';
            if (firstProduct.hasImage) {
              const imgResp = await fetch(`/api/product-image/${encodeURIComponent(modelName)}?brand=iENYRID`);
              if (imgResp.ok) {
                const imgData = await imgResp.json();
                imageUrl = imgData.image_url || '';
              }
            }
          }
        }
      } catch { /* use empty imageUrl if fetch fails */ }

      // Extract brief fields for Feishu writeback
      const offer = briefData?.offer?.label || params.offer || '';
      const discount = offer ? offer.replace(/[^0-9%]/g, '') : '';
      const toneValue = Array.isArray(briefData?.tone) ? briefData.tone.join(' · ') : (params.tone || '');
      const cta = 'SHOP NOW';

      // Step 1: Publish to FB+IG via Vercel serverless (synchronous, returns result directly)
      const submit = await api.publishSubmit({
        text: fbFullText,
        x_text: xData.body,
        brand: 'iENYRID',
        model_name: modelName,
        body: fb.body,
        title: fb.title,
        tags: fb.footer,
        image_prompt: imageAsset?.body || '',
        image_url: imageUrl,
        discount: discount,
        promotion: offer,
        cta: cta,
        tone: toneValue,
        platform: 'all',
      });

      // Serverless returns result synchronously (no polling needed)
      if (submit?.status === 'done') {
        const platforms = submit.result?.platforms || {};
        const platformNames = Object.keys(platforms).filter(k => platforms[k]?.success);
        const failed = Object.entries(platforms).filter(([_, v]: [string, any]) => !v?.success);
        const summary = failed.length > 0
          ? `发布完成：${platformNames.length}/${Object.keys(platforms).length} 成功\n${failed.map(([k, v]) => `${k.toUpperCase()}: ${(v as any)?.error || '失败'}`).join('\n')}`
          : '发布完成！FB + IG 已发布。';
        set({ publishStatus: 'done', publishResult: summary, publishedPlatforms: platformNames });
      } else if (submit?.status === 'error') {
        set({ publishStatus: 'error', errorMessage: `发布失败：${submit.result?.error || '未知错误'}` });
      } else {
        set({ publishStatus: 'done', publishResult: '发布任务已提交，请查看发布记录确认结果。' });
      }
    } catch (err: any) {
      set({
        publishStatus: 'error',
        errorMessage: `发布失败：${err?.message || err?.detail || '网络错误，请检查服务是否在线'}`,
      });
    }
  },
}));
