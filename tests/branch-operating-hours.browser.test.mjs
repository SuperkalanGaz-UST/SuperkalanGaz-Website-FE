import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// All Auth and CRM responses are synthetic. The test performs no live writes.
test('Branch Owner saves operating hours, reloads Fleet, and switches to an unset branch', { timeout: 60_000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const branches = [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Hours Alpha', geofence: null },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Hours Beta', geofence: null },
  ];
  const user = {
    id: '33333333-3333-4333-8333-333333333333', email: 'hours@example.invalid',
    app_metadata: { role: 'branch-owner', status: 'Active', display_name: 'Hours Test',
      branch_ids: branches.map(branch => branch.id), branches: branches.map(branch => branch.name) },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp })}.synthetic`,
    refresh_token: 'synthetic', token_type: 'bearer', expires_at: exp, expires_in: 3600, user,
  };
  const writes = [];
  const hoursByBranch = new Map();
  let hoursUnavailable = false;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
      key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session,
    });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin && url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.origin !== apiOrigin) return route.abort();
      if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
      if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches } });
      if (url.pathname === '/api/inventory/stock-levels/owner') return route.fulfill({ json: { stockLevels: [] } });
      if (url.pathname === '/api/riders') return route.fulfill({ json: { riders: [] } });
      if (url.pathname === '/api/vehicles/locations') return route.fulfill({ json: { vehicles: [{
        id: 'vehicle', plate_number: 'TEST-01', tracker_connected: true, geofence_status: 'unknown', position: null,
      }] } });
      const branchId = url.pathname.match(/^\/api\/branches\/([^/]+)\/operating-hours$/)?.[1];
      if (branchId) {
        assert.ok(branches.some(branch => branch.id === branchId));
        if (hoursUnavailable) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
        if (request.method() === 'PATCH') {
          const hours = request.postDataJSON();
          writes.push({ branchId, hours });
          hoursByBranch.set(branchId, hours);
        }
        return route.fulfill({ json: { operatingHours: hoursByBranch.get(branchId) ?? null } });
      }
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    });
    const page = await context.newPage();
    const selectBranch = async (from, to) => {
      await page.getByRole('button', { name: from, exact: true }).click();
      await page.getByRole('button', { name: to, exact: true }).click();
    };

    await page.goto(`${baseUrl}/branch-owner/settings`);
    await page.getByRole('tab', { name: 'Branch Settings', exact: true }).click();
    await page.getByText('Select a branch to set its operating hours.', { exact: true }).waitFor();
    await selectBranch('Select branch', branches[0].name);
    const opening = page.getByLabel('Opening time', { exact: true });
    const closing = page.getByLabel('Closing time', { exact: true });
    assert.equal(await opening.inputValue(), '');
    await opening.fill('22:00');
    await closing.fill('06:30');
    await page.getByText('Closing time is on the following day.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Save operating hours', exact: true }).click();
    await page.getByText(`Operating hours saved for ${branches[0].name}.`, { exact: true }).waitFor();
    assert.deepEqual(writes, [{ branchId: branches[0].id, hours: { openingTime: '22:00', closingTime: '06:30' } }]);

    await page.goto(`${baseUrl}/branch-owner/fleet`);
    await selectBranch('Select branch', branches[0].name);
    const shownHours = page.getByText('10:00 PM – 6:30 AM (next day) Philippine time', { exact: true });
    await shownHours.waitFor();
    await page.getByText('Waiting for a fresh vehicle GPS fix.', { exact: true }).waitFor();
    hoursUnavailable = true;
    await selectBranch(branches[0].name, branches[1].name);
    const unavailable = page.getByRole('status').filter({ hasText: 'Operating hours unavailable.' });
    await unavailable.waitFor();
    assert.equal(await shownHours.count(), 0);
    hoursUnavailable = false;
    await unavailable.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText('Operating hours not set.', { exact: true }).waitFor();
  } finally {
    await browser.close();
  }
});
