import {
  findPage,
  solidFill,
  SUPPORTED_IMAGE_MIME_TYPES,
  type DesignElement,
} from '@opencanvas/document';
import { dataUrlToBlob } from '@opencanvas/storage';
import { Button, Label } from '@opencanvas/ui';
import { Check, ImagePlus, Pipette, Plus, Trash2, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import {
  extractPageColors,
  MAX_BRAND_COLORS,
  MAX_BRAND_LOGO_BYTES,
  planBrandFontApplication,
  type BrandFontPlan,
} from '../../brand/brandKit';
import { useBrandKit } from '../../brand/brandStore';
import { FONT_FAMILY_NAMES } from '../../fonts/catalog';
import { useEditorActions } from '../actions';
import { useImageImport } from '../assets/useImageImport';
import { useEditor, useNotificationStore } from '../hooks';
import { ColorField } from './fields';
import { PanelSection } from './PanelSection';

/** Element types a single brand color can restyle (fill for shapes/frames, color for text/icons). */
const COLOR_TARGET_TYPES = new Set(['rect', 'ellipse', 'frame', 'text', 'icon']);

function isText(element: DesignElement): boolean {
  return element.type === 'text';
}

/**
 * The local brand kit: a palette and a heading/body font pairing that persist in this browser
 * and follow the user across designs. Applying a color or font always goes through the normal
 * command pipeline, so every application is one undo step and nothing is uploaded anywhere.
 */
export function BrandPanel() {
  const document = useEditor((state) => state.document);
  const activePageId = useEditor((state) => state.activePageId);
  const selectedIds = useEditor((state) => state.selectedIds);
  const actions = useEditorActions();
  const notifications = useNotificationStore();
  const kit = useBrandKit((state) => state.kit);
  const addColor = useBrandKit((state) => state.addColor);
  const removeColor = useBrandKit((state) => state.removeColor);
  const setHeadingFont = useBrandKit((state) => state.setHeadingFont);
  const setBodyFont = useBrandKit((state) => state.setBodyFont);
  const setLogo = useBrandKit((state) => state.setLogo);
  const removeLogo = useBrandKit((state) => state.removeLogo);
  const { importFiles } = useImageImport();
  const [draftColor, setDraftColor] = useState('#6d45e8');
  const [pendingPlan, setPendingPlan] = useState<BrandFontPlan | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoInputId = useId();

  const page = findPage(document, activePageId);
  const selectedElements = (page?.elements ?? []).filter((element) =>
    selectedIds.includes(element.id),
  );
  const colorTargets = selectedElements.filter((element) => COLOR_TARGET_TYPES.has(element.type));
  const selectedText = selectedElements.filter(isText);

  const notify = (title: string, message: string) =>
    notifications.getState().show({ kind: 'info', title, message });

  const applyColor = (color: string) => {
    if (colorTargets.length === 0) {
      notify(
        'Select something first',
        'Select a shape, text, or icon on the canvas, then pick a brand color to apply it.',
      );
      return;
    }
    actions.updateSelection({ fill: solidFill(color), color });
  };

  const handleAddColor = () => {
    if (addColor(draftColor)) return;
    notify(
      'Color not added',
      kit.colors.includes(draftColor)
        ? `${draftColor} is already in your brand kit.`
        : `A brand kit holds up to ${MAX_BRAND_COLORS} colors. Remove one to add another.`,
    );
  };

  const handleCapturePageColors = () => {
    if (!page) return;
    let added = 0;
    for (const color of extractPageColors(page)) {
      if (addColor(color)) added += 1;
    }
    notify(
      added > 0 ? 'Colors added' : 'No new colors',
      added > 0
        ? `Added ${added} ${added === 1 ? 'color' : 'colors'} from this page to your brand kit.`
        : 'This page already matches your brand colors.',
    );
  };

  const handleFontChange = (which: 'heading' | 'body', fontFamily: string) => {
    if (which === 'heading') setHeadingFont(fontFamily);
    else setBodyFont(fontFamily);
    // A plan computed for the previous pairing no longer describes what will happen.
    setPendingPlan(null);
  };

  const applyFontToSelection = (fontFamily: string) => {
    actions.updateSelection({ fontFamily });
  };

  const handleConfirmFonts = () => {
    if (!pendingPlan) return;
    actions.replacePageElements(pendingPlan.elements);
    setPendingPlan(null);
    notify(
      'Brand fonts applied',
      'Headings and body text now use your brand fonts. Undo restores the previous fonts in one step.',
    );
  };

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!(SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      notify('Logo not added', 'Choose a PNG, JPG, GIF, or WebP image for your logo.');
      return;
    }
    if (file.size > MAX_BRAND_LOGO_BYTES) {
      notify(
        'Logo not added',
        `Logos are stored in this browser, so keep them under ${Math.round(MAX_BRAND_LOGO_BYTES / (1024 * 1024))} MB.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (setLogo({ dataUrl, name: file.name })) {
        notify('Logo saved', 'Your logo is ready to insert into any design.');
      } else {
        notify('Logo not added', 'This image could not be stored in your brand kit.');
      }
    };
    reader.onerror = () => {
      notify('Logo not added', 'This image could not be read.');
    };
    reader.readAsDataURL(file);
  };

  const handleInsertLogo = () => {
    const logo = kit.logo;
    if (!logo) return;
    const blob = dataUrlToBlob(logo.dataUrl);
    if (!blob) {
      notify('Logo unavailable', 'The stored logo could not be read back.');
      return;
    }
    void importFiles([new File([blob], logo.name, { type: blob.type })]);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Saved in this browser only — your kit is ready in every design, no account needed.
      </p>

      <PanelSection
        title="Brand colors"
        description={
          colorTargets.length > 0
            ? `Pick a color to apply it to the selected ${colorTargets.length === 1 ? 'element' : 'elements'}.`
            : 'Select a shape, text, or icon, then pick a color to apply it.'
        }
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Brand colors">
          {kit.colors.map((color) => (
            <span key={color} className="relative inline-flex">
              <button
                type="button"
                aria-label={`Apply brand color ${color} to selection`}
                title={`Apply ${color}`}
                onClick={() => applyColor(color)}
                className="size-9 rounded-lg border border-black/10 shadow-sm outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: color }}
              />
              <button
                type="button"
                aria-label={`Remove brand color ${color}`}
                onClick={() => removeColor(color)}
                className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-border bg-panel text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ))}
          {kit.colors.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No colors yet. Add one below, or capture the colors from this page.
            </p>
          ) : null}
        </div>

        <div className="flex items-end gap-2">
          <ColorField label="New color" value={draftColor} onCommit={setDraftColor} />
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 rounded-lg"
            onClick={handleAddColor}
          >
            <Plus aria-hidden="true" /> Add
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 justify-start rounded-lg px-2 text-xs"
          onClick={handleCapturePageColors}
        >
          <Pipette aria-hidden="true" /> Use colors from this page
        </Button>
      </PanelSection>

      <PanelSection
        title="Brand fonts"
        description="A heading and body pairing. Apply them to selected text, or to the whole page."
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="brand-heading-font">Heading font</Label>
          <select
            id="brand-heading-font"
            value={kit.headingFont}
            onChange={(event) => handleFontChange('heading', event.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ fontFamily: `"${kit.headingFont}"` }}
          >
            {FONT_FAMILY_NAMES.map((family) => (
              <option key={family} value={family} style={{ fontFamily: `"${family}"` }}>
                {family}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="brand-body-font">Body font</Label>
          <select
            id="brand-body-font"
            value={kit.bodyFont}
            onChange={(event) => handleFontChange('body', event.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ fontFamily: `"${kit.bodyFont}"` }}
          >
            {FONT_FAMILY_NAMES.map((family) => (
              <option key={family} value={family} style={{ fontFamily: `"${family}"` }}>
                {family}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5" aria-hidden="true">
          <p
            className="truncate text-base leading-snug"
            style={{ fontFamily: `"${kit.headingFont}"`, fontWeight: 600 }}
          >
            Headings look like this
          </p>
          <p
            className="mt-1 text-xs leading-relaxed text-muted-foreground"
            style={{ fontFamily: `"${kit.bodyFont}"` }}
          >
            And body text reads like this — clear at small sizes, in every design.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 rounded-lg text-xs"
            disabled={selectedText.length === 0}
            onClick={() => applyFontToSelection(kit.headingFont)}
          >
            Heading on selection
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 rounded-lg text-xs"
            disabled={selectedText.length === 0}
            onClick={() => applyFontToSelection(kit.bodyFont)}
          >
            Body on selection
          </Button>
        </div>

        {pendingPlan ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
            <p role="status" className="text-xs leading-relaxed">
              Largest text ({pendingPlan.headingCount}) becomes <strong>{kit.headingFont}</strong>;
              other text ({pendingPlan.bodyCount}) becomes <strong>{kit.bodyFont}</strong>. Photos,
              shapes, and colors won’t change.
              {pendingPlan.changedCount === 0 ? ' This page already uses your brand fonts.' : ''}
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                className="h-8 rounded-lg text-xs"
                disabled={pendingPlan.changedCount === 0}
                onClick={handleConfirmFonts}
              >
                <Check aria-hidden="true" /> Apply brand fonts
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => setPendingPlan(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="h-9 rounded-xl text-xs"
            disabled={!page || page.elements.length === 0}
            onClick={() => {
              if (!page) return;
              const plan = planBrandFontApplication(page.elements, kit);
              if (plan.textCount === 0) {
                notify('No text on this page', 'Add some text first, then apply your brand fonts.');
                return;
              }
              setPendingPlan(plan);
            }}
          >
            Apply fonts to this page…
          </Button>
        )}
      </PanelSection>

      <PanelSection
        title="Brand logo"
        description="One logo, ready to insert into every design. Stored in this browser only."
      >
        <input
          ref={logoInputRef}
          id={logoInputId}
          type="file"
          accept={SUPPORTED_IMAGE_MIME_TYPES.join(',')}
          className="sr-only"
          aria-label="Upload brand logo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset so choosing the same file again re-triggers the change event.
            event.target.value = '';
            handleLogoFile(file);
          }}
        />
        {kit.logo ? (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%)] bg-[length:12px_12px] bg-[position:0_0,6px_6px]">
                <img
                  src={kit.logo.dataUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  draggable={false}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" title={kit.logo.name}>
                  {kit.logo.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Saved in this browser
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove brand logo"
                onClick={removeLogo}
                className="shrink-0 rounded-lg"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-9 flex-1 rounded-xl text-xs"
                onClick={handleInsertLogo}
              >
                <ImagePlus aria-hidden="true" /> Insert logo into design
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl text-xs"
                onClick={() => logoInputRef.current?.click()}
              >
                Replace
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="outline"
            className="h-9 rounded-xl text-xs"
            onClick={() => logoInputRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" /> Upload a logo
          </Button>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          PNG, JPG, GIF, or WebP up to {Math.round(MAX_BRAND_LOGO_BYTES / (1024 * 1024))} MB.
          Inserting adds it to the current page as one undoable step.
        </p>
      </PanelSection>
    </div>
  );
}
