// Social Auto-Poster (Multi-Brand) — Zustand Store
import { create } from 'zustand';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface ProductModel {
  name: string;
  brand: string;
  motor: string;
  battery: string;
  range: string;
  speed: string;
  weight: string;
  climb: string;
  price: string;
  selling_point: string;
  advantage: string;
  link: string;
  has_image: boolean;
}

export interface GeneratedContent {
  title: string;
  body: string;
  tags: string;
  x_text: string;
  image_prompt: string;
}

export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface FormState {
  // ---- Brand ----
  brands: string[];
  selectedBrand: string;
  brandsLoaded: boolean;

  // ---- UI State ----
  models: ProductModel[];
  modelsLoaded: boolean;
  generating: boolean;
  publishing: boolean;

  // ---- Form Fields ----
  selectedModel: string;
  painPoint: string;
  adType: string;
  sceneStyle: string;
  discount: string;
  promotion: string;
  discountCode: string;
  cta: string;
  tone: string;
  platform: string;

  // ---- Image Upload ----
  imageFile: File | null;
  imagePreview: string;
  uploading: boolean;

  // ---- Generated ----
  content: GeneratedContent | null;
  activeTab: string;

  // ---- Publish ----
  results: Record<string, PublishResult>;

  // ---- Actions ----
  setField: (field: keyof FormState, value: string) => void;
  loadBrands: () => Promise<void>;
  setSelectedBrand: (brand: string) => Promise<void>;
  setImageFile: (file: File | null) => void;
  uploadImage: () => Promise<boolean>;
  loadModels: () => Promise<void>;
  generate: () => Promise<void>;
  publishFb: () => Promise<void>;
  publishIg: () => Promise<void>;
  publishX: () => Promise<void>;
  publishAll: () => Promise<void>;
  getFullText: () => string;
}

// ---------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------

const initialState = {
  brands: [] as string[],
  selectedBrand: 'iENYRID',
  brandsLoaded: false,

  models: [] as ProductModel[],
  modelsLoaded: false,
  generating: false,
  publishing: false,

  selectedModel: 'iENYRID ES1',
  painPoint: '续航焦虑',
  adType: '单品推广',
  sceneStyle: '城市通勤',
  discount: '夏季促销',
  promotion: '10%折扣',
  discountCode: '',
  cta: '立即购买',
  tone: '亲和有趣',
  platform: 'FB+X+IG',

  imageFile: null as File | null,
  imagePreview: '',
  uploading: false,

  content: null as GeneratedContent | null,
  activeTab: 'all',

  results: {} as Record<string, PublishResult>,
};

// ---------------------------------------------------------------
// Store
// ---------------------------------------------------------------

export const useFormStore = create<FormState>((set, get) => ({
  ...initialState,

  setField: (field, value) => set({ [field]: value }),

  // ---- Brand ----
  loadBrands: async () => {
    try {
      const resp = await fetch('/api/brands');
      const data = await resp.json();
      const brands: string[] = data.brands || [];
      const defaultBrand = data.default || 'iENYRID';
      set({ brands, brandsLoaded: true });
      // Auto-select default brand on first load
      const current = get().selectedBrand;
      if (!brands.includes(current)) {
        // Simply set the brand and load models directly (avoid recursive loadBrands call)
        set({ selectedBrand: defaultBrand, models: [], modelsLoaded: false, selectedModel: '' });
        try {
          const resp = await fetch(`/api/models?brand=${encodeURIComponent(defaultBrand)}`);
          const data = await resp.json();
          set({ models: data.models || [], modelsLoaded: true });
          if (data.models?.length > 0) {
            set({ selectedModel: data.models[0].name });
          }
        } catch (e) {
          console.error('Failed to load models:', e);
        }
      }
    } catch (e) {
      console.error('Failed to load brands:', e);
    }
  },

  setSelectedBrand: async (brand: string) => {
    set({ selectedBrand: brand, models: [], modelsLoaded: false, selectedModel: '', content: null, results: {} });
    // Reload models for new brand
    try {
      const resp = await fetch(`/api/models?brand=${encodeURIComponent(brand)}`);
      const data = await resp.json();
      set({ models: data.models || [], modelsLoaded: true });
      if (data.models?.length > 0) {
        set({ selectedModel: data.models[0].name });
      }
    } catch (e) {
      console.error('Failed to load models for brand:', brand, e);
    }
  },

  // ---- Image Upload ----
  setImageFile: (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => set({ imageFile: file, imagePreview: e.target?.result as string });
      reader.readAsDataURL(file);
    } else {
      set({ imageFile: null, imagePreview: '' });
    }
  },

  uploadImage: async () => {
    const { imageFile, selectedBrand, selectedModel } = get();
    if (!imageFile || !selectedModel) return false;
    set({ uploading: true });
    try {
      const formData = new FormData();
      formData.append('brand', selectedBrand);
      formData.append('model', selectedModel);
      formData.append('file', imageFile);
      const resp = await fetch('/api/upload-image', { method: 'POST', body: formData });
      const data = await resp.json();
      if (data.success) {
        set({ imageFile: null, imagePreview: '' });
      }
      return data.success;
    } catch (e: any) {
      console.error('Upload failed:', e);
      return false;
    } finally {
      set({ uploading: false });
    }
  },

  // ---- Models ----
  loadModels: async () => {
    const brand = get().selectedBrand;
    try {
      const resp = await fetch(`/api/models?brand=${encodeURIComponent(brand)}`);
      const data = await resp.json();
      set({ models: data.models || [], modelsLoaded: true });
      if (data.models?.length > 0 && !get().selectedModel) {
        set({ selectedModel: data.models[0].name });
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  },

  // ---- Generate ----
  generate: async () => {
    const s = get();
    set({ generating: true, content: null, results: {} });
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: s.selectedModel,
          pain_point: s.painPoint,
          ad_type: s.adType,
          scene_style: s.sceneStyle,
          discount: s.discount,
          promotion: s.promotion,
          discount_code: s.discountCode,
          cta: s.cta,
          tone: s.tone,
          platform: s.platform,
          brand: s.selectedBrand,
        }),
      });
      const data = await resp.json();
      set({ content: data, activeTab: 'all' });
    } catch (e: any) {
      console.error('Generate failed:', e);
    } finally {
      set({ generating: false });
    }
  },

  // ---- Publish ----
  publishFb: async () => {
    const { content, selectedBrand, selectedModel } = get();
    if (!content) return;
    set(s => ({ publishing: true, results: { ...s.results, fb: { success: false, error: 'Publishing...' } } }));
    try {
      const text = get().getFullText();
      const imgUrl = await _getProductImage(selectedModel, selectedBrand);
      const resp = await fetch('/api/publish/fb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, image_url: imgUrl, brand: selectedBrand }),
      });
      const data = await resp.json();
      set(s => ({ results: { ...s.results, fb: data } }));
    } finally {
      set({ publishing: false });
    }
  },

  publishIg: async () => {
    const { content, selectedBrand, selectedModel } = get();
    if (!content) return;
    set(s => ({ publishing: true, results: { ...s.results, ig: { success: false, error: 'Publishing...' } } }));
    try {
      const text = get().getFullText();
      const imgUrl = await _getProductImage(selectedModel, selectedBrand);
      const resp = await fetch('/api/publish/ig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, image_url: imgUrl, brand: selectedBrand }),
      });
      const data = await resp.json();
      set(s => ({ results: { ...s.results, ig: data } }));
    } finally {
      set({ publishing: false });
    }
  },

  publishX: async () => {
    const { content, selectedBrand, selectedModel } = get();
    if (!content) return;
    set(s => ({ publishing: true, results: { ...s.results, x: { success: false, error: 'Publishing...' } } }));
    try {
      const imgUrl = await _getProductImage(selectedModel, selectedBrand);
      const resp = await fetch('/api/publish/x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '', x_text: content.x_text, image_url: imgUrl, brand: selectedBrand }),
      });
      const data = await resp.json();
      set(s => ({ results: { ...s.results, x: data } }));
    } finally {
      set({ publishing: false });
    }
  },

  publishAll: async () => {
    const { content, selectedBrand, selectedModel,
      painPoint, adType, sceneStyle, discount, promotion, cta, tone, platform } = get();
    if (!content) return;
    set(s => ({ publishing: true, results: {} }));
    try {
      const text = get().getFullText();
      const imgUrl = await _getProductImage(selectedModel, selectedBrand);
      const resp = await fetch('/api/publish/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          x_text: content.x_text,
          image_url: imgUrl,
          brand: selectedBrand,
          model_name: selectedModel,
          title: content.title,
          tags: content.tags,
          body: content.body,
          image_prompt: content.image_prompt,
          pain_point: painPoint,
          ad_type: adType,
          scene_style: sceneStyle,
          discount: discount,
          promotion: promotion,
          cta: cta,
          tone: tone,
          platform: platform,
        }),
      });
      const data = await resp.json();
      set({ results: data });
    } finally {
      set({ publishing: false });
    }
  },

  getFullText: () => {
    const { content } = get();
    if (!content) return '';
    return `${content.title}\n\n${content.body}\n\n${content.tags}`;
  },
}));

async function _getProductImage(modelName: string, brand: string): Promise<string> {
  try {
    const resp = await fetch(`/api/product-image/${encodeURIComponent(modelName)}?brand=${encodeURIComponent(brand)}`);
    const data = await resp.json();
    return data.image_url || '';
  } catch {
    return '';
  }
}
