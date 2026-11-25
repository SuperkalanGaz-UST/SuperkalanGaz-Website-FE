// Sign In, expired Franchise Administrator link, /signup and Delivery Rider registration. All API calls mocked.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const token = 'a'.repeat(40);
const invitation = {
  invitationId: 'inv-1', recipientName: 'Rider Test', email: 'rider@example.invalid', mobile: '+639171234567',
  branchName: 'Test Branch', expiresAt: '2026-11-21T00:00:00Z', emailVerified: true, accountCreated: false, mobileVerified: false,
};

async function withPage(acceptance, run) {
  const writes = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === baseUrl) return route.continue();
      if (url.origin !== apiOrigin) return route.abort();
      if (route.request().method() !== 'GET') writes.push({ path: url.pathname, body: route.request().postData() });
      if (url.pathname === '/api/delivery-rider-invitations/acceptance') return route.fulfill(acceptance);
      return route.fulfill({ json: {} });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await run(page, writes);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

test('Sign In eye icon, forgot password keeps the email, expired invite link and /signup', { timeout: 120000 }, async () => {
  await withPage({ json: {} }, async page => {
    await page.goto(baseUrl);
    await page.getByLabel('Username or email').fill('owner@example.invalid');
    await page.locator('#password').fill('secret123');
    const eye = page.getByRole('button', { name: 'Show password' });
    assert.equal(await page.locator('#password').getAttribute('type'), 'password');
    assert.match(await eye.locator('svg').getAttribute('class'), /lucide-eye-off/, 'hidden password shows the crossed-out eye');
    await eye.click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    assert.match(await page.getByRole('button', { name: 'Hide password' }).locator('svg').getAttribute('class'), /lucide-eye(?!-off)/);
    await page.getByRole('button', { name: 'Hide password' }).click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'password');
    assert.equal(await page.locator('#password').inputValue(), 'secret123');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    assert.equal(await page.getByLabel('Email address').inputValue(), 'owner@example.invalid');
    await page.getByRole('button', { name: 'Back to login' }).click();
    assert.equal(await page.getByLabel('Username or email').inputValue(), 'owner@example.invalid');

    await page.goto(`${baseUrl}/?invitation=franchise-admin#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
    await page.getByRole('alert').filter({ hasText: 'Ask your Super Administrator to resend it' }).waitFor();
    assert.equal(new URL(page.url()).search + new URL(page.url()).hash, '', 'the dead link is cleared from the address bar');

    await page.goto(`${baseUrl}/signup`);
    assert.equal(new URL(page.url()).pathname, '/');
    await page.getByRole('heading', { name: 'Sign In' }).waitFor();
  });
});

test('dead Delivery Rider invitation points to the Branch Owner', { timeout: 120000 }, async () => {
  await withPage({ status: 404, json: { message: 'This Delivery Rider invitation is invalid, expired, revoked, or already used' } }, async page => {
    await page.goto(`${baseUrl}/delivery-rider-invitation?token=${token}`);
    await page.getByText('Contact your Branch Owner to send you a new invitation.').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Try again' }).count(), 0);
  });
});

test('unverified email shows no verified badge', { timeout: 120000 }, async () => {
  await withPage({ json: { ...invitation, emailVerified: false } }, async page => {
    await page.goto(`${baseUrl}/delivery-rider-invitation?token=${token}`);
    await page.getByText('Open the link in your invitation email').waitFor();
    assert.equal(await page.getByText('Email invitation verified').count(), 0);
  });
});

test('Enter submits the Delivery Rider password step', { timeout: 120000 }, async () => {
  await withPage({ json: invitation }, async (page, writes) => {
    await page.goto(`${baseUrl}/delivery-rider-invitation?token=${token}`);
    await page.getByText('Email invitation verified').waitFor();
    await page.getByRole('button', { name: 'Continue registration' }).click();
    await page.getByPlaceholder('At least 8 characters').fill('rider-pass-1');
    await page.getByPlaceholder('Enter password again').fill('rider-pass-1');
    await page.getByPlaceholder('Enter password again').press('Enter');
    await page.getByRole('heading', { name: 'Accept your branch invitation' }).waitFor();
    assert.deepEqual(writes.map(w => [w.path, JSON.parse(w.body)]), [['/api/delivery-rider-invitations/account', { token, password: 'rider-pass-1' }]]);
  });
});
