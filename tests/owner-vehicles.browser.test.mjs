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
    { id: '00000000-0000-4000-8000-000000000002', name: 'Vehicle Branch A', geofence: {
      type: 'polygon', points: [[14.44, 120.97], [14.48, 120.97], [14.48, 121.0], [14.44, 121.0]],
    } },
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
  let gpsMode = 'success';
  const gpsRequests = [];
  const routeRequests = [];
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
      if (url.hostname === 'tiles.openfreemap.org') return route.fulfill({ json: {
        version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#edf5fa' } }],
      } });
      if (url.origin !== apiOrigin) return route.abort();
      if (route.request().method() !== 'GET') writes.push(url.pathname);
      if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches } });
      if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email, phone: null } } });
      if (url.pathname === '/api/riders') {
        const branchId = url.searchParams.get('branchId');
        assert.ok(branches.some(branch => branch.id === branchId));
        return route.fulfill({ json: { riders: [{ id: 'rider', branch_id: branchId, name: 'Test Delivery Rider',
          plate: 'Assigned vehicle', status: 'Available', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), current_order: null }] } });
      }
      if (url.pathname === '/api/vehicles/locations') {
        gpsRequests.push(url);
        const branchId = url.searchParams.get('branchId');
        assert.ok(branches.some(branch => branch.id === branchId));
        if (gpsMode === 'error') return route.fulfill({ status: 503, json: { message: 'GPS unavailable' } });
        const first = branchId === branches[0].id;
        return route.fulfill({ json: { refresh_interval_ms: 120_000, gps_unavailable: false, vehicles: gpsMode === 'empty' ? [] : [{
          id: first ? 'vehicle-a' : 'vehicle-b', plate_number: first ? 'OWNER-A' : 'OWNER-B', display_name: 'Branch motorcycle', tracker_connected: true, geofence_status: first ? 'outside' : 'inside',
          position: { latitude: first ? 14.6 : 14.7, longitude: 121, captured_at: new Date().toISOString(), stale: false, moving: false },
        }] } });
      }
      if (/^\/api\/vehicles\/vehicle-[ab]\/route$/.test(url.pathname)) {
        routeRequests.push(url);
        const first = url.pathname.includes('vehicle-a');
        assert.equal(url.searchParams.get('branchId'), branches[first ? 0 : 1].id);
        return route.fulfill({ json: { vehicle: { id: first ? 'vehicle-a' : 'vehicle-b', plate_number: first ? 'OWNER-A' : 'OWNER-B', display_name: null },
          from: url.searchParams.get('from'), to: url.searchParams.get('to'), geofence: branches[first ? 0 : 1].geofence,
          points: [{ latitude: first ? 14.6 : 14.7, longitude: 121, captured_at: new Date().toISOString(), outside_geofence: first ? true : null }] } });
      }
      if (url.pathname === '/api/notifications') {
        const branchId = url.searchParams.get('branchId');
        assert.ok(branches.some(branch => branch.id === branchId), 'Owner bell must carry selected branch UUID');
        return route.fulfill({ json: { unread_count: branchId === branches[0].id ? 1 : 0, notifications: branchId === branches[0].id ? [{
          id: 'geofence-test', type: 'vehicle-geofence', title: 'Vehicle outside assigned area', message: 'OWNER-A left its assigned area.',
          branch_id: branchId, created_at: new Date().toISOString(), is_read: false,
        }] : [] } });
      }
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
          status: branchId === branches[0].id ? 'maintenance' : 'active',
          gps_provisioning_status: branchId === branches[0].id ? 'unconfigured' : 'provisioned',
          gps_mileage: branchId === branches[0].id ? null : { status: 'synced', position_at: '2026-11-21T04:19:09Z', pending_m: 140 },
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
    const branchAVehicle = page.getByRole('article', { name: 'Vehicle OWNER-A' });
    await branchAVehicle.getByRole('heading', { name: 'OWNER-A', exact: true }).waitFor();
    await page.getByText('View-only', { exact: true }).waitFor();
    await page.getByText('Service overdue', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Register Vehicle|Mark service complete|Update distance|Connect SinoTrack|Retry SinoTrack/ }).count(), 0);
    await page.getByRole('button', { name: 'View staff readings', exact: true }).click();
    await page.getByText('Couldn’t load saved readings.', { exact: false }).waitFor();
    historyMode = 'success';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('cell', { name: '1,234 km', exact: true }).waitFor();
    await page.getByRole('button', { name: branches[0].name, exact: true }).click();
    await page.getByRole('button', { name: branches[1].name, exact: true }).click();
    const branchBVehicle = page.getByRole('article', { name: 'Vehicle OWNER-B' });
    await branchBVehicle.getByText('900 km left', { exact: true }).waitFor();
    await branchBVehicle.getByText('140 m already counted toward the next kilometre.', { exact: true }).waitFor();
    assert.equal(await branchAVehicle.count(), 0);
    assert.equal(await page.getByRole('cell', { name: '1,234 km', exact: true }).count(), 0, 'History closes on branch switch');
    await page.getByRole('button', { name: 'View staff readings', exact: true }).click();
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
    rosterMode = 'success';
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/branch-owner/fleet`);
    const roster = page.getByRole('region', { name: 'Fleet roster', exact: true });
    const mapPanel = page.getByRole('region', { name: 'Vehicle locations', exact: true });
    assert.equal(gpsRequests.length, 0, 'Fleet GPS requires a selected branch');
    await page.getByRole('button', { name: 'Select branch', exact: true }).click();
    await page.getByRole('button', { name: branches[0].name, exact: true }).click();
    const geofenceToast = page.locator('[data-sonner-toast][data-type="warning"]').filter({ hasText: 'Vehicle outside assigned area' });
    await geofenceToast.waitFor();
    const toastColors = await geofenceToast.evaluate(element => {
      const { backgroundColor, borderTopColor, color } = getComputedStyle(element);
      return { backgroundColor, borderTopColor, color };
    });
    assert.deepEqual(toastColors, { backgroundColor: 'rgb(254, 243, 242)', borderTopColor: 'rgb(254, 205, 202)', color: 'rgb(180, 35, 24)' });
    await mapPanel.getByRole('button', { name: 'Vehicle OWNER-A location', exact: true }).waitFor();
    await roster.getByText('Test Delivery Rider', { exact: true }).waitFor();
    await page.getByRole('alert', { name: 'Vehicles outside assigned area', exact: true }).waitFor();
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await page.getByRole('region', { name: 'Notifications', exact: true }).getByText('Vehicle outside assigned area', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await roster.getByLabel('Roster view').selectOption('vehicles');
    await roster.getByText('14.600000, 121.000000', { exact: true }).waitFor();
    assert.equal(routeRequests.length, 0);
    const historyTrigger = roster.getByRole('button', { name: 'View route history for OWNER-A', exact: true });
    await historyTrigger.click();
    const routeDialogA = page.getByRole('dialog', { name: 'Route history · OWNER-A', exact: true });
    await routeDialogA.getByRole('button', { name: 'Show route', exact: true }).click();
    await routeDialogA.getByText(/recorded GPS points/).waitFor();
    await routeDialogA.getByText('Current branch geofence', { exact: true }).waitFor();
    assert.match(await routeDialogA.getByRole('slider').getAttribute('aria-valuetext'), /Outside geofence/);
    assert.equal(await routeDialogA.getByRole('button', { name: 'Play route playback', exact: true }).isEnabled(), false, 'Single-point history cannot play');
    await routeDialogA.getByRole('button', { name: 'Close', exact: true }).click();
    await routeDialogA.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: branches[0].name, exact: true }).click();
    await page.getByRole('button', { name: branches[1].name, exact: true }).click();
    await mapPanel.getByRole('button', { name: 'Vehicle OWNER-B location', exact: true }).waitFor();
    await roster.getByLabel('Roster view').selectOption('vehicles');
    await roster.getByRole('button', { name: 'Show vehicle OWNER-B on map', exact: true }).waitFor();
    assert.equal(await page.getByRole('alert', { name: 'Vehicles outside assigned area', exact: true }).count(), 0, 'Old branch alerts clear on branch switch');
    assert.equal(await mapPanel.getByRole('button', { name: 'Vehicle OWNER-A location', exact: true }).count(), 0);
    assert.equal(await roster.getByRole('button', { name: 'Show vehicle OWNER-A on map', exact: true }).count(), 0);
    await roster.getByRole('button', { name: 'View route history for OWNER-B', exact: true }).click();
    const routeDialogB = page.getByRole('dialog', { name: 'Route history · OWNER-B', exact: true });
    await routeDialogB.getByRole('button', { name: 'Show route', exact: true }).click();
    await routeDialogB.getByText(/14.700000, 121.000000/).waitFor();
    await routeDialogB.getByText('No branch geofence configured', { exact: true }).waitFor();
    assert.doesNotMatch(await routeDialogB.getByRole('slider').getAttribute('aria-valuetext'), /Outside geofence/);
    await routeDialogB.getByRole('button', { name: 'Close', exact: true }).click();
    await routeDialogB.waitFor({ state: 'detached' });
    gpsMode = 'error';
    await mapPanel.getByRole('button', { name: 'Refresh vehicle locations', exact: true }).click();
    await mapPanel.getByRole('alert').waitFor();
    assert.equal(await mapPanel.getByRole('button', { name: 'Vehicle OWNER-B location', exact: true }).count(), 0);
    gpsMode = 'empty';
    await mapPanel.getByRole('button', { name: 'Refresh vehicle locations', exact: true }).click();
    await roster.getByText('No registered vehicles in this branch.', { exact: true }).waitFor();
    gpsMode = 'success';
    await mapPanel.getByRole('button', { name: 'Refresh vehicle locations', exact: true }).click();
    await roster.getByRole('button', { name: 'Show vehicle OWNER-B on map', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Minimize sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await roster.getByLabel('Roster view').selectOption('riders');
    await roster.getByText('Test Delivery Rider', { exact: true }).waitFor();
    assert.deepEqual(writes, [], 'Owner interactions must never send API writes');
  } finally {
    await browser.close();
  }
});
