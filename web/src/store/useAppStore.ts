// App Store — global UI state: boot, connection, toast, mode
import { create } from 'zustand';

export interface Bootstrap {
  mode: string;
  brands: BrandRef[];
  products: ProductRef[];
  countries: CountryRef[];
  currentDate: string;
  events: EventRef[];
  serviceStatus: { deepseek: boolean; feishu: boolean; meta: boolean };
  calendarDisclaimer: string;
  limits: { maxUploadMb: number };
}

export interface BrandRef {
  id: string; name: string; website: string; tone: string;
  positioning: string[]; audiences: string[]; visualDna: string[];
  visualDnaEn: Record<string, string>; forbidden: string[];
}

export interface ProductRef {
  id: string; brandId: string; model: string; motor: string;
  battery: string; range: string; topSpeed: string; brakes: string;
  tires: string; suspension: string; foldable: boolean;
  maxLoad: string; price: number | string; currency: string;
  url: string; sellingPoints: string[]; structureLock: string; hasImage?: boolean;
}

export interface CountryRef {
  code: string; name: string; nameEn: string; flag: string;
  language: string; currency: string; locale: string; spelling: string;
}

export interface EventRef {
  id: string; name: string; country: string;
  startDate: string; endDate: string; phase: string;
  daysUntil: number; type: string; recommendation: string;
}

interface AppState {
  // Boot
  booted: boolean;
  bootstrap: Bootstrap | null;
  bootError: string;

  // Connection
  online: boolean;

  // Toast
  toast: { message: string; kind: 'success' | 'error' | 'info' } | null;
  toastTimer: ReturnType<typeof setTimeout> | null;

  // Actions
  init: () => Promise<void>;
  setOnline: (v: boolean) => void;
  showToast: (message: string, kind?: 'success' | 'error' | 'info') => void;
  dismissToast: () => void;
}

// Demo bootstrap data for static hosting when backend is unavailable
const DEMO_BOOTSTRAP: Bootstrap = {
  mode: 'demo',
  brands: [
    { id: 'ienyrid', name: 'iENYRID', website: 'https://ienyrid.com', tone: 'Professional & Eco-friendly', positioning: ['Urban Commuter', 'Eco-friendly', 'Smart Mobility'], audiences: ['Young Professionals', 'Urban Commuters', 'Eco-conscious'], visualDna: ['clean', 'tech'], visualDnaEn: { clean: 'Clean', tech: 'Tech' }, forbidden: ['unsafe riding', 'racing'] },
  ],
  products: [
    { id: 'ienyrid-m1', brandId: 'ienyrid', model: 'M1', motor: '350W', battery: '36V 10.4Ah', range: '45km', topSpeed: '25km/h', brakes: 'Disc', tires: '10 inch', suspension: 'Front', foldable: true, maxLoad: '120kg', price: 499, currency: 'EUR', url: 'https://ienyrid.com/m1', sellingPoints: ['Portable', 'Affordable', 'City-friendly'], structureLock: 'unlocked' },
    { id: 'ienyrid-m2', brandId: 'ienyrid', model: 'M2', motor: '500W', battery: '48V 13Ah', range: '60km', topSpeed: '30km/h', brakes: 'Disc', tires: '10 inch', suspension: 'Front+Rear', foldable: true, maxLoad: '150kg', price: 699, currency: 'EUR', url: 'https://ienyrid.com/m2', sellingPoints: ['Powerful', 'Long Range', 'Comfortable'], structureLock: 'unlocked' },
    { id: 'ienyrid-m3', brandId: 'ienyrid', model: 'M3', motor: '800W', battery: '48V 15Ah', range: '80km', topSpeed: '45km/h', brakes: 'Hydraulic Disc', tires: '11 inch', suspension: 'Full', foldable: false, maxLoad: '180kg', price: 999, currency: 'EUR', url: 'https://ienyrid.com/m3', sellingPoints: ['High Performance', 'Off-road', 'Premium'], structureLock: 'unlocked' },
  ],
  countries: [
    { code: 'DE', name: '德国', nameEn: 'Germany', flag: '🇩🇪', language: 'German', currency: 'EUR', locale: 'de-DE', spelling: 'DE' },
    { code: 'FR', name: '法国', nameEn: 'France', flag: '🇫🇷', language: 'French', currency: 'EUR', locale: 'fr-FR', spelling: 'FR' },
    { code: 'IT', name: '意大利', nameEn: 'Italy', flag: '🇮🇹', language: 'Italian', currency: 'EUR', locale: 'it-IT', spelling: 'IT' },
    { code: 'ES', name: '西班牙', nameEn: 'Spain', flag: '🇪🇸', language: 'Spanish', currency: 'EUR', locale: 'es-ES', spelling: 'ES' },
    { code: 'NL', name: '荷兰', nameEn: 'Netherlands', flag: '🇳🇱', language: 'Dutch', currency: 'EUR', locale: 'nl-NL', spelling: 'NL' },
  ],
  currentDate: new Date().toISOString().split('T')[0],
  events: [],
  serviceStatus: { deepseek: false, feishu: false, meta: false },
  calendarDisclaimer: 'Demo mode — calendar events not loaded.',
  limits: { maxUploadMb: 5 },
};

export const useAppStore = create<AppState>((set, get) => ({
  booted: false,
  bootstrap: null,
  bootError: '',
  online: true,
  toast: null,
  toastTimer: null,

  init: async () => {
    try {
      // Try live backend (ngrok or local proxy)
      const resp = await fetch('/api/bootstrap', {
        signal: AbortSignal.timeout(5000),
        headers: window.location.hostname.includes('github') ? { 'ngrok-skip-browser-warning': '1' } : {},
      });
      const data = await resp.json();
      if (data?.mode === 'live') {
        (window as any).__BOOTSTRAP__ = data;
        set({ booted: true, bootstrap: data });
        return;
      }
    } catch { /* fall through to static data */ }

    // Try static data fallback (deployed to /data/ on GitHub Pages)
    try {
      const fallbackResp = await fetch('/data/bootstrap.json');
      if (fallbackResp.ok) {
        const fallbackData = await fallbackResp.json();
        if (fallbackData?.mode === 'live') {
          (window as any).__BOOTSTRAP__ = fallbackData;
          set({ booted: true, bootstrap: fallbackData });
          return;
        }
      }
    } catch { /* fall through to demo data */ }

    // Last resort — embedded demo data
    const bs = DEMO_BOOTSTRAP;
    (window as any).__BOOTSTRAP__ = bs;
    set({
      booted: true,
      bootstrap: bs,
    });
  },

  setOnline: (v) => set({ online: v }),

  showToast: (message, kind = 'info') => {
    const prev = get().toastTimer;
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => set({ toast: null }), 3500);
    set({ toast: { message, kind }, toastTimer: timer });
  },

  dismissToast: () => {
    const prev = get().toastTimer;
    if (prev) clearTimeout(prev);
    set({ toast: null, toastTimer: null });
  },
}));
