import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/TargetApp.tsx', import.meta.url), 'utf8');
const support = readFileSync(new URL('../src/CustomerSupport.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('customer support is reachable from the home quick actions and menu', () => {
  assert.match(app, /nav\('\/customer-support'\)/);
  assert.match(app, /\['\/customer-support','Müşteri Hizmetleri',Phone\]/);
  assert.match(app, /<Route path="\/customer-support" element={<CustomerSupport\/>}\/>/);
});

test('customer support keeps search, category filters, tap-to-call and verification warning', () => {
  assert.match(support, /Kurum veya telefon ara/);
  assert.match(support, /Operatör.*Banka.*Kargo/s);
  assert.match(support, /href=\{'tel:'/);
  assert.match(support, /resmî kaynaklardan henüz doğrulanmamıştır/);
  assert.match(support, /kart şifreni veya SMS doğrulama kodunu kimseyle paylaşma/);
});

test('customer support styles include a narrow-screen single-column layout', () => {
  assert.match(styles, /\.support-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:600px\)\{\.support-page/);
  assert.match(styles, /\.support-list\{grid-template-columns:1fr\}/);
});
