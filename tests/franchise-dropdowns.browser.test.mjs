import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

test('Franchise Administrator dropdowns retain their selections with Dashboard styling', { timeout: 120000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const user = { id: '22222222-2222-4222-8222-222222222222', email: 'dropdown@example.invalid', app_metadata: { role: 'franchise-admin', status: 'Active' }, user_metadata: {}, aud: 'authenticated' };
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const session = { access_token: [encode({ alg: 'HS256' }), encode({ sub: user.id, exp }), 'test'].join('.'), refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    // Synthetic sessions and intercepted requests never modify live records.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin) return route.fulfill({ json: user });
      if (url.pathname === '/api/branches') return route.fulfill({ json: { branches: [{ id: 'branch-a', name: 'Test Branch A', status: 'active', code: 'A', created_at: '2026-01-01', province: 'Test Province', city: null }] } });
      if (url.pathname === '/api/governance/requests') return route.fulfill({ json: { requests: [] } });
      if (url.pathname === '/api/governance/sla-thresholds') return route.fulfill({ json: { thresholds: { request_to_dispatch: 15, dispatch_to_in_transit: 20 } } });
      if (url.pathname === '/api/franchise-reports/orders') return route.fulfill({ json: { total: 0, delivered: 0, cancelled: 0, daily: [], statuses: [], completion: [], topCustomers: [] } });
      if (url.pathname === '/api/franchise-reports/customers') return route.fulfill({ json: { rows: [], total: 0, summary: { customers: 0, eligible: 0, orders: 0, averageRating: null } } });
      if (url.pathname === '/api/franchise-reports/csat') return route.fulfill({ json: { total: 0, rating: null, complaints: 0 } });
      return route.fulfill({ json: { rows: [], total: 0, notifications: [], unread_count: 0, users: [], series: [] } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const appearance = locator => locator.evaluate(element => {
      const style = getComputedStyle(element);
      return { radius: style.borderRadius, border: style.borderColor };
    });
    await page.goto(`${baseUrl}/franchise-admin/dashboard`);
    const reference = page.getByRole('button', { name: 'All Provinces', exact: true });
    await reference.waitFor();
    const expected = await appearance(reference);

    for (const screen of ['order-analytics', 'customers', 'csat', 'customer-ratings', 'complaint-log']) {
      await page.goto(`${baseUrl}/franchise-admin/${screen}`);
      const branch = page.getByRole('combobox', { name: 'Filter by branch', exact: true });
      await branch.waitFor();
      assert.deepEqual(await appearance(branch), expected, `${screen} uses Dashboard trigger styling`);
      assert.equal((await branch.boundingBox()).height, 42, 'report dropdown keeps its original height');
      if (screen === 'customers') {
        const searchBox = await page.getByLabel('Search customers').boundingBox();
        const branchBox = await branch.boundingBox();
        const statusBox = await page.getByRole('combobox', { name: 'Filter customer status' }).boundingBox();
        assert.equal(branchBox.y, statusBox.y, 'customer filters stay on the same row');
        assert.ok(Math.abs(searchBox.y + searchBox.height / 2 - branchBox.y - branchBox.height / 2) < 1, 'search and dropdowns align');
        assert.ok(searchBox.x < branchBox.x && branchBox.x + branchBox.width <= statusBox.x, 'search, branch and status retain their original order');
        assert.ok(statusBox.width < 250, 'status filter stays compact instead of filling the row');
      }
      const initialWidth = (await branch.boundingBox()).width;
      await branch.click();
      const filteredRequest = page.waitForRequest(request => request.url().includes('branchId=branch-a'));
      await page.getByRole('option', { name: 'Test Branch A', exact: true }).click();
      await filteredRequest;
      assert.match(await branch.innerText(), /Test Branch A/);
      assert.equal((await branch.boundingBox()).width, initialWidth, 'selection does not resize the dropdown');
      await branch.click();
      await page.getByRole('option', { name: 'All Branches', exact: true }).click();
      assert.match(await branch.innerText(), /All Branches/);
      const label = screen === 'customers' ? 'Filter customer status' : screen === 'customer-ratings' ? 'Filter star rating' : screen === 'complaint-log' ? 'Filter incident status' : null;
      if (label) {
        const filter = page.getByRole('combobox', { name: label });
        assert.deepEqual(await appearance(filter), expected);
        await filter.click();
        await page.keyboard.press('Escape');
        assert.equal(await filter.getAttribute('aria-expanded'), 'false');
      }
    }
    await page.goto(`${baseUrl}/franchise-admin/franchise-registry`);
    const method = page.getByRole('combobox', { name: 'SLA Breach Notification Method' });
    assert.deepEqual(await appearance(method), expected);
    assert.equal((await method.boundingBox()).height, 38, 'registry dropdown keeps its original height');
    await method.click();
    await page.getByRole('option', { name: 'Email Only', exact: true }).click();
    assert.match(await method.innerText(), /Email Only/);

    await page.goto(`${baseUrl}/franchise-admin/governance-requests`);
    const segment = page.getByRole('combobox', { name: 'SLA segment', exact: true });
    assert.deepEqual(await appearance(segment), expected);
    assert.equal((await segment.boundingBox()).height, 44, 'SLA dropdown keeps its original height');
    await segment.click();
    await page.getByRole('option', { name: 'Dispatch to in transit', exact: true }).click();
    await page.getByText('Currently 20 minutes', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
