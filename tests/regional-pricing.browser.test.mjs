import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic sessions and intercepted API calls: this test never changes real prices.
test('regional price proposal navigation, validation, reset and retry', { timeout: 60000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  assert.ok(supabaseUrl);
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const user = {
    id: '00000000-0000-4000-8000-000000000001', email: 'pricing-test@example.invalid',
    app_metadata: { role: 'franchise-admin', status: 'Active', branch_ids: [], branches: [], display_name: 'Pricing Test' },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.synthetic-test-signature`;
  const sizes = ['50kg', '22kg', '11kg', '5kg', '2.7kg'];
  const amounts = [3000, 1360, 679, 360, 210];
  const writes = [];
  let failPrices = false;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
      key: `sb-${projectRef}-auth-token`, session: { access_token: token, refresh_token: 'synthetic-test-only', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user },
    });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === new URL(supabaseUrl).origin && url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.origin !== apiOrigin) return route.abort();
      if (url.pathname === '/api/governance/dashboard') return route.fulfill({ json: { metrics: { pendingApprovals: 0, adminAccountRequests: 0, priceChanges30Days: 0, branchOwnerChanges: 0 }, priorityRequests: [], recentActivity: [], controls: { noSelfApproval: true, auditTrailActive: true, auditHistoryMutableByUsers: false } } });
      if (request.method() === 'POST') {
        assert.equal(url.pathname, '/api/governance/requests');
        writes.push(request.postDataJSON());
        return route.fulfill({ json: { request: { id: 'test-proposal', status: 'pending' } } });
      }
      if (url.pathname === '/api/prices/regions') return route.fulfill({ json: { regions: [{ code: 'NCR', name: 'Metro Manila (NCR)' }, { code: 'IV-A', name: 'CALABARZON (Region IV-A)' }] } });
      if (url.pathname === '/api/prices') {
        if (failPrices) return route.fulfill({ status: 503, json: { message: 'Pricing temporarily unavailable' } });
        return route.fulfill({ json: { source: url.searchParams.get('regionCode') ? 'regional' : 'system-wide', prices: sizes.map((size, index) => ({ id: `product-${index}`, cylinder_size: size, unit_price: amounts[index], updated_at: new Date().toISOString() })) } });
      }
      return route.fulfill({ json: { serviceRequests: [], branches: [], customers: [], users: [], notifications: [], unreadCount: 0, summary: null, ratings: [] } });
    });
    const page = await context.newPage();
    await page.goto(baseUrl);
    await page.getByRole('link', { name: 'Price Configuration', exact: true }).click();
    await page.getByText('System-wide defaults loaded', { exact: true }).waitFor();
    assert.equal(await page.getByRole('columnheader').count(), 4);
    await page.getByRole('combobox', { name: 'Region', exact: true }).click();
    await page.getByRole('combobox', { name: 'Search Philippine regions', exact: true }).fill('calabarzon');
    await page.getByRole('option', { name: 'CALABARZON (Region IV-A)' }).click();
    await page.getByText('Approved regional prices loaded', { exact: true }).waitFor();
    const price = page.getByLabel('11kg Cylinder proposed price in Philippine pesos', { exact: true });
    await price.fill('699');
    await page.getByLabel('Reason for change').fill('Regional delivery cost adjustment.');
    await page.getByText('+₱20.00', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Submit proposal', exact: true }).isEnabled(), true);
    await price.fill('0');
    await price.blur();
    assert.equal(await price.getAttribute('aria-invalid'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Submit proposal', exact: true }).isEnabled(), false);
    await price.fill('699');
    await page.getByRole('combobox', { name: 'Region', exact: true }).click();
    await page.getByRole('option', { name: 'Metro Manila (NCR)' }).click();
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await price.inputValue(), '699.00');
    assert.match(await page.getByRole('combobox', { name: 'Region', exact: true }).innerText(), /CALABARZON/);
    await page.getByRole('button', { name: 'Submit proposal', exact: true }).click();
    await page.getByText('Proposal submitted. Prices will change only after Super Administrator approval.', { exact: true }).waitFor();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].payload.regionCode, 'IV-A');
    assert.equal(writes[0].payload.prices.find(row => row.cylinderSize === '11kg').unitPrice, 699);
    assert.equal(writes[0].reason, 'Regional delivery cost adjustment.');
    assert.equal('riskLevel' in writes[0], false);
    assert.equal(await price.inputValue(), '679.00', 'Submitting a proposal must not change approved prices');
    await price.fill('700');
    await page.getByRole('button', { name: 'Reset changes', exact: true }).click();
    assert.equal(await price.inputValue(), '679.00');
    if (process.env.TEST_ARTIFACT_DIR) {
      await mkdir(process.env.TEST_ARTIFACT_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/regional-pricing-desktop.png`, fullPage: true });
    }
    failPrices = true;
    await page.getByRole('combobox', { name: 'Region', exact: true }).click();
    await page.getByRole('option', { name: 'Metro Manila (NCR)' }).click();
    await page.getByText('Pricing temporarily unavailable', { exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: /proposed price/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Submit proposal', exact: true }).isEnabled(), false);
    failPrices = false;
    await page.getByRole('button', { name: 'Retry loading prices', exact: true }).click();
    await page.getByText('Approved regional prices loaded', { exact: true }).waitFor();
    await page.setViewportSize({ width: 1024, height: 900 });
    assert.equal(await page.locator('main').evaluate(element => element.scrollWidth > element.clientWidth), false, 'The table must scroll within its container');
    assert.equal(writes.length, 1);
  } finally { await browser.close(); }
});
