import { LIMITS, SUPPORTED_IMAGE_MIME_TYPES, type ImageAsset } from '@opencanvas/document';
import { Button, Tooltip, cn } from '@opencanvas/ui';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { useShallow } from 'zustand/shallow';

import { useAssetUrl } from '../assets/useAssetServices';
import { useImageImport } from '../assets/useImageImport';
import { useEditor } from '../hooks';

const ACCEPT = SUPPORTED_IMAGE_MIME_TYPES.join(',');
const MAX_MB = Math.round(LIMITS.maxAssetBytes / (1024 * 1024));

function imageFiles(transfer: DataTransfer | null): File[] {
  if (!transfer) return [];
  return Array.from(transfer.files);
}

function AssetTile({ asset }: { asset: ImageAsset }) {
  const url = useAssetUrl(asset);
  const { insertAsset, removeAsset } = useImageImport();
  const label = asset.name ?? 'Image';
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => insertAsset(asset.id)}
        className="flex w-full flex-col overflow-hidden rounded-md border border-border bg-background text-left transition-colors outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Add ${label} to the page`}
      >
        <span className="grid aspect-square w-full place-items-center overflow-hidden bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="text-xs text-muted-foreground">Preview unavailable</span>
          )}
        </span>
        <span className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="truncate text-xs font-medium" title={label}>
            {label}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {asset.width}×{asset.height}
          </span>
        </span>
      </button>
      <Tooltip content="Remove upload">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={`Remove ${label}`}
          onClick={() => removeAsset(asset.id)}
          className="absolute top-1 right-1 size-7 bg-background/90 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 />
        </Button>
      </Tooltip>
    </li>
  );
}

export function UploadsPanel() {
  const assets = useEditor(
    useShallow((state) =>
      Object.values(state.document.assets).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    ),
  );
  const { importFiles, pending } = useImageImport();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void importFiles(imageFiles(event.dataTransfer));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-md border border-dashed p-4 text-center transition-colors',
          dragging ? 'border-ring bg-secondary' : 'border-border',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          aria-label="Upload images"
          onChange={(event) => {
            const files = event.target.files ? Array.from(event.target.files) : [];
            // Reset so choosing the same file again re-triggers the change event.
            event.target.value = '';
            void importFiles(files);
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={pending > 0} className="w-full">
          {pending > 0 ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {pending > 0 ? `Importing ${pending}…` : 'Upload image'}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          PNG, JPEG, WebP or GIF up to {MAX_MB} MB. You can also drop files onto the canvas.
        </p>
      </div>

      {assets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Uploaded images appear here so you can place them again.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2" aria-label="Uploaded images">
          {assets.map((asset) => (
            <AssetTile key={asset.id} asset={asset} />
          ))}
        </ul>
      )}
    </div>
  );
}
