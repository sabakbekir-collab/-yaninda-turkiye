import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const configText = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const config = JSON.parse(configText);

test('PR32 test environment is isolated from production and existing preview D1', () => {
  const live = config.d1_databases?.find((binding) => binding.binding === 'DB');
  const oldPreview = config.previews?.d1_databases?.find((binding) => binding.binding === 'DB');
  const isolated = config.env?.['pr32-test'];

  assert.ok(live, 'production DB binding must remain present');
  assert.ok(oldPreview, 'existing preview DB binding must remain present');
  assert.ok(isolated, 'env.pr32-test must exist');
  assert.equal(isolated.name, 'yaninda-turkiye-pr32-test');
  assert.equal(isolated.workers_dev, true);
  assert.equal(isolated.d1_databases?.length, 1);
  assert.equal(isolated.d1_databases[0].binding, 'DB');
  assert.equal(isolated.d1_databases[0].database_name, 'yaninda-turkiye-pr32-test');
  assert.match(isolated.d1_databases[0].database_id, /^(YOUR_PR32_TEST_DB_ID|[0-9a-fA-F-]{36})$/);
  assert.notEqual(isolated.d1_databases[0].database_name, live.database_name);
  assert.notEqual(isolated.d1_databases[0].database_name, oldPreview.database_name);
  assert.notEqual(isolated.d1_databases[0].database_id, live.database_id);
  assert.notEqual(isolated.d1_databases[0].database_id, oldPreview.database_id);
  assert.equal(JSON.stringify(isolated).includes(live.database_id), false);
  assert.equal(JSON.stringify(isolated).includes(oldPreview.database_id), false);
  assert.equal(isolated.triggers?.crons?.length ?? 0, 0);
  assert.equal(isolated.vars, undefined);
  assert.equal(isolated.secrets, undefined);
  assert.equal(isolated.routes, undefined);
  assert.equal(isolated.route, undefined);
  assert.equal(isolated.workers_dev, true);
});
