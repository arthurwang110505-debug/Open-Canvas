import { useState } from 'react';
import { Button, Input } from '@opencanvas/ui';
import { Check, Copy, ExternalLink, MonitorPlay, Share2 } from 'lucide-react';
import type { DesignDocument } from '@opencanvas/document';
import { copyToClipboard, createShareLink } from './cloud';

interface Props {
  document: DesignDocument;
  onClose: () => void;
  onPresent: () => void;
}

export function ShareDialog({ document, onClose, onPresent }: Props) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    const { url } = createShareLink(document);
    setLink(url);
    setBusy(false);
    const ok = await copyToClipboard(url);
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share design"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Share2 className="size-5 text-primary" /> Share this design
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Anyone with the link can view a read-only copy. Your original stays in this browser.</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {!link ? (
            <Button onClick={() => void handleCreate()} disabled={busy} className="rounded-full">
              {busy ? 'Creating…' : 'Create share link'}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input readOnly value={link} className="flex-1 rounded-full bg-muted/50 text-xs" aria-label="Share link" />
                <Button variant="secondary" size="sm" className="shrink-0 rounded-full" onClick={() => void handleCopy()}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="flex items-center gap-1 text-xs text-emerald-700">
                <Check className="size-3.5" /> Link ready — share it like Canva.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => window.open(link, '_blank')}>
                  <ExternalLink className="size-4" /> Open preview
                </Button>
                <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={onPresent}>
                  <MonitorPlay className="size-4" /> Present
                </Button>
              </div>
            </>
          )}

          <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            Self-hosted: no account needed. Links are stored locally in this browser (IndexedDB + localStorage) and work across tabs. Deploy your own API to persist them server-side — see <code className="rounded bg-white px-1 py-0.5">apps/api</code> placeholder.
          </div>

          {!link ? (
            <Button variant="outline" className="rounded-full" onClick={onPresent}>
              <MonitorPlay className="size-4" /> Present fullscreen
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
