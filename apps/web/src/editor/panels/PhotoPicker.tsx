import { SUPPORTED_IMAGE_MIME_TYPES } from '@opencanvas/document';
import { Button } from '@opencanvas/ui';
import { ImagePlus, Link2, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { BUNDLED_PHOTOS } from '../../assets/photos/catalog';
import { forgetPhotoUrl, listPhotoUrls } from '../../assets/photoUrls';

export interface PhotoPickerProps {
  /** Accessible name of the grid, e.g. "Choose a photo". */
  label: string;
  /** Accessible name of one option, given the photo's title. */
  optionLabel: (title: string) => string;
  onPick: (photoId: string) => void;
  /** Offers "Upload a photo" instead of the bundled library only. */
  onUpload?: (files: File[]) => void;
  /** Accessible name of the upload button; ignored without `onUpload`. */
  uploadLabel?: string;
  /** Imports an image from a web URL; enables the link field and remembered links. */
  onImportUrl?: (url: string) => void;
}

/**
 * The bundled photo library as a picker grid. Frames use it to choose their picture and images
 * use it to swap theirs, so both offer the same library and the same CC0 licence.
 *
 * Uploading is part of the same control: "replace this photo" must accept a file, not just the
 * photos that ship with the editor.
 */
export function PhotoPicker({
  label,
  optionLabel,
  onPick,
  onUpload,
  uploadLabel = 'Upload a photo',
  onImportUrl,
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const urlInputId = useId();
  const [url, setUrl] = useState('');
  const [remembered, setRemembered] = useState<string[]>(() => listPhotoUrls());

  const submitUrl = () => {
    const trimmed = url.trim();
    if (!trimmed || !onImportUrl) return;
    onImportUrl(trimmed);
    setUrl('');
    // The import remembers the URL asynchronously; refresh shortly after.
    window.setTimeout(() => setRemembered(listPhotoUrls()), 0);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5" role="listbox" aria-label={label}>
        {BUNDLED_PHOTOS.map((photo) => (
          <button
            key={photo.id}
            type="button"
            role="option"
            aria-selected={false}
            aria-label={optionLabel(photo.title)}
            onClick={() => onPick(photo.id)}
            className="aspect-[4/3] overflow-hidden rounded-lg border border-border hover:border-primary/50"
          >
            <img
              src={photo.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
      {onUpload && (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={SUPPORTED_IMAGE_MIME_TYPES.join(',')}
            className="sr-only"
            aria-label={uploadLabel}
            onChange={(event) => {
              const files = event.target.files ? Array.from(event.target.files) : [];
              // Reset so choosing the same file again re-triggers the change event.
              event.target.value = '';
              if (files.length > 0) onUpload(files);
            }}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <ImagePlus />
            Upload from your computer
          </Button>
        </>
      )}
      {onImportUrl && (
        <>
          <div className="flex gap-1.5">
            <label htmlFor={urlInputId} className="sr-only">
              Image URL
            </label>
            <input
              id={urlInputId}
              type="url"
              value={url}
              placeholder="Paste an image link…"
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitUrl();
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={submitUrl}>
              <Link2 aria-hidden="true" /> Add
            </Button>
          </div>
          {remembered.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">From a link</p>
              <div
                className="grid grid-cols-3 gap-1.5"
                role="listbox"
                aria-label="Photos from links"
              >
                {remembered.map((entry) => (
                  <span key={entry} className="group relative">
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      aria-label={optionLabel(entry)}
                      title={entry}
                      onClick={() => onImportUrl(entry)}
                      className="block aspect-[4/3] w-full overflow-hidden rounded-lg border border-border hover:border-primary/50"
                    >
                      <img
                        src={entry}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={`Forget link ${entry}`}
                      onClick={() => setRemembered(forgetPhotoUrl(entry))}
                      className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [&_svg]:size-3"
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
