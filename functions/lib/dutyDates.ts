function istanbulParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day"), hour: Number(value("hour")) };
}
const validCalendarDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const formatDay = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
function istanbulDay(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  const p = istanbulParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}
export function activeDutyDates(now: Date = new Date()): string[] {
  const p = istanbulParts(now);
  const year = Number(p.year), month = Number(p.month), day = Number(p.day);
  const yesterday = new Date(Date.UTC(year, month - 1, day));
  const dates = [formatDay(year, month, day)];
  if (p.hour < 9) {
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    dates.push(yesterday.toISOString().slice(0, 10));
  }
  return dates;
}
export function dutyDateKey(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return istanbulDay(new Date(value < 1e12 ? value * 1000 : value));
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]), month = Number(dmy[2]), year = Number(dmy[3]);
    return validCalendarDate(year, month, day) ? formatDay(year, month, day) : null;
  }
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const year = Number(isoDate[1]), month = Number(isoDate[2]), day = Number(isoDate[3]);
    return validCalendarDate(year, month, day) ? formatDay(year, month, day) : null;
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) {
    // Validate the calendar portion before Date parsing: JavaScript normalises
    // impossible dates such as February 31 instead of rejecting them.
    const datePart = raw.slice(0, 10);
    if (dutyDateKey(datePart) === null) return null;
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(raw);
    return hasZone ? istanbulDay(new Date(raw)) : datePart;
  }
  return null;
}
export function isActiveDutyDate(value: unknown, now: Date = new Date()): boolean {
  const key = dutyDateKey(value);
  return key !== null && activeDutyDates(now).includes(key);
}

export function isTodayDutyDate(value: unknown, now: Date = new Date()): boolean {
  const key = dutyDateKey(value);
  return key !== null && key === istanbulDay(now);
}

export function dutyRowAllowed(rowDate: unknown, feedDate: unknown, now: Date = new Date()): boolean {
  const row = dutyDateKey(rowDate);
  const feed = dutyDateKey(feedDate);
  const active = activeDutyDates(now);
  return row !== null && feed !== null && active.includes(row) && active.includes(feed);
}
