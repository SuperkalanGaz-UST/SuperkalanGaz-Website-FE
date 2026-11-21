// Branch Manager accuracy and wording: no-customer warning, "Create & start another",
// edit total priced like the API, rider map below the queue, Fleet status split, one
// low-stock rule, "Delivery Rider" wording. Synthetic session; all API calls mocked.
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
const now = new Date().toISOString();
// Recorded at ₱650 when it was created; today's catalog price is ₱679.
const pending = {
  id: '77777777-7777-4777-8777-777777777777', sr_code: 'SR-1', branch_id: branch.id, customer_id: null, customer_code: null, order_source: 'Walk-in/Phone',
  status: 'Pending', customer_name: 'Lito Reyes', customer_contact: '+639171234567', delivery_address: '1 Test St', cylinder_size: '11kg', quantity: 1,
  items: [{ cylinder_size: '11kg', quantity: 1, unit_price: 650 }], unit_price: 650, total_amount: 650, special_instructions: null, rider_id: null,
  requested_at: now, dispatched_at: null, in_transit_at: null, delivered_at: null, delay_reason: null, sla_breached: false, sla_breach_segment: null, sla_breached_at: null, created_at: now,
};
const riders = [
  { id: 'r1', name: 'Ben Available', status: 'Available', assigned_vehicle: null },
  { id: 'r2', name: 'Cora Busy', status: 'On Delivery', assigned_vehicle: null },
  { id: 'r3', name: 'Dan Busy', status: 'On Delivery', assigned_vehicle: null },
];
const stock = [
  { product_id: 'p1', product_name: '11kg LPG Cylinder', current_qty: 8, threshold_qty: 10, capacity_qty: 40 },
  { product_id: 'p2', product_name: '22kg LPG Cylinder', current_qty: 14, threshold_qty: 10, capacity_qty: 40 },
];

test('Branch Manager accuracy and wording fixes', { timeout: 180000 }, async () => {
  const posts = [];
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    await context.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin) return url.pathname === '/auth/v1/user' ? route.fulfill({ json: user }) : url.pathname === '/auth/v1/token' ? route.fulfill({ json: session }) : route.abort();
      if (url.origin !== apiOrigin) return route.abort();
      if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
      if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [branch] } });
      if (url.pathname === '/api/prices/assigned') return route.fulfill({ json: { prices } });
      if (url.pathname === '/api/riders') return route.fulfill({ json: { riders } });
      if (url.pathname === '/api/customers') return route.fulfill({ json: { customers: [] } });
      if (url.pathname === '/api/inventory/stock-levels') return route.fulfill({ json: { stockLevels: stock, stock_levels: stock, items: stock } });
      if (url.pathname === '/api/service-requests' && req.method() === 'POST') {
        posts.push(req.postDataJSON());
        return route.fulfill({ status: 201, json: { serviceRequest: { id: 'new' } } });
      }
      if (url.pathname.startsWith('/api/service-requests')) return route.fulfill({ json: { serviceRequests: [pending], requests: [pending] } });
      return route.fulfill({ json: { notifications: [], unreadCount: 0, vehicles: [], redemptions: [], items: [] } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));

    // The Delivery Rider map sits below the queue.
    await page.goto(`${baseUrl}/branch-manager/service-requests`);
    await page.getByText('Lito Reyes').first().waitFor();
    const mapBelowQueue = await page.evaluate(() => {
      const table = document.querySelector('table');
      const map = [...document.querySelectorAll('button')].find(b => /Hide map|Show map/.test(b.textContent ?? ''));
      return !!table && !!map && (table.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    assert.equal(mapBelowQueue, true, 'rider map follows the queue');

    // Edit shows the new total: the recorded 11kg price is kept, a new size uses today's price.
    await page.getByRole('button', { name: 'More actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await page.getByText('New total ₱650.00').waitFor();
    await page.locator('#edit-quantity-' + pending.id + '-0').fill('2');
    await page.getByText('New total ₱1,300.00').waitFor();
    await page.locator('#edit-cylinder-' + pending.id + '-0').selectOption('5kg');
    await page.getByText('New total ₱720.00').waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    // No linked customer: warned; "Create & start another" keeps the form open.
    await page.getByRole('button', { name: 'New Request' }).click();
    await page.getByText('No customer linked — this order will not earn loyalty points.').waitFor();
    await page.getByPlaceholder('Search existing customer or type new name...').fill('Walk-in Buyer');
    await page.getByPlaceholder('+63 9XX XXX XXXX').fill('9171234567');
    await page.getByPlaceholder('123 Mabini St, Makati').fill('123 Rizal Street, Manila');
    await page.locator('#new-request-cylinder').click();
    await page.getByRole('option', { name: /^11kg/ }).click();
    await page.getByRole('button', { name: 'Create & start another' }).click();
    await page.getByText('Walk-in/phone service request created.').waitFor();
    assert.equal(posts.length, 1);
    assert.equal(await page.getByRole('heading', { name: 'New Walk-in / Phone Request' }).count(), 1, 'form stays open');
    assert.equal(await page.getByPlaceholder('123 Mabini St, Makati').inputValue(), '', 'form is cleared for the next order');

    // Fleet splits Available from On Delivery.
    await page.goto(`${baseUrl}/branch-manager/fleet`);
    const stat = label => page.locator('[class*="statCard"]', { has: page.getByText(label, { exact: true }) }).locator('[class*="statValue"]');
    await page.getByText('Available', { exact: true }).first().waitFor();
    assert.equal(await stat('Available').innerText(), '1');
    assert.equal(await stat('On Delivery').innerText(), '2');
    assert.equal(await page.getByText('Active Delivery Riders').count(), 0);

    // Overview counts low stock like Inventory: 14 of threshold 10 is not low.
    await page.goto(`${baseUrl}/branch-manager/dashboard`);
    await page.getByText('8 remaining (Threshold: 10)').first().waitFor();
    assert.equal(await page.getByText('14 remaining (Threshold: 10)').count(), 0);
    await page.getByRole('columnheader', { name: 'Delivery Rider' }).first().waitFor();

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
