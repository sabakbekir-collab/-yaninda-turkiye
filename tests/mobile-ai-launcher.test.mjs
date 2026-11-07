import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const chatCss = readFileSync(new URL('../src/chat.css', import.meta.url), 'utf8');

test('mobile AI launcher is positioned above the actual 76px bottom navigation', () => {
  assert.match(css, /--mobile-nav-height\s*:\s*76px\s*;/,
    'the measured mobile navigation height must be represented by a CSS variable');
  assert.match(chatCss, /bottom\s*:\s*calc\(var\(--mobile-nav-height\)\s*\+\s*env\(safe-area-inset-bottom\)\s*\+\s*12px\)\s*!important/,
    'the AI launcher must clear the navigation and iPhone safe area');
  assert.match(chatCss, /width\s*:\s*48px\s*!important/);
  assert.match(chatCss, /height\s*:\s*48px\s*!important/);
  assert.match(chatCss, /right\s*:\s*16px\s*!important/);
});
