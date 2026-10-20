import {
  CANVAS_PRESETS,
  LIMITS,
  type DesignElement,
  type FontWeight,
  type ImageElement,
  type ImageFit,
  type TextAlign,
  type TextElement,
} from '@opencanvas/document';
import {
  movableElements,
  selectActivePage,
  selectSelectedElements,
  type AlignMode,
  type DistributeAxis,
} from '@opencanvas/editor-core';
import { Button, Label, Select, Separator, Textarea, Tooltip } from '@opencanvas/ui';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  Italic,
  Link,
  Lock,
  LockOpen,
  Trash2,
  Underline,
  Unlink,
} from 'lucide-react';
import { useId, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { useEditorActions } from './actions';
import { describeElement, ELEMENT_TYPE_LABELS } from './elementLabels';
import { FONT_FAMILIES } from './fonts';
import { useEditor } from './hooks';
import { ColorField, FieldGroup, NumberField } from './panels/fields';

/** Weights bundled for Inter; browsers synthesize the rest for system fonts. */
const FONT_WEIGHTS: { value: FontWeight; label: string }[] = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra bold' },
];

const TEXT_ALIGNMENTS: { value: TextAlign; label: string; icon: React.ReactNode }[] = [
  { value: 'left', label: 'Align left', icon: <AlignLeft /> },
  { value: 'center', label: 'Align center', icon: <AlignCenter /> },
  { value: 'right', label: 'Align right', icon: <AlignRight /> },
  { value: 'justify', label: 'Justify', icon: <AlignJustify /> },
];

const ALIGN_MODES: { mode: AlignMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'left', label: 'Align left', icon: <AlignStartVertical /> },
  { mode: 'center', label: 'Align horizontal centers', icon: <AlignCenterVertical /> },
  { mode: 'right', label: 'Align right', icon: <AlignEndVertical /> },
  { mode: 'top', label: 'Align top', icon: <AlignStartHorizontal /> },
  { mode: 'middle', label: 'Align vertical centers', icon: <AlignCenterHorizontal /> },
  { mode: 'bottom', label: 'Align bottom', icon: <AlignEndHorizontal /> },
];

const DISTRIBUTE_AXES: { axis: DistributeAxis; label: string; icon: React.ReactNode }[] = [
  {
    axis: 'horizontal',
    label: 'Distribute horizontally',
    icon: <AlignHorizontalDistributeCenter />,
  },
  { axis: 'vertical', label: 'Distribute vertically', icon: <AlignVerticalDistributeCenter /> },
];

const IMAGE_FITS: { value: ImageFit; label: string; description: string }[] = [
  {
    value: 'cover',
    label: 'Cover (crop to fill)',
    description: 'Keeps proportions, crops overflow',
  },
  { value: 'fill', label: 'Fill (stretch)', description: 'Stretches the image to the box' },
];

function PageProperties() {
  const size = useEditor((state) => state.document.size);
  const elementCount = useEditor((state) => selectActivePage(state).elements.length);
  const { resizeDocument } = useEditorActions();
  const presetId = useId();
  const matchingPreset = CANVAS_PRESETS.find(
    (preset) => preset.width === size.width && preset.height === size.height,
  );

  return (
    <>
      <div className="px-3 py-3">
        <h2 className="text-sm font-semibold">Page</h2>
        <p className="text-xs text-muted-foreground">
          {elementCount === 0
            ? 'Nothing on the page yet. Insert a shape or text from the left panel.'
            : `${elementCount} element${elementCount === 1 ? '' : 's'}. Select one to edit it.`}
        </p>
      </div>
      <Separator />
      <FieldGroup title="Canvas size">
        <div className="flex flex-col gap-1">
          <Label htmlFor={presetId}>Preset</Label>
          <Select
            id={presetId}
            value={matchingPreset?.id ?? 'custom'}
            onChange={(event) => {
              const preset = CANVAS_PRESETS.find((p) => p.id === event.target.value);
              if (preset) resizeDocument(preset.width, preset.height);
            }}
          >
            {!matchingPreset && <option value="custom">Custom</option>}
            {CANVAS_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} · {preset.width}×{preset.height}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Width"
            value={size.width}
            min={LIMITS.minCanvasDimension}
            max={LIMITS.maxCanvasDimension}
            precision={0}
            unit="px"
            onCommit={(width) => resizeDocument(width, size.height)}
          />
          <NumberField
            label="Height"
            value={size.height}
            min={LIMITS.minCanvasDimension}
            max={LIMITS.maxCanvasDimension}
            precision={0}
            unit="px"
            onCommit={(height) => resizeDocument(size.width, height)}
          />
        </div>
      </FieldGroup>
    </>
  );
}

/** Align to the page (one element) or to the selection box (several); distribute needs three. */
function AlignControls({ elements }: { elements: DesignElement[] }) {
  const { alignSelection, distributeSelection } = useEditorActions();
  const movable = movableElements(elements).length;
  const single = elements.length === 1;
  const target = single ? 'page' : 'selection';
  const canDistribute = movable >= 3;

  return (
    <FieldGroup title={single ? 'Align to page' : 'Align selection'}>
      <div className="grid grid-cols-6 gap-1">
        {ALIGN_MODES.map(({ mode, label, icon }) => (
          <Tooltip key={mode} content={`${label} (${target})`}>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={label}
              disabled={movable === 0}
              onClick={() => alignSelection(mode)}
            >
              {icon}
            </Button>
          </Tooltip>
        ))}
      </div>
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
    </FieldGroup>
  );
}

function ArrangeControls({ elements }: { elements: DesignElement[] }) {
  const { reorderSelection, duplicateSelection, deleteSelection, updateSelection } =
    useEditorActions();
  const allLocked = elements.every((element) => element.locked);
  const allHidden = elements.every((element) => !element.visible);
  const single = elements.length === 1;

  return (
    <FieldGroup title="Arrange">
      <div className="grid grid-cols-4 gap-1">
        <Tooltip content="Bring to front">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Bring to front"
            disabled={!single}
            onClick={() => reorderSelection('front')}
          >
            <ArrowUpToLine />
          </Button>
        </Tooltip>
        <Tooltip content="Bring forward">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Bring forward"
            disabled={!single}
            onClick={() => reorderSelection('forward')}
          >
            <ArrowUp />
          </Button>
        </Tooltip>
        <Tooltip content="Send backward">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Send backward"
            disabled={!single}
            onClick={() => reorderSelection('backward')}
          >
            <ArrowDown />
          </Button>
        </Tooltip>
        <Tooltip content="Send to back">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Send to back"
            disabled={!single}
            onClick={() => reorderSelection('back')}
          >
            <ArrowDownToLine />
          </Button>
        </Tooltip>
      </div>
      <div className="grid grid-cols-4 gap-1">
        <Tooltip content={allLocked ? 'Unlock' : 'Lock position and size'}>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={allLocked ? 'Unlock' : 'Lock'}
            pressed={allLocked}
            onClick={() => updateSelection({ locked: !allLocked })}
          >
            {allLocked ? <Lock /> : <LockOpen />}
          </Button>
        </Tooltip>
        <Tooltip content={allHidden ? 'Show' : 'Hide'}>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={allHidden ? 'Show' : 'Hide'}
            pressed={allHidden}
            onClick={() => updateSelection({ visible: allHidden })}
          >
            {allHidden ? <EyeOff /> : <Eye />}
          </Button>
        </Tooltip>
        <Tooltip content="Duplicate (Ctrl D)">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Duplicate"
            onClick={duplicateSelection}
          >
            <Copy />
          </Button>
        </Tooltip>
        <Tooltip content="Delete (Del)">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Delete"
            onClick={deleteSelection}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </Tooltip>
      </div>
    </FieldGroup>
  );
}

function TextProperties({ element }: { element: TextElement }) {
  const { updateSelection } = useEditorActions();
  const familyId = useId();
  const weightId = useId();
  const contentId = useId();

  return (
    <FieldGroup title="Typography">
      <div className="flex flex-col gap-1">
        <Label htmlFor={contentId}>Content</Label>
        <Textarea
          id={contentId}
          value={element.text}
          rows={3}
          maxLength={LIMITS.maxTextLength}
          onChange={(event) => updateSelection({ text: event.target.value }, `text:${element.id}`)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={familyId}>Font</Label>
        <Select
          id={familyId}
          value={element.fontFamily}
          onChange={(event) => updateSelection({ fontFamily: event.target.value })}
        >
          {!FONT_FAMILIES.includes(element.fontFamily) && (
            <option value={element.fontFamily}>{element.fontFamily}</option>
          )}
          {FONT_FAMILIES.map((family) => (
            <option key={family} value={family} style={{ fontFamily: family }}>
              {family}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Size"
          value={element.fontSize}
          min={LIMITS.minFontSize}
          max={LIMITS.maxFontSize}
          precision={1}
          unit="px"
          onCommit={(fontSize) => updateSelection({ fontSize }, `fontSize:${element.id}`)}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={weightId}>Weight</Label>
          <Select
            id={weightId}
            value={element.fontWeight}
            onChange={(event) => updateSelection({ fontWeight: Number(event.target.value) })}
          >
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Alignment">
        {TEXT_ALIGNMENTS.map((alignment) => (
          <Tooltip key={alignment.value} content={alignment.label}>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={alignment.label}
              pressed={element.textAlign === alignment.value}
              onClick={() => updateSelection({ textAlign: alignment.value })}
            >
              {alignment.icon}
            </Button>
          </Tooltip>
        ))}
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Tooltip content="Italic">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Italic"
            pressed={element.fontStyle === 'italic'}
            onClick={() =>
              updateSelection({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })
            }
          >
            <Italic />
          </Button>
        </Tooltip>
        <Tooltip content="Underline">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Underline"
            pressed={element.underline}
            onClick={() => updateSelection({ underline: !element.underline })}
          >
            <Underline />
          </Button>
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Line height"
          value={element.lineHeight}
          min={0.5}
          max={5}
          step={0.1}
          precision={2}
          onCommit={(lineHeight) => updateSelection({ lineHeight }, `lineHeight:${element.id}`)}
        />
        <NumberField
          label="Letter spacing"
          value={element.letterSpacing}
          min={-100}
          max={1000}
          step={0.5}
          precision={1}
          unit="px"
          onCommit={(letterSpacing) =>
            updateSelection({ letterSpacing }, `letterSpacing:${element.id}`)
          }
        />
      </div>
      <ColorField
        label="Color"
        value={element.color}
        onCommit={(color) => updateSelection({ color }, `color:${element.id}`)}
      />
    </FieldGroup>
  );
}

function ImageProperties({ element }: { element: ImageElement }) {
  const { updateSelection } = useEditorActions();
  const asset = useEditor((state) => state.document.assets[element.assetId]);
  const fitId = useId();
  const current = IMAGE_FITS.find((fit) => fit.value === element.fit);

  return (
    <FieldGroup title="Crop & fit">
      <div className="flex flex-col gap-1">
        <Label htmlFor={fitId}>Fit</Label>
        <Select
          id={fitId}
          value={element.fit}
          onChange={(event) => updateSelection({ fit: event.target.value as ImageFit })}
        >
          {IMAGE_FITS.map((fit) => (
            <option key={fit.value} value={fit.value}>
              {fit.label}
            </option>
          ))}
        </Select>
        {current && <p className="text-[11px] text-muted-foreground">{current.description}</p>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">File</dt>
        <dd className="truncate" title={asset?.name}>
          {asset?.name ?? 'Unknown'}
        </dd>
        <dt className="text-muted-foreground">Original</dt>
        <dd>{asset ? `${asset.width}×${asset.height} px` : '—'}</dd>
      </dl>
    </FieldGroup>
  );
}

function ElementProperties({ element }: { element: DesignElement }) {
  const { updateSelection } = useEditorActions();
  const assets = useEditor((state) => state.document.assets);
  const key = (field: string) => `${field}:${element.id}`;
  const hasStroke = element.type === 'rect' || element.type === 'ellipse' || element.type === 'path';
  const stroke = hasStroke ? (element as { stroke?: { color: string; width: number } }).stroke : undefined;
  const [aspectLocked, setAspectLocked] = useState(false);
  const aspect = element.height !== 0 ? element.width / element.height : 1;

  return (
    <>
      <div className="px-3 py-4">
        <h2 className="text-sm font-semibold">{ELEMENT_TYPE_LABELS[element.type]}</h2>
        <p className="truncate text-xs text-muted-foreground" title={element.id}>
          {describeElement(element, assets)}
        </p>
      </div>
      <Separator />
      <FieldGroup title="Position & size">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="X"
            value={element.x}
            unit="px"
            min={-LIMITS.maxCoordinate}
            max={LIMITS.maxCoordinate}
            onCommit={(x) => updateSelection({ x }, key('x'))}
          />
          <NumberField
            label="Y"
            value={element.y}
            unit="px"
            min={-LIMITS.maxCoordinate}
            max={LIMITS.maxCoordinate}
            onCommit={(y) => updateSelection({ y }, key('y'))}
          />
          <NumberField
            label="Width"
            value={element.width}
            unit="px"
            min={LIMITS.minElementDimension}
            max={LIMITS.maxElementDimension}
            onCommit={(width) => {
              if (aspectLocked) {
                const newHeight = Math.round(width / aspect);
                updateSelection({ width, height: newHeight }, key('width'));
              } else {
                updateSelection({ width }, key('width'));
              }
            }}
          />
          <NumberField
            label="Height"
            value={element.height}
            unit="px"
            min={LIMITS.minElementDimension}
            max={LIMITS.maxElementDimension}
            disabled={element.type === 'text'}
            onCommit={(height) => {
              if (aspectLocked) {
                const newWidth = Math.round(height * aspect);
                updateSelection({ width: newWidth, height }, key('height'));
              } else {
                updateSelection({ height }, key('height'));
              }
            }}
          />
          <NumberField
            label="Rotation"
            value={element.rotation}
            unit="°"
            min={-360}
            max={360}
            precision={1}
            onCommit={(rotation) => updateSelection({ rotation }, key('rotation'))}
          />
          <NumberField
            label="Opacity"
            value={Math.round(element.opacity * 100)}
            unit="%"
            min={0}
            max={100}
            precision={0}
            onCommit={(percent) => updateSelection({ opacity: percent / 100 }, key('opacity'))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={aspectLocked ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={aspectLocked}
            onClick={() => setAspectLocked((v) => !v)}
            className="rounded-full gap-1.5"
          >
            {aspectLocked ? <Link className="size-3.5" /> : <Unlink className="size-3.5" />}
            {aspectLocked ? 'Aspect locked' : 'Lock aspect'}
          </Button>
          {aspectLocked ? <span className="text-xs text-muted-foreground">W/H stays proportional</span> : null}
        </div>
      </FieldGroup>
      {(element.type === 'rect' || element.type === 'ellipse' || element.type === 'path') && (
        <FieldGroup title={element.type === 'path' ? 'Stroke & fill' : 'Fill & stroke'}>
          {element.type !== 'path' && (
            <>
              <ColorField
                label={element.fill.type === 'none' ? 'Fill (none)' : 'Fill'}
                value={element.fill.type === 'solid' ? element.fill.color : '#ffffff'}
                onCommit={(color) => updateSelection({ fill: { type: 'solid', color } }, key('fill'))}
              />
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={element.fill.type === 'none'}
                  onChange={(event) =>
                    updateSelection({
                      fill: event.target.checked
                        ? { type: 'none' }
                        : { type: 'solid', color: '#4f46e5' },
                    })
                  }
                  className="accent-primary"
                />
                No fill
              </label>
            </>
          )}
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <ColorField
              label="Stroke"
              value={stroke?.color ?? '#111827'}
              disabled={!stroke && element.type !== 'path'}
              onCommit={(color) =>
                updateSelection({ stroke: { color, width: stroke?.width ?? 4 } }, key('stroke'))
              }
            />
            <NumberField
              label="Stroke width"
              value={stroke?.width ?? 0}
              min={0}
              max={LIMITS.maxStrokeWidth}
              unit="px"
              precision={1}
              className="w-24"
              onCommit={(width) =>
                element.type === 'path'
                  ? updateSelection({ stroke: { color: stroke?.color ?? '#111827', width: Math.max(1, width) } }, key('strokeWidth'))
                  : updateSelection(
                      width <= 0
                        ? { stroke: undefined }
                        : { stroke: { color: stroke?.color ?? '#111827', width } },
                      key('strokeWidth'),
                    )
              }
            />
          </div>
          {element.type === 'path' && (
            <ColorField
              label={element.fill.type === 'none' ? 'Fill (none)' : 'Fill'}
              value={element.fill.type === 'solid' ? element.fill.color : '#ffffff'}
              onCommit={(color) => updateSelection({ fill: { type: 'solid', color } }, key('fill'))}
            />
          )}
          {element.type === 'path' && (
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={(element as any).closed}
                onChange={(event) => updateSelection({ closed: event.target.checked } as any)}
                className="accent-primary"
              />
              Closed shape
            </label>
          )}
          {element.type === 'rect' && (
            <NumberField
              label="Corner radius"
              value={element.cornerRadius}
              min={0}
              max={LIMITS.maxElementDimension}
              unit="px"
              onCommit={(cornerRadius) => updateSelection({ cornerRadius }, key('cornerRadius'))}
            />
          )}
        </FieldGroup>
      )}
      {element.type === 'text' && <TextProperties element={element} />}
      {element.type === 'image' && <ImageProperties element={element} />}
      <AlignControls elements={[element]} />
      <ArrangeControls elements={[element]} />
    </>
  );
}

function MultiSelectionProperties({ elements }: { elements: DesignElement[] }) {
  const { updateSelection } = useEditorActions();
  const averageOpacity =
    elements.reduce((sum, element) => sum + element.opacity, 0) / elements.length;
  return (
    <>
      <div className="px-3 py-3">
        <h2 className="text-sm font-semibold">{elements.length} elements selected</h2>
        <p className="text-xs text-muted-foreground">
          Drag to move them together. Shared properties apply to every selected element.
        </p>
      </div>
      <Separator />
      <FieldGroup title="Appearance">
        <NumberField
          label="Opacity"
          value={Math.round(averageOpacity * 100)}
          unit="%"
          min={0}
          max={100}
          precision={0}
          onCommit={(percent) => updateSelection({ opacity: percent / 100 }, 'multi-opacity')}
        />
      </FieldGroup>
      <AlignControls elements={elements} />
      <ArrangeControls elements={elements} />
    </>
  );
}

export function PropertiesPanel() {
  const selected = useEditor(useShallow(selectSelectedElements));
  const single = selected.length === 1 ? selected[0] : undefined;

  return (
    <aside
      aria-label="Properties"
      className="flex h-full w-72 flex-col overflow-y-auto border-l border-border bg-panel"
    >
      {selected.length === 0 && <PageProperties />}
      {single && <ElementProperties key={single.id} element={single} />}
      {selected.length > 1 && <MultiSelectionProperties elements={selected} />}
    </aside>
  );
}
