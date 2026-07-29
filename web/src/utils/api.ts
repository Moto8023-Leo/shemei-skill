/**
 * Unified API client for shemei_skill frontend.
 *
 * Features:
 *   - Typed request/response methods for all endpoints
 *   - Default 15s timeout with AbortController
 *   - Exponential-backoff retry (max 2 retries)
 *   - Unified HTTP error → user-friendly message mapping
 *   - Compatible with the Toast system in useAppStore
 */

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

export interface HealthResponse {
  ok: boolean;
  mode: string;
  uptime: number;
  timestamp: string;
}

export interface BrandListResponse {
  brands: string[];
  default: string;
}

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

export interface ModelsResponse {
  models: ProductModel[];
  brand: string;
}

export interface GenerateRequest {
  model: string;
  brand: string;
  pain_point: string;
  ad_type: string;
  scene_style: string;
  discount: string;
  promotion: string;
  discount_code: string;
  cta: string;
  tone: string;
  platform: string;
  country: string;
  campaign_mode: string;
  manual_campaign: string;
  extra_requirements: string;
}

export interface SafetyViolation {
  field: string;
  type: string;
  match: string;
  suggestion: string;
  severity: string;
}

export interface GenerateResponse {
  taskId: string;
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
  event: any;
  styleSummary: string;
  quality: {
    score: number;
    level: string;
    items: { label: string; value: string; status: string }[];
  };
  images: any;
  createdAt: string;
  mode: string;
  safetyViolations: SafetyViolation[];
  safetyBlocking: boolean;
}

export interface PublishRequest {
  text: string;
  x_text?: string;
  image_url?: string;
  brand?: string;
  model_name?: string;
  title?: string;
  tags?: string;
  body?: string;
  image_prompt?: string;
  pain_point?: string;
  ad_type?: string;
  scene_style?: string;
  discount?: string;
  promotion?: string;
  discount_code?: string;
  cta?: string;
  tone?: string;
  platform?: string;
  match_code?: string;
}

export interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface PublishAllResult {
  all_ok: boolean;
  summary_urls: string;
  feishu_updated: boolean;
  results?: Record<string, PublishResult>;
}

export interface PublishSubmitResult {
  task_id: string;
  status: 'processing';
}

// Vercel serverless returns result directly (no polling)
export interface PublishSyncResult {
  status: 'done' | 'error';
  result: {
    platforms?: Record<string, PublishResult>;
    summary?: string;
    all_ok?: boolean;
    error?: string;
  } | null;
}

export interface PublishStatusResult {
  status: 'processing' | 'done' | 'error';
  result: {
    platforms?: Record<string, PublishResult>;
    summary?: string;
    all_ok?: boolean;
    error?: string;
  } | null;
}

export interface BootstrapResponse {
  mode: string;
  brands: any[];
  products: any[];
  countries: any[];
  currentDate: string;
  events: any[];
  serviceStatus: { deepseek: boolean; feishu: boolean; meta: boolean };
  calendarDisclaimer: string;
  limits: { maxUploadMb: number };
}

// ------------------------------------------------------------------
// API base URL — auto-detect environment
// ------------------------------------------------------------------

const VERCEL_BASE = window.location.origin;

function getBaseUrl(): string {
  // In development (localhost) use relative paths → Vite proxy handles it
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '';
  }
  // In production → use same origin (no hardcoded URL), backend is same domain
  return '';
}

/** Whether we're on a production deployment (not local dev). */
function isProductionHost(): boolean {
  return window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
}

// ------------------------------------------------------------------
// Core fetch wrapper
// ------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = [1000, 3000]; // exponential-ish

function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

async function _fetch<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let lastError: ApiError | null = null;

  // Smart routing for API calls on production
  const base = getBaseUrl();
  if (base && url.startsWith('/api/')) {
    url = base + url;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        let detail = '';
        try {
          const errBody = await resp.json();
          detail = errBody.detail || errBody.message || '';
        } catch {}

        const apiErr: ApiError = {
          status: resp.status,
          message: httpStatusMessage(resp.status),
          detail,
        };

        if (isRetryable(resp.status) && attempt < MAX_RETRIES) {
          lastError = apiErr;
          await sleep(RETRY_DELAY_MS[attempt] || 3000);
          continue;
        }

        throw apiErr;
      }

      // Handle 204 No Content
      if (resp.status === 204) return undefined as unknown as T;

      const data = await resp.json();
      return data as T;
    } catch (err: any) {
      clearTimeout(timer);

      if ((err as ApiError).status) throw err; // Already an ApiError

      if (err.name === 'AbortError') {
        const timeoutErr: ApiError = {
          status: 0,
          message: `请求超时 (${timeoutMs / 1000}s)`,
        };
        if (attempt < MAX_RETRIES) {
          lastError = timeoutErr;
          await sleep(RETRY_DELAY_MS[attempt] || 3000);
          continue;
        }
        throw timeoutErr;
      }

      // Network error — report it
      const netErr: ApiError = {
        status: 0,
        message: '网络连接失败，请检查服务是否启动',
      };
      if (attempt < MAX_RETRIES) {
        lastError = netErr;
        await sleep(RETRY_DELAY_MS[attempt] || 3000);
        continue;
      }
      throw netErr;
    }
  }

  throw lastError || { status: 0, message: '未知错误' };
}

function httpStatusMessage(status: number): string {
  const map: Record<number, string> = {
    400: '请求参数有误',
    401: '认证失败，请检查 API 密钥',
    403: '无权限访问',
    404: '资源不存在',
    409: '操作冲突，请稍后重试',
    422: '数据验证失败',
    429: '请求过于频繁，请稍后重试',
    500: '服务器内部错误',
    502: '网关错误',
    503: '服务暂不可用',
  };
  return map[status] || `服务器错误 (${status})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ------------------------------------------------------------------
// Convenience helpers
// ------------------------------------------------------------------

function _get<T>(url: string, timeoutMs?: number): Promise<T> {
  return _fetch<T>(url, { method: 'GET' }, timeoutMs);
}

function _post<T>(url: string, body: unknown, timeoutMs?: number): Promise<T> {
  return _fetch<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

function _postForm<T>(url: string, formData: FormData, timeoutMs?: number): Promise<T> {
  return _fetch<T>(url, { method: 'POST', body: formData }, timeoutMs);
}

// ------------------------------------------------------------------
// Public API methods — one per endpoint
// ------------------------------------------------------------------

export const api = {
  /** GET /api/health */
  health(): Promise<HealthResponse> {
    return _get<HealthResponse>('/api/health', 5000);
  },

  /** GET /api/bootstrap */
  bootstrap(): Promise<BootstrapResponse> {
    return _get<BootstrapResponse>('/api/bootstrap', 20_000);
  },

  /** GET /api/brands */
  brands(): Promise<BrandListResponse> {
    return _get<BrandListResponse>('/api/brands');
  },

  /** GET /api/models */
  models(brand: string): Promise<ModelsResponse> {
    return _get<ModelsResponse>(`/api/models?brand=${encodeURIComponent(brand)}`);
  },

  /** POST /api/generate */
  generate(req: Partial<GenerateRequest>): Promise<GenerateResponse> {
    return _post<GenerateResponse>('/api/generate', req, 120_000);
  },

  /** GET /api/events */
  events(country: string, date?: string): Promise<any> {
    let url = `/api/events?country=${encodeURIComponent(country)}`;
    if (date) url += `&date=${encodeURIComponent(date)}`;
    return _get<any>(url);
  },

  /** GET /api/history */
  history(params?: {
    brandId?: string;
    productId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const search = new URLSearchParams();
    if (params?.brandId) search.set('brandId', params.brandId);
    if (params?.productId) search.set('productId', params.productId);
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.offset) search.set('offset', String(params.offset));
    const qs = search.toString();
    return _get<any>(`/api/history${qs ? '?' + qs : ''}`);
  },

  /** POST /api/history */
  saveHistory(entry: Record<string, unknown>): Promise<any> {
    return _post<any>('/api/history', entry);
  },

  /** GET /api/product-image/:name */
  productImage(modelName: string, brand: string): Promise<{ image_url: string }> {
    return _get<{ image_url: string }>(
      `/api/product-image/${encodeURIComponent(modelName)}?brand=${encodeURIComponent(brand)}`,
    );
  },

  /** POST /api/upload-image */
  uploadImage(brand: string, model: string, file: File): Promise<{ success: boolean }> {
    const fd = new FormData();
    fd.append('brand', brand);
    fd.append('model', model);
    fd.append('file', file);
    return _postForm<{ success: boolean }>('/api/upload-image', fd, 60_000);
  },

  /** POST /api/publish/fb */
  publishFb(req: PublishRequest): Promise<PublishResult> {
    return _post<PublishResult>('/api/publish/fb', req, 60_000);
  },

  /** POST /api/publish/ig */
  publishIg(req: PublishRequest): Promise<PublishResult> {
    return _post<PublishResult>('/api/publish/ig', req, 60_000);
  },

  /** POST /api/publish/x */
  publishX(req: PublishRequest): Promise<PublishResult> {
    return _post<PublishResult>('/api/publish/x', req, 60_000);
  },

  /** POST /api/publish/all — legacy synchronous path, prefer submit+status */
  publishAll(req: PublishRequest): Promise<PublishAllResult> {
    return _post<PublishAllResult>('/api/publish/all', req, 180_000);
  },

  /** POST /api/publish/submit — publish to FB+IG synchronously (Vercel serverless) */
  publishSubmit(req: PublishRequest): Promise<PublishSyncResult> {
    return _post<PublishSyncResult>('/api/publish/submit', req, 60_000);
  },

  /** POST /api/feishu/writeback */
  feishuWriteback(req: {
    model_name: string;
    title: string;
    body: string;
    tags: string;
    x_text: string;
    image_prompt: string;
    result_text: string;
    brand: string;
  }): Promise<any> {
    return _post<any>('/api/feishu/writeback', req);
  },

  /** GET /api/visual/style-pool */
  visualStylePool(language: string = 'zh'): Promise<any> {
    return _get<any>(`/api/visual/style-pool?language=${encodeURIComponent(language)}`);
  },

  /** GET /api/calendar/year */
  calendarYear(country: string, year: number, brandId?: string): Promise<any> {
    let url = `/api/calendar/year?country=${encodeURIComponent(country)}&year=${year}`;
    if (brandId) url += `&brandId=${encodeURIComponent(brandId)}`;
    return _get<any>(url);
  },

  /** GET /api/calendar */
  calendar(country: string, date?: string, brandId?: string): Promise<any> {
    const search = new URLSearchParams({ country });
    if (date) search.set('date', date);
    if (brandId) search.set('brandId', brandId);
    return _get<any>(`/api/calendar?${search.toString()}`);
  },

  /** POST /api/quality/score */
  qualityScore(data: Record<string, unknown>): Promise<any> {
    return _post<any>('/api/quality/score', data);
  },

  // ------------------------------------------------------------------
  // Creative Brief Workflow (Phase 1)
  // ------------------------------------------------------------------

  /** POST /api/creative-brief */
  creativeBrief(idea: string, brandId: string = 'ienyrid', productId: string = ''): Promise<CreativeBriefResponse> {
    return _post<CreativeBriefResponse>('/api/creative-brief', { idea, brandId, productId }, 120_000);
  },

  /** POST /api/creative-brief/{taskId}/apply */
  applyBrief(taskId: string, editedFields: Record<string, unknown> = {}): Promise<ApplyBriefResponse> {
    return _post<ApplyBriefResponse>(`/api/creative-brief/${encodeURIComponent(taskId)}/apply`, { taskId, editedFields });
  },

  /** POST /api/content-jobs/stream — SSE streaming with brief data */
  createContentJobStream(
    briefData: Record<string, unknown> | BriefData,
    onStatus: (status: { type: string; key: string; status: string }) => void,
    onData: (data: Record<string, GeneratedAsset>) => void,
    onError: (err: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve) => {
      // Safe serialize: BriefData has specific shape, but we just need to send as JSON
      const safeBrief = briefData as Record<string, unknown>;
      fetch('/api/content-jobs/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: safeBrief, assets: ['facebook', 'instagram', 'x', 'image_prompt'] }),
        signal,
      }).then(async (resp) => {
        if (!resp.ok) {
          let detail = '';
          try { const errBody = await resp.json(); detail = errBody.detail || ''; } catch {}
          onError(`生成请求失败 (${resp.status})${detail ? ': ' + detail : ''}`);
          resolve();
          return;
        }
        const reader = resp.body?.getReader();
        if (!reader) { resolve(); return; }
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'status') {
                  onStatus(data);
                } else if (data.type === 'error') {
                  onError(data.message || 'Unknown error');
                } else {
                  onData(data);
                }
              } catch { /* skip unparseable lines */ }
            }
          }
        }
        resolve();
      }).catch((err) => {
        if ((err as Error).name === 'AbortError') return resolve();
        onError(`网络错误: ${(err as Error).message}`);
        resolve();
      });
    });
  },

  /** GET /api/content-jobs/{jobId} */
  getContentJob(jobId: string): Promise<ContentJobResponse> {
    return _get<ContentJobResponse>(`/api/content-jobs/${encodeURIComponent(jobId)}`);
  },

  /** GET /api/creative-brief/{taskId} */
  getCreativeBrief(taskId: string): Promise<CreativeBriefResponse> {
    return _get<CreativeBriefResponse>(`/api/creative-brief/${encodeURIComponent(taskId)}`);
  },
};

/** Fallback: use sync /api/content-jobs when SSE stream endpoint is unavailable */
function fallbackToSync(
  creativeBriefId: string,
  onData: (data: Record<string, GeneratedAsset>) => void,
  onError: (err: string) => void,
  resolve: () => void,
) {
  fetch('/api/content-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creativeBriefId, assets: ['facebook', 'instagram', 'x', 'image_prompt'] }),
  }).then(async (resp) => {
    if (!resp.ok) {
      let detail = '';
      try { const errBody = await resp.json(); detail = errBody.detail || ''; } catch {}
      onError(`生成请求失败 (${resp.status})${detail ? ': ' + detail : ''}`);
    } else {
      const data = await resp.json();
      if (data.generated) onData(data.generated);
    }
    resolve();
  }).catch((err) => {
    onError(`网络错误: ${(err as Error).message}`);
    resolve();
  });
}

/** Creative Brief API response types */
export interface ConfidenceFactors {
  clarificationQuestions: { count: number; penalty: number };
  missingKeyFields: { fields: string[]; penalty: number };
  missingLists: { fields: string[]; penalty: number };
  market: { missing: string[]; penalty: number };
  offerUnverified: { hasLabel: boolean; penalty: number };
  bonuses: { avoidList: number; audienceSegments: number; total: number };
  computedScore: number;
}

export interface CreativeBriefResponse {
  taskId: string;
  brief: BriefData;
  confidence: number;
  confidenceFactors: ConfidenceFactors;
  warnings: string[];
  mode: 'live' | 'demo';
  createdAt: string;
}

export interface BriefData {
  campaignTheme: string;
  market: { country: string; language: string };
  audience: string[];
  painPoints: string[];
  productBenefits: string[];
  messageAngle: string;
  emotionalDirection: string[];
  tone: string[];
  visualDirection: string;
  offer: { label: string; verified: boolean };
  avoid: string[];
  clarificationQuestions: string[];
  confidence: number;
}

export interface ApplyBriefResponse {
  taskId: string;
  status: string;
  brief: BriefData;
  appliedAt: string;
}

export interface GeneratedAsset {
  title: string;
  body: string;
  footer: string;
}

export interface GeneratedContent {
  [key: string]: GeneratedAsset;  // Allow dynamic access via platform key
  facebook: GeneratedAsset;
  instagram: GeneratedAsset;
  x: GeneratedAsset;
  image: GeneratedAsset;
  video: GeneratedAsset;
}

export interface ContentJobResponse {
  jobId: string;
  status: string;
  generated: GeneratedContent;
  briefId: string;
  createdAt: string;
  mode: 'live' | 'demo';
}

export default api;
