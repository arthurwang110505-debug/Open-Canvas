import { useEffect } from 'react';

import { useEditorActions } from './actions';
import { useCanvasController, useCanvasReady, usePersistence } from './hooks';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Global editor shortcuts. They are ignored while typing in form fields or editing text on
 * the canvas so native text editing keeps working.
 */
export function useKeyboardShortcuts(): void {
  const actions = useEditorActions();
  const canvas = useCanvasController();
  const canvasReady = useCanvasReady();
  const persistence = usePersistence();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      // Saving is allowed everywhere, including while typing in a field or on the canvas.
      if (modifier && key === 's') {
        event.preventDefault();
        void persistence.state.getState().saveNow();
        return;
      }

      if (isTypingTarget(event.target) || canvas.isEditingText()) return;

      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (modifier && key === 'y') {
        event.preventDefault();
        actions.redo();
        return;
      }
      if (modifier && key === 'd') {
        event.preventDefault();
        actions.duplicateSelection();
        return;
      }
      if (modifier && key === 'a') {
        event.preventDefault();
        actions.selectAll();
        return;
      }
      // Physical bracket keys so the shortcut survives Shift (which turns ] into } on US layouts).
      if (modifier && (event.code === 'BracketRight' || event.code === 'BracketLeft')) {
        event.preventDefault();
        const forward = event.code === 'BracketRight';
        if (event.shiftKey) actions.reorderSelection(forward ? 'front' : 'back');
        else actions.reorderSelection(forward ? 'forward' : 'backward');
        return;
      }
      if (modifier && canvasReady && (key === '=' || key === '+')) {
        event.preventDefault();
        canvas.zoomIn();
        return;
      }
      if (modifier && canvasReady && key === '-') {
        event.preventDefault();
        canvas.zoomOut();
        return;
      }
      if (modifier && canvasReady && key === '0') {
        event.preventDefault();
        canvas.fitToScreen();
        return;
      }
      if (modifier && canvasReady && key === '1') {
        event.preventDefault();
        canvas.zoomTo(1);
        return;
      }
      if (modifier) return;

      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          actions.deleteSelection();
          return;
        case 'Escape':
          actions.clearSelection();
          return;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          const step = event.shiftKey ? 10 : 1;
          const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
          const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
          event.preventDefault();
          actions.nudgeSelection(dx, dy);
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, canvas, canvasReady, persistence]);
}
