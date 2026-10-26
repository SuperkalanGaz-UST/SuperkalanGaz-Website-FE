import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic Auth/API responses only. These tests never read or write live CRM records.
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const branches = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Inventory Alpha', geofence: null },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Inventory Beta', geofence: null },
];
const sizes = ['50kg', '22kg', '11kg', '5kg', '2.7kg'];

async function setup(browser) {
  const user = {
    id: '33333333-3333-4333-8333-333333333333', email: 'inventory-test@example.invalid',
    app_metadata: { role: 'branch-owner', status: 'Active', display_name: 'Inventory Test', branch_ids: branches.map(b => b.id), branches: branches.map(b => b.name) },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.synthetic`,
    refresh_token: 'synthetic', expires_at: expiresAt, expires_in: 3600, token_type: 'bearer', user,
  };
  const state = { reads: [], priceReads: [], writes: [], mode: 'success', quantity: 7, delayStock: null, delayPrice: null };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session,
  });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin === authOrigin) {
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.pathname === '/auth/v1/token') return route.fulfill({ json: session });
      return route.abort();
    }
    if (url.origin !== apiOrigin) return route.abort();
    if (request.method() !== 'GET') state.writes.push({ path: url.pathname, method: request.method() });
    if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
    if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches } });
    // Preserve this suite's unavailable-reward scenario alongside the new real-reward suite.
    if (url.pathname === '/api/inventory/reward-stock-levels/owner') return route.fulfill({ status: 503, json: { message: 'Reward inventory is unavailable' } });
    if (url.pathname === '/api/inventory/stock-levels/owner') {
      const branchId = url.searchParams.get('branchId');
      assert.ok(branches.some(b => b.id === branchId));
      assert.equal(request.method(), 'GET');
      state.reads.push(branchId);
      if (branchId === branches[1].id && state.delayStock) await state.delayStock;
      if (state.mode === 'error') return route.fulfill({ status: 503, json: { message: 'Inventory unavailable for this branch.' } });
      const stockLevels = state.mode === 'empty' ? [] : [{
        branch_id: state.mode === 'wrong-branch' ? branches[1].id : branchId,
        product_id: 'product-11kg', product_name: '11kg LPG Cylinder', cylinder_size: '11kg',
        current_qty: branchId === branches[0].id ? state.quantity : 80,
        threshold_qty: branchId === branches[0].id ? 10 : 20,
        capacity_qty: branchId === branches[0].id ? 40 : 160,
      }, ...(branchId === branches[0].id ? [{
        branch_id: branchId, product_id: 'product-50kg', product_name: '50kg LPG Cylinder',
        cylinder_size: '50kg', current_qty: 0, threshold_qty: 4, capacity_qty: 30,
      }] : [])];
      return route.fulfill({ json: { stockLevels } });
    }
    if (url.pathname.startsWith('/api/prices/for-branch/')) {
      const branchId = url.pathname.split('/').at(-1);
      state.priceReads.push(branchId);
      if (branchId === branches[1].id && state.delayPrice) await state.delayPrice;
      return route.fulfill({ json: { prices: sizes.map((size, i) => ({
        id: `product-${size}`, cylinder_size: size,
        unit_price: (branchId === branches[0].id ? 600 : 1600) + i,
        updated_at: '2026-10-22T00:00:00Z',
      })) } });
    }
    if (url.pathname.startsWith('/api/inventory')) throw new Error(`Unexpected inventory endpoint: ${url.pathname}`);
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, state, errors };
}

async function select(page, name) {
  await page.getByRole('button', { name: /Select branch|Inventory Alpha|Inventory Beta/, exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}
async function screenshot(page, name) {
  if (!process.env.TEST_ARTIFACT_DIR) return;
  await mkdir(process.env.TEST_ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/${name}.png`, fullPage: true });
}
const launch = () => chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });

test('Owner inventory scopes quantities/prices, preserves labels/capacity and stays read-only across delayed switches', { timeout: 90_000 }, async () => {
  const browser = await launch();
  try {
    const { context, page, state, errors } = await setup(browser);
    await page.goto(`${baseUrl}/branch-owner/inventory`);
    await page.getByText('Select an assigned branch to view its inventory.', { exact: true }).waitFor();
    assert.deepEqual(state.reads, []);
    assert.deepEqual(state.priceReads, []);
    await select(page, branches[0].name);
    await page.getByText('7 units', { exact: true }).waitFor();
    await page.getByText('₱602.00 retail price', { exact: true }).waitFor();
    assert.equal(await page.getByText('Low Stock', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Out of Stock', { exact: true }).count(), 1);
    const gauge = page.getByRole('progressbar', { name: '11kg LPG Cylinder stock level', exact: true });
    assert.equal(await gauge.getAttribute('aria-valuemax'), '40');
    assert.equal(await gauge.locator('div').evaluate(el => el.style.width), '17.5%');
    await screenshot(page, 'owner-inventory-alpha');
    await page.getByRole('button', { name: 'Reward Merchandise', exact: true }).click();
    await page.getByText('Reward inventory is unavailable', { exact: true }).waitFor();
    assert.equal(await page.getByText('Notebook and Pen', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'LPG Cylinders', exact: true }).click();

    let releaseStock;
    let releasePrice;
    state.delayStock = new Promise(resolve => { releaseStock = resolve; });
    state.delayPrice = new Promise(resolve => { releasePrice = resolve; });
    await select(page, branches[1].name);
    await page.getByText('Loading stock levels…', { exact: true }).waitFor();
    assert.equal(await page.getByText('7 units', { exact: true }).count(), 0);
    assert.equal(await page.getByText('₱602.00 retail price', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('progressbar').count(), 0);
    assert.equal(await page.getByText('—', { exact: true }).count(), 3);
    releaseStock();
    await page.getByText('80 units', { exact: true }).waitFor();
    await page.getByText('Price unavailable', { exact: true }).waitFor();
    releasePrice();
    await page.getByText('₱1,602.00 retail price', { exact: true }).waitFor();
    assert.equal(await gauge.getAttribute('aria-valuemax'), '160');
    assert.equal(await gauge.locator('div').evaluate(el => el.style.width), '50%');
    await page.getByText('In Stock', { exact: true }).waitFor();
    await screenshot(page, 'owner-inventory-beta');

    // A later read must reflect changed backend stock rather than a hardcoded or stale total.
    state.quantity = 23;
    await select(page, branches[0].name);
    await page.getByText('23 units', { exact: true }).waitFor();
    assert.equal(await page.getByText('80 units', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Add item|Update Inventory|Adjust stock|Delete|Submit Request|Mark Delivered/i }).count(), 0);
    assert.ok(state.reads.includes(branches[0].id) && state.reads.includes(branches[1].id));
    assert.deepEqual(state.writes, []);
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
});

test('Owner inventory hides data on unavailable or wrong-branch responses and handles an empty catalog', { timeout: 90_000 }, async () => {
  const browser = await launch();
  try {
    const { context, page, state } = await setup(browser);
    state.mode = 'error';
    await page.goto(`${baseUrl}/branch-owner/inventory`);
    await page.getByText('Select an assigned branch to view its inventory.', { exact: true }).waitFor();
    await select(page, branches[0].name);
    await page.getByRole('alert').filter({ hasText: 'Inventory unavailable for this branch.' }).waitFor();
    assert.equal(await page.getByRole('progressbar').count(), 0);
    assert.equal(await page.getByText('—', { exact: true }).count(), 3);
    state.mode = 'wrong-branch';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'The inventory response did not match the selected branch.' }).waitFor();
    assert.equal(await page.getByRole('progressbar').count(), 0);
    state.mode = 'empty';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByText('No inventory items are available for this branch.', { exact: true }).waitFor();
    assert.deepEqual(state.writes, []);
    await context.close();
  } finally { await browser.close(); }
});
