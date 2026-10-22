import { createContext, useContext } from 'react';

export interface DrawState {
  enabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  setEnabled: (v: boolean) => void;
  setStrokeColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
}

export const DrawContext = createContext<DrawState | null>(null);

export function useDraw(): DrawState {
  const ctx = useContext(DrawContext);
  if (!ctx) throw new Error('useDraw must be inside DrawProvider');
  return ctx;
}
