import type { DesignElement } from '@opencanvas/document';
import { movableElements, type AlignMode, type DistributeAxis } from '@opencanvas/editor-core';
import { Button, Tooltip, cn } from '@opencanvas/ui';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useEditorActions } from './actions';

const ALIGN_MODES: { mode: AlignMode; label: string; icon: ReactNode }[] = [
  { mode: 'left', label: 'Align left', icon: <AlignStartVertical /> },
  { mode: 'center', label: 'Align horizontal centers', icon: <AlignCenterVertical /> },
  { mode: 'right', label: 'Align right', icon: <AlignEndVertical /> },
  { mode: 'top', label: 'Align top', icon: <AlignStartHorizontal /> },
  { mode: 'middle', label: 'Align vertical centers', icon: <AlignCenterHorizontal /> },
  { mode: 'bottom', label: 'Align bottom', icon: <AlignEndHorizontal /> },
];

const DISTRIBUTE_AXES: { axis: DistributeAxis; label: string; icon: ReactNode }[] = [
  {
    axis: 'horizontal',
    label: 'Distribute horizontally',
    icon: <AlignHorizontalDistributeCenter />,
  },
  { axis: 'vertical', label: 'Distribute vertically', icon: <AlignVerticalDistributeCenter /> },
];

interface SelectionAlignmentControlsProps {
  elements: DesignElement[];
  /** Compact mode keeps alignment in the toolbar; distribution remains in Properties. */
  compact?: boolean;
}

/** One implementation shared by the full inspector and the selection-aware toolbar. */
export function SelectionAlignmentControls({
  elements,
  compact = false,
}: SelectionAlignmentControlsProps) {
  const { alignSelection, distributeSelection } = useEditorActions();
  const movable = movableElements(elements).length;
  const single = elements.length === 1;
  const target = single ? 'page' : 'selection';
  const canDistribute = movable >= 3;

  return (
    <>
      <div
        role="group"
        aria-label={single ? 'Align to page' : 'Align selection'}
        className={cn(compact ? 'flex shrink-0 items-center gap-0.5' : 'grid grid-cols-6 gap-1')}
      >
        {ALIGN_MODES.map(({ mode, label, icon }) => (
          <Tooltip key={mode} content={`${label} (${target})`}>
            <Button
              variant={compact ? 'ghost' : 'outline'}
              size="icon-sm"
              aria-label={label}
              disabled={movable === 0}
              onClick={() => alignSelection(mode)}
              className={compact ? 'rounded-lg' : undefined}
            >
              {icon}
            </Button>
          </Tooltip>
        ))}
      </div>
      {!compact ? (
        <div className="grid grid-cols-6 gap-1">
          {DISTRIBUTE_AXES.map(({ axis, label, icon }) => (
            <Tooltip
              key={axis}
              content={canDistribute ? label : `${label} (select at least 3 unlocked elements)`}
            >
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={label}
                disabled={!canDistribute}
                onClick={() => distributeSelection(axis)}
              >
                {icon}
              </Button>
            </Tooltip>
          ))}
        </div>
      ) : null}
    </>
  );
}
