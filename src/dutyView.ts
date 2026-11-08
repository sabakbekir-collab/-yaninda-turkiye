export type DutyViewInput<T> = { feedDate: string | number | Date | null | undefined; items: T[]; now: string | number | Date; tz: string };
export type DutyView<T> = { kind: 'list'; items: T[] } | { kind: 'none'; staleDate?: string; items: [] };

function dateKey(value: string | number | Date, tz: string): string | null {
  if (value instanceof Date || typeof value === 'number') {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find(item => item.type === type)?.value || '';
    return part('year') + '-' + part('month') + '-' + part('day');
  }
  const raw = String(value ?? '').trim();
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]), month = Number(dmy[2]), year = Number(dmy[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') : null;
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return null;
  const year = Number(iso[1]), month = Number(iso[2]), day = Number(iso[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  if (raw.length > 10) {
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return null;
    if (/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return dateKey(date, tz);
  }
  return iso[1] + '-' + iso[2] + '-' + iso[3];
}

export function dutyViewState<T>(input: DutyViewInput<T>): DutyView<T> {
  const now = input.now instanceof Date ? input.now : new Date(input.now);
  if (!Number.isFinite(now.getTime())) return { kind: 'none', items: [] };
  let today: string;
  try { today = dateKey(now, input.tz) || ''; } catch { return { kind: 'none', items: [] }; }
  const feed = input.feedDate === null || input.feedDate === undefined || input.feedDate === '' ? null : dateKey(input.feedDate, input.tz);
  const datedItems = Array.isArray(input.items) ? input.items.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    const rowDate = row.verifiedAt ?? row.dutyDate ?? row.duty_date ?? row.date;
    return rowDate !== null && rowDate !== undefined && dateKey(rowDate as string | number | Date, input.tz) === today;
  }) : [];
  if (feed === today && datedItems.length > 0) return { kind: 'list', items: datedItems };
  return { kind: 'none', ...(feed && feed !== today ? { staleDate: feed } : {}), items: [] };
}
export function shouldShowDutyCount(count: number): boolean {
  return Number.isFinite(count) && count > 0;
}

export function formatDutySourceDate(value: string | number | Date, tz = 'Europe/Istanbul'): string {
  const key = dateKey(value, tz);
  if (!key) return '';
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('tr-TR', { timeZone: tz, day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}
