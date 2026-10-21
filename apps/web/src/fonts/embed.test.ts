import { describe, expect, it, vi } from 'vitest';

import { bytesToBase64, resolveFontFaces, type FontFileLoader } from './embed';

const bytes = (...values: number[]) => new Uint8Array(values);
const okLoader =
  (value = bytes(65, 65, 65, 65)): FontFileLoader =>
  () =>
    Promise.resolve(value);

describe('bytesToBase64', () => {
  it('encodes without overflowing on large inputs', () => {
    const encoded = bytesToBase64(new Uint8Array(70_000).fill(65));
    expect(encoded.startsWith('QUFB')).toBe(true);
    expect(encoded.length % 4).toBe(0);
  });
});

describe('resolveFontFaces', () => {
  it('embeds a bundled variable family with its real weight range', async () => {
    const faces = await resolveFontFaces(
      [{ family: 'Inter', weight: 500, style: 'normal' }],
      okLoader(),
    );
    expect(faces).toEqual([
      { family: 'Inter', weight: '100 900', style: 'normal', data: 'QUFBQQ==' },
    ]);
  });

  it('picks the nearest static weight', async () => {
    const faces = await resolveFontFaces(
      [{ family: 'Libre Baskerville', weight: 600, style: 'normal' }],
      okLoader(),
    );
    expect(faces).toHaveLength(1);
    expect(faces[0]?.weight).toBe('700');
  });

  it('falls back to the upright face for a family without italics', async () => {
    const faces = await resolveFontFaces(
      [{ family: 'Space Grotesk', weight: 400, style: 'italic' }],
      okLoader(),
    );
    expect(faces[0]?.style).toBe('normal');
  });

  it('embeds one face per style and skips duplicates', async () => {
    const load = vi.fn(okLoader());
    const faces = await resolveFontFaces(
      [
        { family: 'Fraunces', weight: 400, style: 'normal' },
        { family: 'Fraunces', weight: 700, style: 'normal' },
        { family: 'Fraunces', weight: 400, style: 'italic' },
      ],
      load,
    );
    expect(faces.map((face) => face.style)).toEqual(['normal', 'italic']);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('leaves families it does not bundle alone', async () => {
    const load = vi.fn(okLoader());
    const faces = await resolveFontFaces(
      [{ family: 'Georgia', weight: 400, style: 'normal' }],
      load,
    );
    expect(faces).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('names the family when its file cannot be read', async () => {
    const failing: FontFileLoader = () => Promise.reject(new Error('HTTP 404'));
    await expect(
      resolveFontFaces([{ family: 'Caveat', weight: 400, style: 'normal' }], failing),
    ).rejects.toThrow('The font "Caveat" could not be embedded: HTTP 404');
  });
});
