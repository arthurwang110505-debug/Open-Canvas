import { DocumentSchema, type DesignDocument } from './schema';
import { migrateDocument, readSchemaVersion, type MigrateOptions } from './migrations';
import { err, ok, type Result } from './result';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface DocumentParseError {
  code:
    | 'invalid-json'
    | 'invalid-structure'
    | 'unsupported-version'
    | 'missing-migration'
    | 'migration-failed'
    | 'invalid-document';
  message: string;
  issues?: ValidationIssue[];
}

export interface ParsedDocument {
  document: DesignDocument;
  /** Schema version the input was stored with (before migrations). */
  sourceVersion: number;
  migrated: boolean;
}

const MAX_ISSUES_REPORTED = 20;

/** Validates an in-memory object that already claims to be a current-version document. */
export function validateDocument(input: unknown): Result<DesignDocument, DocumentParseError> {
  const parsed = DocumentSchema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  const issues = parsed.error.issues.slice(0, MAX_ISSUES_REPORTED).map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }));
  const first = issues[0];
  return err({
    code: 'invalid-document',
    message: first
      ? `Invalid document: ${first.path}: ${first.message}`
      : 'Invalid document structure.',
    issues,
  });
}

/**
 * Parses a document from a JSON string or an already-decoded value, migrating older
 * schema versions and validating the result. Never throws for malformed input.
 */
export function parseDocument(
  input: unknown,
  options: MigrateOptions = {},
): Result<ParsedDocument, DocumentParseError> {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      return err({ code: 'invalid-json', message: `The file is not valid JSON: ${detail}` });
    }
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return err({ code: 'invalid-structure', message: 'Expected a JSON object at the top level.' });
  }

  const sourceVersion = readSchemaVersion(raw);
  if (sourceVersion === undefined) {
    return err({
      code: 'invalid-structure',
      message: 'The document is missing an integer "schemaVersion" field.',
    });
  }

  const migrated = migrateDocument(raw as Record<string, unknown>, options);
  if (!migrated.ok) {
    return err({ code: migrated.error.code, message: migrated.error.message });
  }

  const validated = validateDocument(migrated.value.document);
  if (!validated.ok) return validated;

  return ok({
    document: validated.value,
    sourceVersion,
    migrated: migrated.value.appliedMigrations.length > 0,
  });
}

export interface SerializeOptions {
  pretty?: boolean;
}

/** Serializes a document to its canonical JSON representation. */
export function serializeDocument(document: DesignDocument, options: SerializeOptions = {}): string {
  return JSON.stringify(document, null, options.pretty ? 2 : undefined);
}

/** Structural deep clone that keeps the document plain and JSON-safe. */
export function cloneDocument(document: DesignDocument): DesignDocument {
  return structuredClone(document);
}
