import { customAlphabet } from 'nanoid';

// URL-safe alphabet restricted to characters accepted by `IdSchema`.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(ALPHABET, 16);

/** Generates a stable, URL-safe identifier for documents, pages and elements. */
export function generateId(prefix?: string): string {
  const id = nanoid();
  return prefix ? `${prefix}_${id}` : id;
}
