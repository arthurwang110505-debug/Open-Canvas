import { LIMITS, type DesignElement, type TextElement } from '@opencanvas/document';
import { selectSelectedElements } from '@opencanvas/editor-core';
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Select,
  Separator,
  Tooltip,
} from '@opencanvas/ui';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Crop,
  ImageIcon,
  Italic,
  MoreHorizontal,
  Palette,
  SlidersHorizontal,
  Underline,
} from 'lucide-react';
import { useId } from 'react';
import { useShallow } from 'zustand/shallow';

import { useEditorActions } from './actions';
import { SelectionAlignmentControls } from './SelectionAlignmentControls';
import { useEditor, useEditorStore } from './hooks';
import { NumberField } from './panels/fields';
import { FONT_CATEGORIES, fontWeightsFor } from '../fonts/catalog';
import type { SidebarTab } from './Sidebar';

interface ContextualToolbarProps {
  onOpenPanel: (panel: SidebarTab) => void;
}

function SelectionColor({ element }: { element: DesignElement }) {
  const { updateSelection } = useEditorActions();
  const color =
    element.type === 'text' || element.type === 'icon'
      ? element.color
      : 'fill' in element && element.fill.type === 'solid'
        ? element.fill.color
        : '#ffffff';

  if (element.type === 'image' || element.type === 'group') return null;

  const label = element.type === 'text' || element.type === 'icon' ? 'Text color' : 'Fill color';
  return (
    <Tooltip content={label}>
      <label
        className="grid size-11 shrink-0 cursor-pointer place-items-center sm:size-8 rounded-lg border border-border bg-white hover:bg-muted"
        aria-label={label}
      >
        <input
          type="color"
          aria-label={label}
          value={color.slice(0, 7)}
          onChange={(event) => {
            const next = event.target.value;
            if (element.type === 'text' || element.type === 'icon') {
              updateSelection({ color: next }, `color:${element.id}`);
            } else if ('fill' in element) {
              updateSelection({ fill: { type: 'solid', color: next } }, `fill:${element.id}`);
            }
          }}
          className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </label>
    </Tooltip>
  );
}

function SelectionOpacity({ elements }: { elements: DesignElement[] }) {
  const { updateSelection } = useEditorActions();
  const averageOpacity =
    elements.reduce((sum, element) => sum + element.opacity, 0) / elements.length;
  const single = elements.length === 1 ? elements[0] : undefined;
  const mergeKey = single ? `opacity:${single.id}` : 'multi-opacity';

  return (
    <NumberField
      compact
      label="Opacity"
      value={Math.round(averageOpacity * 100)}
      unit="%"
      min={0}
      max={100}
      precision={0}
      onCommit={(percent) => updateSelection({ opacity: percent / 100 }, mergeKey)}
      className="rounded-lg border border-transparent px-1.5 hover:border-border"
    />
  );
}

function TextControls({ element }: { element: TextElement }) {
  const { updateSelection } = useEditorActions();
  const familyId = useId();
  const familyWeights = fontWeightsFor(element.fontFamily, element.fontWeight);
  const isBold = element.fontWeight >= 600;
  const regularWeight = familyWeights.find((weight) => weight < 600) ?? 400;
  const boldWeight = familyWeights.find((weight) => weight >= 700) ?? familyWeights.at(-1) ?? 700;

  return (
    <>
      <Select
        id={familyId}
        aria-label="Font family"
        value={element.fontFamily}
        onChange={(event) =>
          updateSelection({ fontFamily: event.target.value }, `fontFamily:${element.id}`)
        }
        className="h-10 w-24 shrink-0 sm:h-8 border-transparent xl:w-[154px] bg-transparent text-xs hover:border-input"
        style={{ fontFamily: `"${element.fontFamily}"` }}
      >
        {FONT_CATEGORIES.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.families.map((font) => (
              <option key={font.family} value={font.family}>
                {font.family}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <input
        type="number"
        aria-label="Font size"
        min={LIMITS.minFontSize}
        max={LIMITS.maxFontSize}
        value={element.fontSize}
        onChange={(event) => {
          if (event.target.value === '') return;
          const fontSize = Number(event.target.value);
          if (Number.isFinite(fontSize)) {
            updateSelection({ fontSize }, `fontSize:${element.id}`);
          }
        }}
        className="h-10 w-11 shrink-0 rounded-md sm:h-8 xl:w-[70px] xl:w-[70px] border border-transparent bg-transparent px-2 text-center text-xs tabular-nums outline-none hover:border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <Separator orientation="vertical" className="mx-0.5 hidden h-6 xl:block" />
      <Tooltip content={isBold ? 'Remove bold' : 'Bold'}>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-11 sm:size-8"
          aria-label="Bold"
          pressed={isBold}
          onClick={() =>
            updateSelection(
              { fontWeight: isBold ? regularWeight : boldWeight },
              `weight:${element.id}`,
            )
          }
        >
          <Bold />
        </Button>
      </Tooltip>
      <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
        <Tooltip content={element.fontStyle === 'italic' ? 'Remove italic' : 'Italic'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Italic"
            pressed={element.fontStyle === 'italic'}
            onClick={() =>
              updateSelection(
                { fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' },
                `fontStyle:${element.id}`,
              )
            }
          >
            <Italic />
          </Button>
        </Tooltip>
        <Tooltip content={element.underline ? 'Remove underline' : 'Underline'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Underline"
            pressed={element.underline}
            onClick={() =>
              updateSelection({ underline: !element.underline }, `underline:${element.id}`)
            }
          >
            <Underline />
          </Button>
        </Tooltip>
        <Separator orientation="vertical" className="mx-0.5 h-6" />
        {(
          [
            { value: 'left', label: 'Align left', icon: <AlignLeft /> },
            { value: 'center', label: 'Align center', icon: <AlignCenter /> },
            { value: 'right', label: 'Align right', icon: <AlignRight /> },
          ] as const
        ).map((alignment) => (
          <Tooltip key={alignment.value} content={alignment.label}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={alignment.label}
              pressed={element.textAlign === alignment.value}
              onClick={() =>
                updateSelection({ textAlign: alignment.value }, `textAlign:${element.id}`)
              }
            >
              {alignment.icon}
            </Button>
          </Tooltip>
        ))}
      </div>
    </>
  );
}

/** The compact 44px inspector that follows the current page or selection. */
export function ContextualToolbar({ onOpenPanel }: ContextualToolbarProps) {
  const selected = useEditor(useShallow(selectSelectedElements));
  const activePageId = useEditor((state) => state.activePageId);
  const documentSize = useEditor((state) => state.document.size);
  const pages = useEditor((state) => state.document.pages);
  const store = useEditorStore();
  const { updateSelection } = useEditorActions();
  const activeIndex = pages.findIndex((page) => page.id === activePageId);
  const single = selected.length === 1 ? selected[0] : undefined;

  return (
    <div
      role="toolbar"
      aria-label="Contextual toolbar"
      className="relative z-20 flex h-11 min-w-0 items-center overflow-visible border-b border-border bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div
        key={selected.map((element) => element.id).join(',') || 'page'}
        className="flex min-w-0 flex-1 animate-toolbar-in items-center gap-1.5"
      >
        {selected.length === 0 ? (
          <>
            <div className="flex shrink-0 items-center gap-2 pr-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="size-4" />
              </span>
              <span className="text-xs font-semibold">Page {Math.max(1, activeIndex + 1)}</span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {documentSize.width} × {documentSize.height} px
              </span>
            </div>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenPanel('background')}
              className="h-8 rounded-lg text-xs"
            >
              <Palette className="size-4" /> Background
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenPanel('page')}
              className="h-8 rounded-lg text-xs"
            >
              <SlidersHorizontal className="size-4" /> Resize
            </Button>
            <span className="ml-auto hidden shrink-0 pr-1 text-[11px] text-muted-foreground md:inline">
              {pages.length} page{pages.length === 1 ? '' : 's'}
            </span>
          </>
        ) : (
          <>
            <span className="ml-1 hidden shrink-0 text-xs font-semibold text-foreground lg:inline">
              {selected.length > 1 ? `${selected.length} selected` : (single?.type ?? 'Selection')}
            </span>
            <Separator orientation="vertical" className="mx-1 hidden h-6 lg:block" />
            {selected.length > 1 ? (
              <>
                <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
                  <SelectionAlignmentControls elements={selected} compact />
                  <Separator orientation="vertical" className="mx-1 h-6" />
                </div>
              </>
            ) : null}
            {single?.type === 'text' ? <TextControls element={single} /> : null}
            {single ? <SelectionColor element={single} /> : null}
            {single?.type === 'image' ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => store.getState().beginCrop(single.id)}
              >
                <Crop className="size-4" /> Crop
              </Button>
            ) : null}
            {single?.type === 'frame' && single.assetId ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => store.getState().setPhotoPan(single.id)}
              >
                <ImageIcon className="size-4" /> Adjust photo
              </Button>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-1 pl-1 sm:gap-1.5 sm:pl-2">
              <div className="hidden xl:block">
                <SelectionOpacity elements={selected} />
              </div>
              <Menu>
                <MenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More selection actions"
                    className="size-11 sm:size-8"
                  >
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent align="end" aria-label="Selection actions">
                  <MenuLabel>Selection</MenuLabel>
                  {single?.type === 'text' ? (
                    <>
                      <MenuItem
                        icon={<Italic />}
                        hint={single.fontStyle === 'italic' ? 'On' : 'Off'}
                        onSelect={() => {
                          updateSelection(
                            { fontStyle: single.fontStyle === 'italic' ? 'normal' : 'italic' },
                            `fontStyle:${single.id}`,
                          );
                        }}
                      >
                        Italic
                      </MenuItem>
                      <MenuItem
                        icon={<Underline />}
                        hint={single.underline ? 'On' : 'Off'}
                        onSelect={() =>
                          updateSelection(
                            { underline: !single.underline },
                            `underline:${single.id}`,
                          )
                        }
                      >
                        Underline
                      </MenuItem>
                      <MenuSeparator />
                      {(['left', 'center', 'right'] as const).map((alignment) => (
                        <MenuItem
                          key={alignment}
                          icon={
                            alignment === 'left' ? (
                              <AlignLeft />
                            ) : alignment === 'center' ? (
                              <AlignCenter />
                            ) : (
                              <AlignRight />
                            )
                          }
                          hint={single.textAlign === alignment ? 'On' : undefined}
                          onSelect={() =>
                            updateSelection({ textAlign: alignment }, `textAlign:${single.id}`)
                          }
                        >
                          Align {alignment}
                        </MenuItem>
                      ))}
                      <MenuSeparator />
                    </>
                  ) : null}
                  {selected.length > 1 ? (
                    <MenuItem
                      icon={<SlidersHorizontal />}
                      onSelect={() => onOpenPanel('properties')}
                    >
                      Align and distribute
                    </MenuItem>
                  ) : null}
                  <MenuItem icon={<SlidersHorizontal />} onSelect={() => onOpenPanel('properties')}>
                    Opacity, position & more
                  </MenuItem>
                </MenuContent>
              </Menu>
              <Tooltip content="Selection properties">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Open selection properties"
                  className="size-11 rounded-lg text-xs sm:size-8 sm:w-auto sm:px-2"
                  onClick={() => onOpenPanel('properties')}
                >
                  <SlidersHorizontal className="size-4" />{' '}
                  <span className="hidden sm:inline">Properties</span>
                </Button>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
