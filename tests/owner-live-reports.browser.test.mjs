import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

test('owner reports refresh automatically, recover independently, and roll over Philippine dates', { timeout: 120000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'America/Los_Angeles' });
    const branch = { id: '11111111-1111-4111-8111-111111111111', name: 'Live Test Branch', geofence: null };
    const user = { id: '22222222-2222-4222-8222-222222222222', email: 'live@example.invalid', app_metadata: { role: 'branch-owner', status: 'Active', branch_ids: [branch.id], branches: [branch.name] }, user_metadata: {}, aud: 'authenticated' };
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const exp = Date.parse('2030-01-01T00:00:00Z') / 1000;
    const session = { access_token: [encode({ alg: 'HS256' }), encode({ sub: user.id, exp }), 'test'].join('.'), refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    let count = 1;
    let failCsat = false;
    const queries = [];
    const proofs = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin) return route.fulfill({ json: url.pathname.endsWith('/token') ? session : user });
      if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [branch] } });
      if (url.pathname === '/api/service-requests/reports/branch-owner-dashboard') {
        assert.equal(url.searchParams.get('branchId'), branch.id);
        queries.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
        return route.fulfill({ json: { metrics: { ordersToday: count, totalOrders: url.searchParams.get('from') === '2026-11-01' ? count : 0, completedDeliveries: count, cancelledFailedDeliveries: 0, slaBreaches: 0, loyaltyClaimsThisMonth: count, deliveryCompletionRate: 100, earningsToday: [{ hour: '12:00', earnings: count * 100 }], earningsThisWeek: [], earningsThisMonth: [], dailyOrderVolume: [{ day: 'Wed 25', orders: count }], hourlyOrderVolume: [{ hour: '12:00', orders: count }] } } });
      }
      if (url.pathname === '/api/csat/reports/dashboard-summary') return route.fulfill(failCsat ? { status: 503, json: { message: 'Unavailable' } } : { json: { report: { average_stars: 4.5, total_responses: count } } });
      if (url.pathname === '/api/service-requests/delivery-records') {
        proofs.push(count);
        return route.fulfill({ json: { serviceRequests: count > 1 ? [{ id: 'proof-1', sr_code: 'LIVE-SR', customer_name: 'Live Customer', cylinder_size: '11kg', quantity: 1, delivered_at: '2026-11-25T04:00:00Z' }] : [] } });
      }
      return route.fulfill({ json: { notifications: [], unread_count: 0, rows: [], records: [], total: 0 } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-11-25T04:00:00Z') });
    const card = label => page.locator('div.rounded-2xl', { has: page.getByText(label, { exact: true }) }).first();
    await page.goto(`${baseUrl}/branch-owner/dashboard`);
    await card('Orders Today').getByText('1', { exact: true }).waitFor();
    count = 2;
    await page.clock.fastForward(30_000);
    await card('Orders Today').getByText('2', { exact: true }).waitFor();
    failCsat = true;
    count = 3;
    await page.clock.fastForward(30_000);
    await card('Orders Today').getByText('3', { exact: true }).waitFor();
    await page.getByRole('alert').filter({ hasText: 'Some report data is unavailable' }).waitFor();
    assert.equal(await card('Average CSAT Score').getByText('4.5', { exact: true }).count(), 0);
    failCsat = false;
    await page.clock.fastForward(30_000);
    await card('Average CSAT Score').getByText('4.5', { exact: true }).waitFor();
    await page.getByRole('alert').filter({ hasText: 'Some report data is unavailable' }).waitFor({ state: 'hidden' });

    count = 1;
    await page.goto(`${baseUrl}/branch-owner/order-analytics`);
    await page.getByText('No orders in the same period last month', { exact: true }).waitFor();
    await page.getByText('No completed deliveries found for this branch.', { exact: true }).waitFor();
    const monthRow = page.getByRole('row').filter({ has: page.getByText('November 2026', { exact: true }) });
    await monthRow.getByRole('cell').nth(2).getByText('1', { exact: true }).waitFor();
    count = 4;
    await page.clock.fastForward(30_000);
    await card('Completed Deliveries').getByText('4', { exact: true }).waitFor();
    await monthRow.getByRole('cell').nth(2).getByText('4', { exact: true }).waitFor();
    await page.getByText('LIVE-SR', { exact: true }).waitFor();
    assert.ok(proofs.includes(4));

    await page.clock.setSystemTime(new Date('2026-11-30T15:59:45Z'));
    const rolloverRequest = page.waitForRequest(request => request.url().includes('from=2026-12-01') && request.url().includes('to=2026-12-01'));
    await page.clock.fastForward(30_000);
    await rolloverRequest;
    assert.ok(queries.some(query => query.from === '2026-11-01' && query.to === '2026-11-01'));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
