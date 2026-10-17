import { describe, expect, it } from 'vitest';

import { blobToDataUrl, dataUrlToBlob, parseDataUrl } from './dataUrl';

describe('data URLs', () => {
  it('round-trips blob bytes through a base64 data URL', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 250, 0, 128])], { type: 'image/png' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const restored = dataUrlToBlob(dataUrl);
    if (!restored) throw new Error('expected a blob');
    expect(restored).toBeInstanceOf(Blob);
    expect(restored.type).toBe('image/png');
    expect(restored.size).toBe(blob.size);
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(
      new Uint8Array(await blob.arrayBuffer()),
    );
  });

  it('handles payloads larger than one base64 chunk boundary', async () => {
    const bytes = new Uint8Array(0x8000 + 17);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
    const dataUrl = await blobToDataUrl(new Blob([bytes], { type: 'application/octet-stream' }));
    const restored = dataUrlToBlob(dataUrl);
    if (!restored) throw new Error('expected a blob');
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(bytes);
  });

  it('falls back to a generic mime type when the blob has none', async () => {
    const dataUrl = await blobToDataUrl(new Blob(['hi']));
    expect(dataUrl.startsWith('data:application/octet-stream;base64,')).toBe(true);
  });

  it('parses only base64 data URLs', () => {
    expect(parseDataUrl('data:text/plain;base64,aGk=')).toEqual({
      mimeType: 'text/plain',
      bytes: new Uint8Array([104, 105]),
    });
    expect(parseDataUrl('data:text/plain,hello')).toBeUndefined();
    expect(parseDataUrl('https://example.com/a.png')).toBeUndefined();
    expect(parseDataUrl('blob:https://example.com/1')).toBeUndefined();
    expect(dataUrlToBlob('data:text/plain,hello')).toBeUndefined();
  });
});
