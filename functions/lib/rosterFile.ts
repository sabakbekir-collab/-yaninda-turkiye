export type RosterContext = { provinceSlugs: readonly string[]; slugify: (value: string) => string; provinceNames?: Readonly<Record<string, string>>; districtsByProvince?: Readonly<Record<string, readonly string[]>> };

export type MonthlyRosterRow = { duty_date: string; district_slug: string; name: string; address: string; phone: string; roster_kind: 'monthly' | 'daily' };
export type RosterFileResult = { ok: true; province: string; province_slug: string; rows: MonthlyRosterRow[]; dates: string[]; missing_dates: string[]; duplicate_count: number; first_date: string; last_date: string } | { ok: false; error: string; lineNumbers?: number[] };
export type ReminderPlan = { kind: 'missing_today' | 'month_end'; date: string; message: string }[];

function dayKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (key: string) => parts.find(part => part.type === key)?.value || '';
  return get('year') + '-' + get('month') + '-' + get('day');
}

function parseDate(value: string): string | null {
  const raw = value.trim();
  let year = 0;
  let month = 0;
  let day = 0;
  if (raw.length === 10 && raw[2] === '.' && raw[5] === '.') {
    day = Number(raw.slice(0, 2));
    month = Number(raw.slice(3, 5));
    year = Number(raw.slice(6, 10));
  } else if (raw.length === 10 && raw[4] === '-' && raw[7] === '-') {
    year = Number(raw.slice(0, 4));
    month = Number(raw.slice(5, 7));
    day = Number(raw.slice(8, 10));
  } else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function csvFields(line: string): string[] | null {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ';' && !quoted) {
      fields.push(field.trim());
      field = '';
    } else field += char;
  }
  if (quoted) return null;
  fields.push(field.trim());
  return fields;
}

function invalidControl(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function validPhone(value: string): boolean {
  if (!value || invalidControl(value)) return false;
  let digits = 0;
  for (const char of value) {
    if (char >= '0' && char <= '9') digits += 1;
    else if (!'+ ()-'.includes(char)) return false;
  }
  return digits > 0;
}

function fail(error: string, lineNumbers: number[] = []): RosterFileResult {
  return { ok: false, error, ...(lineNumbers.length ? { lineNumbers: lineNumbers.slice(0, 10) } : {}) };
}

export function parseRosterFile(input: string, now: Date, ctx: RosterContext): RosterFileResult {
  if (typeof input !== 'string') return fail('invalid_file');
  const text = input.charCodeAt(0) === 65279 ? input.slice(1) : input;
  if (new TextEncoder().encode(text).length > 200 * 1024) return fail('file_too_large');
  const lines = text.split(String.fromCharCode(10)).map(line => line.endsWith(String.fromCharCode(13)) ? line.slice(0, -1) : line);
  const provinceText = (lines.shift() || '').trim();
  const provinceSlug = ctx.provinceSlugs.find(slug => slug === ctx.slugify(provinceText));
  if (!provinceSlug) return fail('unknown_province', [1]);
  const province = ctx.provinceNames?.[provinceSlug] || provinceText;
  const today = dayKey(now);
  const maxDate = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) + 45)).toISOString().slice(0, 10);
  const rows: MonthlyRosterRow[] = [];
  const errors: number[] = [];
  const seen = new Set<string>();
  const days = new Set<string>();
  let duplicates = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    const fields = csvFields(raw);
    if (!fields) {
      errors.push(index + 2);
      continue;
    }
    if (index === 0 && ctx.slugify(fields[0]) === 'tarih' && ctx.slugify(fields[1] || '') === 'ilce') continue;
    if (rows.length >= 600) return fail('too_many_rows', [index + 2]);
    if (fields.length !== 5) {
      errors.push(index + 2);
      continue;
    }
    const date = parseDate(fields[0]);
    const district = fields[1] ? (ctx.districtsByProvince?.[provinceSlug] || []).find(name => ctx.slugify(name) === ctx.slugify(fields[1])) : '';
    const name = fields[2];
    const address = fields[3];
    const phone = fields[4];
    if (!date || date < today || date > maxDate || (fields[1] && !district) || !name || name.length > 120 || !address || address.length > 240 || !phone || !validPhone(phone) || invalidControl(name) || invalidControl(address)) {
      errors.push(index + 2);
      continue;
    }
    const key = [date, ctx.slugify(name), ctx.slugify(address)].join('|');
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    days.add(date);
    rows.push({ duty_date: date, district_slug: district ? ctx.slugify(district) : '', name, address, phone, roster_kind: 'monthly' });
  }
  if (errors.length) return fail('invalid_rows', errors);
  if (!rows.length) return fail('empty_roster');
  if (days.size > 62) return fail('too_many_dates');
  const sorted = Array.from(days).sort();
  const missing: string[] = [];
  const first = new Date(sorted[0] + 'T00:00:00Z');
  const last = new Date(sorted[sorted.length - 1] + 'T00:00:00Z');
  for (let date = new Date(first); date <= last; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    if (!days.has(key)) missing.push(key);
  }
  return { ok: true, province, province_slug: provinceSlug, rows, dates: sorted, missing_dates: missing, duplicate_count: duplicates, first_date: sorted[0], last_date: sorted[sorted.length - 1] };
}

export function planReminders(now: Date, rows: Array<{ duty_date: string }>): ReminderPlan {
  const today = dayKey(now);
  const todayRows = rows.some(row => row.duty_date === today);
  if (!todayRows) return [{ kind: 'missing_today', date: today, message: 'Bugünün listesi yok. Gönder.' }];
  const future = rows.map(row => row.duty_date).filter(date => date >= today).sort();
  const last = future[future.length - 1];
  if (!last) return [];
  const [year, month, day] = today.split('-').map(Number);
  const [lastYear, lastMonth, lastDay] = last.split('-').map(Number);
  const distance = Math.round((Date.UTC(lastYear, lastMonth - 1, lastDay) - Date.UTC(year, month - 1, day)) / 86400000);
  if (distance < 5) return [{ kind: 'month_end', date: today, message: 'Listenin son günü ' + last.slice(8, 10) + '.' + last.slice(5, 7) + '. Yeni ay listesini gönder.' }];
  return [];
}

export function monthlyEntryNote(enteredAt: Date): string {
  const parts = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(enteredAt);
  const get = (key: string) => parts.find(part => part.type === key)?.value || '';
  return 'Aylık listeye göre; değişiklik olabilir, gitmeden telefonla teyit edin. Giriş: ' + get('day') + '.' + get('month') + ' ' + get('hour') + ':' + get('minute');
}

export function dailyEntryNote(enteredAt: Date): string {
  return 'Güncellendi: ' + new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(enteredAt);
}
