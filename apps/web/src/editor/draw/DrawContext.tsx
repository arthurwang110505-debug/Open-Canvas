import { createContext, useContext, useState, type ReactNode } from 'react';

interface DrawState {
  enabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  setEnabled: (v: boolean) => void;
  setStrokeColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
}

const DrawContext = createContext<DrawState | null>(null);

export function DrawProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#111827');
  const [strokeWidth, setStrokeWidth] = useState(4);
  return (
    <DrawContext.Provider value={{ enabled, strokeColor, strokeWidth, setEnabled, setStrokeColor, setStrokeWidth }}>
      {children}
    </DrawContext.Provider>
  );
}

export function useDraw(): DrawState {
  const ctx = useContext(DrawContext);
  if (!ctx) throw new Error('useDraw must be inside DrawProvider');
  return ctx;
}
