import { Slot } from '@radix-ui/react-slot';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import { cn } from '../lib/cn';

interface MenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  focusTrigger: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error('Menu parts must be used inside <Menu>.');
  return context;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

function menuItems(content: HTMLElement | null): HTMLElement[] {
  if (!content) return [];
  return Array.from(content.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

export interface MenuProps {
  children: ReactNode;
  className?: string;
}

/**
 * Accessible dropdown menu: one trigger, one content panel, roving focus between items.
 * Opening, closing, Escape, outside clicks and arrow-key navigation are handled here so
 * every menu in the app behaves the same way.
 */
export function Menu({ children, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const focusTrigger = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  // Outside pointer presses close the menu without stealing focus from what was clicked.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  // Move focus into the menu as soon as it opens, so keyboard users land on the first item.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      menuItems(contentRef.current)[0]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <MenuContext.Provider
      value={{ open, setOpen, contentId, triggerRef, contentRef, focusTrigger }}
    >
      <div className={cn('relative inline-flex', className)}>{children}</div>
    </MenuContext.Provider>
  );
}

export interface MenuTriggerProps extends ComponentPropsWithRef<'button'> {
  asChild?: boolean;
}

export function MenuTrigger({
  asChild = false,
  className,
  children,
  onClick,
  ...props
}: MenuTriggerProps) {
  const { open, setOpen, contentId, triggerRef } = useMenu();
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={triggerRef}
      type={asChild ? undefined : 'button'}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      data-state={open ? 'open' : 'closed'}
      className={cn(!asChild && 'inline-flex items-center', className)}
      {...props}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
    >
      {children}
    </Component>
  );
}

export interface MenuContentProps {
  children: ReactNode;
  /** Which edge of the trigger the panel aligns to. Defaults to `start`. */
  align?: 'start' | 'end';
  className?: string;
  'aria-label'?: string;
}

export function MenuContent({ children, align = 'start', className, ...props }: MenuContentProps) {
  const { open, setOpen, contentId, contentRef, focusTrigger } = useMenu();
  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(contentRef.current);
    const current = document.activeElement as HTMLElement | null;
    const index = current ? items.indexOf(current) : -1;
    const focusAt = (next: number) => {
      event.preventDefault();
      const wrapped = (next + items.length) % items.length;
      items[wrapped]?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        focusTrigger();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={contentRef}
      id={contentId}
      role="menu"
      aria-label={props['aria-label']}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        'absolute top-full z-50 mt-1.5 min-w-52 rounded-xl border border-border bg-white p-1.5 shadow-[0_12px_32px_rgba(16,24,40,0.16)] outline-none',
        align === 'end' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface MenuItemProps extends ComponentPropsWithRef<'button'> {
  icon?: ReactNode;
  /** Right-aligned secondary text (shortcut, format hint). */
  hint?: string;
  onSelect?: () => void;
}

export function MenuItem({
  icon,
  hint,
  onSelect,
  className,
  children,
  onClick,
  ...props
}: MenuItemProps) {
  const { setOpen, focusTrigger } = useMenu();
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        onSelect?.();
        setOpen(false);
        focusTrigger();
      }}
      {...props}
    >
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <span className="flex-1 truncate">{children}</span>
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="mx-1 my-1 h-px bg-border" />;
}
