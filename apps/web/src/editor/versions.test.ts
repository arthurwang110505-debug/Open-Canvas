import { createBlankDocument, createRectElement, type DesignDocument } from '@opencanvas/document';
import { beforeEach, describe, expect, it } from 'vitest';

import { deleteVersion, listVersions, MAX_SAVED_VERSIONS, saveVersion } from './versions';

const fixedDate = new Date('2026-10-21T09:30:00.000Z');

function fixture(id = 'doc_versions'): DesignDocument {
  const document = createBlankDocument({ id, name: 'Versions', now: fixedDate });
  document.pages[0]?.elements.push(createRectElement({ id: 'r1', x: 10, y: 10 }));
  return document;
}

describe('saved versions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and lists versions newest first', () => {
    const document = fixture();
    const first = saveVersion(document, 'First');
    expect(first).not.toBeNull();
    const second = saveVersion(document, 'Second');
    expect(second).not.toBeNull();

    const listed = listVersions(document.id);
    expect(listed.map((version) => version.name)).toEqual(['Second', 'First']);
    expect(listed[0]?.document.pages[0]?.elements).toHaveLength(1);
  });

  it('keeps versions separate per design', () => {
    saveVersion(fixture('doc_a'), 'A');
    saveVersion(fixture('doc_b'), 'B');
    expect(listVersions('doc_a').map((version) => version.name)).toEqual(['A']);
    expect(listVersions('doc_b').map((version) => version.name)).toEqual(['B']);
  });

  it('rejects empty names and enforces the cap', () => {
    const document = fixture();
    expect(saveVersion(document, '   ')).toBeNull();
    for (let index = 0; index < MAX_SAVED_VERSIONS; index += 1) {
      expect(saveVersion(document, `v${index}`)).not.toBeNull();
    }
    expect(saveVersion(document, 'one too many')).toBeNull();
    expect(listVersions(document.id)).toHaveLength(MAX_SAVED_VERSIONS);
  });

  it('deletes a version by id', () => {
    const document = fixture();
    const saved = saveVersion(document, 'Keep me');
    if (!saved) throw new Error('expected a saved version');
    expect(deleteVersion(document.id, saved.id)).toBe(true);
    expect(listVersions(document.id)).toEqual([]);
    expect(deleteVersion(document.id, saved.id)).toBe(false);
  });

  it('drops corrupt entries and snapshots of other designs', () => {
    const document = fixture();
    const saved = saveVersion(document, 'Good');
    if (!saved) throw new Error('expected a saved version');
    const key = `opencanvas:versions:${document.id}`;
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[];
    raw.push({ id: 'bad', name: 'Broken', createdAt: 'not-a-date', document: { nope: true } });
    raw.push({
      id: 'other',
      name: 'Other design',
      createdAt: new Date().toISOString(),
      document: fixture('doc_other'),
    });
    localStorage.setItem(key, JSON.stringify(raw));

    expect(listVersions(document.id).map((version) => version.name)).toEqual(['Good']);
  });
});
