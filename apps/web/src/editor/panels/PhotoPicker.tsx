import { SUPPORTED_IMAGE_MIME_TYPES } from '@opencanvas/document';
import { Button } from '@opencanvas/ui';
import { ImagePlus } from 'lucide-react';
import { useId, useRef } from 'react';

import { BUNDLED_PHOTOS } from '../../assets/photos/catalog';

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
}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

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
    </div>
  );
}
