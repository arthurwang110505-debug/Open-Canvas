/** Downloads through a temporary object URL and anchor; the browser shows its normal save UI. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously cancels the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
