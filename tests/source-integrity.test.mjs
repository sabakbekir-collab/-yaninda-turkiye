import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Guards against tool corruption where a real line break is written as the two
// characters backslash + n. That text lands inside a comment or JSX and either
// breaks the build or prints it on screen. This file deliberately contains no
// backslash character itself, so the same corruption cannot hit it.
const BACKSLASH = String.fromCharCode(92);
const NEWLINE = String.fromCharCode(10);
const MARK = BACKSLASH + 'n';
const FOLLOWERS = ['  ', '//', '{', '<'];

export function findCorruptedLines(text) {
  return text.split(NEWLINE).flatMap((line, index) => {
    let from = 0;
    for (;;) {
      const at = line.indexOf(MARK, from);
      if (at === -1) return [];
      const rest = line.slice(at + 2).trimStart();
      const spaced = line.slice(at + 2).startsWith('  ');
      if (spaced || FOLLOWERS.slice(1).some(token => rest.startsWith(token))) return [index + 1];
      from = at + 2;
    }
  });
}

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

test('detector flags a literal backslash-n used as a line break', () => {
  assert.deepEqual(findCorruptedLines('a();' + MARK + '  // note'), [1]);
  assert.deepEqual(findCorruptedLines('<section>' + MARK + '    {x}'), [1]);
  assert.deepEqual(findCorruptedLines('x' + MARK + '// c'), [1]);
});

test('detector leaves legitimate escaped newlines in strings alone', () => {
  assert.deepEqual(findCorruptedLines("lines.join('" + MARK + "')"), []);
  assert.deepEqual(findCorruptedLines("text+'" + MARK + "'+url"), []);
});

test('no source file contains a corrupted literal line break', () => {
  const offenders = [];
  for (const root of ['src', 'functions', 'worker']) {
    let files = [];
    try { files = sourceFiles(root); } catch { continue; }
    for (const file of files) {
      const lines = findCorruptedLines(readFileSync(file, 'utf8'));
      if (lines.length) offenders.push(file + ':' + lines.join(','));
    }
  }
  assert.deepEqual(offenders, []);
});
