import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOverpassBody } from '../functions/lib/overpassBody.ts';

test('classifies a remarkless empty elements list as a genuine empty result', () => {
  assert.deepEqual(classifyOverpassBody({ elements: [] }), {
    kind: 'empty',
    elements: []
  });
});

test('classifies runtime error remarks on empty results as upstream errors, case-insensitively', () => {
  for (const remark of [
    'runtime error: Query timed out in "around" statement',
    'RUNTIME ERROR: query timed out',
    'out of memory',
    'rate_limited'
  ]) {
    const result = classifyOverpassBody({ elements: [], remark });
    assert.equal(result.kind, 'error', remark);
    assert.match(result.reason, /^overpass_remark_/);
  }
});

test('classifies empty results with non-failure remarks as errors rather than confirmed empty', () => {
  const result = classifyOverpassBody({ elements: [], remark: 'The data included an informational note' });
  assert.equal(result.kind, 'error');
  assert.match(result.reason, /^overpass_remark_/);
});

test('keeps non-empty elements when a provider also returns a remark, marked partial', () => {
  const elements = [{ type: 'node', id: 7, lat: 38.74, lon: 41.50 }];
  const result = classifyOverpassBody({ elements, remark: 'runtime warning: some data omitted' });
  assert.equal(result.kind, 'partial');
  assert.deepEqual(result.elements, elements);
});

test('classifies non-empty elements without a remark as a normal successful response', () => {
  const elements = [{ type: 'node', id: 9, lat: 38.74, lon: 41.50 }];
  assert.deepEqual(classifyOverpassBody({ elements }), { kind: 'ok', elements });
});

test('rejects malformed bodies and safely normalizes remark arrays and non-string values', () => {
  assert.equal(classifyOverpassBody({ elements: null }).reason, 'overpass_bad_body');
  assert.equal(classifyOverpassBody({ elements: [] , remark: ['runtime error: Query timed out', 42, null] }).kind, 'error');
  assert.equal(classifyOverpassBody({ elements: [], remark: [42, null, {}] }).kind, 'error');
});
