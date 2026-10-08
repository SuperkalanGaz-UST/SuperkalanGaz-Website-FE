import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Requires a rebuilt app running on localhost:3000. Every non-local request is
// intercepted: the synthetic session and write never reach Supabase or GCP.
test('Branch Manager guide registers via the cloud API without claiming live GPS', { timeout: 60_000 }, async () => {
    const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
    assert.ok(supabaseUrl, 'Local public Supabase URL is required');
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const cloudOrigin = 'https://superkalan-crm-api-7icfrdyg5a-as.a.run.app';
    const user = {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'browser-test@example.invalid',
        app_metadata: { role: 'branch-manager', status: 'Active', branches: ['Test branch'], branch_ids: ['00000000-0000-4000-8000-000000000002'] },
        user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
    };
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.synthetic-not-a-real-signature`;
    const vehicle = {
        id: '00000000-0000-4000-8000-000000000003', branch_id: user.app_metadata.branch_ids[0],
        plate_number: 'TEST 123', vehicle_type: 'Motorcycle', assigned_rider_id: null, assigned_rider_name: null,
        status: 'active', gps_provisioning_status: 'unconfigured', gps_provisioning_error: null,
        current_odometer_km: 0, last_pms_odometer_km: 0, km_since_last_pms: 0, maintenance_threshold_km: 3000,
    };
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
            key: `sb-${projectRef}-auth-token`,
            session: { access_token: token, refresh_token: 'synthetic-test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user },
        });
        const writes = [];
        const unexpected = [];
        await context.route('**/*', async route => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.origin === 'http://localhost:3000') return route.continue();
            if (url.origin === new URL(supabaseUrl).origin && url.pathname === '/auth/v1/user') {
                return route.fulfill({ json: user });
            }
            if (url.origin !== cloudOrigin) {
                unexpected.push(url.origin);
                return route.abort();
            }
            if (request.method() === 'POST') {
                assert.equal(url.pathname, `/api/vehicles/${vehicle.id}/gps-provisioning`);
                assert.equal(request.headers().authorization, `Bearer ${token}`);
                assert.deepEqual(request.postDataJSON(), { hardwareUniqueId: '8160528336' });
                writes.push(url.pathname);
                vehicle.gps_provisioning_status = 'provisioned';
                return route.fulfill({ json: { vehicle } });
            }
            if (url.pathname === '/api/vehicles') return route.fulfill({ json: { vehicles: [vehicle] } });
            return route.fulfill({ json: { serviceRequests: [], riders: [], summary: null, ratings: [], stockLevels: [], notifications: [], unreadCount: 0 } });
        });
        const page = await context.newPage();
        await page.goto('http://localhost:3000');
        await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
        await page.getByRole('button', { name: 'Connect SinoTrack', exact: true }).click();
        const dialog = page.getByRole('dialog');
        for (let step = 0; step < 3; step++) await dialog.getByRole('button', { name: 'Next', exact: true }).click();
        await dialog.getByText('8040000 34.158.48.168 5013', { exact: true }).waitFor();
        assert.match(await dialog.innerText(), /website does not send SMS/);
        await page.setViewportSize({ width: 390, height: 844 });
        const overflow = await dialog.evaluate(element => element.scrollWidth > element.clientWidth);
        assert.equal(overflow, false, 'SMS instructions should not overflow the mobile dialog');
        if (process.env.TEST_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/traccar-guide-mobile.png` });
        await page.setViewportSize({ width: 1280, height: 900 });
        await dialog.getByRole('button', { name: 'Next', exact: true }).click();
        await dialog.getByRole('button', { name: 'Next', exact: true }).click();
        await dialog.getByRole('button', { name: 'Enter device ID', exact: true }).click();
        await dialog.getByLabel('SinoTrack Hardware ID').fill('8160528336');
        await dialog.getByRole('button', { name: 'Register device in Traccar', exact: true }).click();
        await page.getByText('Registered in Traccar', { exact: true }).waitFor();
        await page.getByText('TEST 123: device registered in Traccar. Live GPS reception still needs verification.', { exact: true }).waitFor();
        assert.equal(writes.length, 1);
        assert.deepEqual(unexpected, [], 'No browser requests should target local NestJS or private Traccar');
    } finally {
        await browser.close();
    }
});
