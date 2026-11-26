import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic identity and intercepted API responses keep the test isolated from live records.
test('branch registration, coverage editing and owner reassignment stay separate in Franchise Registry', { timeout: 120000 }, async () => {
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
  const currentOwner = { id: '00000000-0000-4000-8000-000000000003', display_name: 'Current Owner', email: 'current@example.invalid', phone: '+639171234567', status: 'Active' };
  const proposedOwner = { id: '00000000-0000-4000-8000-000000000005', display_name: 'Proposed Owner', status: 'Active' };
  const pendingOwner = { id: '00000000-0000-4000-8000-000000000006', display_name: 'Pending Owner', status: 'Pending' };
  const branch = { owner_id: currentOwner.id, id: '00000000-0000-4000-8000-000000000002', name: 'Coverage Branch', code: 'COV', status: 'active', region: 'NCR', address: '123 Test Street', city: 'Manila', province: 'Metro Manila', contact_number: '+639171234567', geofence: { type: 'polygon', center, radiusMeters: 1000, points }, created_at: new Date().toISOString() };
  const patches = [];
  const registrations = [];
  const proposals = [];
  const errors = [];
  const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}), args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] });
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
      if (url.pathname === '/api/users' && url.searchParams.get('role') === 'branch-owner') {
        const users = url.searchParams.has('branchId') ? [currentOwner] : [currentOwner, proposedOwner, pendingOwner];
        return route.fulfill({ json: { users } });
      }
      if (url.pathname === '/api/governance/requests') {
        if (request.method() === 'POST') {
          proposals.push(request.postDataJSON());
          return route.fulfill({ status: 201, json: { request: { status: 'pending' } } });
        }
        return route.fulfill({ json: { requests: proposals.map((proposal, index) => ({
          id: `proposal-${index}`, ...proposal, status: 'pending', submitted_at: new Date().toISOString(),
        })) } });
      }
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
    const ownerEmail = page.getByLabel('Owner email address', { exact: true });
    const invalidEmail = page.getByRole('alert').filter({ hasText: 'Enter a valid email address.' });
    assert.equal(await invalidEmail.count(), 0, 'an untouched email field has no error');
    await ownerEmail.fill('invalid-email');
    await invalidEmail.waitFor();
    assert.equal(await ownerEmail.evaluate(element => element === document.activeElement), true, 'validation appears before blur');
    assert.equal(await ownerEmail.getAttribute('aria-invalid'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Continue →', exact: true }).isDisabled(), true);
    await ownerEmail.fill('nora@example.invalid');
    assert.equal(await invalidEmail.count(), 0, 'correcting the email clears its error');
    assert.equal(await ownerEmail.getAttribute('aria-invalid'), 'false');
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
    await page.goto(`${baseUrl}/franchise-admin/franchise-registry`);
    await page.getByRole('heading', { name: 'Franchise Registry', exact: true }).waitFor();

    // 3) Governance history and SLA submission remain, while branch edits open the transfer form.
    assert.equal(await page.getByRole('link', { name: 'Account Reviews', exact: true }).count(), 0);
    await page.getByRole('link', { name: 'Governance Requests', exact: true }).click();
    await page.getByRole('heading', { name: 'SLA threshold request', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Branch Owner', exact: false }).count(), 0);
    await page.getByRole('link', { name: 'Franchise Registry', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Request Branch Owner reassignment', exact: true }).click();
    await page.getByText('Current Owner (Active)', { exact: true }).waitFor();
    const ownerSelect = page.getByLabel('Proposed Branch Owner', { exact: true });
    await ownerSelect.click();
    assert.deepEqual(await page.getByRole('option').allTextContents(), ['Select a Branch Owner', 'Proposed Owner']);
    await page.getByRole('option', { name: proposedOwner.display_name, exact: true }).click();
    await page.getByLabel('Business justification').fill('Transfer ownership of this branch.');
    await page.getByRole('button', { name: 'Submit reassignment request', exact: true }).click();
    await page.getByText('Request submitted for Super Administrator review.', { exact: true }).waitFor();
    assert.deepEqual(proposals, [{
      type: 'branch-owner-change',
      title: 'Reassign Branch Owner for Coverage Branch',
      reason: 'Transfer ownership of this branch.',
      riskLevel: 'medium',
      branchId: branch.id,
      payload: { newOwnerId: proposedOwner.id },
    }]);
    assert.equal(patches.length, 1, 'submitting a proposal does not edit the branch');
    await page.getByRole('button', { name: 'Close edit branch dialog', exact: true }).click();
    await page.getByRole('link', { name: 'Governance Requests', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Reassign Branch Owner for Coverage Branch' }).getByText('pending', { exact: true }).waitFor();
    await page.getByLabel('Business justification').fill('Update the dispatch threshold.');
    await page.getByRole('button', { name: 'Submit SLA request', exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'Request to dispatch SLA threshold' }).getByText('pending', { exact: true }).waitFor();
    assert.equal(proposals[1].type, 'sla-threshold');

    const retiredPage = await page.goto(`${baseUrl}/franchise-admin/account-reviews`);
    assert.equal(retiredPage.status(), 404);

    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
