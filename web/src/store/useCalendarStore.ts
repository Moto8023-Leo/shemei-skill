// Calendar Store — marketing calendar events
import { create } from 'zustand';
import type { EventRef } from './useAppStore';

interface CalendarState {
  events: EventRef[];
  selectedCountry: string;
  loading: boolean;

  setCountry: (code: string) => void;
  fetchEvents: (country: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarState>((set) => ({
  events: [],
  selectedCountry: 'GB',
  loading: false,

  setCountry: (code) => {
    set({ selectedCountry: code });
  },

  fetchEvents: async (country) => {
    set({ loading: true });
    try {
      const resp = await fetch(`/api/events?country=${encodeURIComponent(country)}`);
      const data = await resp.json();
      set({ events: data.events || [] });
    } catch (e) {
      console.error('Calendar fetch failed:', e);
    } finally {
      set({ loading: false });
    }
  },
}));
