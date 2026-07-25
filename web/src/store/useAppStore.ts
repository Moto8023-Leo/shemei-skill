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

export const useAppStore = create<AppState>((set, get) => ({
  booted: false,
  bootstrap: null,
  bootError: '',
  online: true,
  toast: null,
  toastTimer: null,

  init: async () => {
    try {
      const resp = await fetch('/api/bootstrap', { signal: AbortSignal.timeout(15000) });
      const data = await resp.json();
      set({ booted: true, bootstrap: data });
    } catch (e: any) {
      set({ bootError: e.message || 'Failed to connect' });
    }
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
