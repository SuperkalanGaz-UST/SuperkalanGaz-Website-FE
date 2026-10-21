import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic session and intercepted API calls; this test never touches live CRM records.
test('Owner Vehicles stays view-only and scopes roster/history across branch switches', { timeout: 90_000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  assert.ok(supabaseUrl);
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const branches = [
    { id: '00000000-0000-4000-8000-000000000002', name: 'Vehicle Branch A', geofence: null },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Vehicle Branch B', geofence: null },
  ];
  const user = {
    id: '00000000-0000-4000-8000-000000000001', email: 'owner-vehicles@example.invalid',
    app_metadata: { role: 'branch-owner', status: 'Active', display_name: 'Owner Test', branches: branches.map(b => b.name), branch_ids: branches.map(b => b.id) },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.synthetic-test-signature`;
  const requests = [];
  const writes = [];
  let rosterMode = 'success';
  let historyMode = 'error';
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
      key: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
      session: { access_token: token, refresh_token: 'synthetic-test-only', token_type: 'bearer', expires_in: 3600, expires_at: exp, user },
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === new URL(supabaseUrl).origin && url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.origin !== apiOrigin) return route.abort();
      if (route.request().method() !== 'GET') writes.push(url.pathname);
      if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches } });
      if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email, phone: null } } });
      if (url.pathname.startsWith('/api/vehicles')) {
        requests.push(url);
        const branchId = url.searchParams.get('branchId');
        assert.ok(branches.some(branch => branch.id === branchId));
        if (url.pathname !== '/api/vehicles') {
          if (historyMode === 'error') return route.fulfill({ status: 503, json: { message: 'History unavailable' } });
          return route.fulfill({ json: { maintenanceLogs: [{ id: 'log-1', odometer_km: 1234, fuel_liters: 2, logged_at: '2026-10-20T06:00:00Z' }] } });
        }
        if (rosterMode === 'error') return route.fulfill({ status: 503, json: { message: 'Roster unavailable' } });
        return route.fulfill({ json: { vehicles: rosterMode === 'empty' ? [] : [{
          id: branchId === branches[0].id ? 'vehicle-a' : 'vehicle-b', branch_id: branchId,
          plate_number: branchId === branches[0].id ? 'OWNER-A' : 'OWNER-B', vehicle_type: 'motorcycle', assigned_rider_name: 'Test Delivery Rider',
          status: branchId === branches[0].id ? 'maintenance' : 'active', gps_provisioning_status: 'unconfigured',
          current_odometer_km: branchId === branches[0].id ? 14500 : 8900, km_since_last_pms: branchId === branches[0].id ? 3300 : 2100, maintenance_threshold_km: 3000,
        }] } });
      }
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/branch-owner/vehicles`);
    await page.getByText('Select an assigned branch to view its vehicles.').waitFor();
    assert.equal(requests.length, 0, 'No automatic first-branch selection');
    await page.getByRole('button', { name: 'Select branch', exact: true }).click();
    await page.getByRole('button', { name: branches[0].name, exact: true }).click();
    await page.getByText('OWNER-A · motorcycle', { exact: true }).waitFor();
    await page.getByText('View-only', { exact: true }).waitFor();
    await page.getByText('Maintenance Due', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Register Vehicle|Reset PMS|Update Odo|Connect SinoTrack|Retry SinoTrack/ }).count(), 0);
    await page.getByRole('button', { name: 'View History', exact: true }).click();
    await page.getByText('Could not load maintenance history.', { exact: false }).waitFor();
    historyMode = 'success';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('cell', { name: '1,234 km', exact: true }).waitFor();
    await page.getByRole('button', { name: branches[0].name, exact: true }).click();
    await page.getByRole('button', { name: branches[1].name, exact: true }).click();
    await page.getByText('OWNER-B · motorcycle', { exact: true }).waitFor();
    assert.equal(await page.getByText('OWNER-A · motorcycle', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('cell', { name: '1,234 km', exact: true }).count(), 0, 'History closes on branch switch');
    await page.getByRole('button', { name: 'View History', exact: true }).click();
    await page.getByRole('cell', { name: '1,234 km', exact: true }).waitFor();
    assert.ok(requests.some(url => url.pathname.endsWith('/vehicle-b') && url.searchParams.get('branchId') === branches[1].id));
    if (process.env.TEST_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/owner-vehicles-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Minimize sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.TEST_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/owner-vehicles-mobile.png`, fullPage: true });
    rosterMode = 'error';
    await page.reload();
    await page.getByRole('button', { name: 'Select branch', exact: true }).click();
    await page.getByRole('button', { name: branches[0].name, exact: true }).click();
    await page.getByText('Could not load vehicles.', { exact: true }).waitFor();
    rosterMode = 'empty';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByText("No vehicles on this branch's roster yet.", { exact: true }).waitFor();
    assert.deepEqual(writes, [], 'Owner interactions must never send API writes');
  } finally {
    await browser.close();
  }
});
