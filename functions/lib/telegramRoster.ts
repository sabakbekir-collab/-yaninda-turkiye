import { districtMap } from '../../src/turkeyDistricts';
import { trSlug } from '../../src/text';

export type RosterRow = { district_slug: string; name: string; address: string; phone: string };
export type RosterParseResult = { ok: true; province: string; province_slug: string; duty_date: string; rows: RosterRow[] } | { ok: false; error: string; lineNumber?: number };

function istanbulDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (key: string) => parts.find(part => part.type === key)?.value || '';
  return value('year') + '-' + value('month') + '-' + value('day');
}

function addDay(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string): string | null {
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0].length !== 2 || parts[1].length !== 2 || parts[2].length !== 4) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function validPhone(value: string): boolean {
  if (!value || !/[0-9]/.test(value)) return false;
  for (const char of value) if (!'0123456789+ ()-'.includes(char)) return false;
  return true;
}

function fail(error: string, lineNumber?: number): RosterParseResult {
  return { ok: false, error, ...(lineNumber === undefined ? {} : { lineNumber }) };
}

export function parseRosterMessage(text: string, now: Date = new Date()): RosterParseResult {
  if (typeof text !== 'string' || text.length > 8000) return fail('message_too_long');
  const lines = text.split(String.fromCharCode(10));
  const header = (lines.shift() || '').trim();
  if (!header) return fail('invalid_header', 1);
  const firstSpace = header.indexOf(' ');
  const provinceText = firstSpace < 0 ? header : header.slice(0, firstSpace).trim();
  const dateText = firstSpace < 0 ? '' : header.slice(firstSpace + 1).trim();
  const province = Object.keys(districtMap).find(name => trSlug(name) === trSlug(provinceText));
  if (!province) return fail('unknown_province', 1);
  const today = istanbulDay(now);
  const dutyDate = dateText ? parseDate(dateText) : today;
  if (!dutyDate) return fail('invalid_date', 1);
  if (dutyDate !== today && dutyDate !== addDay(today)) return fail('date_out_of_range', 1);

  const rows: RosterRow[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    if (rows.length >= 60) return fail('too_many_rows', index + 2);
    let district = '';
    let rowText = raw;
    if (raw.startsWith('[')) {
      const close = raw.indexOf(']');
      if (close < 2 || raw.slice(close + 1, close + 2) !== ' ') return fail('invalid_row', index + 2);
      const districtText = raw.slice(1, close).trim();
      const knownDistrict = districtsForProvince(province, districtText);
      if (!knownDistrict) return fail('unknown_district', index + 2);
      district = trSlug(knownDistrict);
      rowText = raw.slice(close + 2).trim();
    }
    const columns = rowText.split('|').map(value => value.trim());
    if (columns.length !== 3 || !columns[0] || !columns[1] || !validPhone(columns[2])) return fail('invalid_row', index + 2);
    rows.push({ district_slug: district, name: columns[0].slice(0, 160), address: columns[1].slice(0, 400), phone: columns[2].slice(0, 40) });
  }
  if (!rows.length) return fail('empty_roster');
  return { ok: true, province, province_slug: trSlug(province), duty_date: dutyDate, rows };
}

function districtsForProvince(province: string, input: string): string | null {
  const districts = districtMap[province] || [];
  return districts.find(name => trSlug(name) === trSlug(input)) || null;
}

export function verifyWebhookSecret(expected: string | null | undefined, actual: string | null | undefined): boolean {
  const left = typeof expected === 'string' ? expected : '';
  const right = typeof actual === 'string' ? actual : '';
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0 && left.length > 0;
}

export function decideTelegramAction(input: { linkedChatId?: string | null; incomingChatId: string; text: string }): 'ignore' | 'link' | 'parse' | 'confirm' | 'cancel' {
  const text = input.text.trim();
  if (!input.linkedChatId || input.linkedChatId !== input.incomingChatId) {
    const prefix = '/baglan ';
    const code = text.startsWith(prefix) ? text.slice(prefix.length).trim() : '';
    return code.length === 6 && Array.from(code).every(char => char >= '0' && char <= '9') ? 'link' : 'ignore';
  }
  const command = text.toLocaleUpperCase('tr-TR');
  if (command === 'ONAY') return 'confirm';
  if (command === 'İPTAL') return 'cancel';
  return 'parse';
}
