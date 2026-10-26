import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// All remote calls are intercepted; no live identity, GPS, or CRM writes.
test('Vehicle Management refreshes GPS mileage at five minutes and shows stale/outage states', { timeout: 90_000 }, async () => {
    const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
    assert.ok(supabaseUrl);
    const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
    const cloudOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
    const branchId = '00000000-0000-4000-8000-000000000002';
    const user = {
        id: '00000000-0000-4000-8000-000000000001', email: 'gps-test@example.invalid',
            app_metadata: { role: 'branch-manager', status: 'Active', display_name: 'GPS Test', branches: ['Test branch'], branch_ids: [branchId] },
        user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
    };
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.synthetic-not-a-real-signature`;
    const vehicle = {
        id: '00000000-0000-4000-8000-000000000003', branch_id: branchId,
        plate_number: 'GPS TEST', vehicle_type: 'Motorcycle', assigned_rider_id: null, assigned_rider_name: null,
        status: 'active', gps_provisioning_status: 'provisioned', gps_provisioning_error: null,
        current_odometer_km: 2999, last_pms_odometer_km: 0, km_since_last_pms: 2999, maintenance_threshold_km: 3000,
        gps_mileage: { status: 'synced', position_at: new Date().toISOString(), synced_at: new Date().toISOString() },
    };
    let vehicleReads = 0;
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
            key: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
            session: { access_token: token, refresh_token: 'synthetic-test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user },
        });
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin === new URL(baseUrl).origin) return route.continue();
            if (url.origin === new URL(supabaseUrl).origin && url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
            if (url.origin !== cloudOrigin) return route.abort();
            assert.equal(route.request().method(), 'GET', 'GPS refresh must not issue browser writes');
            if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [{ id: branchId, name: 'Test branch', geofence: null }] } });
            if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email, phone: null } } });
            if (url.pathname === '/api/vehicles') {
                vehicleReads++;
                return route.fulfill({ json: { vehicles: [vehicle], gps_refresh_interval_ms: 300_000 } });
            }
            return route.fulfill({ json: { serviceRequests: [], riders: [], summary: null, ratings: [], stockLevels: [], notifications: [], unreadCount: 0 } });
        });
        const page = await context.newPage();
        await page.clock.install();
        await page.goto(`${baseUrl}/branch-manager/vehicles`);
        await page.getByText('GPS mileage updates automatically while this screen is open.', { exact: false }).waitFor();
        const before = vehicleReads;
        vehicle.current_odometer_km = 3000;
        vehicle.km_since_last_pms = 3000;
        vehicle.status = 'maintenance';
        await page.clock.fastForward(290_000);
        assert.equal(vehicleReads, before, 'No sub-five-minute polling');
        await page.clock.fastForward(10_100);
        await page.getByText('Overdue', { exact: true }).waitFor();
        assert.equal(vehicleReads, before + 1);
        vehicle.gps_mileage.status = 'unavailable';
        await page.clock.fastForward(300_100);
        await page.getByText('GPS mileage unavailable.', { exact: false }).waitFor();
        vehicle.gps_mileage.status = 'stale';
        await page.clock.fastForward(300_100);
        await page.getByText('No recent GPS reading.', { exact: false }).waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'GPS note must not cause mobile overflow');
        if (process.env.TEST_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/gps-mileage-mobile.png`, fullPage: true });
    } finally {
        await browser.close();
    }
});
