// Branch Owner risky actions and reports: Branch Manager deactivation needs a reason and
// runs once; month-to-date compares with the same days last month and the revenue arrow
// follows the real direction; duplicate Fleet panel and completion "View all" are gone.
// Synthetic session; all API calls mocked.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const branch = { id: '11111111-1111-4111-8111-111111111111', name: 'Amadeo', geofence: null };
const user = {
  id: '55555555-5555-4555-8555-555555555555', email: 'owner@example.invalid',
  app_metadata: { role: 'branch-owner', status: 'Active', display_name: 'Owner', branch_ids: [branch.id], branches: [branch.name] },
  user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
};
const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const session = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
const manager = { id: '66666666-6666-4666-8666-666666666666', email: 'manager@example.invalid', username: 'ana', display_name: 'Ana Manager', phone: '+639171234567', branch_ids: [branch.id], branches: [branch.name], status: 'Active', created_at: '2026-10-01T00:00:00.000Z', last_login_at: null };

// Same arithmetic as the app: last month's 1st through today's day of the month.
const day = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = new Date();
const previousFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const previousEnd = new Date(previousFirst.getFullYear(), previousFirst.getMonth(), Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate()));
const previousPeriod = { from: day(previousFirst), to: day(previousEnd) };
const currentFirst = day(new Date(now.getFullYear(), now.getMonth(), 1));

test('Branch Owner actions and reports', { timeout: 180000 }, async () => {
  const deletes = [];
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
      if (url.pathname === '/api/service-requests/reports/branch-owner-dashboard') {
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const samePeriod = from === previousPeriod.from && to === previousPeriod.to;
        // Revenue fell 20% against the same days last month, but rose against all of last month.
        const totalRevenue = from === currentFirst ? 800 : samePeriod ? 1000 : 500;
        const totalOrders = from === currentFirst ? 10 : samePeriod ? 8 : 20;
        return route.fulfill({ json: { metrics: { ordersToday: 1, totalOrders, totalRevenue, completedDeliveries: 5, cancelledFailedDeliveries: 0, slaBreaches: 0, loyaltyClaimsThisMonth: 0, deliveryCompletionRate: 50, revenueByTank: [], dailyOrderVolume: [], hourlyOrderVolume: [] } } });
      }
      if (url.pathname === '/api/users' && req.method() === 'GET') return route.fulfill({ json: { users: [manager] } });
      if (url.pathname === `/api/users/${manager.id}` && req.method() === 'DELETE') {
        deletes.push(req.postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 400));
        return route.fulfill({ json: { ok: true } });
      }
      return route.fulfill({ json: { invitations: [], notifications: [], unreadCount: 0, report: null, riders: [], sales: [], vehicles: [] } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));

    // Revenue compares month-to-date with the same days of last month; the arrow points down.
    await page.goto(`${baseUrl}/branch-owner/sales-overview`);
    const revenueCard = page.locator('div.rounded-2xl', { has: page.getByText('Revenue vs Last Month', { exact: true }) });
    await revenueCard.getByText('-20.0%', { exact: true }).waitFor();
    assert.equal(await revenueCard.locator('svg.lucide-arrow-down-right').count(), 1, 'down arrow for a drop');

    // Orders use the same period too.
    await page.goto(`${baseUrl}/branch-owner/order-analytics`);
    await page.getByText(/vs same period last month/).first().waitFor();
    await page.getByText('+25.0%').first().waitFor();
    assert.equal(await page.getByRole('link', { name: 'View all' }).count(), 0, 'completion table has no duplicate full view');

    // Fleet shows the rider list once.
    await page.goto(`${baseUrl}/branch-owner/fleet`);
    await page.getByText('Fleet roster', { exact: true }).waitFor();
    assert.equal(await page.getByText('Delivery Rider Status', { exact: true }).count(), 0);

    // Deactivating a Branch Manager needs a reason and sends one request.
    await page.goto(`${baseUrl}/branch-owner/user-management`);
    await page.getByTitle('Deactivate Branch Manager').first().click();
    const confirm = page.getByRole('button', { name: 'Deactivate', exact: true });
    assert.equal(await confirm.isDisabled(), true, 'a reason is required');
    await page.getByPlaceholder('Why is this Branch Manager being deactivated?').fill('Resigned last week');
    await confirm.click();
    await page.getByRole('button', { name: 'Deactivating…' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Deactivating…' }).isDisabled(), true, 'no second request while saving');
    await page.getByRole('heading', { name: 'Deactivate Branch Manager' }).waitFor({ state: 'hidden' });
    assert.deepEqual(deletes, [{ reason: 'Resigned last week' }]);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
