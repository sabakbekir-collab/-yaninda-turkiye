import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const chatCss = readFileSync(new URL('../src/chat.css', import.meta.url), 'utf8');

test('mobile navigation height is defined once and used by the navigation', () => {
  assert.match(css, /:root\\s*\\{[^}]*--mobile-nav-height\\s*:\\s*76px\\s*;/,
    'the measured 76px navigation height must be a root CSS variable');
  assert.match(css, /\\.bottom-nav\\s*\\{[^}]*height\\s*:\\s*var\\(--mobile-nav-height\\)/,
    'the bottom navigation must use the shared height variable');
  assert.doesNotMatch(css, /\\.bottom-nav\\s*\\{[^}]*height\\s*:\\s*76px/,
    'the navigation must not retain a duplicate hard-coded height');
});

test('mobile AI launcher clears the navigation while desktop positioning stays unchanged', () => {
  assert.match(chatCss, /\\.yai-launcher\\s*\\{[^}]*right\\s*:\\s*18px[^}]*bottom\\s*:\\s*82px/,
    'desktop launcher positioning must remain unchanged');
  const mobileRule = chatCss.match(/@media\\s*\\(max-width\\s*:\\s*850px\\)\\s*\\{([\\s\\S]*?)\\n\\}/);
  assert.ok(mobileRule, 'an 850px mobile media query must contain the launcher override');
  assert.match(mobileRule[1], /\\.yai-launcher\\s*\\{[^}]*right\\s*:\\s*16px\\s*!important/);
  assert.match(mobileRule[1], /bottom\\s*:\\s*calc\\(var\\(--mobile-nav-height\\)\\s*\\+\\s*env\\(safe-area-inset-bottom\\)\\s*\\+\\s*12px\\)\\s*!important/);
  assert.match(mobileRule[1], /width\\s*:\\s*48px\\s*!important/);
  assert.match(mobileRule[1], /height\\s*:\\s*48px\\s*!important/);
  assert.match(mobileRule[1], /border-radius\\s*:\\s*50%\\s*!important/);
});
