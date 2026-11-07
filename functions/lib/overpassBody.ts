export type OverpassBodyClassification =
  | { kind: 'ok' | 'empty' | 'partial'; elements: unknown[] }
  | { kind: 'error'; reason: string };

function remarkText(value: unknown): string {
  if (Array.isArray(value)) return value.map(item => String(item)).join(' ').trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function remarkReason(remark: string): string {
  const value = remark.toLowerCase();
  if (value.includes('timeout') || value.includes('timed out')) return 'overpass_remark_timeout';
  if (value.includes('out of memory') || value.includes('memory')) return 'overpass_remark_memory';
  if (value.includes('rate_limited') || value.includes('rate limited')) return 'overpass_remark_rate_limited';
  if (value.includes('runtime error')) return 'overpass_remark_runtime_error';
  return 'overpass_remark_unspecified';
}

/** Classifies Overpass JSON without depending on fetch, Workers, or Node APIs. */
export function classifyOverpassBody(data: unknown): OverpassBodyClassification {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { kind: 'error', reason: 'overpass_bad_body' };
  }
  const body = data as { elements?: unknown; remark?: unknown };
  if (!Array.isArray(body.elements)) return { kind: 'error', reason: 'overpass_bad_body' };

  const elements = body.elements;
  const remark = remarkText(body.remark);
  if (remark) {
    if (elements.length === 0) return { kind: 'error', reason: remarkReason(remark) };
    return { kind: 'partial', elements };
  }
  return elements.length === 0
    ? { kind: 'empty', elements }
    : { kind: 'ok', elements };
}
