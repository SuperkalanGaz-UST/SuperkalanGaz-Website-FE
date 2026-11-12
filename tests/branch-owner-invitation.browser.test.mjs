import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Every Auth/API request is intercepted: no real invitations or passwords are sent.
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
const authOrigin = new URL(supabaseUrl).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const branchId = '00000000-0000-4000-8000-000000000002';
const ownerId = '00000000-0000-4000-8000-000000000003';
function sessionFor(role, status = 'Active') {
  const user = { id: role === 'branch-owner' ? ownerId : '00000000-0000-4000-8000-000000000001', email: 'owner-invite@example.invalid',
    app_metadata: { role, status, branch_owner_invitation: role === 'branch-owner', invited_by: '00000000-0000-4000-8000-000000000001', invitation_branch_id: branchId, display_name: 'Invited Owner', username: 'invited-owner', branch_ids: role === 'branch-owner' ? [branchId] : [], branches: role === 'branch-owner' ? ['Test Branch'] : [] },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
}
async function seed(context, session) {
  await context.addInitScript(({ key, session }) => {
    if (!sessionStorage.getItem('invitation-test-seeded')) {
      localStorage.setItem(key, JSON.stringify(session));
      sessionStorage.setItem('invitation-test-seeded', 'yes');
    }
  }, { key: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`, session });
}
async function intercept(context, session, handler, authHandler = async () => false) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin === authOrigin) {
      if (await authHandler(route, url)) return;
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: session.user });
      if (url.pathname === '/auth/v1/token') return route.fulfill({ json: session });
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      return route.abort();
    }
    if (url.hostname === 'tiles.openfreemap.org') return route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
    if (url.origin !== apiOrigin && url.origin !== 'http://localhost:3001') return route.abort();
    if (await handler(route, url)) return;
    if (url.pathname === '/api/prices/regions') return route.fulfill({ json: { regions: [{ code: 'NCR', name: 'Metro Manila (NCR)' }] } });
    return route.fulfill({ json: { branches: [], users: [], notifications: [], unreadCount: 0, locations: [] } });
  });
}

test('expired invitation callback explains how to get a new link even with an existing staff session', { timeout: 15000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const session = sessionFor('franchise-admin');
    await seed(context, session);
    const requests = [];
    await intercept(context, session, async (route, url) => {
      requests.push(url.pathname);
      return false;
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?invitation=branch-owner#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Invitation unavailable', exact: true }).waitFor({ timeout: 3000 });
    await page.getByRole('alert').filter({ hasText: /ask your Franchise Administrator to resend/i }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Sign In', exact: true }).count(), 0);
    assert.equal(requests.length, 0, 'An invitation callback must not open another account’s dashboard');
    assert.equal(new URL(page.url()).hash, '');
  } finally { await browser.close(); }
});

test('legacy links show password setup while checking Auth and offer a retry when Auth stalls', { timeout: 15000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const session = sessionFor('branch-owner', 'Pending');
    let releaseUser;
    const userReady = new Promise(resolve => { releaseUser = resolve; });
    await intercept(context, session, async () => false, async (route, url) => {
      if (url.pathname !== '/auth/v1/user') return false;
      await userReady;
      await route.fulfill({ json: session.user });
      return true;
    });
    const page = await context.newPage();
    const fragment = new URLSearchParams({
      access_token: session.access_token, refresh_token: session.refresh_token,
      expires_in: String(session.expires_in), token_type: session.token_type, type: 'invite',
    });
    await page.goto(`${baseUrl}/?invitation=branch-owner#${fragment}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Set Password', exact: true }).waitFor({ timeout: 3000 });
    await page.getByRole('status').filter({ hasText: /Checking your Branch Owner invitation/ }).waitFor();
    await page.getByRole('button', { name: 'Try again', exact: true }).waitFor({ timeout: 5500 });
    releaseUser();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByLabel('New password', { exact: true }).waitFor({ timeout: 3000 });
  } finally { await browser.close(); }
});

test('new owner registration reports SMTP failures and then confirms an invitation without displaying a password', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const session = sessionFor('franchise-admin');
    await seed(context, session);
    let failMail = true;
    const payloads = [];
    await intercept(context, session, async (route, url) => {
      if (url.pathname === '/api/branches' && route.request().method() === 'POST') {
        payloads.push(route.request().postDataJSON());
        await route.fulfill(failMail ? { status: 503, json: { message: 'Invitation email unavailable' } } : { json: { id: branchId, code: 'INVITED-BRANCH', owner: { id: ownerId, email: session.user.email, invitationSent: true } } });
        return true;
      }
      return false;
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/franchise-admin/franchise-registry`);
    await page.getByRole('button', { name: '+ Register New Branch', exact: true }).click();
    await page.getByPlaceholder('Search known locations…').fill('Test Branch');
    await page.getByPlaceholder('9XX XXX XXXX', { exact: true }).fill('9171234567');
    await page.getByLabel('Full address', { exact: true }).fill('123 Test Street');
    await page.getByPlaceholder('Search province…', { exact: true }).fill('Metro Manila');
    await page.getByRole('button', { name: 'Metro Manila', exact: true }).click();
    await page.getByPlaceholder('Search city or municipality…', { exact: true }).fill('Manila');
    await page.getByRole('option', { name: 'Manila', exact: true }).click();
    await page.getByPlaceholder('20', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: 'New owner', exact: true }).click();
    await page.getByLabel('Owner first name', { exact: true }).fill('Invited');
    await page.getByLabel('Owner last name', { exact: true }).fill('Owner');
    await page.getByLabel('Owner email address', { exact: true }).fill(session.user.email);
    await page.getByPlaceholder('9XX XXX XXXX', { exact: true }).fill('9171234567');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm & Create', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Invitation email unavailable' }).waitFor();
    assert.equal(await page.getByText('Branch Account Created!', { exact: true }).count(), 0);
    failMail = false;
    await page.getByRole('button', { name: 'Confirm & Create', exact: true }).click();
    await page.getByText('Branch Account Created!', { exact: true }).waitFor();
    await page.getByText(/An invitation email was sent to/).waitFor();
    assert.equal(await page.getByText(/temporary password/i).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).isEnabled(), true);
    assert.equal(payloads[1].ownerType, 'new');
    assert.equal(payloads[1].ownerMobile, '+639171234567');
    assert.equal('password' in payloads[1], false);
  } finally { await browser.close(); }
});

test('an emailed Branch Owner link verifies only on click, then sets the password through NestJS', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const session = sessionFor('branch-owner', 'Pending');
    const requests = [];
    const chosenPasswords = [];
    const verifications = [];
    let expired = true;
    await intercept(context, session, async (route, url) => {
      requests.push(url.pathname);
      if (url.pathname === '/api/branches/owner-invitations/accept') {
        chosenPasswords.push(route.request().postDataJSON());
        if (expired) await route.fulfill({ status: 403, json: { message: 'This invitation is expired. Ask the Franchise Administrator to resend it.' } });
        else {
          session.user.app_metadata.status = 'Active';
          await route.fulfill({ json: { ok: true } });
        }
        return true;
      }
      if (url.pathname === '/api/branches/assigned') {
        await route.fulfill({ json: { branches: [{ id: branchId, name: 'Test Branch', geofence: null }] } });
        return true;
      }
      return false;
    }, async (route, url) => {
      if (url.pathname !== '/auth/v1/verify') return false;
      const { token_hash, type } = route.request().postDataJSON();
      verifications.push({ token_hash, type });
      await route.fulfill({ json: session });
      return true;
    });
    const page = await context.newPage();
    const tokenHash = 'a'.repeat(64);
    await page.goto(`${baseUrl}/?invitation=branch-owner#token_hash=${tokenHash}`);
    await page.getByRole('heading', { name: 'Set Password', exact: true }).waitFor({ timeout: 3000 });
    const verify = page.getByRole('button', { name: 'Verify invitation', exact: true });
    await verify.waitFor();
    assert.deepEqual(verifications, [], 'Opening or previewing the email link must not spend it');
    await verify.click();
    await page.getByLabel('New password', { exact: true }).waitFor();
    assert.deepEqual(verifications, [{ token_hash: tokenHash, type: 'email' }]);
    assert.equal(new URL(page.url()).hash, '');
    await page.getByText(/Branch Owner account\./).waitFor();
    assert.equal(requests.length, 0, 'Pending owners must not load protected dashboard data');
    await page.getByLabel('New password', { exact: true }).fill('ChosenPassword1');
    await page.getByLabel('Confirm password', { exact: true }).fill('ChosenPassword1');
    await page.getByRole('button', { name: 'Activate account', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'This invitation is expired.' }).waitFor();
    assert.equal(requests.some(path => path === '/api/branches/assigned'), false);
    expired = false;
    await page.getByRole('button', { name: 'Activate account', exact: true }).click();
    await page.waitForURL('**/branch-owner/dashboard');
    assert.deepEqual(chosenPasswords.at(-1), { password: 'ChosenPassword1' });
    assert.equal(requests.some(path => path.includes('franchise-admin-invitations')), false);
  } finally { await browser.close(); }
});
