import type { Env } from './types';
import { createTelegramLinkCode } from './telegramD1Store.ts';

export async function createAdminTelegramLink(env: Env, now = new Date()): Promise<{ code: string; expiresAt: string }> {
  const random = crypto.getRandomValues(new Uint32Array(1))[0];
  const code = String(random % 1_000_000).padStart(6, '0');
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  await createTelegramLinkCode(env, code, expiresAt);
  return { code, expiresAt };
}
