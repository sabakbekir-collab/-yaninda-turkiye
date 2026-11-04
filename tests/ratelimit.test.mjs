import test from "node:test";
import assert from "node:assert/strict";
import { rateLimited } from "../functions/lib/ratelimit.ts";

const request = { headers: { get: () => null } };

function fakeEnv(initialCount = 0, shouldFail = false) {
  let count = initialCount;
  return {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async run() {
                if (shouldFail) throw new Error("D1 unavailable");
                count += 1;
              },
              async first() {
                if (shouldFail) throw new Error("D1 unavailable");
                return { payload: String(count) };
              },
            };
          },
        };
      },
    },
  };
}

test("rate limiter allows requests within the configured limit", async () => {
  assert.equal(await rateLimited(fakeEnv(), request, "test", 5, 60), false);
});

test("rate limiter blocks requests over the configured limit", async () => {
  assert.equal(await rateLimited(fakeEnv(5), request, "test", 5, 60), true);
});

test("rate limiter fails closed when D1 is missing", async () => {
  assert.equal(await rateLimited({}, request, "test", 5, 60), true);
});

test("rate limiter fails closed when D1 is unavailable", async () => {
  assert.equal(await rateLimited(fakeEnv(0, true), request, "test", 5, 60), true);
});
