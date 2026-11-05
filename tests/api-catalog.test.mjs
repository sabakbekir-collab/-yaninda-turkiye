import test from "node:test";
import assert from "node:assert/strict";
import { makeSession } from "../functions/lib/auth.ts";
import { onRequestGet, onRequestPost } from "../functions/api/api-catalog.ts";

const secret = "test-admin-session-secret";
const env = { ADMIN_SESSION_SECRET: secret };

async function authenticatedRequest(url, init = {}) {
  const token = await makeSession(secret);
  const headers = new Headers(init.headers || {});
  headers.set("Cookie", `yt_admin=${token}`);
  return new Request(url, { ...init, headers });
}

test("API catalog rejects unauthenticated reads", async () => {
  const response = await onRequestGet({
    request: new Request("https://yaninda.example/api/admin/api-catalog"),
    env,
  });
  assert.equal(response.status, 401);
});

test("API catalog returns curated metadata without exposing probe URLs", async () => {
  const request = await authenticatedRequest("https://yaninda.example/api/admin/api-catalog");
  const response = await onRequestGet({ request, env });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.apis.length, 5);
  assert.ok(body.apis.every((api) => api.testable === true));
  assert.ok(body.apis.every((api) => !("testUrl" in api)));
});

test("API catalog test rejects arbitrary IDs without making outbound requests", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };
  try {
    const request = await authenticatedRequest(
      "https://yaninda.example/api/admin/api-catalog",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "https://attacker.example" }) },
    );
    const response = await onRequestPost({ request, env });
    assert.equal(response.status, 404);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API catalog probes only the fixed endpoint selected by catalog ID", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({ current: { temperature_2m: 12 } });
  };
  try {
    const request = await authenticatedRequest(
      "https://yaninda.example/api/admin/api-catalog",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "open-meteo" }) },
    );
    const response = await onRequestPost({ request, env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(new URL(requestedUrl).hostname, "api.open-meteo.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API catalog rejects unauthenticated probes", async () => {
  const request = new Request("https://yaninda.example/api/admin/api-catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "open-meteo" }),
  });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 401);
});
