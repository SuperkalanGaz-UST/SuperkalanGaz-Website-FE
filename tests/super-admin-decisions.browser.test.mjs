import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic Super Administrator; all API calls intercepted. No real requests or accounts change.
test('decision reasons never carry over, decisions and account status need confirmation', { timeout: 120000 }, async () => {
  const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
  const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
  const user = {
    id: '22222222-2222-4222-8222-222222222222', email: 'sa@example.invalid',
    app_metadata: { role: 'super-admin', status: 'Active', display_name: 'SA Test', branch_ids: [], branches: [] },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const session = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
  const request = (id, title) => ({ id, type: 'sla-threshold', status: 'pending', title, reason: 'Proposed by FA', risk_level: 'medium', branch_id: null, requested_by: 'fa-1', requested_by_name: 'Maria Santos', payload: { segment: 'request-dispatch', thresholdMinutes: 30 }, submitted_at: new Date().toISOString(), decided_by: null, decided_by_name: null, decision_reason: null, decided_at: null, applied_at: null });
  const requests = [request('aaaaaaaa-0000-4000-8000-000000000001', 'Alpha SLA change'), request('bbbbbbbb-0000-4000-8000-000000000002', 'Beta SLA change')];
  let account = { id: '33333333-3333-4333-8333-333333333333', email: 'ana@example.invalid', username: null, displayName: 'Ana Reyes', phone: null, status: 'Active', createdAt: '2026-08-25T01:00:00.000Z' };
  const decisions = [];
  const statusWrites = [];
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    await context.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin) return url.pathname === '/auth/v1/user' ? route.fulfill({ json: user }) : url.pathname === '/auth/v1/token' ? route.fulfill({ json: session }) : route.abort();
      if (url.origin !== apiOrigin) return route.abort();
      if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
      if (url.pathname === '/api/governance/requests') return route.fulfill({ json: { requests } });
      if (url.pathname.endsWith('/decision')) {
        const body = req.postDataJSON();
        decisions.push({ id: url.pathname.split('/')[4], ...body });
        const decided = requests.find(r => r.id === url.pathname.split('/')[4]);
        decided.status = body.decision === 'approve' ? 'approved' : body.decision === 'reject' ? 'rejected' : 'revision-requested';
        return route.fulfill({ json: { request: decided } });
      }
      if (url.pathname === '/api/governance/admin-accounts') return route.fulfill({ json: { accounts: [account], invitations: [], requests: [] } });
      if (url.pathname === `/api/governance/admin-accounts/${account.id}/status`) {
        const body = req.postDataJSON();
        statusWrites.push(body);
        account = { ...account, status: body.status };
        return route.fulfill({ json: { account: { id: account.id, status: body.status } } });
      }
      return route.fulfill({ json: { notifications: [], unreadCount: 0, events: [], metrics: {}, priorityRequests: [], recentActivity: [] } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));

    // 1) Reason clears when the selected request changes (click or search).
    await page.goto(`${baseUrl}/super-admin/approval-requests`);
    const reason = page.getByPlaceholder('Explain the approval, revision request, or rejection…');
    await reason.fill('Reason written for Alpha only');
    await page.getByPlaceholder('Search requests…').fill('Beta');
    await page.getByRole('heading', { name: 'Beta SLA change' }).waitFor();
    assert.equal(await reason.inputValue(), '', 'reason did not carry over to Beta');

    // 2) A decision needs confirmation; cancelling sends nothing.
    await reason.fill('Approved for the Beta region');
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByText('Approve this request?').waitFor();
    assert.match(await dialog.innerText(), /Beta SLA change[\s\S]*Your reason: Approved for the Beta region/);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    assert.equal(decisions.length, 0, 'cancel sends nothing');
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await dialog.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'));
    assert.deepEqual(decisions, [{ id: requests[1].id, decision: 'approve', reason: 'Approved for the Beta region' }]);

    // 3) Deactivate a Franchise Administrator with a required reason.
    await page.goto(`${baseUrl}/super-admin/franchise-administrators`);
    await page.getByRole('button', { name: 'Deactivate Ana Reyes' }).click();
    const statusDialog = page.getByRole('alertdialog');
    const confirm = statusDialog.getByRole('button', { name: 'Deactivate', exact: true });
    assert.equal(await confirm.isEnabled(), false, 'reason required');
    await statusDialog.getByLabel(/Reason/).fill('Left the company');
    await confirm.click();
    await page.getByRole('button', { name: 'Reactivate Ana Reyes' }).waitFor();
    assert.deepEqual(statusWrites, [{ status: 'Inactive', reason: 'Left the company' }]);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
