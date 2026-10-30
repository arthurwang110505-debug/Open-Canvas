import { Button, Dialog, Input } from '@opencanvas/ui';
import { Check, Copy, ExternalLink, FileDown, MonitorPlay, Share2, X } from 'lucide-react';
import { useState } from 'react';
import type { DesignDocument } from '@opencanvas/document';
import { copyToClipboard, createShareLink } from './cloud';

interface Props {
  document: DesignDocument;
  onClose: () => void;
  onPresent: () => void;
}

/**
 * Sharing is deliberately described for what it is: the link opens a copy that lives in this
 * browser. Designs travel to other machines as exported files. No button here claims more than
 * it can do — the share link is real, it is just local to this device.
 */
export function ShareDialog({ document, onClose, onPresent }: Props) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    const created = createShareLink(document);
    if (!created.ok) {
      setError(created.error.message);
      setBusy(false);
      return;
    }
    setLink(created.value.url);
    setBusy(false);
    const ok = await copyToClipboard(created.value.url);
    setCopied(ok);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopy = async () => {
    if (!link) return;
    const ok = await copyToClipboard(link);
    setCopied(ok);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      labelledBy="share-dialog-title"
      describedBy="share-dialog-description"
      onClose={onClose}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="share-dialog-title" className="flex items-center gap-2 text-lg font-semibold">
              <Share2 className="size-5 text-primary" /> Share this design
            </h2>
            <p
              id="share-dialog-description"
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
            >
              View links open a read-only copy stored in this browser. Nothing is uploaded.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onClose}
            aria-label="Close share dialog"
          >
            <X />
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-xs leading-relaxed text-destructive"
            >
              {error}
            </p>
          ) : null}
          {!link ? (
            <Button onClick={() => void handleCreate()} disabled={busy} className="rounded-full">
              {busy ? 'Creating…' : 'Create view link'}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={link}
                  className="min-w-0 flex-1 rounded-full bg-muted/50 text-xs"
                  aria-label="Share link"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 rounded-full"
                  onClick={() => void handleCopy()}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="flex items-center gap-1 text-xs text-emerald-700">
                <Check className="size-3.5" />
                Link ready — it works in this browser and its tabs.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-full"
                  onClick={() => window.open(link, '_blank')}
                >
                  <ExternalLink className="size-4" /> Open preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-full"
                  onClick={onPresent}
                >
                  <MonitorPlay className="size-4" /> Present
                </Button>
              </div>
            </>
          )}

          <div className="rounded-xl bg-muted/60 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <FileDown className="size-3.5" /> Sending it to someone else?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              View links do not travel between devices. Use <strong>Download</strong> to export a
              PNG, SVG or PDF, or export the design file from the dashboard — those open anywhere.
            </p>
          </div>

          {!link ? (
            <Button variant="outline" className="rounded-full" onClick={onPresent}>
              <MonitorPlay className="size-4" /> Present fullscreen
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
