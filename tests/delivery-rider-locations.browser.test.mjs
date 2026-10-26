import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic locations and accounts only. No service receives a real GPS sample.
test('manager dispatch shows actual phone pins, refreshes, clears Offline positions and handles outages', { timeout: 90_000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const branchId = '00000000-0000-4000-8000-000000000002';
  const user = {
    id: '00000000-0000-4000-8000-000000000001', email: 'location-test@example.invalid',
    app_metadata: { role: 'branch-manager', status: 'Active', display_name: 'Location Test', branches: ['Test branch'], branch_ids: [branchId] },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt })}.synthetic-test-signature`,
    refresh_token: 'synthetic-test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user,
  };
  const location = (age = 0) => ({ latitude: 14.45, longitude: 120.98, accuracyM: 8,
    capturedAt: new Date(Date.now() - age).toISOString(), receivedAt: new Date(Date.now() - age).toISOString(), source: 'phone' });
  const riders = [
    { id: 'available', name: 'Available Test', plate: 'TEST 1', status: 'Available', operational_location: location() },
    { id: 'stale', name: 'Stale Test', plate: 'TEST 2', status: 'On Delivery', operational_location: location(16 * 60_000) },
    { id: 'offline', name: 'Offline Test', plate: 'TEST 3', status: 'Offline', operational_location: location() },
    { id: 'missing', name: 'Missing Test', plate: 'TEST 4', status: 'Available', operational_location: null },
  ];
  riders[0].assigned_vehicle = { id: 'vehicle-1', plate_number: 'SAVED VEHICLE', status: 'active' };
  let unavailable = false;
  let riderReads = 0;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
      key: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`, session,
    });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname === 'tiles.openfreemap.org') return route.fulfill({ json: {
        version: 8, sources: {}, layers: [{ id: 'test-background', type: 'background', paint: { 'background-color': '#edf5fa' } }],
      } });
      if (url.origin === new URL(supabaseUrl).origin && url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.origin === apiOrigin && url.pathname.startsWith('/api/')) {
        assert.equal(request.method(), 'GET', 'Location display must not issue operational writes');
        assert.equal(request.headers().authorization, `Bearer ${session.access_token}`);
        if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [{ id: branchId, name: 'Test branch', geofence: {
          type: 'polygon', points: [[14.44, 120.97], [14.48, 120.97], [14.48, 121.0], [14.44, 121.0]],
        } }] } });
        if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email, phone: null } } });
        if (url.pathname === '/api/riders') {
          riderReads++;
          return unavailable ? route.fulfill({ status: 503, json: { message: 'Dispatch service unavailable' } }) : route.fulfill({ json: { riders } });
        }
        if (url.pathname === '/api/prices') return route.fulfill({ json: { prices: [] } });
        return route.fulfill({ json: { serviceRequests: [], customers: [], notifications: [], unreadCount: 0 } });
      }
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(`${baseUrl}/branch-manager/service-requests`);
    const panel = page.getByRole('region', { name: 'Delivery Rider locations', exact: true });
    try { await panel.getByText('Phone GPS: 14.450000, 120.980000', { exact: true }).first().waitFor({ timeout: 10_000 }); }
    catch (error) { throw new Error(`Screen: ${(await page.locator('body').innerText()).slice(0, 2000)}; errors: ${errors.join('; ')}`, { cause: error }); }
    await panel.getByRole('button', { name: 'Show location of Available Test', exact: true }).waitFor();
    await panel.getByText('Assigned vehicle: SAVED VEHICLE', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('button', { name: 'Show location of Offline Test' }).count(), 0);
    await panel.getByText('GPS unavailable', { exact: true }).waitFor();
    const stalePin = panel.getByRole('button', { name: 'Show location of Stale Test', exact: true });
    assert.equal(await stalePin.getAttribute('data-stale'), 'true');
    await panel.getByText('GPS stale · last known position', { exact: true }).waitFor();
    const before = riderReads;
    riders[0].operational_location = { ...location(), latitude: 14.46 };
    riders[0].assigned_vehicle = { id: 'vehicle-2', plate_number: 'NEW ASSIGNMENT', status: 'active' };
    await page.clock.fastForward(15_100);
    await panel.getByText('Phone GPS: 14.460000, 120.980000', { exact: true }).waitFor();
    await panel.getByText('Assigned vehicle: NEW ASSIGNMENT', { exact: true }).waitFor();
    assert.ok(riderReads > before, 'Locations refresh automatically');
    riders[0].status = 'Offline';
    await page.clock.fastForward(15_100);
    await panel.getByRole('button', { name: 'Show location of Available Test', exact: true }).waitFor({ state: 'detached' });
    unavailable = true;
    await page.clock.fastForward(15_100);
    await panel.getByRole('alert').waitFor();
    assert.equal(await panel.getByLabel('Delivery Rider phone location map', { exact: true }).count(), 0, 'Outages must not leave a map pretending to be current');
    unavailable = false;
    await panel.getByRole('button', { name: 'Refresh Delivery Rider locations', exact: true }).click();
    await stalePin.waitFor();
    await panel.getByRole('button', { name: 'Hide map', exact: true }).click();
    assert.equal(await panel.getByLabel('Delivery Rider phone location map', { exact: true }).count(), 0);
    await panel.getByRole('button', { name: 'Show map', exact: true }).click();
    await stalePin.waitFor();
    await page.goto(`${baseUrl}/branch-manager/fleet`);
    await page.getByRole('heading', { name: 'Vehicle GPS coverage', exact: true }).waitFor();
    await page.getByText('Vehicle positions unavailable. This map shows the branch boundary only. Delivery Rider phone locations appear separately below.', { exact: true }).waitFor();
    await stalePin.waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Live GPS Tracking', exact: true }).count(), 0);
    // The hardware coverage map must not invent vehicle positions from the
    // geofence or reuse phone coordinates as vehicle telemetry.
    assert.equal(await page.getByRole('button', { name: /Stale Test —/ }).count(), 0);
    assert.deepEqual(errors, []);
    if (process.env.TEST_ARTIFACT_DIR) await panel.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/manager-rider-locations.png` });
  } finally { await browser.close(); }
});
