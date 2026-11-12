import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic accounts and intercepted requests: real owners/assignments are never changed.
test('edit uses the saved owner ID instead of Maria, the first directory account', { timeout: 60000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const apiOrigins = new Set([apiOrigin, 'http://localhost:3001']);
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'assignment@example.invalid', app_metadata: { role: 'franchise-admin', status: 'Active', branch_ids: [], branches: [], display_name: 'Assignment Test' }, user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.synthetic`;
  const correctOwnerId = '00000000-0000-4000-8000-000000000005';
  let branch = { owner_id: correctOwnerId, id: '00000000-0000-4000-8000-000000000002', name: 'Test Branch', code: 'TEST', status: 'active', region: 'NCR', address: '123 Test Street', city: 'Manila', province: 'Metro Manila', contact_number: '+639171234567', geofence: null, created_at: new Date().toISOString() };
  const owners = [
    { id: '00000000-0000-4000-8000-000000000003', email: 'maria@example.invalid', display_name: 'Maria Santos', phone: '+639171111111', status: 'Active' },
    { id: correctOwnerId, email: 'new-owner@example.invalid', display_name: 'New Branch Owner', phone: '+639172222222', status: 'Active' },
  ];
  let failOwners = false;
  let missingOwner = false;
  let pendingOwner = false;
  let resends = 0;
  const ownerLookups = [];
  const ownerWrites = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${projectRef}-auth-token`, session: { access_token: token, refresh_token: 'synthetic', token_type: 'bearer', expires_in: 3600, expires_at: exp, user } });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === new URL(supabaseUrl).origin && url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.hostname === 'tiles.openfreemap.org') return route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
      if (!apiOrigins.has(url.origin)) return route.abort();
      if (url.pathname.endsWith('/owner-invitation/resend')) {
        resends += 1;
        return route.fulfill({ json: { ok: true } });
      }
      if (url.pathname === '/api/users') {
        ownerLookups.push(url);
        return route.fulfill(failOwners ? { status: 503, json: { message: 'Owner directory unavailable' } } : { json: { users: missingOwner ? [owners[0]] : owners.map(owner => pendingOwner && owner.id === correctOwnerId ? { ...owner, status: 'Pending' } : owner) } });
      }
      if (url.pathname.startsWith('/api/users/') && request.method() === 'PATCH') {
        ownerWrites.push({ id: url.pathname.split('/').at(-1), ...request.postDataJSON() });
        return route.fulfill({ json: { ok: true } });
      }
      if (url.pathname === `/api/branches/${branch.id}` && request.method() === 'PATCH') {
        branch = { ...branch, ...request.postDataJSON() };
        return route.fulfill({ json: { branch } });
      }
      if (url.pathname === '/api/branches') return route.fulfill({ json: { branches: [branch] } });
      if (url.pathname === '/api/prices/regions') return route.fulfill({ json: { regions: [{ code: 'NCR', name: 'Metro Manila (NCR)' }] } });
      return route.fulfill({ json: { users: [], notifications: [], unreadCount: 0 } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(`${baseUrl}/franchise-admin/franchise-registry`);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'New Branch Owner'), null, { timeout: 5000 });
    assert.equal(await page.locator('input').evaluateAll(inputs => inputs.some(input => input.value === 'Maria Santos')), false);
    assert.equal(ownerLookups.at(-1).searchParams.get('branchId'), branch.id);
    assert.equal(ownerLookups.at(-1).searchParams.has('branch'), false);
    await page.getByLabel('Owner name', { exact: true }).fill('Updated Owner');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    assert.deepEqual(ownerWrites, [{ id: correctOwnerId, name: 'Updated Owner' }]);

    failOwners = true;
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Retry owner lookup', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save Changes', exact: true }).isEnabled(), false);
    failOwners = false;
    await page.getByRole('button', { name: 'Retry owner lookup', exact: true }).click();
    await page.getByLabel('Owner name', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Owner name', { exact: true }).inputValue(), 'New Branch Owner');
    await page.getByRole('button', { name: 'Close edit branch dialog', exact: true }).click();

    pendingOwner = true;
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Resend invitation', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Owner name', { exact: true }).isEnabled(), false);
    await page.getByRole('button', { name: 'Resend invitation', exact: true }).click();
    await page.getByText('Branch Owner invitation email sent.', { exact: true }).waitFor();
    assert.equal(resends, 1);
    await page.getByRole('button', { name: 'Close edit branch dialog', exact: true }).click();
    pendingOwner = false;
    missingOwner = true;
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByText('The assigned Branch Owner could not be loaded. Retry before saving.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save Changes', exact: true }).isEnabled(), false);
    assert.equal(await page.getByLabel('Owner name', { exact: true }).count(), 0);
  } finally { await browser.close(); }
});
