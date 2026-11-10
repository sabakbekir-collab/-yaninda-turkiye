import type { Env } from './types';
import { buildRosterContext } from '../api/rosterContext.ts';
import { decideTelegramAction, parseRosterMessage } from './telegramRoster.ts';
import {
  confirmRoster,
  clearTelegramLinkAttempts,
  consumeTelegramLinkCode,
  currentManualDutyRows,
  deletePendingRoster,
  linkedTelegramChatId,
  pendingRoster,
  recordRosterEvent,
  reminderAlreadySent,
  registerTelegramLinkAttempt,
  savePendingRoster,
} from './telegramD1Store.ts';

type TelegramMessage = { chatId: string; text: string };

async function sendMessage(env: Env, chatId: string, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('telegram_not_configured');
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('telegram_send_failed');
}

function previewText(roster: Extract<ReturnType<typeof parseRosterMessage>, { ok: true }>): string {
  const rows = roster.rows.slice(0, 20).map(row => `${row.district_slug ? '[' + row.district_slug + '] ' : ''}${row.name} | ${row.address} | ${row.phone}`);
  if (roster.rows.length > rows.length) rows.push(`... ${roster.rows.length - rows.length} kayıt daha`);
  return [`${roster.province} · ${roster.duty_date}`, ...rows, '', 'Yayımlamak için ONAY, vazgeçmek için İPTAL yaz. Önizleme 10 dakika geçerlidir.'].join('\n').slice(0, 3900);
}

export async function processTelegramMessage(env: Env, message: TelegramMessage, now = new Date()): Promise<void> {
  if (!env.DB) return;
  const linkedChatId = await linkedTelegramChatId(env);
  const action = decideTelegramAction({ linkedChatId, incomingChatId: message.chatId, text: message.text });
  if (action === 'ignore') return;

  try {
    if (action === 'link') {
      const code = message.text.trim().slice('/baglan '.length).trim();
      if (!await registerTelegramLinkAttempt(env, message.chatId, now)) return;
      if (!await consumeTelegramLinkCode(env, code, message.chatId)) return;
      await clearTelegramLinkAttempts(env, message.chatId);
      await recordRosterEvent(env, 'linked');
      await sendMessage(env, message.chatId, 'Telegram hesabı yönetici paneline bağlandı.');
      return;
    }

    if (action === 'parse') {
      const result = parseRosterMessage(message.text, now, buildRosterContext());
      if (!result.ok) {
        await recordRosterEvent(env, 'error');
        await sendMessage(env, message.chatId, `Liste kabul edilmedi${result.lineNumber ? ' (satır ' + result.lineNumber + ')' : ''}. Bilgileri kontrol edip yeniden gönderin.`);
        return;
      }
      await savePendingRoster(env, message.chatId, result, now);
      try {
        await sendMessage(env, message.chatId, previewText(result));
      } catch {
        await deletePendingRoster(env, message.chatId);
        await recordRosterEvent(env, 'error', result.province, result.duty_date);
        throw new Error('telegram_preview_failed');
      }
      await recordRosterEvent(env, 'preview', result.province, result.duty_date);
      return;
    }

    if (action === 'confirm') {
      const roster = await pendingRoster(env, message.chatId, now);
      if (!roster) {
        await recordRosterEvent(env, 'error');
        await sendMessage(env, message.chatId, 'Onaylanacak geçerli bir önizleme bulunamadı. Listeyi yeniden gönderin.');
        return;
      }
      await confirmRoster(env, roster);
      await deletePendingRoster(env, message.chatId);
      await recordRosterEvent(env, 'confirmed', roster.province, roster.duty_date);
      await sendMessage(env, message.chatId, `${roster.province} nöbet listesi yayımlandı.`);
      return;
    }

    if (action === 'cancel') {
      const roster = await pendingRoster(env, message.chatId, now);
      await deletePendingRoster(env, message.chatId);
      await recordRosterEvent(env, 'cancelled', roster?.province, roster?.duty_date);
      await sendMessage(env, message.chatId, 'Bekleyen nöbet listesi iptal edildi.');
    }
  } catch {
    try { await recordRosterEvent(env, 'error'); } catch { /* Keep webhook errors independent from audit storage. */ }
    throw new Error('telegram_flow_failed');
  }
}

function istanbulDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (key: string) => parts.find(part => part.type === key)?.value || '';
  return value('year') + '-' + value('month') + '-' + value('day');
}

export async function sendMissingRosterReminder(env: Env, now = new Date()): Promise<void> {
  if (!env.DB) return;
  const day = istanbulDay(now);
  if (await reminderAlreadySent(env, day)) return;
  if ((await currentManualDutyRows(env, 'mus', day)).length) return;
  const chatId = await linkedTelegramChatId(env);
  if (!chatId) return;
  await sendMessage(env, chatId, 'Muş için bugünün nöbet listesi henüz yayımlanmadı. Lütfen listeyi gönderip ONAY ile yayımlayın.');
  await recordRosterEvent(env, 'reminder', 'Muş', day);
}