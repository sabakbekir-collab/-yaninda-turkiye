import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = ['functions/api/telegram.ts', 'worker/index.ts', 'functions/api/places.ts'];
const chamberHosts = ['batmaneczaciodasi.org.tr', 'eczaciodasi.org.tr', 'eczaciodalari.org.tr'];

test('server code never fetches chamber websites', () => {
  for (const path of files) {
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    for (const host of chamberHosts) {
      const position = source.indexOf(host);
      assert.equal(position, -1, path + ' contains a chamber host in server request code');
    }
  }
});
