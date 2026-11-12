import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic identity and intercepted API responses: no real branches or users are modified.
test('address lookup, draggable branch pin, radius save/reopen, and address invalidation', { timeout: 90000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'geofence@example.invalid', app_metadata: { role: 'franchise-admin', status: 'Active', branch_ids: [], branches: [], display_name: 'Geofence Test' }, user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.synthetic`;
  let branch = { owner_id: null, id: '00000000-0000-4000-8000-000000000002', name: 'Test Manila Branch', code: 'TEST', status: 'active', region: 'NCR', address: '123 Test Street', city: 'Manila', province: 'Metro Manila', contact_number: '+639171234567', geofence: null, created_at: new Date().toISOString() };
  let failLookup = false;
  const lookups = [];
  const writes = [];
  const registrations = [];
  const errors = [];
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${projectRef}-auth-token`, session: { access_token: token, refresh_token: 'synthetic', token_type: 'bearer', expires_in: 3600, expires_at: exp, user } });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === new URL(supabaseUrl).origin && url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      // Deterministic map style still renders the real MapLibre circle, marker and interaction.
      if (url.hostname === 'tiles.openfreemap.org') return route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef2ed' } }] } });
      if (url.origin !== apiOrigin && url.origin !== 'http://localhost:3001') return route.abort();
      if (url.pathname === '/api/governance/dashboard') return route.fulfill({ json: { metrics: { pendingApprovals: 0, adminAccountRequests: 0, priceChanges30Days: 0, branchOwnerChanges: 0 }, priorityRequests: [], recentActivity: [], controls: { noSelfApproval: true, auditTrailActive: true, auditHistoryMutableByUsers: false } } });
      if (url.pathname === '/api/branches/locate-address') {
        lookups.push(request.postDataJSON());
        return route.fulfill(failLookup ? { status: 503, json: { message: 'Address search is unavailable. Try again or place the branch pin manually.' } } : { json: { matches: [{ label: '123 Test Street, Manila, Philippines', center: [14.5995, 120.9842] }] } });
      }
      if (url.pathname === `/api/branches/${branch.id}` && request.method() === 'PATCH') {
        const data = request.postDataJSON();
        writes.push(data);
        branch = { ...branch, ...data };
        return route.fulfill({ json: { branch } });
      }
      if (url.pathname === '/api/users' && !url.searchParams.has('branchId')) return route.fulfill({ json: { users: [{ id: '00000000-0000-4000-8000-000000000003', email: 'owner@example.invalid', display_name: 'Test Owner', username: 'test-owner', branches: [], status: 'Active' }] } });
      if (url.pathname === '/api/branches' && request.method() === 'POST') {
        registrations.push(request.postDataJSON());
        return route.fulfill({ json: { id: '00000000-0000-4000-8000-000000000004', code: 'NEW-TEST', owner: null } });
      }
      if (url.pathname === '/api/branches') return route.fulfill({ json: { branches: [branch] } });
      if (url.pathname === '/api/prices/regions') return route.fulfill({ json: { regions: [{ code: 'NCR', name: 'Metro Manila (NCR)' }] } });
      return route.fulfill({ json: { serviceRequests: [], branches: [], customers: [], users: [], notifications: [], unreadCount: 0, summary: null, ratings: [], locations: [] } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl);
    await page.getByRole('link', { name: 'Franchise Registry', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Locate address', exact: true }).click();
    await page.getByRole('button', { name: '123 Test Street, Manila, Philippines', exact: true }).click();
    assert.deepEqual(lookups[0], { address: branch.address, city: branch.city, province: branch.province });
    await page.getByLabel('Geofence radius (metres)').fill('2500');
    const marker = page.getByLabel('Branch location', { exact: true });
    await marker.waitFor();
    await marker.scrollIntoViewIfNeeded();
    const before = await page.getByText(/^Branch centre:/).innerText();
    const bounds = await marker.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 50, bounds.y + bounds.height / 2 + 20, { steps: 15 });
    await page.mouse.up();
    await page.waitForFunction(old => [...document.querySelectorAll('p')].find(p => p.textContent.startsWith('Branch centre:'))?.textContent !== old, before);
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    assert.equal(writes[0].geofence.radiusMeters, 2500);
    assert.equal(writes[0].geofence.points.length, 96);
    assert.notDeepEqual(writes[0].geofence.center, [14.5995, 120.9842]);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    assert.equal(await page.getByLabel('Geofence radius (metres)').inputValue(), '2500');
    await page.getByLabel('Geofence radius (metres)').fill('0');
    assert.equal(await page.getByRole('button', { name: 'Save Changes', exact: true }).isEnabled(), false);
    await page.getByLabel('Geofence radius (metres)').fill('1500');
    failLookup = true;
    await page.getByRole('button', { name: 'Locate address', exact: true }).click();
    await page.getByText('Address search is unavailable. Try again or place the branch pin manually.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Move branch pin', exact: true }).click();
    const canvas = page.locator('.maplibregl-canvas');
    await canvas.click({ position: { x: 160, y: 130 } });
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    assert.equal(writes[1].geofence.radiusMeters, 1500);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Full address', { exact: true }).fill('456 New Street');
    await page.getByText('No coverage set', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Branch location', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Close edit branch dialog', exact: true }).click();
    await page.getByRole('button', { name: '+ Register New Branch', exact: true }).click();
    await page.getByPlaceholder('Search known locations…').fill('New Test Branch');
    await page.getByPlaceholder('9XX XXX XXXX', { exact: true }).fill('9171234567');
    await page.getByLabel('Full address', { exact: true }).fill('123 Test Street');
    await page.getByPlaceholder('Search province…', { exact: true }).fill('Metro Manila');
    await page.getByRole('button', { name: 'Metro Manila', exact: true }).click();
    await page.getByPlaceholder('Search city or municipality…', { exact: true }).fill('Manila');
    await page.getByRole('option', { name: 'Manila', exact: true }).click();
    await page.getByPlaceholder('20', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: /Test Owner/ }).click();
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    failLookup = false;
    await page.getByRole('button', { name: 'Locate address', exact: true }).click();
    await page.getByRole('button', { name: '123 Test Street, Manila, Philippines', exact: true }).click();
    await page.getByLabel('Geofence radius (metres)').fill('3500');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByText('Circle · 3.5 km radius', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Confirm & Create', exact: true }).click();
    await page.getByText('NEW-TEST', { exact: true }).first().waitFor();
    assert.equal(registrations[0].geofence.radiusMeters, 3500);
    assert.deepEqual(registrations[0].geofence.center, [14.5995, 120.9842]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
