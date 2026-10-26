import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Auth and API traffic is synthetic: this suite cannot modify live accounts.
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const branch = { id: '11111111-1111-4111-8111-111111111111', name: 'Settings Test Branch', geofence: null };
const roles = ['super-admin', 'franchise-admin', 'branch-owner', 'branch-manager'];

async function setup(browser, role, signedOut = false) {
  const user = {
    id: '22222222-2222-4222-8222-222222222222', email: 'settings@example.invalid',
    app_metadata: { role, status: 'Active', username: 'original.name', display_name: 'Settings Test',
      phone: '+639171234567', branch_ids: [branch.id], branches: [branch.name] },
    user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z',
  };
  if (signedOut) user.app_metadata.username = 'new.name';
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.${encode('test-signature')}`,
    refresh_token: 'synthetic', expires_at: expiresAt, expires_in: 3600, token_type: 'bearer', user,
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  if (!signedOut) await context.addInitScript(({ key, session }) => {
    if (!sessionStorage.getItem('settings-initialized')) {
      localStorage.setItem(key, JSON.stringify(session));
      sessionStorage.setItem('settings-initialized', 'yes');
    }
  }, { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
  const state = { writes: [], signIns: [], conflict: false, unavailable: false, refreshes: 0 };
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin === authOrigin) {
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.pathname === '/auth/v1/token') { state.refreshes++; return route.fulfill({ json: session }); }
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      throw new Error(`Unexpected Auth request: ${url.pathname}`);
    }
    if (url.origin !== apiOrigin) return route.abort();
    if (url.pathname === '/api/auth/staff/sign-in') {
      state.signIns.push(request.postDataJSON());
      return route.fulfill({ json: { access_token: session.access_token, refresh_token: session.refresh_token } });
    }
    if (url.pathname === '/api/users/me') {
      if (state.unavailable) return route.fulfill({ status: 503, json: { message: 'Account service unavailable' } });
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON();
        state.writes.push(body);
        if (state.conflict) return route.fulfill({ status: 409, json: { message: 'This username is already in use. Choose another username.' } });
        Object.assign(user.app_metadata, { username: body.username, display_name: body.name, phone: body.phone });
        user.email = body.email;
      }
      return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
    }
    if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [branch] } });
    if (url.pathname === '/api/governance/dashboard') return route.fulfill({ json: {
      metrics: { pendingApprovals: 0, adminAccountRequests: 0, priceChanges30Days: 0, branchOwnerChanges: 0 },
      priorityRequests: [], recentActivity: [], controls: { noSelfApproval: true, auditTrailActive: true, auditHistoryMutableByUsers: false },
    } });
    return route.fulfill({ json: { notifications: [], unreadCount: 0, branches: [], serviceRequests: [], riders: [], vehicles: [], users: [], summary: null, ratings: [], requests: [] } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, state, errors };
}

for (const role of roles) {
  test(`${role}: validates, cancels, handles conflicts, saves and reloads a username`, { timeout: 90_000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const { context, page, state, errors } = await setup(browser, role);
    try {
      await page.goto(`${baseUrl}/${role}/settings`);
      const username = page.getByLabel('Username', { exact: true });
      await username.waitFor();
      assert.equal(await username.inputValue(), 'original.name');
      assert.equal(await username.isEditable(), true);
      const save = page.getByRole('button', { name: role === 'branch-owner' ? 'Save profile' : 'Save changes', exact: true });
      await username.fill('bad name');
      await save.click();
      await page.getByText('Use 3–64 letters, numbers, dots, underscores, or hyphens', { exact: true }).waitFor();
      assert.equal(state.writes.length, 0);
      await username.fill('unsaved.name');
      await page.getByRole('button', { name: role === 'branch-owner' ? 'Discard changes' : 'Cancel', exact: true }).click();
      assert.equal(await username.inputValue(), 'original.name');
      state.conflict = true;
      await username.fill('taken.name');
      await save.click();
      await page.getByText('This username is already in use. Choose another username.', { exact: true }).first().waitFor();
      assert.equal(await username.getAttribute('aria-invalid'), 'true');
      state.conflict = false;
      await username.fill(' New.Name ');
      await save.click();
      await page.getByText('Account details updated.', { exact: true }).waitFor();
      assert.equal(await username.inputValue(), 'new.name');
      assert.deepEqual(Object.keys(state.writes.at(-1)).sort(), ['email', 'name', 'phone', 'username']);
      assert.equal(state.writes.at(-1).username, 'new.name');
      assert.ok(state.refreshes > 0, 'Saved profile refreshes the persisted Auth session');
      await page.reload();
      await username.waitFor();
      assert.equal(await username.inputValue(), 'new.name');
      await page.screenshot({ path: `/private/tmp/account-settings-${role}.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await username.isVisible(), true);
      assert.equal(await username.isEditable(), true);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
      await browser.close();
    }
  });
}

test('renamed username login exchanges credentials through NestJS and restores the staff session', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const { context, page, state } = await setup(browser, 'branch-manager', true);
  try {
    await page.goto(baseUrl);
    await page.getByLabel('Username or email', { exact: true }).fill('new.name');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/branch-manager/dashboard');
    assert.deepEqual(state.signIns, [{ username: 'new.name', password: 'synthetic-password' }]);
  } finally {
    await context.close();
    await browser.close();
  }
});
