import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

test('password recovery reports the actual error and allows a successful retry', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}),
  });
  try {
    const page = await browser.newPage();
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const user = {
      id: '22222222-2222-4222-8222-222222222222', email: 'reset@example.invalid',
      app_metadata: {}, user_metadata: {}, aud: 'authenticated',
    };
    const access_token = [encode({ alg: 'HS256' }), encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }), 'test'].join('.');
    let failure = null;
    const passwords = [];
    // All Auth traffic is synthetic; never change a real account's password.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (!url.pathname.startsWith('/auth/v1/')) return route.abort();
      if (url.pathname.endsWith('/verify')) {
        return route.fulfill({ json: { access_token, refresh_token: 'test', expires_in: 3600, token_type: 'bearer', user } });
      }
      if (url.pathname.endsWith('/user') && route.request().method() === 'PUT') {
        passwords.push(route.request().postDataJSON().password);
        return route.fulfill(failure ? {
          status: failure.status ?? 422,
          json: { error_code: failure.code, msg: failure.message },
        } : { json: { user } });
      }
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
      return route.fulfill({ json: {} });
    });
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.getByLabel('Email address').fill(user.email);
    await page.getByRole('button', { name: 'Send reset code', exact: true }).click();
    await page.getByLabel('Password reset code', { exact: true }).fill('123456');
    await page.getByRole('button', { name: 'Verify code', exact: true }).click();
    await page.getByLabel('New password', { exact: true }).fill('old-password-123');
    await page.getByLabel('Confirm new password', { exact: true }).fill('old-password-123');

    for (const scenario of [
      { code: 'same_password', message: 'New password should be different from the old password.', expected: 'Choose a new password different from your current password.' },
      { code: 'weak_password', message: 'Password must include an uppercase letter.', expected: 'Password must include an uppercase letter.' },
      { code: 'over_request_rate_limit', status: 429, message: 'Too many requests', expected: 'Too many attempts. Please wait a moment and try again.' },
      { code: 'session_expired', message: 'Session expired', expected: 'Your recovery session expired. Request a new reset code.' },
      { code: 'validation_failed', message: 'Invalid request', expected: 'Could not update your password. Please try again.' },
    ]) {
      failure = scenario;
      await page.getByRole('button', { name: 'Update password', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: scenario.expected }).waitFor();
      assert.equal(await page.locator('#new-password').inputValue(), 'old-password-123');
    }
    failure = null;
    await page.getByLabel('New password', { exact: true }).fill('Different-password-456');
    await page.getByLabel('Confirm new password', { exact: true }).fill('Different-password-456');
    await page.getByRole('button', { name: 'Update password', exact: true }).click();
    await page.getByRole('heading', { name: 'Password updated', exact: true }).waitFor();
    assert.equal(passwords.length, 6);
    assert.equal(passwords.at(-1), 'Different-password-456');
    await page.getByRole('button', { name: 'Return to login' }).click();
    await page.getByRole('heading', { name: 'Sign In', exact: true }).waitFor();
  } finally {
    await browser.close();
  }
});
