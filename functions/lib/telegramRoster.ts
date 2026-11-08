export type RosterRow = { district_slug: string; name: string; address: string; phone: string };
export type RosterParseResult = { ok: true; province: string; province_slug: string; duty_date: string; rows: RosterRow[] } | { ok: false; error: string; lineNumber?: number };
export function parseRosterMessage(_text: string, _now: Date = new Date()): RosterParseResult { return { ok: false, error: 'not_implemented' }; }
export function verifyWebhookSecret(_expected: string | null | undefined, _actual: string | null | undefined): boolean { return false; }
export function decideTelegramAction(_input: { linkedChatId?: string | null; incomingChatId: string; text: string }): 'ignore' | 'link' | 'parse' | 'confirm' | 'cancel' { return 'ignore'; }
