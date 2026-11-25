import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

test('owner daily and hourly volume use Philippine dates even on a device in another timezone', { timeout: 60000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles' });
    const branch = { id: '11111111-1111-4111-8111-111111111111', name: 'Volume Test Branch', geofence: null };
    const user = { id: '22222222-2222-4222-8222-222222222222', email: 'volume@example.invalid', app_metadata: { role: 'branch-owner', status: 'Active', branch_ids: [branch.id], branches: [branch.name] }, user_metadata: {}, aud: 'authenticated' };
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const session = { access_token: [encode({ alg: 'HS256' }), encode({ sub: user.id, exp }), 'test'].join('.'), refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    const dates = [];
    const labels = ['Tue 27', 'Wed 28', 'Thu 29', 'Fri 30', 'Sat 31', 'Sun 1', 'Mon 2'];
    const daily = labels.map((day, index) => ({ day, orders: index === 6 ? 1 : 0 }));
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, orders: hour === 0 ? 1 : 0 }));
    // Every Auth and API response is synthetic; no live accounts or orders change.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin) return route.fulfill({ json: url.pathname.endsWith('/token') ? session : user });
      if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [branch] } });
      if (url.pathname === '/api/service-requests/reports/branch-owner-dashboard') {
        assert.equal(url.searchParams.get('branchId'), branch.id);
        dates.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
        return route.fulfill({ json: { metrics: { ordersToday: 1, totalOrders: 1, completedDeliveries: 0, cancelledFailedDeliveries: 0, slaBreaches: 0, loyaltyClaimsThisMonth: 0, deliveryCompletionRate: 0, dailyOrderVolume: daily, hourlyOrderVolume: hourly } } });
      }
      return route.fulfill({ json: { report: { average_stars: null, total_responses: 0 }, notifications: [], unread_count: 0, records: [], rows: [], total: 0 } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Manila is already November 2; Los Angeles and UTC are still November 1.
    await page.clock.setFixedTime(new Date('2026-11-01T16:30:00Z'));
    await page.goto(`${baseUrl}/branch-owner/order-analytics`);
    await page.getByRole('heading', { name: 'Daily Order Volume (Last 7 Days)', exact: true }).waitFor();
    const chart = page.locator('.recharts-wrapper').first();
    await chart.getByText('Mon 2', { exact: true }).waitFor();
    assert.deepEqual(await chart.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').allTextContents(), labels);
    assert.ok(dates.some(range => range.from === '2026-11-01' && range.to === '2026-11-02'));
    assert.ok(dates.some(range => range.from === '2026-10-01' && range.to === '2026-10-02'));
    await page.getByRole('button', { name: 'Hour', exact: true }).click();
    await page.getByRole('heading', { name: 'Hourly Order Volume (Today)', exact: true }).waitFor();
    await chart.getByText('00:00', { exact: true }).waitFor();
    assert.equal(await chart.getByText('24:00', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await chart.getByText('Mon 2', { exact: true }).waitFor();
    assert.deepEqual(await chart.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value').allTextContents(), labels);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
