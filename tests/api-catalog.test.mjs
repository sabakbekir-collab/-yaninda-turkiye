import test from "node:test";
import assert from "node:assert/strict";
import { isIP } from "node:net";
import { makeSession } from "../functions/lib/auth.ts";
import { onRequestGet, onRequestPost, CATALOG } from "../functions/api/api-catalog.ts";

const secret = "test-admin-session-secret";
const env = { ADMIN_SESSION_SECRET: secret };
const origin = "https://yaninda.example";

async function authenticatedRequest(url, init = {}) {
  const token = await makeSession(secret);
  const headers = new Headers(init.headers || {});
  headers.set("Cookie", `yt_admin=${token}`);
  if (!headers.has("Origin")) headers.set("Origin", new URL(url).origin);
  return new Request(url, { ...init, headers });
}

async function withFetch(mock, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try { await fn(); } finally { globalThis.fetch = originalFetch; }
}

function postRequest(body = { id: "open-meteo" }, headers = {}) {
  return authenticatedRequest(`${origin}/api/admin/api-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("API catalog rejects unauthenticated reads", async () => {
  const response = await onRequestGet({
    request: new Request(`${origin}/api/admin/api-catalog`),
    env,
  });
  assert.equal(response.status, 401);
});

test("API catalog returns curated metadata without exposing probe URLs", async () => {
  const request = await authenticatedRequest(`${origin}/api/admin/api-catalog`);
  const response = await onRequestGet({ request, env });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.apis.length, 5);
  assert.ok(body.apis.every((api) => api.testable === true));
  assert.ok(body.apis.every((api) => !("testUrl" in api)));
});

test("catalog destinations are fixed HTTPS hostnames, never IP literals or private addresses", () => {
  const allowedHosts = new Set([
    "api.open-meteo.com",
    "nominatim.openstreetmap.org",
    "restcountries.com",
    "api.frankfurter.dev",
    "geocoding-api.open-meteo.com",
  ]);
  for (const entry of CATALOG) {
    const url = new URL(entry.testUrl);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    assert.equal(url.protocol, "https:", entry.id);
    assert.notEqual(host, "localhost", entry.id);
    assert.equal(isIP(host), 0, entry.id);
    assert.ok(!/^(?:0x[0-9a-f]+|[0-9]+)$/.test(host), entry.id);
    assert.ok(allowedHosts.has(host), `unexpected probe host: ${host}`);
    assert.ok(!/^(?:10\.|127\.|169\.254\.|192\.168\.)/.test(host), entry.id);
    assert.ok(!/^172\.(?:1[6-9]|2[0-9]|3[01])\./.test(host), entry.id);
  }
  // WHATWG URL canonicalizes several non-standard numeric IPv4 forms.
  for (const raw of ["127.1", "2130706433", "0x7f000001", "0177.0.0.1"]) {
    assert.equal(isIP(new URL(`https://${raw}`).hostname), 4, raw);
  }
});

test("API catalog test rejects arbitrary IDs and client-supplied URL/host without outbound requests", async () => {
  let called = false;
  await withFetch(async () => { called = true; return Response.json({}); }, async () => {
    const request = await postRequest({ id: "https://attacker.example", url: "https://127.0.0.1", host: "127.0.0.1" });
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 404);
    assert.equal(called, false);
  });
});

test("API catalog probes only the fixed endpoint selected by catalog ID", async () => {
  let requestedUrl = "";
  await withFetch(async (input, init) => {
    requestedUrl = String(input);
    assert.equal(init.redirect, "manual");
    return Response.json({ current: { temperature_2m: 12 } });
  }, async () => {
    const response = await onRequestPost({ request: await postRequest(), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(new URL(requestedUrl).hostname, "api.open-meteo.com");
  });
});

test("POST rejects missing Origin with 403 before authentication", async () => {
  const request = new Request(`${origin}/api/admin/api-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "invalid" },
    body: JSON.stringify({ id: "open-meteo" }),
  });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 403);
});

test("POST rejects mismatched Origin with 403 before authentication", async () => {
  const request = new Request(`${origin}/api/admin/api-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example", Cookie: "invalid" },
    body: JSON.stringify({ id: "open-meteo" }),
  });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 403);
});

test("API catalog blocks redirects and reports redirect_blocked", async () => {
  await withFetch(async () => new Response(null, { status: 302, headers: { Location: "https://127.0.0.1/" } }), async () => {
    const response = await onRequestPost({ request: await postRequest(), env });
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "redirect_blocked");
  });
});

test("API catalog truncates responses above 64 KiB", async () => {
  await withFetch(async () => new Response(new Uint8Array(70 * 1024), {
    status: 200, headers: { "Content-Type": "application/json", "Content-Length": String(70 * 1024) },
  }), async () => {
    const response = await onRequestPost({ request: await postRequest(), env });
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.truncated, true);
    assert.equal(body.error, "response_too_large");
  });
});

test("API catalog reports provider timeout without throwing", async () => {
  await withFetch(async () => { throw new DOMException("timed out", "TimeoutError"); }, async () => {
    const response = await onRequestPost({ request: await postRequest(), env });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.error, "timeout");
    assert.match(body.detail, /7 saniye/);
  });
});

test("API catalog maps provider 403, 404, 429 and 5xx to readable errors", async () => {
  for (const status of [403, 404, 429, 503]) {
    await withFetch(async () => new Response("upstream error", { status }), async () => {
      const response = await onRequestPost({ request: await postRequest(), env });
      const body = await response.json();
      assert.equal(body.ok, false);
      assert.equal(body.httpStatus, status);
      assert.ok(body.detail.length > 10);
    });
  }
});

test("API catalog reports malformed JSON without crashing", async () => {
  await withFetch(async () => new Response("not-json", { status: 200, headers: { "Content-Type": "application/json" } }), async () => {
    const response = await onRequestPost({ request: await postRequest(), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, false);
    assert.equal(body.error, "invalid_json");
    assert.match(body.detail, /geçerli JSON/);
  });
});

test("API catalog rejects unauthenticated probes after same-origin validation", async () => {
  const request = new Request(`${origin}/api/admin/api-catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ id: "open-meteo" }),
  });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 401);
});
