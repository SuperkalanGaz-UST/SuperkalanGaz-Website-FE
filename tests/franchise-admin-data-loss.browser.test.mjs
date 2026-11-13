import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic identity and intercepted API responses: no real branches, users or reviews are modified.
test('address edit never wipes coverage, unconfirmed invitation never re-creates, reasons never carry over', { timeout: 120000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'fa-test@example.invalid', app_metadata: { role: 'franchise-admin', status: 'Active', branch_ids: [], branches: [], display_name: 'FA Test' }, user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.synthetic`;
  const center = [14.5995, 120.9842];
  const points = Array.from({ length: 12 }, (_, i) => [center[0] + 0.01 * Math.sin(i * Math.PI / 6), center[1] + 0.01 * Math.cos(i * Math.PI / 6)]);
  const branch = { owner_id: null, id: '00000000-0000-4000-8000-000000000002', name: 'Coverage Branch', code: 'COV', status: 'active', region: 'NCR', address: '123 Test Street', city: 'Manila', province: 'Metro Manila', contact_number: '+639171234567', geofence: { type: 'polygon', center, radiusMeters: 1000, points }, created_at: new Date().toISOString() };
  const reviews = [
    { id: 'r-1', role: 'branch-owner', status: 'pending', applicant_name: 'Alpha Applicant', applicant_email: 'alpha@example.invalid', applicant_phone: null, branch_name: 'Coverage Branch', branch_address: null, submitted_at: new Date().toISOString(), decided_by_name: null, decision_reason: null },
    { id: 'r-2', role: 'branch-manager', status: 'pending', applicant_name: 'Beta Applicant', applicant_email: 'beta@example.invalid', applicant_phone: null, branch_name: 'Coverage Branch', branch_address: null, submitted_at: new Date().toISOString(), decided_by_name: null, decision_reason: null },
  ];
  const patches = [];
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
      if (url.hostname === 'tiles.openfreemap.org') return route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef2ed' } }] } });
      if (url.origin !== apiOrigin) return route.abort();
      if (url.pathname === '/api/governance/dashboard') return route.fulfill({ json: { metrics: { pendingApprovals: 0, adminAccountRequests: 0, priceChanges30Days: 0, branchOwnerChanges: 0 }, priorityRequests: [], recentActivity: [], controls: { noSelfApproval: true, auditTrailActive: true, auditHistoryMutableByUsers: false } } });
      if (url.pathname === `/api/branches/${branch.id}` && request.method() === 'PATCH') { patches.push(request.postDataJSON()); return route.fulfill({ json: { branch } }); }
      if (url.pathname === '/api/branches' && request.method() === 'POST') {
        registrations.push(request.postDataJSON());
        // Branch persisted, invitation email not confirmed.
        return route.fulfill({ json: { id: '00000000-0000-4000-8000-000000000004', code: 'NEW-OWNER', owner: { invitationSent: false } } });
      }
      if (url.pathname === '/api/branches') return route.fulfill({ json: { branches: [branch] } });
      if (url.pathname === '/api/staff-registration/requests') return route.fulfill({ json: { requests: reviews } });
      if (url.pathname === '/api/prices/regions') return route.fulfill({ json: { regions: [{ code: 'NCR', name: 'Metro Manila (NCR)' }] } });
      return route.fulfill({ json: { serviceRequests: [], branches: [], customers: [], users: [], documents: [], notifications: [], unreadCount: 0, summary: null, ratings: [], locations: [] } });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl);

    // 1) Editing the address must not silently erase the saved coverage.
    await page.getByRole('link', { name: 'Franchise Registry', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const save = page.getByRole('button', { name: 'Save Changes', exact: true });
    await page.getByLabel('Full address', { exact: true }).fill('456 New Street');
    await page.getByText(/The address changed, so the saved coverage area no longer applies/).waitFor();
    assert.equal(await save.isEnabled(), false, 'cannot save while coverage is stale');
    await page.getByLabel('Full address', { exact: true }).fill('123 Test Street');
    assert.equal(await page.getByText(/The address changed/).count(), 0);
    await save.click();
    await page.waitForFunction(() => !document.querySelector('[aria-label="Close edit branch dialog"]'));
    assert.equal(patches.length, 1);
    assert.deepEqual(patches[0].geofence, branch.geofence, 'restored address keeps the stored coverage');

    // 2) A created branch with an unconfirmed invitation leaves the wizard; no duplicate, next run starts empty.
    await page.getByRole('button', { name: '+ Register New Branch', exact: true }).click();
    await page.getByPlaceholder('Search known locations…').fill('Unconfirmed Branch');
    await page.getByPlaceholder('9XX XXX XXXX', { exact: true }).fill('9171234567');
    await page.getByLabel('Full address', { exact: true }).fill('789 Test Street');
    await page.getByPlaceholder('Search province…', { exact: true }).fill('Metro Manila');
    await page.getByRole('button', { name: 'Metro Manila', exact: true }).click();
    await page.getByPlaceholder('Search city or municipality…', { exact: true }).fill('Manila');
    await page.getByRole('option', { name: 'Manila', exact: true }).click();
    await page.getByPlaceholder('20', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: 'New owner', exact: true }).click();
    await page.getByLabel('Owner first name', { exact: true }).fill('Nora');
    await page.getByLabel('Owner last name', { exact: true }).fill('Santos');
    await page.getByLabel('Owner email address', { exact: true }).fill('nora@example.invalid');
    await page.locator('input[type="tel"]').fill('9181234567');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm & Create', exact: true }).click();
    await page.getByText(/could not be confirmed\.\s*Do not register the branch again/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Confirm & Create', exact: true }).count(), 0, 'wizard is gone');
    assert.equal(registrations.length, 1);
    await page.getByRole('button', { name: /Register another/i }).click();
    assert.equal(await page.getByPlaceholder('Search known locations…').inputValue(), '', 'next registration starts empty');
    assert.equal(await page.getByLabel('Full address', { exact: true }).inputValue(), '');
    await page.keyboard.press('Escape');

    // 3) A typed reason is cleared when the selected applicant changes through search.
    await page.goto(baseUrl);
    await page.getByRole('link', { name: 'Account Reviews', exact: true }).click();
    const reason = page.getByLabel('Decision reason');
    await reason.fill('Reason written for Alpha only');
    await page.getByPlaceholder('Search name, email, or branch').fill('Beta');
    await page.getByText('beta@example.invalid').first().waitFor();
    assert.equal(await reason.inputValue(), '', 'reason does not carry over to Beta');

    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
