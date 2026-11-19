import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic locations and accounts only. No service receives a real GPS sample.
test('manager dispatch and Fleet show independent phone and vehicle fixes, refresh and handle outages', { timeout: 90_000 }, async () => {
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
    { id: 'stale', name: 'Stale Test', plate: 'TEST 2', status: 'On Delivery', operational_location: location(3 * 60_000) },
    { id: 'offline', name: 'Offline Test', plate: 'TEST 3', status: 'Offline', operational_location: location() },
    { id: 'missing', name: 'Missing Test', plate: 'TEST 4', status: 'Available', operational_location: null },
  ];
  riders[0].assigned_vehicle = { id: 'vehicle-1', plate_number: 'SAVED VEHICLE', status: 'active' };
  let unavailable = false;
  let vehicleGpsUnavailable = false;
  let vehicleRequestFailed = false;
  let riderReads = 0;
  let vehicleReads = 0;
  let vehicleInterval = 30_000;
  let routeState = 'positions';
  let routeReads = 0;
  const geofence = { type: 'polygon', points: [[14.44, 120.97], [14.48, 120.97], [14.48, 121.0], [14.44, 121.0]] };
  const vehicleFix = { latitude: 14.47, longitude: 120.97, captured_at: new Date().toISOString(), stale: false };
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
        if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [{ id: branchId, name: 'Test branch', geofence }] } });
        if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email, phone: null } } });
        if (url.pathname === '/api/riders') {
          riderReads++;
          return unavailable ? route.fulfill({ status: 503, json: { message: 'Dispatch service unavailable' } }) : route.fulfill({ json: { riders } });
        }
        if (url.pathname === '/api/vehicles/locations') {
          vehicleReads++;
          if (vehicleRequestFailed) return route.fulfill({ status: 503, json: { message: 'Vehicle locations temporarily unavailable' } });
          return route.fulfill({ json: { gps_unavailable: vehicleGpsUnavailable, refresh_interval_ms: vehicleInterval, vehicles: [
            { id: 'unassigned-vehicle', plate_number: 'HW 123', display_name: 'Branch motorcycle', tracker_connected: true, geofence_status: 'outside', position: vehicleGpsUnavailable ? null : vehicleFix },
            { id: 'untracked-vehicle', plate_number: 'NO GPS', display_name: null, tracker_connected: false, position: null },
          ] } });
        }
        if (url.pathname === '/api/vehicles/unassigned-vehicle/route') {
          routeReads++;
          assert.equal(url.searchParams.get('from'), '2026-01-01T00:00:00.000Z');
          assert.equal(url.searchParams.get('to'), '2026-01-01T01:00:00.000Z');
          if (routeState === 'error') return route.fulfill({ status: 503, json: { message: 'Route history is unavailable. Retry or choose a shorter period' } });
          const points = [
            { latitude: 14.45, longitude: 120.99, captured_at: '2026-01-01T00:10:00Z', outside_geofence: false },
            { latitude: 14.61, longitude: 121, captured_at: '2026-01-01T00:20:00Z', outside_geofence: true },
            { latitude: 14.62, longitude: 121.01, captured_at: '2026-01-01T00:40:00Z', outside_geofence: true },
          ];
          return route.fulfill({ json: {
            vehicle: { id: 'unassigned-vehicle', plate_number: 'HW 123', display_name: 'Branch motorcycle' },
            from: url.searchParams.get('from'), to: url.searchParams.get('to'),
            ...(routeState === 'legacy' ? {
              points: points.map(({ latitude, longitude, captured_at }) => ({ latitude, longitude, captured_at })),
            } : {
              geofence,
              points: routeState === 'empty' ? [] : routeState === 'single' ? points.slice(0, 1) : points,
            }),
          } });
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
    await panel.getByText('Location unavailable', { exact: true }).waitFor();
    const stalePin = panel.getByRole('button', { name: 'Show location of Stale Test', exact: true });
    assert.equal(await stalePin.getAttribute('data-stale'), 'true');
    await panel.getByText(/Location unavailable · last update at/).waitFor({ timeout: 3_000 });
    riders[1].operational_location = { ...location(), latitude: 14.60, longitude: 120.99 };
    await page.clock.fastForward(15_100);
    await panel.getByText('Phone GPS: 14.600000, 120.990000', { exact: true }).waitFor();
    assert.equal(await stalePin.getAttribute('data-stale'), 'false', 'A new fix replaces the stale pin');
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
    const vehiclePanel = page.getByRole('region', { name: 'Vehicle locations', exact: true });
    const vehiclePin = vehiclePanel.getByRole('button', { name: 'Vehicle HW 123 location', exact: true });
    await vehiclePin.waitFor();
    await vehiclePanel.getByRole('alert', { name: 'Vehicles outside assigned area', exact: true }).waitFor();
    const history = page.getByRole('dialog', { name: 'Route history · HW 123', exact: true });
    assert.equal(await history.count(), 0, 'Route history is opened from the vehicle roster');
    const historyTrigger = vehiclePanel.getByRole('button', { name: 'View route history for HW 123', exact: true });
    await historyTrigger.click();
    await history.waitFor();
    assert.equal(routeReads, 0, 'History is fetched on deliberate search');
    await history.getByLabel('From', { exact: true }).fill('2026-01-01T08:00');
    await history.getByLabel('To', { exact: true }).fill('2026-01-01T09:00');
    const showRoute = history.getByRole('button', { name: 'Show route', exact: true });
    await showRoute.click();
    await history.getByText(/3 recorded GPS points/).waitFor();
    await history.getByLabel('Vehicle route history map', { exact: true }).waitFor();
    await history.getByRole('button', { name: 'Recorded vehicle position', exact: true }).waitFor();
    const play = history.getByRole('button', { name: 'Play route playback', exact: true });
    await history.getByText('Current branch geofence', { exact: true }).waitFor();
    assert.ok((await play.boundingBox()).width < 120, 'Playback control stays compact');
    const outsideTime = history.getByRole('button', { name: /8:20:00/ });
    await outsideTime.click();
    assert.equal(await history.getByRole('slider').inputValue(), '1');
    assert.match(await history.getByRole('slider').getAttribute('aria-valuetext'), /8:20:00.*Outside geofence/);
    const outsideMark = history.locator('[class*="routeOutsideMark"]');
    assert.equal(await outsideMark.count(), 1, 'Consecutive outside fixes share a red band');
    assert.equal(await outsideMark.evaluate(element => element.style.width), '50%');
    if (process.env.TEST_ARTIFACT_DIR) await history.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/route-geofence.png` });
    await history.getByRole('slider').press('Home');
    await play.click();
    await page.clock.fastForward(550);
    assert.equal(await history.getByRole('slider').inputValue(), '1');
    await history.getByRole('button', { name: 'Pause route playback', exact: true }).click();
    await page.clock.fastForward(1_100);
    assert.equal(await history.getByRole('slider').inputValue(), '1', 'Pause stops local playback');
    await play.click();
    await page.clock.fastForward(550);
    await play.waitFor();
    assert.equal(await history.getByRole('slider').inputValue(), '2', 'Playback stops at the end');
    await play.click();
    assert.equal(await history.getByRole('slider').inputValue(), '0', 'Play restarts a completed route');
    const readsBeforeScrubbing = routeReads;
    await history.getByRole('slider').press('End');
    await history.getByText(/14.620000, 121.010000/).waitFor();
    await page.clock.fastForward(60_100);
    assert.equal(routeReads, readsBeforeScrubbing, 'Scrubbing and elapsed time do not refetch route history');
    vehicleRequestFailed = true;
    const failedVehicleRead = page.waitForResponse(response => new URL(response.url()).pathname === '/api/vehicles/locations' && response.status() === 503);
    await page.clock.fastForward(30_100);
    await failedVehicleRead;
    await history.getByText(/14.620000, 121.010000/).waitFor();
    vehicleRequestFailed = false;
    const recoveredVehicleRead = page.waitForResponse(response => new URL(response.url()).pathname === '/api/vehicles/locations' && response.status() === 200);
    await page.clock.fastForward(30_100);
    await recoveredVehicleRead;
    routeState = 'legacy';
    await showRoute.click();
    await history.getByText('Current branch geofence', { exact: true }).waitFor();
    await history.getByText(/The route API hasn’t supplied outside-geofence timestamps/).waitFor();
    assert.equal(await outsideMark.count(), 0, 'The saved geofence remains visible while route classifications are unavailable');
    routeState = 'empty';
    await showRoute.click();
    await history.getByText('No movement recorded for this vehicle in the selected period.').waitFor();
    assert.equal(await history.getByLabel('Vehicle route history map', { exact: true }).count(), 0);
    routeState = 'error';
    await showRoute.click();
    await history.getByRole('alert').filter({ hasText: 'Route history is unavailable' }).waitFor();
    assert.equal(await page.locator('[aria-label="Vehicle HW 123 location"]').count(), 1);
    routeState = 'single';
    await showRoute.click();
    await history.getByText(/1 recorded GPS points/).waitFor();
    assert.equal(await history.getByRole('slider').isDisabled(), true);
    assert.equal(await outsideTime.count(), 0);
    await history.getByLabel('From', { exact: true }).fill('2026-01-03T08:00');
    const readsBeforeInvalid = routeReads;
    await showRoute.click();
    await history.getByRole('alert').filter({ hasText: 'within 24 hours' }).waitFor();
    assert.equal(routeReads, readsBeforeInvalid);
    assert.equal(await history.getByLabel('Vehicle route history map', { exact: true }).count(), 0);
    await history.getByLabel('From', { exact: true }).fill('2026-01-01T08:00');
    routeState = 'positions';
    await showRoute.click();
    await history.getByText(/3 recorded GPS points/).waitFor();
    await history.getByRole('button', { name: 'Close', exact: true }).click();
    await history.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'View route history for HW 123');
    await vehiclePanel.getByText('14.470000, 120.970000', { exact: true }).waitFor();
    await vehiclePanel.getByText('Tracker setup incomplete', { exact: true }).waitFor();
    await stalePin.waitFor();
    assert.equal(await vehiclePanel.getByRole('button', { name: 'Vehicle NO GPS location', exact: true }).count(), 0);
    assert.equal(await vehiclePanel.getByRole('button', { name: 'Show location of Stale Test', exact: true }).count(), 0);
    assert.equal(await panel.getByRole('button', { name: 'Vehicle HW 123 location', exact: true }).count(), 0);
    await vehiclePanel.getByRole('button', { name: 'Show vehicle HW 123 on map', exact: true }).click();
    await vehiclePanel.getByText('Branch motorcycle · HW 123', { exact: true }).waitFor();
    const beforeVehicleRefresh = vehicleReads;
    vehicleFix.stale = true;
    await page.clock.fastForward(30_100);
    await vehiclePanel.getByText(/Last known fix/).first().waitFor();
    assert.ok(vehicleReads > beforeVehicleRefresh);
    assert.equal(await vehiclePin.getAttribute('data-stale'), 'true');
    vehicleGpsUnavailable = true;
    const refreshVehicles = vehiclePanel.getByRole('button', { name: 'Refresh vehicle locations', exact: true });
    await refreshVehicles.click();
    await vehiclePanel.getByText(/vehicle GPS data could not be loaded/).waitFor();
    await vehiclePin.waitFor({ state: 'detached' });
    await stalePin.waitFor();
    vehicleGpsUnavailable = false;
    await refreshVehicles.click();
    await vehiclePin.waitFor();
    vehicleInterval = 120_000;
    await refreshVehicles.click();
    await vehiclePanel.getByText(/refreshes every 120 seconds/).waitFor();
    const readsBeforeParked = vehicleReads;
    await page.clock.fastForward(30_100);
    assert.equal(vehicleReads, readsBeforeParked, 'Parked vehicles use the slower refresh interval');
    const parkedRefresh = page.waitForResponse(response => new URL(response.url()).pathname === '/api/vehicles/locations');
    await page.clock.fastForward(90_100);
    await parkedRefresh;
    assert.ok(vehicleReads > readsBeforeParked, 'Parked vehicles still check for movement');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Minimize sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor();
    await historyTrigger.click();
    await history.waitFor();
    await history.getByLabel('From', { exact: true }).fill('2026-01-01T08:00');
    await history.getByLabel('To', { exact: true }).fill('2026-01-01T09:00');
    await showRoute.click();
    await history.getByText(/3 recorded GPS points/).waitFor();
    await page.waitForFunction(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog && dialog.scrollWidth <= dialog.clientWidth && dialog.getBoundingClientRect().width <= window.innerWidth;
    }, null, { timeout: 4000 });
    await history.press('Escape');
    await history.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    if (process.env.TEST_ARTIFACT_DIR) await panel.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/manager-rider-locations.png` });
  } finally { await browser.close(); }
});
