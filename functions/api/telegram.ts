import { decideTelegramAction, verifyWebhookSecret } from "../lib/telegramRoster.ts";
import type { Env } from "../lib/types";

type TelegramEnv = Env & { TELEGRAM_WEBHOOK_SECRET?: string };
type TelegramRequestContext = { request: Request; env: TelegramEnv };
type TelegramUpdate = {
  update_id?: number;
  message?: { chat?: { id?: string | number }; text?: string };
  edited_message?: unknown;
  channel_post?: unknown;
  edited_channel_post?: unknown;
};

const MAX_BODY_BYTES = 100 * 1024;
const ok = () => new Response("OK", { status: 200 });
const errorResponse = (status: number, error: string) => Response.json({ error }, { status });

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function onRequest({ request, env }: TelegramRequestContext): Promise<Response> {
  if (request.method !== "POST") return errorResponse(405, "method_not_allowed");
  const suppliedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!verifyWebhookSecret(env.TELEGRAM_WEBHOOK_SECRET, suppliedSecret)) return errorResponse(401, "unauthorized");

  try {
    const body = await readBoundedBody(request);
    if (body === null) return ok();
    let update: TelegramUpdate;
    try {
      update = JSON.parse(body) as TelegramUpdate;
    } catch {
      return ok();
    }
    if (update.edited_message || update.channel_post || update.edited_channel_post || !update.message) return ok();
    const chatId = update.message.chat?.id;
    const messageText = update.message.text;
    if (chatId === undefined || typeof messageText !== "string") return ok();
    decideTelegramAction({ linkedChatId: null, incomingChatId: String(chatId), text: messageText });
    return ok();
  } catch {
    console.error("telegram_webhook_error");
    return ok();
  }
}
