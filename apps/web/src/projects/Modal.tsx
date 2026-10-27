import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';

interface ModalProps {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/** Small app-local modal shell with Escape, backdrop, focus entry, and focus containment. */
export function Modal({ labelledBy, onClose, children, className = '' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      if (dialogRef.current?.contains(document.activeElement)) return;
      const preferred = dialogRef.current?.querySelector<HTMLElement>('[autofocus]');
      const first =
        preferred ??
        dialogRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex="0"]',
        );
      first?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, []);

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      role="presentation"
      onMouseDown={closeFromBackdrop}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[3px]"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`my-auto max-h-[min(90vh,800px)] w-full overflow-y-auto rounded-3xl border border-white/50 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
