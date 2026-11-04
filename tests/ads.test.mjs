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

test("ads endpoint returns active ads when D1 is available", async () => {
  const response = await onRequestGet(context({ results: [{ id: 1, title: "Test" }] }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ads: [{ id: 1, title: "Test" }] });
});

test("ads endpoint returns 503 when D1 binding is missing", async () => {
  const response = await onRequestGet(context({ missingDb: true }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "database_unavailable" });
});

test("ads endpoint returns 503 when D1 query fails", async () => {
  const response = await onRequestGet(context({ fail: true }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "ads_unavailable" });
});
