import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  loadBrandKit,
  MAX_BRAND_COLORS,
  normalizeBrandColor,
  saveBrandKit,
  type BrandKit,
} from './brandKit';

export interface BrandKitState {
  kit: BrandKit;
  /** Adds a color to the kit. Returns false for invalid, duplicate, or over-cap colors. */
  addColor: (color: string) => boolean;
  removeColor: (color: string) => void;
  setHeadingFont: (fontFamily: string) => void;
  setBodyFont: (fontFamily: string) => void;
  /** Replaces the whole kit (used by tests and future import/reset flows). */
  setKit: (kit: BrandKit) => void;
}

export type BrandKitStore = StoreApi<BrandKitState>;

/**
 * The brand kit lives in one app-level store backed by localStorage, so it follows the user
 * across designs without an account and without touching the document schema.
 */
export function createBrandKitStore(storage?: Storage | null): BrandKitStore {
  const persist = (kit: BrandKit) => saveBrandKit(kit, storage);
  return createStore<BrandKitState>((set, get) => ({
    kit: loadBrandKit(storage),
    addColor: (input) => {
      const color = normalizeBrandColor(input);
      if (!color) return false;
      const { colors } = get().kit;
      if (colors.includes(color) || colors.length >= MAX_BRAND_COLORS) return false;
      const kit = { ...get().kit, colors: [...colors, color] };
      set({ kit });
      persist(kit);
      return true;
    },
    removeColor: (color) => {
      const kit = { ...get().kit, colors: get().kit.colors.filter((entry) => entry !== color) };
      set({ kit });
      persist(kit);
    },
    setHeadingFont: (headingFont) => {
      const kit = { ...get().kit, headingFont };
      set({ kit });
      persist(kit);
    },
    setBodyFont: (bodyFont) => {
      const kit = { ...get().kit, bodyFont };
      set({ kit });
      persist(kit);
    },
    setKit: (kit) => {
      set({ kit });
      persist(kit);
    },
  }));
}

/** The shared instance used by the app; tests build their own with `createBrandKitStore`. */
export const brandKitStore: BrandKitStore = createBrandKitStore();

/** Subscribes to a slice of the shared brand kit. */
export function useBrandKit<T>(selector: (state: BrandKitState) => T): T {
  return useStore(brandKitStore, selector);
}
