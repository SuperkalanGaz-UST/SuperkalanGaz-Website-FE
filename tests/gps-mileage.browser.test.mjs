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
        current_odometer_km: 43437, last_pms_odometer_km: 43437, km_since_last_pms: 0, maintenance_threshold_km: 3000,
        gps_mileage: { status: 'synced', position_at: '2026-11-21T04:19:09Z', pending_m: 650 },
    };
    let vehicleReads = 0;
    let serviceResets = 0;
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
            if (url.pathname === `/api/vehicles/${vehicle.id}/reset-pms`) {
                assert.equal(route.request().method(), 'POST');
                serviceResets++;
                vehicle.status = 'active';
                vehicle.last_pms_odometer_km = vehicle.current_odometer_km;
                vehicle.km_since_last_pms = 0;
                return route.fulfill({ json: { vehicle } });
            }
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
        const card = page.getByRole('article', { name: 'Vehicle GPS TEST' });
        await card.getByText('Total distance', { exact: true }).waitFor();
        await card.getByText('43,437 km', { exact: true }).waitFor();
        await card.getByText('3,000 km left', { exact: true }).waitFor();
        await card.getByText('At 46,437 km', { exact: true }).waitFor();
        await card.getByText('650 m already counted toward the next kilometre.', { exact: true }).waitFor();
        await card.getByText('Last distance update', { exact: true }).waitFor();
        assert.equal(await card.locator('time').getAttribute('datetime'), vehicle.gps_mileage.position_at);
        assert.equal(await card.getByRole('button', { name: 'Mark service complete' }).count(), 0);
        if (process.env.TEST_ARTIFACT_DIR) await card.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/mileage-card-preview.png` });
        await card.getByRole('button', { name: 'Update distance' }).click();
        const mileageDialog = page.getByRole('dialog', { name: 'Update distance' });
        assert.equal(await mileageDialog.getByLabel('Total distance (km)').inputValue(), '43437');
        await mileageDialog.getByRole('button', { name: 'Cancel' }).click();
        const before = vehicleReads;
        vehicle.current_odometer_km = 46437;
        vehicle.km_since_last_pms = 3000;
        vehicle.status = 'maintenance';
        await page.clock.fastForward(290_000);
        assert.equal(vehicleReads, before, 'No sub-five-minute polling');
        await page.clock.fastForward(10_100);
        await card.getByText('Service due', { exact: true }).waitFor();
        await card.getByRole('button', { name: 'Mark service complete' }).waitFor();
        assert.equal(vehicleReads, before + 1);
        vehicle.gps_mileage.status = 'unavailable';
        await page.clock.fastForward(300_100);
        await card.getByText('Couldn’t get a distance update', { exact: true }).waitFor();
        vehicle.gps_mileage.status = 'stale';
        await page.clock.fastForward(300_100);
        await card.getByText('Distance updates are delayed', { exact: true }).waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Minimize sidebar' }).click();
        await page.getByRole('button', { name: 'Expand sidebar' }).evaluate(async button => {
            await Promise.all(button.parentElement.getAnimations().map(animation => animation.finished));
        });
        assert.equal(await card.evaluate(element => element.scrollWidth > element.clientWidth), false, 'Mileage card fits the mobile column');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'GPS note must not cause mobile overflow');
        if (process.env.TEST_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/gps-mileage-mobile.png`, fullPage: true });
        const markComplete = card.getByRole('button', { name: 'Mark service complete' });
        const confirmation = page.getByRole('alertdialog', { name: 'Mark this vehicle serviced?' });
        await markComplete.click();
        await confirmation.getByRole('button', { name: 'Cancel' }).click();
        await confirmation.waitFor({ state: 'hidden' });
        assert.equal(serviceResets, 0);
        await markComplete.click();
        await confirmation.getByRole('button', { name: 'Reset PMS' }).click();
        await card.getByText('3,000 km left', { exact: true }).waitFor();
        assert.equal(serviceResets, 1);
    } finally {
        await browser.close();
    }
});
