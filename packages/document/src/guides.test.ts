import { describe, expect, it } from 'vitest';

import { createBlankDocument } from './factories';
import { DocumentSchema } from './schema';

describe('page guides', () => {
  it('defaults guides on older additive page data without a schema migration', () => {
    const document = createBlankDocument({ id: 'doc' });
    const raw = structuredClone(document) as unknown as {
      pages: { guides?: unknown }[];
    };
    delete raw.pages[0]?.guides;

    const parsed = DocumentSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.pages[0]?.guides).toEqual([]);
  });

  it('rejects duplicate guide ids on a page', () => {
    const document = createBlankDocument({ id: 'doc' });
    const page = document.pages[0];
    if (!page) throw new Error('missing page');
    const guide = { id: 'guide', axis: 'vertical' as const, position: 20, kind: 'margin' as const };
    const result = DocumentSchema.safeParse({
      ...document,
      pages: [{ ...page, guides: [guide, { ...guide, position: 40 }] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes('Duplicate guide id')),
      ).toBe(true);
    }
  });
});
