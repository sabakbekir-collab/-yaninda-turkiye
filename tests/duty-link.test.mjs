import test from "node:test";
import assert from "node:assert/strict";
import { dutyLinkFor, MUS_DUTY_URL } from "../src/dutyLink.ts";

test("Muş gets the fixed official link in every spelling of the name", () => {
  for (const name of ["Muş", "MUŞ", "muş", "Mus", "MUS", " Muş "]) {
    const link = dutyLinkFor(name, true);
    assert.ok(link, name);
    assert.equal(link.url, "https://www.batmaneczaciodasi.org.tr/nobetci-eczaneler/mus");
    assert.equal(link.url, MUS_DUTY_URL);
    assert.equal(link.title, "Muş resmî nöbetçi eczane listesi");
    assert.equal(link.button, "Resmî listeyi aç");
  }
});

test("other provinces and empty input get no link", () => {
  for (const name of ["Batman", "İstanbul", "Ankara", "Muğla", "Muşa", "", "  ", null, undefined]) {
    assert.equal(dutyLinkFor(name, false), null, String(name));
  }
});

test("link text states the app does not fetch the list", () => {
  const link = dutyLinkFor("Muş", true);
  assert.match(link.note, /Bu uygulama o listeyi çekmez/);
});

test("the empty-state message appears only when there are no current records", () => {
  assert.equal(dutyLinkFor("Muş", false).empty, "Güncel liste uygulamada yok; resmî listeye bakın.");
  assert.equal(dutyLinkFor("Muş", true).empty, null);
});

test("the url is a constant, not derived from the province argument", () => {
  const a = dutyLinkFor("Muş", true).url;
  const b = dutyLinkFor("MUS", false).url;
  assert.equal(a, b);
  assert.ok(a.startsWith("https://www.batmaneczaciodasi.org.tr/"));
});
