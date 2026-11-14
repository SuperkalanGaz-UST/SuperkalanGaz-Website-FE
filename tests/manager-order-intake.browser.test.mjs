// Branch Manager order intake + Verify Code. Synthetic session, all API calls mocked; no real writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const branch = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Branch', geofence: null };
const user = {
  id: '55555555-5555-4555-8555-555555555555', email: 'bm@example.invalid',
  app_metadata: { role: 'branch-manager', status: 'Active', display_name: 'BM Test', branch_ids: [branch.id], branches: [branch.name] },
  user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
};
const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const session = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
const prices = [['2.7kg', 210], ['5kg', 360], ['11kg', 679], ['22kg', 1360], ['50kg', 3000]].map(([s, p]) => ({ id: `price-${s}`, cylinder_size: s, unit_price: p, updated_at: '2026-10-22' }));
test('quantity, total, keyboard size select and Verify Code', { timeout: 90000 }, async () => {
const redemptionReads = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === baseUrl) return route.continue();
    if (url.origin === authOrigin) return url.pathname === '/auth/v1/user' ? route.fulfill({ json: user }) : url.pathname === '/auth/v1/token' ? route.fulfill({ json: session }) : route.abort();
    if (url.origin !== apiOrigin) return route.abort();
    if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
    if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [branch] } });
    if (url.pathname === '/api/prices/assigned') return route.fulfill({ json: { prices } });
    if (url.pathname === '/api/loyalty/redemptions/verify/ABC123') return route.fulfill({ json: { redemption: {
      id: 'r1', branch_id: branch.id, customer_id: 'c1', track: 'commercial_30plus1', catalog_item_id: null, reward_description: null, points_spent: null,
      status: 'approved', requested_at: '2026-11-01', approved_by: null, approved_at: null, rejected_reason: null, fulfilled_at: null,
      redemption_code: 'ABC123', created_at: '2026-11-01', updated_at: '2026-11-01', customer_name: 'Ana Cruz', catalog_item_name: null,
      points_balance: null, completed_cycles: 1, current_cycle_count: 0 } } });
    if (url.pathname === '/api/loyalty/redemptions') { redemptionReads.push(url.search); return route.fulfill({ json: { redemptions: [] } }); }
    return route.fulfill({ json: { serviceRequests: [], requests: [], riders: [], notifications: [], unreadCount: 0, catalog: [], items: [] } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // Order intake
  await page.goto(`${baseUrl}/branch-manager/service-requests`);
  await page.getByRole('button', { name: 'New Request' }).click();
  const size = page.getByLabel('Cylinder Size', { exact: true });
  assert.equal(await size.getAttribute('role'), 'combobox', 'label is linked to the size select');
  await size.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: /^11kg/ }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'option');
  for (let i = 0; i < 5; i++) {
    if (/^11kg/.test(await page.evaluate(() => document.activeElement?.textContent ?? ''))) break;
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  assert.match(await size.innerText(), /11kg/, 'keyboard selection shows readable label');

  const qty = page.getByLabel('Quantity', { exact: true });
  await qty.click();
  await qty.press('Control+A');
  await qty.press('Backspace');
  assert.equal(await qty.inputValue(), '', 'cleared quantity stays empty');
  await qty.pressSequentially('2');
  assert.equal(await qty.inputValue(), '2', 'typing 2 gives 2, not 12');
  const total = await page.getByText(/^Total ₱/).innerText();
  assert.match(total, /1,358\.00/, `total is 2 x 679 (got "${total}")`);

  await qty.press('Control+A');
  await qty.press('Backspace');
  await qty.blur();
  await page.getByText('Quantity must be at least 1').waitFor();
  assert.equal(await page.getByText(/^Total ₱/).count(), 0, 'no total for empty quantity');

  // Verify Code
  await page.goto(`${baseUrl}/branch-manager/rewards`);
  await page.getByPlaceholder('Search by code…').fill('ABC123');
  await page.getByRole('button', { name: 'Verify Code' }).click();
  const status = page.getByRole('status').filter({ hasText: 'Code ABC123' });
  await status.waitFor();
  assert.match(await status.innerText(), /Ana Cruz/);
  assert.equal(await page.getByRole('tab', { name: 'Commercial 30+1' }).getAttribute('aria-selected'), 'true', 'switched to commercial track');
  await page.waitForTimeout(500);
  assert.ok(redemptionReads.some(q => q.includes('track=commercial_30plus1') && q.includes('status=all')), `refetched commercial/all: ${redemptionReads.join(' | ')}`);

  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
});
