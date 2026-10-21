import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from './constants';
import { createBlankDocument } from './factories';
import { MIGRATIONS, migrateDocument, readSchemaVersion, type Migration } from './migrations';
import { parseDocument } from './serialization';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');

/** A fake chain used to exercise the pipeline; the real registry is empty for v1. */
const addTags: Migration = {
  from: 1,
  to: 2,
  description: 'add tags',
  migrate: (raw) => ({ ...raw, tags: [] }),
};
const renameTags: Migration = {
  from: 2,
  to: 3,
  description: 'rename tags to labels',
  migrate: (raw) => {
    const { tags, ...rest } = raw;
    return { ...rest, labels: tags };
  },
};
const fakeRegistry: Migration[] = [addTags, renameTags];

describe('readSchemaVersion', () => {
  it('returns integer versions only', () => {
    expect(readSchemaVersion({ schemaVersion: 3 })).toBe(3);
    expect(readSchemaVersion({ schemaVersion: '3' })).toBeUndefined();
    expect(readSchemaVersion({ schemaVersion: 1.5 })).toBeUndefined();
    expect(readSchemaVersion(null)).toBeUndefined();
    expect(readSchemaVersion([])).toBeUndefined();
  });
});

describe('migrateDocument', () => {
  it('is a no-op for current documents', () => {
    const doc = createBlankDocument({ now: fixedDate });
    const result = migrateDocument(doc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document).toEqual(doc);
      expect(result.value.appliedMigrations).toHaveLength(0);
    }
  });

  it('applies every step in order and stamps the final version', () => {
    const result = migrateDocument(
      { schemaVersion: 1, name: 'x' },
      { registry: fakeRegistry, targetVersion: 3 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.document).toEqual({ schemaVersion: 3, name: 'x', labels: [] });
      expect(result.value.appliedMigrations.map((m) => m.to)).toEqual([2, 3]);
      expect(result.value.fromVersion).toBe(1);
    }
  });

  it('fails explicitly when a step is missing', () => {
    const result = migrateDocument(
      { schemaVersion: 1 },
      { registry: [renameTags], targetVersion: 3 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('missing-migration');
  });

  it('surfaces exceptions thrown by a migration', () => {
    const exploding: Migration = {
      from: 1,
      to: 2,
      description: 'explode',
      migrate: () => {
        throw new Error('boom');
      },
    };
    const result = migrateDocument(
      { schemaVersion: 1 },
      { registry: [exploding], targetVersion: 2 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('migration-failed');
      expect(result.error.message).toContain('boom');
    }
  });

  it('rejects versions newer than the target', () => {
    const result = migrateDocument({ schemaVersion: 9 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unsupported-version');
  });

  it('rejects versions below 1', () => {
    const result = migrateDocument({ schemaVersion: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unsupported-version');
  });
});

describe('registry integrity', () => {
  it('forms a contiguous chain ending at the current version', () => {
    let expected = 1;
    for (const migration of MIGRATIONS) {
      expect(migration.from).toBe(expected);
      expect(migration.to).toBe(expected + 1);
      expected += 1;
    }
    expect(expected).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('upgrades the v4 fixture to exactly the committed v5 fixture', () => {
    const read = (name: string): Record<string, unknown> =>
      JSON.parse(
        readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8'),
      ) as Record<string, unknown>;
    const before = read('schema-v4.json');
    // The pair is the contract: a v4 document opened today must produce this exact v5 document.
    // Regenerate schema-v5.json only when a migration deliberately changes existing content.
    const result = migrateDocument(before);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.document).toEqual(read('schema-v5.json'));
    expect(result.value.appliedMigrations.map((step) => step.from)).toEqual([4]);

    // And the migrated document passes the same validation a stored one does.
    const parsed = parseDocument(result.value.document);
    expect(parsed.ok).toBe(true);
  });

  it('is used by parseDocument so migrated files are validated', () => {
    const doc = createBlankDocument({ now: fixedDate });
    const result = parseDocument(doc, { registry: MIGRATIONS });
    expect(result.ok).toBe(true);
  });
});
