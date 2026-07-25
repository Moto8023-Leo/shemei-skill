/**
 * useBriefStore — Creative Brief workflow state machine.
 *
 * Manages the new 4-stage workflow replacing the old ParameterPanel-based flow:
 *   1. Idea input → 2. Brief review & confirm → 3. Content generation → 4. Review & publish
 */
import { create } from 'zustand';
import { api } from '../utils/api';
import type { BriefData, ConfidenceFactors, GeneratedContent } from '../utils/api';
// ── Types ──

export type AnalysisStatus = 'idle' | 'loading' | 'done' | 'error';
export type GenerationStatus = 'idle' | 'loading' | 'done' | 'error';

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
    const { briefTaskId, briefData } = get();
    if (!briefTaskId) return;

    try {
      await api.applyBrief(briefTaskId);

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

      // ── Auto-trigger content generation via SSE streaming ──
      set({ generationStatus: 'loading', stage: 3, errorMessage: '', generatedData: null, streamPhase: 'copy' });

      let partial: Partial<GeneratedContent> = {};

      await api.createContentJobStream(
        briefTaskId,
        // onStatus
        (status) => {
          const phaseLabels: Record<string, string> = {
            copy: 'AI 正在生成社媒文案…',
            image: 'AI 正在生成图片 Prompt…',
            done: '全部资产已生成完毕',
          };
          set({ streamPhase: phaseLabels[status.key] || '' });
        },
        // onData — triggered for the final payload
        (data) => {
          if (!data || typeof data !== 'object') return;
          // Merge into partial
          for (const key of ['facebook', 'instagram', 'x', 'image']) {
            if (data[key]) {
              partial[key] = data[key] as GeneratedContent[typeof key];
            }
          }
        },
        // onError
        (err) => {
          set({
            generationStatus: 'error',
            errorMessage: `内容生成失败：${err}`,
          });
        },
      );

      // SSE stream done — finalize
      if (Object.keys(partial).length > 0) {
        set({
          generationStatus: 'done',
          generatedData: partial as GeneratedContent,
          stage: 4,
          errorMessage: '',
          streamPhase: '',
        });
      } else if (get().generationStatus !== 'error') {
        set({
          generationStatus: 'done',
          stage: 4,
          streamPhase: '',
        });
      }
    } catch (err: any) {
      set({ errorMessage: `应用失败：${err?.message || err?.detail || '未知错误'}` });
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
    const { briefTaskId } = get();
    if (!briefTaskId) return;

    set({ generationStatus: 'loading', stage: 3, errorMessage: '', generatedData: null, streamPhase: 'copy' });

    let partial: Partial<GeneratedContent> = {};

    await api.createContentJobStream(
      briefTaskId,
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
        set({ generationStatus: 'error', errorMessage: `内容生成失败：${err}` });
      },
    );

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
    const { briefTaskId } = get();
    if (!briefTaskId) return;

    set({ generationStatus: 'loading', errorMessage: '', generatedData: null, streamPhase: 'copy' });

    let partial: Partial<GeneratedContent> = {};

    await api.createContentJobStream(
      briefTaskId,
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

  resetWorkflow: () => set({ ...initialState, params: { ...initialParams } }),

  publishContent: async () => {
    const { generatedData, params, briefData } = get();
    if (!generatedData) return;

    try {
      const fb = generatedData.facebook;
      const ig = generatedData.instagram;
      const xData = generatedData.x;
      const imageAsset = generatedData.image;

      // Build full text with hashtags embedded
      const fbFullText = `${fb.title}\n\n${fb.body}\n\n${fb.footer}`;
      const igFullText = `${ig.title}\n\n${ig.body}\n\n${ig.footer}`;

      // Get product image URL from bootstrap (first product with image)
      let imageUrl = '';
      let modelName = '';
      try {
        // Try to get product image from backend via Feishu
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

      await api.publishAll({
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
    } catch (err: any) {
      const msg = err?.message || err?.detail || '未知错误';
      set({ errorMessage: `发布失败：${msg}` });
    }
  },
}));
