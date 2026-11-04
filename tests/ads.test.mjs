/* global Request */
import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/ads.ts";

function context({ missingDb = false, fail = false, results = [] } = {}) {
  const statement = {
    bind() { return this; },
    async all() {
      if (fail) throw new Error("D1 unavailable");
      return { results };
    },
  };
  return {
    request: new Request("https://example.test/api/ads?placement=home_top"),
    env: missingDb ? {} : { DB: { prepare() { return statement; } } },
  };
}

test("ads endpoint returns active ads and strips unsafe URLs", async () => {
  const response = await onRequestGet(context({ results: [{ id: 1, title: "Test", image_url: "javascript:alert(1)", target_url: "https://safe.example" }] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ads: [{ id: 1, title: "Test", text: "", image_url: null, target_url: "https://safe.example/", placement: undefined }] });
});

test("ads endpoint returns 200 with an empty list when inventory is genuinely empty", async () => {
  const response = await onRequestGet(context());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ads: [] });
});

test("ads endpoint returns 503, no-store and an empty ads array when D1 binding is missing", async () => {
  const response = await onRequestGet(context({ missingDb: true }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { ads: [], error: "database_unavailable" });
});

test("ads endpoint returns 503, no-store and an empty ads array when D1 query fails", async () => {
  const response = await onRequestGet(context({ fail: true }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { ads: [], error: "ads_unavailable" });
});
