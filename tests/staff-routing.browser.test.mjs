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

test('owner branch recovers from a temporary assignment failure on sign-in and reload', { timeout: 20_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context } = await createContext(browser, sessionFor('branch-owner'), { signedOut: true });
    let attempts = 0;
    let reloading = false;
    await context.route(`${apiOrigin}/api/branches/assigned`, async route => {
      assert.ok(route.request().headers().authorization?.startsWith('Bearer '));
      if (++attempts === 1) {
        // On reload, leave the first request pending to exercise the client timeout.
        if (reloading) return;
        await route.fulfill({ status: 503, json: { message: 'Branch lookup temporarily unavailable' } });
      } else {
        await route.fulfill({ json: { branches: [branches[0]] } });
      }
    });

    const page = await context.newPage();
    await page.goto(`${baseUrl}/branch-owner/settings`);
    await page.getByLabel('Username or email', { exact: true }).fill('routing-test');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    for (const trigger of ['sign-in', 'reload']) {
      if (trigger === 'reload') {
        attempts = 0;
        reloading = true;
        await page.reload();
      }
      const badge = page.getByText(branches[0].name, { exact: true });
      const retry = page.getByRole('button', { name: 'Branch unavailable · Retry', exact: true });
      const outcome = await Promise.race([
        badge.waitFor({ timeout: 8_000 }).then(() => 'branch shown'),
        retry.waitFor({ timeout: 8_000 }).then(() => 'Branch unavailable · Retry'),
      ]);
      assert.equal(outcome, 'branch shown', `${trigger} should recover without a click`);
      assert.equal(attempts, 2, `${trigger} should retry the temporary failure once`);
    }
  } finally { await browser.close(); }
});

test('failed live assignment keeps owner branch data unavailable', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const status of [403, 503]) {
      const { context, apiRequests } = await createContext(browser, sessionFor('branch-owner'));
      try {
        let attempts = 0;
        await context.route(`${apiOrigin}/api/branches/assigned`, route => {
          attempts++;
          return route.fulfill({ status, json: { message: 'Branch assignment unavailable' } });
        });
        const page = await context.newPage();
        await page.goto(`${baseUrl}/branch-owner/customer-ratings`);
        await page.getByRole('button', { name: 'Branch unavailable · Retry', exact: true }).waitFor();
        assert.equal(attempts, status === 503 ? 2 : 1);
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

test('Branch Manager offers the order without choosing a motorcycle', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const session = sessionFor('branch-manager');
  session.user.app_metadata.branch_ids = [branches[0].id];
  session.user.app_metadata.branches = [branches[0].name];
  const { context } = await createContext(browser, session);
  try {
    const riderId = '00000000-0000-4000-8000-000000000014';
    const requestId = '00000000-0000-4000-8000-000000000015';
    const row = {
      id: requestId, sr_code: 'SR-80432', branch_id: branches[0].id, status: 'Pending', order_source: 'Mobile App',
      customer_name: 'Test customer', customer_contact: '+639171234567', delivery_address: 'Test address',
      cylinder_size: '11kg', quantity: 1, unit_price: 900, total_amount: 900, requested_at: new Date().toISOString(),
      dispatched_at: null, rider_id: null, delivery_offer_expires_at: null,
    };
    await context.route(`${apiOrigin}/api/branches/assigned`, route => route.fulfill({ json: { branches: [branches[0]] } }));
    await context.route(`${apiOrigin}/api/riders?*`, route => route.fulfill({ json: {
      riders: [{ id: riderId, name: 'Available Test Rider', status: 'Available', plate: '', assigned_vehicle: null }],
    } }));
    await context.route(`${apiOrigin}/api/service-requests`, route => route.fulfill({ json: { serviceRequests: [row] } }));
    await context.route(`${apiOrigin}/api/service-requests/${requestId}/dispatch`, route => {
      assert.deepEqual(route.request().postDataJSON(), { riderId });
      row.delivery_offer_expires_at = new Date(Date.now() + 300_000).toISOString();
      return route.fulfill({ json: { serviceRequest: row } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    await page.goto(`${baseUrl}/branch-manager/service-requests`);
    const offer = page.getByRole('button', { name: 'Offer delivery', exact: true });
    await offer.click();
    await page.getByRole('combobox', { name: 'Delivery Rider', exact: true }).click();
    await page.getByRole('option', { name: /^Available Test Rider/ }).click();
    await page.getByRole('button', { name: 'Send offer', exact: true }).click();
    await page.getByText('Awaiting Delivery Rider acceptance', { exact: true }).waitFor();
    assert.equal(await offer.isDisabled(), true);
    const order = page.getByRole('row').filter({ hasText: 'SR-80432' });
    assert.equal(await order.getByText('Pending', { exact: true }).count(), 1);
  } finally {
    await context.close();
    await browser.close();
  }
});

test('Branch Manager order row lists every cylinder in a mixed order', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const session = sessionFor('branch-manager');
  session.user.app_metadata.branch_ids = [branches[0].id];
  session.user.app_metadata.branches = [branches[0].name];
  const { context } = await createContext(browser, session);
  try {
    const row = {
      id: '00000000-0000-4000-8000-000000000016', sr_code: 'SR-80433', branch_id: branches[0].id, status: 'Pending',
      order_source: 'Mobile App', customer_name: 'Mixed order customer', customer_contact: '+639171234567',
      delivery_address: 'Test address', cylinder_size: '2.7kg', quantity: 1, unit_price: 200, total_amount: 550,
      items: [{ cylinder_size: '2.7kg', quantity: 1, unit_price: 200 }, { cylinder_size: '5kg', quantity: 1, unit_price: 350 }],
      requested_at: new Date().toISOString(), dispatched_at: null, rider_id: null, delivery_offer_expires_at: null,
    };
    await context.route(`${apiOrigin}/api/branches/assigned`, route => route.fulfill({ json: { branches: [branches[0]] } }));
    await context.route(`${apiOrigin}/api/riders?*`, route => route.fulfill({ json: { riders: [] } }));
    await context.route(`${apiOrigin}/api/service-requests`, route => route.fulfill({ json: { serviceRequests: [row] } }));
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    await page.goto(`${baseUrl}/branch-manager/service-requests`);
    const order = page.getByRole('row').filter({ hasText: 'SR-80433' });
    await order.waitFor();
    const text = await order.innerText();
    assert.match(text, /2\.7kg/);
    assert.match(text, /5kg/);
  } finally {
    await context.close();
    await browser.close();
  }
});

test('Branch Manager creates one walk-in order with several cylinder sizes', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const session = sessionFor('branch-manager');
  session.user.app_metadata.branch_ids = [branches[0].id];
  session.user.app_metadata.branches = [branches[0].name];
  const { context } = await createContext(browser, session);
  try {
    const unitPrices = { '50kg': 3000, '22kg': 1400, '11kg': 659, '5kg': 350, '2.7kg': 200 };
    let posted = null;
    await context.route(`${apiOrigin}/api/branches/assigned`, route => route.fulfill({ json: { branches: [branches[0]] } }));
    await context.route(`${apiOrigin}/api/prices/assigned`, route => route.fulfill({ json: {
      prices: Object.entries(unitPrices).map(([cylinder_size, unit_price], i) => ({
        id: `00000000-0000-4000-8000-00000000002${i}`, cylinder_size, unit_price, updated_at: new Date().toISOString(),
      })),
    } }));
    await context.route(`${apiOrigin}/api/riders?*`, route => route.fulfill({ json: { riders: [] } }));
    await context.route(`${apiOrigin}/api/customers?*`, route => route.fulfill({ json: { customers: [] } }));
    await context.route(`${apiOrigin}/api/service-requests`, route => {
      if (route.request().method() === 'POST') {
        posted = route.request().postDataJSON();
        return route.fulfill({ status: 201, json: { serviceRequest: { id: '00000000-0000-4000-8000-000000000017' } } });
      }
      return route.fulfill({ json: { serviceRequests: [] } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    await page.goto(`${baseUrl}/branch-manager/service-requests`);
    await page.getByRole('button', { name: 'New Request' }).click();
    await page.getByPlaceholder('Search existing customer or type new name...').fill('Walk-in Buyer');
    await page.getByPlaceholder('+63 9XX XXX XXXX').fill('9171234567');
    await page.getByPlaceholder('123 Mabini St, Makati').fill('123 Rizal Street, Manila');
    await page.locator('#new-request-cylinder').click();
    await page.getByRole('option', { name: /^2\.7kg/ }).click();
    await page.getByRole('button', { name: 'Add another cylinder' }).click();
    await page.locator('#new-request-cylinder-2').click();
    // A size already on the order is not offered again.
    assert.equal(await page.getByRole('option', { name: /^2\.7kg/ }).count(), 0);
    await page.getByRole('option', { name: /^5kg/ }).click();
    await page.locator('#new-request-quantity-2').fill('3');
    await page.getByText('Total ₱1,250.00', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Create Request' }).click();
    for (let i = 0; i < 50 && !posted; i += 1) await page.waitForTimeout(100);
    assert.ok(posted, 'walk-in order was not submitted');
    assert.deepEqual(posted.items, [{ cylinderSize: '2.7kg', quantity: 1 }, { cylinderSize: '5kg', quantity: 3 }]);
    assert.equal(posted.cylinderSize, undefined);
    assert.equal(posted.quantity, undefined);
  } finally {
    await context.close();
    await browser.close();
  }
});
