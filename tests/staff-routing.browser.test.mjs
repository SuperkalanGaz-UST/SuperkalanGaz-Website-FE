import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// All Auth/API requests are intercepted; no real accounts or records change.
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
assert.ok(supabaseUrl);
const authOrigin = new URL(supabaseUrl).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
const branches = [
  { id: '00000000-0000-4000-8000-000000000002', name: 'Routing Branch A', geofence: null },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Routing Branch B', geofence: null },
];

function sessionFor(role, status = 'Active') {
  const user = {
    id: '00000000-0000-4000-8000-000000000001', email: 'routing-test@example.invalid',
    app_metadata: { role, status, display_name: 'Routing Test', branches: branches.map(b => b.name), branch_ids: branches.map(b => b.id) },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.synthetic-test-signature`,
    refresh_token: 'synthetic-test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user,
  };
}

async function createContext(browser, session, { signedOut = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  // Seed only once: refresh and logout must use the app's persisted session.
  if (!signedOut) await context.addInitScript(({ key, session }) => {
    if (!sessionStorage.getItem('routing-test-initialized')) {
      localStorage.setItem(key, JSON.stringify(session));
      sessionStorage.setItem('routing-test-initialized', 'yes');
    }
  }, { key: storageKey, session });
  const apiRequests = [];
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin === authOrigin) {
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: session.user });
      if (url.pathname === '/auth/v1/token') return route.fulfill({ json: session });
      if (url.pathname === '/auth/v1/recover') return route.fulfill({ json: {} });
      if (url.pathname === '/auth/v1/verify') return route.fulfill({ json: session });
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      return route.abort();
    }
    if (url.origin !== apiOrigin) return route.abort();
    apiRequests.push(url.pathname);
    if (url.pathname === '/api/auth/staff/sign-in') return route.fulfill({ json: { access_token: session.access_token, refresh_token: session.refresh_token } });
    if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches } });
    if (url.pathname === '/api/governance/dashboard') return route.fulfill({ json: {
      metrics: { pendingApprovals: 0, adminAccountRequests: 0, priceChanges30Days: 0, branchOwnerChanges: 0 },
      priorityRequests: [], recentActivity: [],
      controls: { noSelfApproval: true, auditTrailActive: true, auditHistoryMutableByUsers: false },
    } });
    if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: {
      ...session.user.app_metadata, id: session.user.id, email: session.user.email, phone: null,
    } } });
    return route.fulfill({ json: {
      serviceRequests: [], branches: [], customers: [], users: [], notifications: [], unreadCount: 0,
      summary: null, ratings: [], requests: [], riders: [], vehicles: [], stockLevels: [],
    } });
  });
  return { context, apiRequests };
}

async function expectPath(page, path) {
  await page.waitForURL(url => url.pathname === path);
  assert.equal(new URL(page.url()).pathname, path);
}

test('owner refresh waits for live branch assignment instead of displaying a stale claim label', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const session = sessionFor('branch-owner');
  session.user.app_metadata.branch_ids = [branches[0].id];
  const staleBranchLabel = 'Previous Branch Label';
  session.user.app_metadata.branches = [staleBranchLabel];
  const assigned = [branches[0]];
  const { context, apiRequests } = await createContext(browser, session);
  let releaseAssignment;
  try {
    const page = await context.newPage();
    for (let attempt = 0; attempt < 2; attempt++) {
      const assignmentHeld = new Promise(resolve => { releaseAssignment = resolve; });
      let assignmentRequested;
      const requested = new Promise(resolve => { assignmentRequested = resolve; });
      await context.route(`${apiOrigin}/api/branches/assigned`, async route => {
        assignmentRequested();
        await assignmentHeld;
        await route.fulfill({ json: { branches: assigned } });
      });
      apiRequests.length = 0;
      if (attempt === 0) await page.goto(`${baseUrl}/branch-owner/customer-ratings`);
      else await page.reload();
      await requested;
      await page.getByRole('button', { name: session.user.app_metadata.display_name, exact: true }).waitFor();
      assert.equal(await page.getByText(staleBranchLabel, { exact: true }).count(), 0,
        'A restored session must not display a stale branch label before live assignment resolves');
      assert.equal(apiRequests.some(path => path.startsWith('/api/csat/')), false,
        'Branch data must wait for the API-validated assignment');
      releaseAssignment();
      await page.getByText(assigned[0].name, { exact: true }).waitFor();
      await context.unroute(`${apiOrigin}/api/branches/assigned`);
    }
  } finally {
    releaseAssignment?.();
    await context.close();
    await browser.close();
  }
});

test('owner CSAT requests use only the explicitly selected live branch UUID', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const { context } = await createContext(browser, sessionFor('branch-owner'));
  const requests = [];
  try {
    await context.route(`${apiOrigin}/api/csat/**`, route => {
      requests.push(new URL(route.request().url()));
      return route.fulfill({ json: { ratings: [], summary: null } });
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/branch-owner/csat`);
    await page.getByRole('button', { name: 'Select branch', exact: true }).waitFor();
    assert.equal(requests.length, 0, 'Multiple branches require an explicit selection');
    await page.getByRole('button', { name: 'Select branch', exact: true }).click();
    const loaded = page.waitForResponse(response => response.url().includes('/api/csat/ratings?'));
    await page.getByRole('button', { name: 'Routing Branch B', exact: true }).click();
    await loaded;
    await page.getByRole('button', { name: 'View all', exact: true }).first().click();
    await expectPath(page, '/branch-owner/customer-ratings');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expectPath(page, '/branch-owner/csat');
    const complaintsLoaded = page.waitForResponse(response => response.url().includes('maxStars=3'));
    await page.getByRole('button', { name: 'View all', exact: true }).last().click();
    await complaintsLoaded;
    assert.ok(requests.some(url => url.pathname.endsWith('/summary')));
    assert.ok(requests.some(url => url.searchParams.get('maxStars') === '3'));
    assert.ok(requests.every(url => url.searchParams.get('branchId') === branches[1].id),
      'Summary, ratings and complaints must all carry the selected UUID');
  } finally { await context.close(); await browser.close(); }
});

test('failed live assignment keeps owner branch data unavailable', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const status of [403, 503]) {
      const { context, apiRequests } = await createContext(browser, sessionFor('branch-owner'));
      try {
        await context.route(`${apiOrigin}/api/branches/assigned`, route =>
          route.fulfill({ status, json: { message: 'Branch assignment unavailable' } }));
        const page = await context.newPage();
        await page.goto(`${baseUrl}/branch-owner/customer-ratings`);
        await page.getByRole('button', { name: 'Branch unavailable · Retry', exact: true }).waitFor();
        assert.equal(apiRequests.some(path => path.startsWith('/api/csat/')), false);
        assert.equal(await page.getByText('Routing Branch A', { exact: true }).count(), 0);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('staff URLs preserve navigation, refresh and role isolation for every staff persona', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [role, settingsLabel, heading] of [
      ['super-admin', 'System Settings', 'Account settings'],
      ['franchise-admin', 'Settings', 'Account settings'],
      ['branch-owner', 'Settings', 'Settings'],
      ['branch-manager', 'Settings', 'Account settings'],
    ]) {
      const { context, apiRequests } = await createContext(browser, sessionFor(role));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseUrl);
      await expectPath(page, `/${role}/dashboard`);
      await page.goto(`${baseUrl}/${role}`);
      await expectPath(page, `/${role}/dashboard`);
      const sidebar = page.locator('aside');
      await sidebar.getByRole('link', { name: settingsLabel, exact: true }).click();
      await expectPath(page, `/${role}/settings`);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.equal(await sidebar.getByRole('link', { name: settingsLabel, exact: true }).getAttribute('aria-current'), 'page');
      if (role === 'branch-manager') {
        const newTabPromise = context.waitForEvent('page');
        await sidebar.getByRole('link', { name: settingsLabel, exact: true }).click({ button: 'middle' });
        const newTab = await newTabPromise;
        await newTab.getByRole('heading', { name: heading, exact: true }).waitFor();
        await expectPath(newTab, `/${role}/settings`);
        await newTab.close();
      }
      await page.reload();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await expectPath(page, `/${role}/settings`);
      await page.goBack();
      await expectPath(page, `/${role}/dashboard`);
      await page.goForward();
      await expectPath(page, `/${role}/settings`);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      const requestsBefore = apiRequests.length;
      const otherRole = role === 'super-admin' ? 'branch-manager' : 'super-admin';
      await page.goto(`${baseUrl}/${otherRole}/settings`);
      await expectPath(page, `/${role}/dashboard`);
      assert.equal(await page.locator('aside').getAttribute('aria-label'), {
        'super-admin': 'Super Administrator navigation', 'franchise-admin': 'Franchise Administrator navigation',
        'branch-owner': 'Branch Owner navigation', 'branch-manager': 'Branch Manager navigation',
      }[role]);
      if (otherRole === 'super-admin') assert.equal(apiRequests.slice(requestsBefore).some(path => path.startsWith('/api/governance/')), role === 'franchise-admin');
      assert.deepEqual(errors, [], `${role} must render without runtime errors`);
      await context.close();
    }
  } finally { await browser.close(); }
});

test('password recovery stays in its password form before any dashboard redirect', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const session = sessionFor('branch-manager');
    const { context, apiRequests } = await createContext(browser, session, { signedOut: true });
    const page = await context.newPage();
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).fill(session.user.email);
    await page.getByRole('button', { name: 'Send reset code', exact: true }).click();
    await page.getByLabel('Password reset code', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    await page.getByRole('heading', { name: 'Set a new password', exact: true }).waitFor();
    assert.equal(await page.locator('aside').count(), 0);
    assert.deepEqual(apiRequests, [], 'Recovery must not load staff data');
    await context.close();
  } finally { await browser.close(); }
});

test('branch selection and compact sidebar survive client navigation; detail events create history', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context } = await createContext(browser, sessionFor('branch-owner'));
    const page = await context.newPage();
    await page.goto(`${baseUrl}/branch-owner/settings`);
    await page.getByRole('button', { name: 'Select branch', exact: true }).click();
    await page.getByRole('button', { name: 'Routing Branch B', exact: true }).click();
    await page.getByRole('button', { name: 'Minimize sidebar', exact: true }).click();
    await page.locator('aside').getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expectPath(page, '/branch-owner/dashboard');
    await page.getByRole('button', { name: 'Routing Branch B', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'delivery-completion-full' })));
    await expectPath(page, '/branch-owner/delivery-completion');
    await page.reload();
    await page.getByRole('heading', { name: 'Delivery Completion', exact: false }).first().waitFor();
    await page.goBack();
    await expectPath(page, '/branch-owner/dashboard');
    await context.close();
  } finally { await browser.close(); }
});

test('signed-out bookmarks require login and logout cannot be undone with Back', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context } = await createContext(browser, sessionFor('branch-manager'), { signedOut: true });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/branch-manager/settings`);
    await page.getByRole('heading', { name: 'Sign In', exact: true }).waitFor();
    assert.equal(await page.locator('aside').count(), 0);
    await page.getByLabel('Username or email', { exact: true }).fill('routing-test');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.getByRole('heading', { name: 'Account settings', exact: true }).waitFor();
    await expectPath(page, '/branch-manager/settings');
    await page.locator('aside').getByRole('link', { name: 'Overview', exact: true }).click();
    await expectPath(page, '/branch-manager/dashboard');
    await page.getByRole('button', { name: 'Routing Test', exact: true }).click();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expectPath(page, '/');
    await page.getByRole('heading', { name: 'Sign In', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('heading', { name: 'Sign In', exact: true }).waitFor();
    assert.equal(await page.locator('aside').count(), 0);
    await context.close();
  } finally { await browser.close(); }
});

test('unknown destinations return 404 and invitations retain their dedicated flows', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context } = await createContext(browser, sessionFor('franchise-admin', 'Pending'));
    const page = await context.newPage();
    await page.goto(`${baseUrl}/franchise-admin/settings`);
    await page.getByRole('heading', { name: 'Activate your account', exact: true }).waitFor();
    assert.equal(await page.locator('aside').count(), 0);
    for (const path of ['/branch-manager/not-a-screen', '/driver/dashboard', '/super-admin/settings/extra', '/constructor/dashboard', '/franchise-admin/supply-chain']) {
      const response = await page.goto(`${baseUrl}${path}`);
      assert.equal(response.status(), 404, path);
      await page.getByRole('heading', { name: '404', exact: true }).waitFor();
      assert.equal(await page.locator('aside').count(), 0);
    }
    const token = 'a'.repeat(43);
    await page.goto(`${baseUrl}/?token=${token}`);
    await expectPath(page, '/delivery-rider-invitation');
    assert.equal(new URL(page.url()).searchParams.get('token'), token);
    assert.equal(await page.locator('aside').count(), 0);
    await context.close();
    const rider = await createContext(browser, sessionFor('driver', 'Pending'));
    const riderPage = await rider.context.newPage();
    await riderPage.goto(baseUrl);
    await expectPath(riderPage, '/delivery-rider-invitation');
    assert.equal(new URL(riderPage.url()).searchParams.get('session'), 'verified');
    assert.equal(await riderPage.locator('aside').count(), 0);
    await rider.context.close();
  } finally { await browser.close(); }
});
