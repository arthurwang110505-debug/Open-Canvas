import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../lib/cn';

export interface DialogProps {
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * A portal-based modal with focus containment, Escape, backdrop dismissal, and an inert
 * background. Portals keep dialogs out of clipped toolbars and scrolling dashboard panels.
 */
export function Dialog({ labelledBy, describedBy, onClose, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const overlay = overlayRef.current;
    if (!dialog || !overlay) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Only siblings are made inert; an ancestor of the portal must remain interactive.
    const siblings = Array.from(document.body.children).filter(
      (element): element is HTMLElement => element !== overlay && element instanceof HTMLElement,
    );
    const previousInert = siblings.map((element) => element.hasAttribute('inert'));
    siblings.forEach((element) => {
      element.inert = true;
      // Keep the state observable to assistive technology and older DOM implementations.
      element.setAttribute('inert', '');
    });

    const visibleControls = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) =>
          !element.closest('[inert], [hidden]') && element.getAttribute('type') !== 'hidden',
      );
    const frame = requestAnimationFrame(() => {
      if (dialog.contains(document.activeElement)) return;
      const preferred = dialog.querySelector<HTMLElement>('[data-autofocus]');
      (preferred ?? visibleControls()[0] ?? dialog).focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      // Nested dialogs must not both respond to the same Escape or Tab.
      const overlays = document.querySelectorAll('[data-dialog-overlay]');
      if (overlays[overlays.length - 1] !== overlay) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = visibleControls();
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      siblings.forEach((element, index) => {
        const inert = previousInert[index] ?? false;
        element.inert = inert;
        if (inert) element.setAttribute('inert', '');
        else element.removeAttribute('inert');
      });
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      data-dialog-overlay
      role="presentation"
      className="fixed inset-0 z-[100] flex animate-overlay-in items-center justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-[3px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn(
          'my-auto max-h-[92dvh] w-full max-w-lg animate-dialog-in overflow-y-auto overscroll-contain rounded-2xl border border-border bg-panel shadow-[0_24px_80px_rgba(15,23,42,0.24)] outline-none',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
