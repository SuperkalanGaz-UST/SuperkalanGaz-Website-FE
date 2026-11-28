import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic multi-branch Branch Owner; all API calls intercepted. No real data is read or changed.
test('branch selection survives refresh, resets on login, validates access, and scopes staff', { timeout: 180000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const alpha = { id: '11111111-1111-4111-8111-111111111111', name: 'Scope Alpha', geofence: null };
  const beta = { id: '22222222-2222-4222-8222-222222222222', name: 'Scope Beta', geofence: null };
  const gamma = { id: '33333333-3333-4333-8333-333333333333', name: 'Scope Gamma', geofence: null };
  let assignedBranches = [alpha, beta];
  const user = {
    id: '55555555-5555-4555-8555-555555555555', email: 'owner@example.invalid',
    app_metadata: { role: 'branch-owner', status: 'Active', display_name: 'Scope Owner', branch_ids: [alpha.id, beta.id], branches: [alpha.name, beta.name] },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const session = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
  const manager = { id: '66666666-6666-4666-8666-666666666666', email: 'manager@example.invalid', username: 'alpha.manager', display_name: 'Alpha Manager', phone: '+639171234567', branch_ids: [alpha.id], branches: [alpha.name], status: 'Active', created_at: '2026-10-01T00:00:00.000Z', last_login_at: null };
  const ordersToday = { [alpha.id]: 7, [beta.id]: 3 };
  let releaseBeta;
  const betaGate = new Promise(resolve => { releaseBeta = resolve; });
  const managerReads = [];
  const patches = [];
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addInitScript(({ key, session }) => {
      if (!sessionStorage.getItem('owner-scope-initialized')) {
        localStorage.setItem(key, JSON.stringify(session));
        sessionStorage.setItem('owner-scope-initialized', 'yes');
      }
    }, { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin) {
        if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
        return url.pathname === '/auth/v1/user' ? route.fulfill({ json: user }) : url.pathname === '/auth/v1/token' ? route.fulfill({ json: session }) : route.abort();
      }
      if (url.origin !== apiOrigin) return route.abort();
      if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
      if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: assignedBranches } });
      if (url.pathname === '/api/service-requests/reports/branch-owner-dashboard') {
        const branchId = url.searchParams.get('branchId');
        if (branchId === beta.id) await betaGate;
        return route.fulfill({ json: { metrics: { ordersToday: ordersToday[branchId], totalOrders: 10, completedDeliveries: 5, cancelledFailedDeliveries: 0, slaBreaches: 0, loyaltyClaimsThisMonth: 0, deliveryCompletionRate: 50 } } });
      }
      if (url.pathname === '/api/users' && request.method() === 'GET') { managerReads.push(url.search); return route.fulfill({ json: { users: [manager] } }); }
      if (url.pathname === `/api/users/${manager.id}` && request.method() === 'PATCH') { patches.push(request.postDataJSON()); return route.fulfill({ json: { ok: true } }); }
      return route.fulfill({ json: { invitations: [], notifications: [], unreadCount: 0, report: null } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    const kpi = page.locator('div.rounded-2xl', { has: page.getByText('Orders Today', { exact: true }) });

    // 1) A multi-branch owner is told to choose a branch instead of seeing unexplained "—".
    await page.goto(`${baseUrl}/branch-owner/dashboard`);
    await page.getByText('Select a branch from the branch menu above to see its data.').waitFor();

    // 2) Switching branches never leaves the previous branch's figure on screen.
    await page.getByRole('button', { name: 'Select branch', exact: true }).click();
    await page.getByRole('button', { name: alpha.name, exact: true }).click();
    await kpi.getByText('7', { exact: true }).waitFor();
    assert.equal(await page.getByText('Select a branch from the branch menu above').count(), 0);
    await page.getByRole('button', { name: alpha.name, exact: true }).click();
    await page.getByRole('button', { name: beta.name, exact: true }).click();
    await page.waitForTimeout(400); // Beta's response is still held back
    assert.equal(await kpi.getByText('7', { exact: true }).count(), 0, 'Alpha figure is gone while Beta loads');
    releaseBeta();
    await kpi.getByText('3', { exact: true }).waitFor();

    // Refresh restores Beta only after its assignment has been checked.
    await page.reload();
    await kpi.getByText('3', { exact: true }).waitFor();
    await page.getByRole('button', { name: beta.name, exact: true }).waitFor();

    // 3) Staff list follows the selected branch.
    await page.goto(`${baseUrl}/branch-owner/user-management`);
    await page.getByRole('button', { name: beta.name, exact: true }).click();
    await page.getByRole('button', { name: alpha.name, exact: true }).click();
    await page.getByText('Alpha Manager').first().waitFor();
    assert.ok(managerReads.some(q => q.includes(`branchId=${alpha.id}`)), `scoped read: ${managerReads.join(' | ')}`);

    // 4) Editing a Branch Manager: no password fields, +63 prefix, canonical phone saved.
    await page.getByTitle('Edit Branch Manager').first().click();
    await page.getByRole('heading', { name: 'Edit Branch Manager' }).waitFor();
    assert.equal(await page.locator('input[type="password"]').count(), 0, 'no password fields');
    const phone = page.locator('#manager-phone');
    assert.equal(await phone.inputValue(), '917 123 4567');
    await phone.fill('9181234567');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#manager-phone'));
    assert.equal(patches.length, 1);
    assert.equal(patches[0].phone, '+639181234567');
    assert.equal('password' in patches[0], false);

    // A removed assignment must not be restored, even if the JWT still lists it.
    assignedBranches = [beta, gamma];
    await page.goto(`${baseUrl}/branch-owner/dashboard`);
    await page.getByText('Select a branch from the branch menu above to see its data.').waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('superkalan:owner-branch-selection')), null);

    // A saved preference belonging to another owner is ignored.
    await page.evaluate(({ branchId }) => {
      sessionStorage.setItem('superkalan:owner-branch-selection', JSON.stringify({ ownerId: 'another-owner', branchId }));
    }, { branchId: beta.id });
    await page.reload();
    await page.getByText('Select a branch from the branch menu above to see its data.').waitFor();

    await page.getByRole('button', { name: 'Select branch', exact: true }).click();
    await page.getByRole('button', { name: beta.name, exact: true }).click();
    await kpi.getByText('3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Scope Owner', exact: true }).click();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('heading', { name: 'Sign In', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('superkalan:owner-branch-selection')), null);
    await page.getByLabel('Username or email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.getByText('Select a branch from the branch menu above to see its data.').waitFor();

    // Single-branch owners still enter their sole authorized branch automatically.
    assignedBranches = [beta];
    await page.reload();
    await kpi.getByText('3', { exact: true }).waitFor();

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
