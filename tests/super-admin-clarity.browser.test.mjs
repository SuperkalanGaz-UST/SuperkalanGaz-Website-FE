// Super Administrator clarity: deep-linked review, before/after payloads, next-item after a decision,
// invitation revoke with reason, audit export/date range, current password. All API calls mocked.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

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
const base = { status: 'pending', reason: 'Proposed by FA', risk_level: 'medium', branch_id: null, requested_by: 'fa-1', requested_by_name: 'Maria Santos', submitted_at: '2026-11-19T01:00:00Z', decided_by: null, decided_by_name: null, decision_reason: null, decided_at: null, applied_at: null };
const requests = [
  { ...base, id: 'aaaaaaaa-0000-4000-8000-000000000001', type: 'sla-threshold', title: 'Alpha SLA change', payload: { segment: 'request_to_dispatch', thresholdMinutes: 45, currentThresholdMinutes: 30 } },
  { ...base, id: 'bbbbbbbb-0000-4000-8000-000000000002', type: 'branch-owner-change', title: 'Beta owner change', payload: { newOwnerId: 'u-new', newOwnerName: 'Nina Cruz', currentOwnerName: 'Oscar Reyes', branchName: 'Amadeo' } },
  { ...base, id: 'cccccccc-0000-4000-8000-000000000003', type: 'other', title: 'Gamma other', payload: { details: { note: 'x' } } },
];
const invitations = [
  { id: 'i-1', email: 'pending@example.invalid', displayName: 'Pending Person', status: 'Pending', invitedAt: '2026-11-18T00:00:00Z', confirmationSentAt: '2026-11-18T00:00:00Z', expiresAt: '2026-11-25T00:00:00Z', invitedBy: user.id, invitedByName: 'SA Test' },
  { id: 'i-2', email: 'expired@example.invalid', displayName: 'Expired Person', status: 'Expired', invitedAt: '2026-11-01T00:00:00Z', confirmationSentAt: '2026-11-01T00:00:00Z', expiresAt: '2026-11-02T00:00:00Z', invitedBy: user.id, invitedByName: 'SA Test' },
];
const event = (id, action, occurredAt) => ({ id, category: 'admin-account', action, actorUserId: user.id, actorName: 'SA Test', actorRole: 'super-admin', affectedRecordType: 'franchise-admin-invitation', affectedRecordId: `rec-${id}`, branchId: null, governanceRequestId: null, beforeState: { status: 'Pending' }, afterState: { status: 'Revoked' }, reason: 'Wrong person', occurredAt });
const events = [event('e1', 'franchise-admin-invitation-revoked', '2026-11-10T02:00:00Z'), event('e2', 'franchise-admin-deactivated', '2026-11-18T02:00:00Z')];

test('Super Administrator clarity fixes', { timeout: 180000 }, async () => {
  const writes = [];
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    await context.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin) return url.pathname === '/auth/v1/user' ? route.fulfill({ json: user }) : url.pathname === '/auth/v1/token' ? route.fulfill({ json: session }) : route.abort();
      if (url.origin !== apiOrigin) return route.abort();
      if (req.method() !== 'GET') writes.push({ path: url.pathname, body: req.postDataJSON() });
      if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email, username: 'sa' } } });
      if (url.pathname === '/api/governance/dashboard') return route.fulfill({ json: { metrics: { pendingApprovals: 3, adminAccountRequests: 0, priceChanges30Days: 0, branchOwnerChanges: 1 }, priorityRequests: requests, recentActivity: [], controls: { noSelfApproval: true, auditTrailActive: true, auditHistoryMutableByUsers: false } } });
      if (url.pathname === '/api/governance/requests') return route.fulfill({ json: { requests } });
      if (url.pathname.endsWith('/decision')) {
        const decided = requests.find(r => r.id === url.pathname.split('/')[4]);
        decided.status = 'approved';
        return route.fulfill({ json: { request: decided } });
      }
      if (url.pathname === '/api/governance/admin-accounts') return route.fulfill({ json: { accounts: [], invitations, requests: [] } });
      if (url.pathname.endsWith('/revoke')) return route.fulfill({ json: { invitation: { ...invitations[0], status: 'Revoked' } } });
      if (url.pathname === '/api/governance/audit') return route.fulfill({ json: { events } });
      if (url.pathname === '/api/users/me/password') return route.fulfill({ json: { ok: true } });
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));

    // Dashboard is named like the sidebar; Review opens the exact request.
    await page.goto(`${baseUrl}/super-admin/dashboard`);
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    await page.getByText('Account Settings', { exact: true }).waitFor();
    await page.getByRole('row', { name: /Beta owner change/ }).getByRole('button', { name: 'Review' }).click();
    await page.waitForURL(/approval-requests\?request=bbbbbbbb/);
    await page.getByRole('heading', { name: 'Beta owner change' }).waitFor();
    await page.getByText('Oscar Reyes →').waitFor();
    await page.getByText('Amadeo').waitFor();

    // Labelled before/after, never [object Object].
    await page.getByRole('button', { name: /Alpha SLA change/ }).click();
    await page.getByText('30 min →').waitFor();
    await page.getByText('Request → Dispatch').waitFor();
    await page.getByRole('button', { name: /Gamma other/ }).click();
    await page.getByText('Note: x').waitFor();
    assert.equal(await page.getByText('[object Object]').count(), 0);

    // Search hides the selected request, so the panel follows the filter.
    await page.getByPlaceholder('Search requests…').fill('Beta');
    await page.getByRole('heading', { name: 'Beta owner change' }).waitFor();
    await page.getByPlaceholder('Search requests…').fill('');

    // After a decision, the next item in the list opens.
    await page.getByRole('button', { name: /Alpha SLA change/ }).click();
    await page.getByPlaceholder('Explain the approval, revision request, or rejection…').fill('Matches the traffic data');
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Approve', exact: true }).click();
    await page.getByRole('heading', { name: 'Beta owner change' }).waitFor();

    // Invitations: expired cannot be revoked; revoke asks for a reason.
    writes.length = 0;
    await page.goto(`${baseUrl}/super-admin/franchise-administrators`);
    await page.getByRole('heading', { name: 'Invitations', exact: true }).waitFor();
    assert.equal(await page.getByRole('row', { name: /Expired Person/ }).getByRole('button', { name: 'Revoke' }).isDisabled(), true);
    await page.getByRole('row', { name: /Pending Person/ }).getByRole('button', { name: 'Revoke' }).click();
    const dialog = page.getByRole('alertdialog');
    assert.equal(await dialog.getByRole('button', { name: 'Revoke' }).isDisabled(), true, 'a reason is required');
    await dialog.getByLabel(/Reason/).fill('Sent to the wrong person');
    await dialog.getByRole('button', { name: 'Revoke' }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(writes, [{ path: '/api/governance/franchise-admin-invitations/i-1/revoke', body: { reason: 'Sent to the wrong person' } }]);

    // Audit logs: date range and search narrow the list and the export; affected record ID shown.
    await page.goto(`${baseUrl}/super-admin/account-approval-logs`);
    await page.getByText('2 immutable events').waitFor();
    await page.getByLabel('From').fill('2026-11-15');
    await page.getByText('1 immutable event', { exact: true }).waitFor();
    await page.getByText('Franchise Admin Invitation · rec-e2').waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const csv = await readFile(await (await download).path(), 'utf8');
    assert.match(csv, /rec-e2/);
    assert.doesNotMatch(csv, /rec-e1/, 'export follows the date range');

    // Account Settings: the current password is required and sent.
    writes.length = 0;
    await page.goto(`${baseUrl}/super-admin/settings`);
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByLabel('New password', { exact: true }).fill('brand-new-pass1');
    await page.getByLabel('Confirm new password').fill('brand-new-pass1');
    await page.getByRole('button', { name: 'Update password' }).click();
    await page.getByText('Enter your current password').waitFor();
    assert.equal(writes.length, 0);
    await page.getByLabel('Current password', { exact: true }).fill('old-pass');
    await page.getByRole('button', { name: 'Update password' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(writes, [{ path: '/api/users/me/password', body: { currentPassword: 'old-pass', password: 'brand-new-pass1' } }]);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
