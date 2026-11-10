import test from "node:test";
import assert from "node:assert/strict";
import { isTelegramWebhookPath, onRequest } from "../functions/api/telegram.ts";
import { buildRosterContext } from "../functions/api/rosterContext.ts";

const secret = "test-webhook-secret";
const context = (body, options = {}) => ({
  request: new Request("https://example.test/api/telegram", {
    method: options.method || "POST",
    headers: options.headers || {
      "X-Telegram-Bot-Api-Secret-Token": secret,
      "Content-Type": "application/json",
    },
    body,
  }),
  env: { TELEGRAM_WEBHOOK_SECRET: secret },
});

test("Telegram webhook rejects an incorrect secret without reading the body", async () => {
  let bodyRead = false;
  const request = {
    method: "POST",
    headers: new Headers({ "X-Telegram-Bot-Api-Secret-Token": "wrong" }),
    get body() {
      bodyRead = true;
      return null;
    },
  };

  const response = await onRequest({ request, env: { TELEGRAM_WEBHOOK_SECRET: secret } });
  assert.equal(response.status, 401);
  assert.equal(bodyRead, false);
});

test("Telegram webhook path matcher includes the documented setup URL", () => {
  assert.equal(isTelegramWebhookPath("/api/telegram"), true);
  assert.equal(isTelegramWebhookPath("/api/telegram/webhook"), true);
  assert.equal(isTelegramWebhookPath("/api/telegram/other"), false);
});

test("Telegram webhook rejects methods other than POST", async () => {
  const response = await onRequest(context(null, { method: "GET" }));
  assert.equal(response.status, 405);
});

test("Telegram webhook ignores edited messages and channel posts", async () => {
  const edited = await onRequest(context(JSON.stringify({ update_id: 1, edited_message: { text: "/baglan 123456" } })));
  const channel = await onRequest(context(JSON.stringify({ update_id: 2, channel_post: { text: "/baglan 123456" } })));
  assert.equal(edited.status, 200);
  assert.equal(channel.status, 200);
});

test("an unlinked chat receives no Telegram reply and no message is sent", async () => {
  const originalFetch = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => {
    sends += 1;
    return new Response("unexpected");
  };
  try {
    const response = await onRequest(context(JSON.stringify({
      update_id: 3,
      message: { chat: { id: 12345 }, text: "Merhaba" },
    })));
    assert.equal(response.status, 200);
    assert.equal(sends, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("malformed JSON is acknowledged with HTTP 200", async () => {
  const response = await onRequest(context("{"));
  assert.equal(response.status, 200);
});

test("roster context covers all 81 provinces with at least one district each", () => {
  const roster = buildRosterContext();
  assert.equal(roster.provinceSlugs.length, 81);
  assert.equal(Object.keys(roster.districtsByProvince || {}).length, 81);
  for (const province of roster.provinceSlugs) {
    assert.ok((roster.districtsByProvince?.[province] || []).length > 0, province);
  }
});
