import { useEffect } from 'react';

import { useEditorActions } from './actions';
import { useCanvasController, useCanvasReady, useEditorStore, usePersistence } from './hooks';
import { useDraw } from './draw/DrawContext';

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
  const draw = useDraw();
  const store = useEditorStore();

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

      // Crop mode is modal: it owns Enter and Escape, and nothing else reaches the document.
      if (store.getState().cropId) {
        if (event.key === 'Enter') {
          event.preventDefault();
          store.getState().applyCrop();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          store.getState().cancelCrop();
        } else if (!modifier) {
          event.preventDefault();
        }
        return;
      }

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
      if (modifier && key === 'g') {
        event.preventDefault();
        if (event.shiftKey) actions.ungroupSelection();
        else actions.groupSelection();
        return;
      }
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

      // Quick insert shortcuts like Canva: R=rect, O=ellipse, T=text, L=line, D=draw
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        const k = event.key.toLowerCase();
        if (k === 'r') {
          event.preventDefault();
          actions.addShape('rect');
          return;
        }
        if (k === 'o') {
          event.preventDefault();
          actions.addShape('ellipse');
          return;
        }
        if (k === 't') {
          event.preventDefault();
          actions.addText('body');
          return;
        }
        if (k === 'l') {
          event.preventDefault();
          actions.addShape('line');
          return;
        }
        if (k === 'd') {
          event.preventDefault();
          draw.setEnabled(!draw.enabled);
          return;
        }
      }

      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          actions.deleteSelection();
          return;
        case 'Escape':
          // Escape unwinds one level at a time: pen, then adjust-photo mode, then the selection.
          if (draw.enabled) {
            draw.setEnabled(false);
            return;
          }
          if (store.getState().photoPanId) {
            store.getState().setPhotoPan(null);
            return;
          }
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
          // While adjusting a photo the arrow keys move the picture, not the frame.
          if (store.getState().photoPanId) actions.nudgePhoto(dx, dy);
          else actions.nudgeSelection(dx, dy);
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, canvas, canvasReady, persistence, draw, store]);
}
