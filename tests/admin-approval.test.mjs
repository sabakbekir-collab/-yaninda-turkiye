import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/admin.ts";
import { makeSession } from "../functions/lib/auth.ts";

async function invokeApproval(payload, fetchImpl) {
  const updates = [];
  const statement = {
    values: [],
    bind(...values) { this.values = values; return this; },
    async run() { if (this.sql?.startsWith("UPDATE submissions")) updates.push(this.values); return {}; },
    async first() { return { id: 7, address: "Atatürk Caddesi 1", district: "Merkez", province: "Muş" }; },
  };
  const db = {
    prepare(sql) {
      const s = Object.create(statement);
      s.sql = sql;
      return s;
    },
  };
  const secret = "test-only-secret";
  const token = await makeSession(secret);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl || (async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
  try {
    const request = new Request("https://yaninda.example/api/admin", {
      method: "POST",
      headers: {
        Origin: "https://yaninda.example",
        Cookie: `yt_admin=${encodeURIComponent(token)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "approve_submission", id: 7, ...payload }),
    });
    const response = await onRequestPost({
      request,
      env: {
        DB: db,
        ADMIN_SESSION_SECRET: secret,
        OSM_CONTACT_EMAIL: "test@example.invalid",
      },
    });
    return { response, updates };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("approval accepts valid manual Turkish coordinates without geocoding", async () => {
  const { response, updates } = await invokeApproval({ latitude: 38.7432, longitude: 41.5064 });
  assert.equal(response.status, 200);
  assert.deepEqual(updates[0], [38.7432, 41.5064, 7]);
});

test("approval rejects manual coordinates outside Turkey", async () => {
  const { response, updates } = await invokeApproval({ latitude: 51.5, longitude: -0.1 });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "coordinates_out_of_range" });
  assert.equal(updates.length, 0);
});

test("approval rejects numeric strings and malformed coordinate values", async () => {
  for (const payload of [
    { latitude: "38.7", longitude: "41.5" },
    { latitude: "not-a-number", longitude: 41.5 },
    { latitude: 38.7 },
    { latitude: null, longitude: 41.5 },
  ]) {
    const { response, updates } = await invokeApproval(payload);
    assert.equal(response.status, 400);
    assert.equal(updates.length, 0);
  }
});

test("approval returns 422 and does not publish when geocoding finds no result", async () => {
  const { response, updates } = await invokeApproval({}, async () => new Response("[]", { status: 200 }));
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { error: "geocode_failed" });
  assert.equal(updates.length, 0);
});

test("approval returns 503 and does not publish when Nominatim returns 5xx", async () => {
  const { response, updates } = await invokeApproval({}, async () => new Response("upstream failure", { status: 503 }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "geocoding_unavailable" });
  assert.equal(updates.length, 0);
});

test("approval returns 503 and does not publish when Nominatim returns malformed JSON", async () => {
  const { response, updates } = await invokeApproval({}, async () => new Response("{broken", { status: 200 }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "geocoding_unavailable" });
  assert.equal(updates.length, 0);
});
