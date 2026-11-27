import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
  Tooltip,
} from '@opencanvas/ui';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

import { useAppTheme } from './useAppTheme';
import type { ThemePreference } from './theme';

const OPTIONS: readonly { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match system', icon: Monitor },
];

export interface ThemeToggleProps {
  className?: string;
}

/**
 * The appearance switch.
 *
 * It shows what is actually on screen rather than what was chosen, so someone on `system` sees
 * a moon at night — the icon answers "what am I looking at", and the menu answers "why".
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { preference, resolved, setPreference } = useAppTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;
  const current = OPTIONS.find((option) => option.value === preference);

  return (
    <Menu className={className}>
      <Tooltip content={`Appearance: ${current?.label ?? 'Match system'}`}>
        <MenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Change appearance"
            className="rounded-lg"
          >
            <Icon />
          </Button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent align="end" aria-label="Appearance" className="w-52">
        <MenuLabel>Appearance</MenuLabel>
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            icon={<option.icon />}
            onSelect={() => setPreference(option.value)}
            aria-current={preference === option.value}
          >
            <span className="flex-1 text-left">{option.label}</span>
            {preference === option.value ? <Check className="size-4 shrink-0" aria-hidden /> : null}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
