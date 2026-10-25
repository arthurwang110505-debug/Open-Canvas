import {
  CANVAS_PRESETS,
  LIMITS,
  type DesignElement,
  type FrameElement,
  type FrameShape,
  type IconElement,
  type ImageElement,
  type ImageFit,
  type TextAlign,
  type TextElement,
  type TextTransform,
} from '@opencanvas/document';
import { canPanFramePhoto } from '@opencanvas/canvas-fabric';
import { getIcon } from '@opencanvas/icons';
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
  List,
  ListOrdered,
  Lock,
  LockOpen,
  Trash2,
  Underline,
  Unlink,
} from 'lucide-react';
import { useId, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { useEditorActions } from './actions';
import { useImageImport } from './assets/useImageImport';
import { describeElement, ELEMENT_TYPE_LABELS } from './elementLabels';
import { FONT_CATEGORIES, FONT_FAMILY_NAMES, fontWeightsFor } from '../fonts/catalog';
import { useEditor, useEditorStore } from './hooks';
import { ColorField, FieldGroup, NumberField } from './panels/fields';
import { GradientPicker } from './panels/GradientPicker';
import { IconPicker, IconPreview } from './panels/IconPicker';
import { PhotoPicker } from './panels/PhotoPicker';

/** Names for the weights the bundled families expose; anything else shows its number. */
const FONT_WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'Extra light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
  800: 'Extra bold',
  900: 'Black',
};

const TEXT_ALIGNMENTS: { value: TextAlign; label: string; icon: React.ReactNode }[] = [
  { value: 'left', label: 'Align left', icon: <AlignLeft /> },
  { value: 'center', label: 'Align center', icon: <AlignCenter /> },
  { value: 'right', label: 'Align right', icon: <AlignRight /> },
  { value: 'justify', label: 'Justify', icon: <AlignJustify /> },
];

const TEXT_CASES: { value: TextTransform; label: string }[] = [
  { value: 'none', label: 'As typed' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'capitalize', label: 'Capitalize Each Word' },
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
      <div className="px-4 py-3.5">
        <h2 className="text-[15px] font-semibold">Page</h2>
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
  const casingId = useId();

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
          style={{ fontFamily: `"${element.fontFamily}"` }}
          onChange={(event) => updateSelection({ fontFamily: event.target.value })}
        >
          {!FONT_FAMILY_NAMES.includes(element.fontFamily) && (
            <option value={element.fontFamily}>{element.fontFamily}</option>
          )}
          {FONT_CATEGORIES.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.families.map((font) => (
                <option
                  key={font.family}
                  value={font.family}
                  style={{ fontFamily: `"${font.family}", sans-serif` }}
                >
                  {font.family}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <p
          aria-hidden="true"
          data-testid="font-specimen"
          className="truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-base leading-tight text-foreground"
          style={{
            fontFamily: `"${element.fontFamily}"`,
            fontWeight: element.fontWeight,
            fontStyle: element.fontStyle,
          }}
        >
          Aa Bb Cc — The quick brown fox
        </p>
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
            {fontWeightsFor(element.fontFamily, element.fontWeight).map((weight) => (
              <option key={weight} value={weight}>
                {FONT_WEIGHT_LABELS[weight] ?? String(weight)}
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
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Tooltip content="Bulleted list">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Bulleted list"
            pressed={element.listStyle === 'bullet'}
            onClick={() =>
              updateSelection(
                { listStyle: element.listStyle === 'bullet' ? 'none' : 'bullet' },
                `listStyle:${element.id}`,
              )
            }
          >
            <List />
          </Button>
        </Tooltip>
        <Tooltip content="Numbered list">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Numbered list"
            pressed={element.listStyle === 'number'}
            onClick={() =>
              updateSelection(
                { listStyle: element.listStyle === 'number' ? 'none' : 'number' },
                `listStyle:${element.id}`,
              )
            }
          >
            <ListOrdered />
          </Button>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={casingId}>Casing</Label>
        <Select
          id={casingId}
          value={element.textTransform}
          onChange={(event) =>
            updateSelection(
              { textTransform: event.target.value as TextTransform },
              `textTransform:${element.id}`,
            )
          }
        >
          {TEXT_CASES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Changes how the text looks; your wording stays as typed.
        </p>
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

const FRAME_SHAPES: { value: FrameShape; label: string }[] = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'ellipse', label: 'Ellipse' },
];

/**
 * A frame is a mask with a photo in it. The panel keeps the two ideas apart: the mask (shape, fill)
 * always applies, the photo section only appears once there is something to photograph.
 */
function FrameProperties({ element }: { element: FrameElement }) {
  const { updateSelection } = useEditorActions();
  const { insertPhoto, importFiles } = useImageImport();
  const store = useEditorStore();
  const photoPanId = useEditor((state) => state.photoPanId);
  const shapeId = useId();
  const fitId = useId();
  const [picking, setPicking] = useState(false);
  const hasPhoto = element.assetId !== undefined;
  const asset = useEditor((state) =>
    element.assetId ? state.document.assets[element.assetId] : undefined,
  );
  // Offering the mode for a photo that already fills the mask would be a button that does nothing.
  const pannable = asset !== undefined && !element.locked && canPanFramePhoto(element, asset);
  const adjusting = photoPanId === element.id;

  return (
    <FieldGroup title="Shape & photo">
      <div className="flex flex-col gap-1">
        <Label htmlFor={shapeId}>Shape</Label>
        <Select
          id={shapeId}
          value={element.shape}
          onChange={(event) =>
            updateSelection({ shape: event.target.value as FrameShape }, `shape:${element.id}`)
          }
        >
          {FRAME_SHAPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      {element.shape === 'rect' && (
        <NumberField
          label="Corner radius"
          value={element.cornerRadius}
          min={0}
          max={LIMITS.maxElementDimension}
          unit="px"
          onCommit={(cornerRadius) =>
            updateSelection({ cornerRadius }, `cornerRadius:${element.id}`)
          }
        />
      )}
      <ColorField
        label="Fill"
        value={element.fill.type === 'solid' ? element.fill.color : '#e5e7eb'}
        onCommit={(color) =>
          updateSelection({ fill: { type: 'solid', color } }, `fill:${element.id}`)
        }
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">Photo</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPicking((open) => !open)}>
              {hasPhoto ? 'Replace photo' : 'Choose photo'}
            </Button>
            {hasPhoto && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateSelection({ assetId: undefined, crop: undefined }, `photo:${element.id}`)
                }
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        {picking && (
          <PhotoPicker
            label="Choose a photo"
            optionLabel={(title) => `Fill with ${title}`}
            onPick={(photoId) => {
              insertPhoto(photoId, { frameId: element.id });
              setPicking(false);
            }}
            onUpload={(files) => {
              void importFiles(files, { frameId: element.id });
              setPicking(false);
            }}
            uploadLabel="Upload a photo for this frame"
          />
        )}
        {hasPhoto && (
          <div className="flex flex-col gap-1">
            <Label htmlFor={fitId}>Photo fit</Label>
            <Select
              id={fitId}
              value={element.fit}
              onChange={(event) =>
                updateSelection({ fit: event.target.value as ImageFit }, `fit:${element.id}`)
              }
            >
              {IMAGE_FITS.map((fit) => (
                <option key={fit.value} value={fit.value}>
                  {fit.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        {pannable && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {adjusting
                ? 'Drag the photo on the canvas, or nudge it with the arrow keys.'
                : 'Move the photo inside its frame.'}
            </p>
            <Button
              variant={adjusting ? 'default' : 'outline'}
              size="sm"
              onClick={() => store.getState().setPhotoPan(adjusting ? null : element.id)}
            >
              {adjusting ? 'Done' : 'Adjust photo'}
            </Button>
          </div>
        )}
      </div>
    </FieldGroup>
  );
}

function IconProperties({ element }: { element: IconElement }) {
  const { updateSelection } = useEditorActions();
  const [picking, setPicking] = useState(false);
  const icon = getIcon(element.iconId);

  return (
    <FieldGroup title="Icon">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40">
          <IconPreview
            iconId={element.iconId}
            color={element.color}
            strokeWidth={2}
            className="size-5"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium capitalize">
            {element.iconId.replace(/-/g, ' ')}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {icon ? 'Vector icon' : 'Not in this version of OpenCanvas'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPicking((open) => !open)}>
          {picking ? 'Close' : 'Replace'}
        </Button>
      </div>
      {picking && (
        <IconPicker
          selectedId={element.iconId}
          onPick={(iconId) => {
            updateSelection({ iconId });
            setPicking(false);
          }}
        />
      )}
      <div className="flex flex-col gap-1">
        <NumberField
          label="Stroke width"
          value={element.strokeWidth}
          min={0.25}
          max={6}
          precision={2}
          onCommit={(strokeWidth) => updateSelection({ strokeWidth }, `strokeWidth:${element.id}`)}
        />
        <p className="text-[11px] text-muted-foreground">
          Measured on the icon&apos;s own 24-unit grid, so it scales with the box.
        </p>
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
  const { insertPhoto, importFiles } = useImageImport();
  const store = useEditorStore();
  const asset = useEditor((state) => state.document.assets[element.assetId]);
  const fitId = useId();
  const [replacing, setReplacing] = useState(false);
  const current = IMAGE_FITS.find((fit) => fit.value === element.fit);
  const filters = element.filters ?? { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
  const hasCrop = !!element.crop;
  const crop = element.crop;

  return (
    <>
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
        <div className="flex gap-1" role="group" aria-label="Flip">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={!!element.flipH}
            className="flex-1 rounded-full"
            onClick={() => updateSelection({ flipH: !element.flipH })}
          >
            ↔ Flip H
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={!!element.flipV}
            className="flex-1 rounded-full"
            onClick={() => updateSelection({ flipV: !element.flipV })}
          >
            ↕ Flip V
          </Button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">File</dt>
          <dd className="truncate" title={asset?.name}>
            {asset?.name ?? 'Unknown'}
          </dd>
          <dt className="text-muted-foreground">Original</dt>
          <dd>{asset ? `${asset.width}×${asset.height} px` : '—'}</dd>
        </dl>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={replacing}
          onClick={() => setReplacing((open) => !open)}
        >
          {replacing ? 'Close' : 'Replace image'}
        </Button>
        {replacing && (
          <PhotoPicker
            label="Replace with a photo"
            optionLabel={(title) => `Replace with ${title}`}
            onPick={(photoId) => {
              insertPhoto(photoId, { replaceId: element.id });
              setReplacing(false);
            }}
            onUpload={(files) => {
              void importFiles(files, { replaceId: element.id });
              setReplacing(false);
            }}
            uploadLabel="Upload a replacement image"
          />
        )}
      </FieldGroup>
      <FieldGroup title="Adjust">
        <NumberField
          label="Brightness"
          value={filters.brightness}
          min={0}
          max={300}
          precision={0}
          unit="%"
          onCommit={(v) =>
            updateSelection(
              { filters: { ...filters, brightness: v } },
              `filter-brightness:${element.id}`,
            )
          }
        />
        <NumberField
          label="Contrast"
          value={filters.contrast}
          min={0}
          max={300}
          precision={0}
          unit="%"
          onCommit={(v) =>
            updateSelection(
              { filters: { ...filters, contrast: v } },
              `filter-contrast:${element.id}`,
            )
          }
        />
        <NumberField
          label="Saturation"
          value={filters.saturate}
          min={0}
          max={300}
          precision={0}
          unit="%"
          onCommit={(v) =>
            updateSelection(
              { filters: { ...filters, saturate: v } },
              `filter-saturate:${element.id}`,
            )
          }
        />
        <NumberField
          label="Blur"
          value={filters.blur}
          min={0}
          max={32}
          precision={1}
          unit="px"
          onCommit={(v) =>
            updateSelection({ filters: { ...filters, blur: v } }, `filter-blur:${element.id}`)
          }
        />
        {filters.brightness !== 100 ||
        filters.contrast !== 100 ||
        filters.saturate !== 100 ||
        filters.blur !== 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() =>
              updateSelection({
                filters: { brightness: 100, contrast: 100, saturate: 100, blur: 0 },
              })
            }
          >
            Reset filters
          </Button>
        ) : null}
      </FieldGroup>
      <FieldGroup title="Crop">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => store.getState().beginCrop(element.id)}
        >
          Crop on canvas
        </Button>
        {hasCrop && crop ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X"
                value={Math.round(crop.x * 100)}
                min={0}
                max={95}
                unit="%"
                precision={0}
                onCommit={(v) => {
                  const nx = v / 100;
                  updateSelection({ crop: { ...crop, x: Math.min(nx, 1 - crop.width) } });
                }}
              />
              <NumberField
                label="Y"
                value={Math.round(crop.y * 100)}
                min={0}
                max={95}
                unit="%"
                precision={0}
                onCommit={(v) => {
                  const ny = v / 100;
                  updateSelection({ crop: { ...crop, y: Math.min(ny, 1 - crop.height) } });
                }}
              />
              <NumberField
                label="Width"
                value={Math.round(crop.width * 100)}
                min={5}
                max={100}
                unit="%"
                precision={0}
                onCommit={(v) => {
                  const w = v / 100;
                  updateSelection({ crop: { ...crop, width: w, x: Math.min(crop.x, 1 - w) } });
                }}
              />
              <NumberField
                label="Height"
                value={Math.round(crop.height * 100)}
                min={5}
                max={100}
                unit="%"
                precision={0}
                onCommit={(v) => {
                  const h = v / 100;
                  updateSelection({ crop: { ...crop, height: h, y: Math.min(crop.y, 1 - h) } });
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full"
                onClick={() => updateSelection({ crop: undefined })}
              >
                Reset crop
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-full"
                onClick={() =>
                  updateSelection({ crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } })
                }
              >
                Center 80%
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              No crop — showing full image. Crop selects a sub-rectangle of the source (0–100%).
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => updateSelection({ crop: { x: 0, y: 0, width: 1, height: 1 } })}
            >
              Enable crop
            </Button>
          </div>
        )}
      </FieldGroup>
    </>
  );
}

function ElementProperties({ element }: { element: DesignElement }) {
  const { updateSelection } = useEditorActions();
  const assets = useEditor((state) => state.document.assets);
  const key = (field: string) => `${field}:${element.id}`;
  const hasStroke =
    element.type === 'rect' || element.type === 'ellipse' || element.type === 'path';
  const stroke = hasStroke
    ? (element as { stroke?: { color: string; width: number } }).stroke
    : undefined;
  const [aspectLocked, setAspectLocked] = useState(false);
  const [gradientOpen, setGradientOpen] = useState(false);
  const aspect = element.height !== 0 ? element.width / element.height : 1;

  return (
    <>
      <div className="px-4 py-3.5">
        <h2 className="text-[15px] font-semibold">{ELEMENT_TYPE_LABELS[element.type]}</h2>
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
          {aspectLocked ? (
            <span className="text-xs text-muted-foreground">W/H stays proportional</span>
          ) : null}
        </div>
      </FieldGroup>
      {(element.type === 'rect' || element.type === 'ellipse' || element.type === 'path') && (
        <FieldGroup title={element.type === 'path' ? 'Stroke & fill' : 'Fill & stroke'}>
          {element.type !== 'path' && (
            <>
              <ColorField
                label={
                  element.fill.type === 'none'
                    ? 'Fill (none)'
                    : element.fill.type === 'solid'
                      ? 'Fill'
                      : 'Fill (gradient)'
                }
                value={element.fill.type === 'solid' ? element.fill.color : '#ffffff'}
                onCommit={(color) =>
                  updateSelection({ fill: { type: 'solid', color } }, key('fill'))
                }
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
                  ? updateSelection(
                      { stroke: { color: stroke?.color ?? '#111827', width: Math.max(1, width) } },
                      key('strokeWidth'),
                    )
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
              label={
                element.fill.type === 'none'
                  ? 'Fill (none)'
                  : element.fill.type === 'solid'
                    ? 'Fill'
                    : 'Fill (gradient)'
              }
              value={element.fill.type === 'solid' ? element.fill.color : '#ffffff'}
              onCommit={(color) => updateSelection({ fill: { type: 'solid', color } }, key('fill'))}
            />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant={gradientOpen ? 'secondary' : 'outline'}
              size="sm"
              aria-expanded={gradientOpen}
              onClick={() => setGradientOpen((open) => !open)}
              className="rounded-full"
            >
              Gradient
            </Button>
            <span className="text-xs text-muted-foreground">
              {element.fill.type === 'linear' || element.fill.type === 'radial'
                ? 'Gradient applied'
                : 'Pick a preset'}
            </span>
          </div>
          {gradientOpen ? (
            <GradientPicker
              value={element.fill}
              onPick={(fill, mergeKey) => updateSelection({ fill }, mergeKey ?? key('fill'))}
            />
          ) : null}
          {element.type === 'path' && (
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={element.closed}
                onChange={(event) => updateSelection({ closed: event.target.checked })}
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
      {element.type === 'icon' && <IconProperties element={element} />}
      {element.type === 'frame' && <FrameProperties element={element} />}
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
        <h2 className="text-[15px] font-semibold">{elements.length} elements selected</h2>
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

export function PagePropertiesPanel() {
  return (
    <aside aria-label="Page properties" className="flex min-h-full flex-col bg-panel">
      <PageProperties />
    </aside>
  );
}

export function PropertiesPanel() {
  const selected = useEditor(useShallow(selectSelectedElements));
  const single = selected.length === 1 ? selected[0] : undefined;

  return (
    <aside aria-label="Properties" className="flex min-h-full min-w-0 flex-col bg-panel">
      {selected.length === 0 ? (
        <div className="px-4 py-5">
          <h2 className="text-[15px] font-semibold">Nothing selected</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Select an element on the page to edit its size, appearance, typography, and position.
          </p>
        </div>
      ) : null}
      {single && <ElementProperties key={single.id} element={single} />}
      {selected.length > 1 && <MultiSelectionProperties elements={selected} />}
    </aside>
  );
}
