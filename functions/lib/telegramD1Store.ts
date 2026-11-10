import type { Env } from './types';
import type { RosterParseResult, RosterRow } from './telegramRoster.ts';
import { manualDutySourceFor } from './manualDuty.ts';

type ParsedRoster = Extract<RosterParseResult, { ok: true }>;
export type StoredDutyRow = RosterRow & { id: number; province: string; province_slug: string; duty_date: string; duty_note?: string };
const LINK_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const LINK_ATTEMPT_LIMIT = 5;

function db(env: Env) {
  if (!env.DB) throw new Error('database_unavailable');
  return env.DB;
}

export async function linkedTelegramChatId(env: Env): Promise<string | null> {
  const row = await db(env).prepare("SELECT value FROM telegram_settings WHERE key='linked_chat_id' LIMIT 1").first<{ value: string }>();
  return row?.value || null;
}

export async function createTelegramLinkCode(env: Env, code: string, expiresAt: string): Promise<void> {
  const database = db(env);
  const statements = [
    database.prepare('DELETE FROM telegram_link_codes'),
    database.prepare('INSERT INTO telegram_link_codes(code,expires_at,used) VALUES(?,?,0)').bind(code, expiresAt),
  ];
  if (database.batch) await database.batch(statements);
  else for (const statement of statements) await statement.run();
}

export async function registerTelegramLinkAttempt(env: Env, chatId: string, now: Date): Promise<boolean> {
  const database = db(env);
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - LINK_ATTEMPT_WINDOW_MS).toISOString();
  await database.prepare('DELETE FROM telegram_link_attempts WHERE window_started_at<=? AND (locked_until IS NULL OR locked_until<=?)')
    .bind(windowStart, nowIso).run();
  const current = await database.prepare('SELECT window_started_at,attempts,locked_until FROM telegram_link_attempts WHERE chat_id=? LIMIT 1')
    .bind(chatId).first<{ window_started_at: string; attempts: number; locked_until: string | null }>();
  if (current?.locked_until && Date.parse(current.locked_until) > now.getTime()) return false;

  await database.prepare(`INSERT INTO telegram_link_attempts(chat_id,window_started_at,attempts,locked_until) VALUES(?,?,1,NULL)
    ON CONFLICT(chat_id) DO UPDATE SET
      attempts=CASE WHEN telegram_link_attempts.window_started_at<=? THEN 1 ELSE telegram_link_attempts.attempts+1 END,
      window_started_at=CASE WHEN telegram_link_attempts.window_started_at<=? THEN excluded.window_started_at ELSE telegram_link_attempts.window_started_at END,
      locked_until=CASE WHEN telegram_link_attempts.window_started_at<=? THEN NULL ELSE telegram_link_attempts.locked_until END`)
    .bind(chatId, nowIso, windowStart, windowStart, windowStart).run();

  const updated = await database.prepare('SELECT attempts FROM telegram_link_attempts WHERE chat_id=? LIMIT 1')
    .bind(chatId).first<{ attempts: number }>();
  if (!updated || updated.attempts <= LINK_ATTEMPT_LIMIT) return Boolean(updated);

  const lockedUntil = new Date(now.getTime() + LINK_ATTEMPT_WINDOW_MS).toISOString();
  await database.prepare('UPDATE telegram_link_attempts SET locked_until=? WHERE chat_id=?')
    .bind(lockedUntil, chatId).run();
  return false;
}

export async function clearTelegramLinkAttempts(env: Env, chatId: string): Promise<void> {
  await db(env).prepare('DELETE FROM telegram_link_attempts WHERE chat_id=?').bind(chatId).run();
}

export async function consumeTelegramLinkCode(env: Env, code: string, chatId: string): Promise<boolean> {
  const database = db(env);
  const claimed = await database.prepare('UPDATE telegram_link_codes SET used=1 WHERE code=? AND used=0 AND expires_at>? RETURNING code').bind(code, new Date().toISOString()).first<{ code: string }>();
  if (!claimed) return false;
  await database.prepare("INSERT INTO telegram_settings(key,value) VALUES('linked_chat_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(chatId).run();
  return true;
}

export async function savePendingRoster(env: Env, chatId: string, roster: ParsedRoster, now: Date): Promise<void> {
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  await db(env).prepare('INSERT INTO telegram_pending_rosters(chat_id,payload,expires_at) VALUES(?,?,?) ON CONFLICT(chat_id) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at')
    .bind(chatId, JSON.stringify(roster), expiresAt).run();
}

export async function pendingRoster(env: Env, chatId: string, now: Date): Promise<ParsedRoster | null> {
  const row = await db(env).prepare('SELECT payload,expires_at FROM telegram_pending_rosters WHERE chat_id=? LIMIT 1').bind(chatId).first<{ payload: string; expires_at: string }>();
  if (!row) return null;
  if (Date.parse(row.expires_at) <= now.getTime()) {
    await deletePendingRoster(env, chatId);
    return null;
  }
  try {
    const roster = JSON.parse(row.payload) as ParsedRoster;
    return roster?.ok === true && Array.isArray(roster.rows) ? roster : null;
  } catch {
    return null;
  }
}

export async function deletePendingRoster(env: Env, chatId: string): Promise<void> {
  await db(env).prepare('DELETE FROM telegram_pending_rosters WHERE chat_id=?').bind(chatId).run();
}

export async function confirmRoster(env: Env, roster: ParsedRoster): Promise<void> {
  const database = db(env);
  const statements = [
    database.prepare('DELETE FROM manual_duty_rosters WHERE province_slug=? AND duty_date=?').bind(roster.province_slug, roster.duty_date),
    database.prepare('INSERT INTO manual_duty_rosters(province,province_slug,duty_date,source_label) VALUES(?,?,?,?)').bind(roster.province, roster.province_slug, roster.duty_date, manualDutySourceFor(roster.province_slug)),
    ...roster.rows.map(row => database.prepare('INSERT INTO manual_duty_entries(roster_id,district_slug,name,address,phone) SELECT id,?,?,?,? FROM manual_duty_rosters WHERE province_slug=? AND duty_date=?')
      .bind(row.district_slug, row.name, row.address, row.phone, roster.province_slug, roster.duty_date)),
  ];
  if (database.batch) await database.batch(statements);
  else for (const statement of statements) await statement.run();
}

export async function currentManualDutyRows(env: Env, provinceSlug: string, dutyDate: string): Promise<StoredDutyRow[]> {
  const result = await db(env).prepare(`SELECT e.id,r.province,r.province_slug,r.duty_date,e.district_slug,e.name,e.address,e.phone
    FROM manual_duty_rosters r JOIN manual_duty_entries e ON e.roster_id=r.id
    WHERE r.province_slug=? AND r.duty_date=? ORDER BY e.id`).bind(provinceSlug, dutyDate).all<StoredDutyRow>();
  return result.results || [];
}

export async function recordRosterEvent(env: Env, type: 'preview'|'error'|'confirmed'|'cancelled'|'linked'|'reminder', province?: string, dutyDate?: string): Promise<void> {
  await db(env).prepare('INSERT INTO roster_events(type,province,duty_date) VALUES(?,?,?)').bind(type, province || null, dutyDate || null).run();
}

export async function recentRosterEvents(env: Env): Promise<Array<{ id: number; type: string; province: string | null; duty_date: string | null; created_at: string }>> {
  const result = await db(env).prepare('SELECT id,type,province,duty_date,created_at FROM roster_events ORDER BY id DESC LIMIT 50').all<{ id: number; type: string; province: string | null; duty_date: string | null; created_at: string }>();
  return result.results || [];
}

export async function reminderAlreadySent(env: Env, dutyDate: string): Promise<boolean> {
  const row = await db(env).prepare("SELECT id FROM roster_events WHERE type='reminder' AND duty_date=? LIMIT 1").bind(dutyDate).first<{ id: number }>();
  return Boolean(row);
}