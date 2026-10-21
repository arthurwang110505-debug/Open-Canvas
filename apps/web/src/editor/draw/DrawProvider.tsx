import { useState, type ReactNode } from 'react';

import { DrawContext } from './DrawContext';

export function DrawProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#111827');
  const [strokeWidth, setStrokeWidth] = useState(4);
  return (
    <DrawContext.Provider
      value={{ enabled, strokeColor, strokeWidth, setEnabled, setStrokeColor, setStrokeWidth }}
    >
      {children}
    </DrawContext.Provider>
  );
}
