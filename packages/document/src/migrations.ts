import { CURRENT_SCHEMA_VERSION } from './constants';
import { err, ok, type Result } from './result';

/**
 * A migration upgrades a raw (not yet validated) document from `from` to `to = from + 1`.
 * Migrations operate on `unknown` data on purpose: older shapes no longer have TypeScript
 * types, so each step must defensively inspect what it receives.
 */
export interface Migration {
  from: number;
  to: number;
  description: string;
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>;
}

export interface MigrationError {
  code: 'unsupported-version' | 'missing-migration' | 'migration-failed';
  message: string;
  fromVersion: number;
  targetVersion: number;
}

/**
 * Registry of schema migrations, ordered by `from`. Version 1 is the first public format,
 * so the registry is empty today; new entries are appended whenever `CURRENT_SCHEMA_VERSION` bumps.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    to: 2,
    description: 'Add group element (children stored relative to group origin)',
    migrate: (raw) => ({ ...raw }),
  },
  {
    from: 2,
    to: 3,
    description: 'Add path element for freehand drawing',
    migrate: (raw) => ({ ...raw }),
  },
  {
    from: 3,
    to: 4,
    description: 'Add image flip, filters and crop',
    migrate: (raw) => ({ ...raw }),
  },
  {
    from: 4,
    to: 5,
    description: 'Add icon element',
    // Purely additive: existing elements are valid unchanged, and a document that has no icons
    // looks the same in both versions. The bump exists so an older build rejects a document
    // containing an icon it cannot draw instead of rendering it as a blank space.
    migrate: (raw) => ({ ...raw }),
  },
  {
    from: 5,
    to: 6,
    description: 'Add linear and radial gradient fills',
    // Purely additive: every existing solid/none fill stays valid, and a page background is a
    // Fill, so old documents need no rewriting. The bump makes an older build reject a document
    // with a gradient instead of painting a blank rectangle.
    migrate: (raw) => ({ ...raw }),
  },
];

export interface MigrateOptions {
  registry?: readonly Migration[];
  targetVersion?: number;
}

export interface MigrationOutcome {
  document: Record<string, unknown>;
  fromVersion: number;
  appliedMigrations: readonly Migration[];
}

export function readSchemaVersion(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const version = (raw as Record<string, unknown>)['schemaVersion'];
  return typeof version === 'number' && Number.isInteger(version) ? version : undefined;
}

/**
 * Upgrades `raw` step by step until it reaches `targetVersion`. Documents produced by a newer
 * application version are rejected rather than guessed at.
 */
export function migrateDocument(
  raw: Record<string, unknown>,
  options: MigrateOptions = {},
): Result<MigrationOutcome, MigrationError> {
  const registry = options.registry ?? MIGRATIONS;
  const targetVersion = options.targetVersion ?? CURRENT_SCHEMA_VERSION;
  const fromVersion = readSchemaVersion(raw);

  if (fromVersion === undefined) {
    return err({
      code: 'unsupported-version',
      message: 'Document has no integer "schemaVersion" field.',
      fromVersion: Number.NaN,
      targetVersion,
    });
  }
  if (fromVersion > targetVersion) {
    return err({
      code: 'unsupported-version',
      message: `Document schema version ${fromVersion} is newer than the supported version ${targetVersion}. Update OpenCanvas to open it.`,
      fromVersion,
      targetVersion,
    });
  }
  if (fromVersion < 1) {
    return err({
      code: 'unsupported-version',
      message: `Document schema version ${fromVersion} is not supported.`,
      fromVersion,
      targetVersion,
    });
  }

  let current = raw;
  let version = fromVersion;
  const applied: Migration[] = [];

  while (version < targetVersion) {
    const step = registry.find((m) => m.from === version);
    if (!step) {
      return err({
        code: 'missing-migration',
        message: `No migration registered from schema version ${version} to ${version + 1}.`,
        fromVersion,
        targetVersion,
      });
    }
    if (step.to !== version + 1) {
      return err({
        code: 'missing-migration',
        message: `Migration from ${step.from} must target ${version + 1}, got ${step.to}.`,
        fromVersion,
        targetVersion,
      });
    }
    try {
      current = { ...step.migrate(current), schemaVersion: step.to };
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      return err({
        code: 'migration-failed',
        message: `Migration ${step.from} -> ${step.to} (${step.description}) failed: ${detail}`,
        fromVersion,
        targetVersion,
      });
    }
    applied.push(step);
    version = step.to;
  }

  return ok({ document: current, fromVersion, appliedMigrations: applied });
}
