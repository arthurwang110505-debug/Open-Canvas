import type { ProjectSummary } from '@opencanvas/storage';

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Local, human-readable timestamp for a stored ISO date. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return timestampFormatter.format(date);
}

export function formatCanvasSize(summary: ProjectSummary): string {
  return `${summary.size.width} × ${summary.size.height} px`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function describeProjectContents(summary: ProjectSummary): string {
  return `${pluralize(summary.pageCount, 'page')} · ${pluralize(summary.elementCount, 'element')}`;
}
