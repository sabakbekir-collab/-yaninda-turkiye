import test from "node:test";
import assert from "node:assert/strict";
import { nonDutySectionState } from "../src/searchPlan.ts";
import { officialLinkFor, dutyLinkFor } from "../src/dutyLink.ts";

test("non-duty pharmacy section distinguishes loading, empty success and source error", () => {
  assert.equal(nonDutySectionState({ status: "loading", count: 0 }), "loading");
  assert.equal(nonDutySectionState({ status: "success", count: 0 }), "empty");
  assert.equal(nonDutySectionState({ status: "error", count: 0 }), "error");
});

test("non-duty pharmacy section shows results after a successful lookup", () => {
  assert.equal(nonDutySectionState({ status: "success", count: 2 }), "results");
});

test("Muş uses its provincial duty link and suppresses the generic e-Devlet link", () => {
  assert.equal(dutyLinkFor("Muş", false)?.url, "https://www.batmaneczaciodasi.org.tr/nobetci-eczaneler/mus");
  assert.equal(officialLinkFor("Muş"), null);
});

test("other provinces get exactly the e-Devlet official pharmacy URL", () => {
  assert.equal(officialLinkFor("İstanbul"), "https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama");
  assert.equal(officialLinkFor("Ankara"), "https://www.turkiye.gov.tr/saglik-titck-nobetci-eczane-sorgulama");
  assert.equal(officialLinkFor(""), null);
});
