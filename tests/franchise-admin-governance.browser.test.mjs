// Franchise Administrator navigation and governance: Order Analytics naming and scope,
// current SLA value, Revise for returned requests, pending price warning, branch
// deactivate/reactivate with a reason. Synthetic session; all API calls mocked.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const user = {
  id: '00000000-0000-4000-8000-000000000001', email: 'fa@example.invalid',
  app_metadata: { role: 'franchise-admin', status: 'Active', display_name: 'FA Test', branch_ids: [], branches: [] },
  user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
};
const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const session = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
const sizes = ['50kg', '22kg', '11kg', '5kg', '2.7kg'];
const amounts = [3000, 1360, 679, 360, 210];
const owner = { id: '00000000-0000-4000-8000-000000000003', display_name: 'Current Owner', email: 'current@example.invalid', phone: '+639171234567', status: 'Active' };
const proposed = { id: '00000000-0000-4000-8000-000000000005', display_name: 'Proposed Owner', status: 'Active' };
const active = { id: '00000000-0000-4000-8000-000000000002', owner_id: owner.id, name: 'Amadeo', code: 'AMD', status: 'active', region: 'NCR', address: '1 Test St', city: 'Amadeo', province: 'Cavite', contact_number: '+639171234567', geofence: null, created_at: '2026-01-01T00:00:00Z' };
const inactive = { ...active, id: '00000000-0000-4000-8000-000000000009', owner_id: null, name: 'Silang', code: 'SIL', status: 'inactive' };
const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date());
const base = { risk_level: 'medium', branch_id: null, requested_by: user.id, requested_by_name: 'FA Test', submitted_at: '2026-11-19T01:00:00Z', decided_by: 'sa', decided_by_name: 'SA', decided_at: '2026-11-20T01:00:00Z', applied_at: null };
const requests = [
  { ...base, id: 'sla-1', type: 'sla-threshold', status: 'revision-requested', title: 'SLA ask', reason: 'Traffic slowed down', decision_reason: 'Attach last month data', payload: { segment: 'dispatch_to_in_transit', thresholdMinutes: 50 } },
  { ...base, id: 'price-1', type: 'price-configuration', status: 'revision-requested', title: 'NCR prices', reason: 'Supplier cost up', decision_reason: 'Too steep', payload: { regionCode: 'NCR', prices: sizes.map((cylinderSize, i) => ({ cylinderSize, unitPrice: cylinderSize === '11kg' ? 700 : amounts[i] })) } },
  { ...base, id: 'owner-1', type: 'branch-owner-change', status: 'revision-requested', title: 'Owner swap', reason: 'Owner retiring', decision_reason: 'Confirm the handover date', branch_id: active.id, payload: { newOwnerId: proposed.id } },
  { ...base, id: 'price-2', type: 'price-configuration', status: 'pending', title: 'Default prices', reason: 'Inflation', decision_reason: null, payload: { prices: [] } },
];

test('Franchise Administrator navigation and governance fixes', { timeout: 180000 }, async () => {
  const writes = [];
  const errors = [];
  let revisionsAvailable = false;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    await context.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      if (url.origin === authOrigin) return url.pathname === '/auth/v1/user' ? route.fulfill({ json: user }) : route.abort();
      if (url.origin !== apiOrigin) return route.abort();
      if (req.method() !== 'GET') {
        writes.push({ method: req.method(), path: url.pathname, body: req.postDataJSON() });
        if (url.pathname.startsWith('/api/branches/')) {
          const target = url.pathname.includes(inactive.id) ? inactive : active;
          return route.fulfill({ json: { branch: { ...target, status: req.method() === 'DELETE' ? 'inactive' : 'active' } } });
        }
        if (url.pathname.endsWith('/revise')) {
          if (!revisionsAvailable) return route.fulfill({ status: 404, json: { message: 'Route unavailable' } });
          return route.fulfill({ status: 201, json: { request: { id: url.pathname.split('/').at(-2), status: 'pending' } } });
        }
        return route.fulfill({ status: 201, json: { request: { id: 'new', status: 'pending' } } });
      }
      if (url.pathname === '/api/governance/requests') return route.fulfill({ json: { requests } });
      if (url.pathname === '/api/governance/sla-thresholds') return route.fulfill({ json: { thresholds: { request_to_dispatch: 30 } } });
      if (url.pathname === '/api/franchise-reports/orders') return route.fulfill({ json: { total: 10, delivered: 8, cancelled: 1, daily: [], statuses: [], topCustomers: [], completion: [
        { branchId: active.id, branch: 'Amadeo', month, totalOrders: 10, completed: 8, slaBreaches: 0 },
        { branchId: active.id, branch: 'Amadeo', month: '2026-01', totalOrders: 4, completed: 1, slaBreaches: 2 },
      ] } });
      if (url.pathname === '/api/branches') return route.fulfill({ json: { branches: [active, inactive] } });
      if (url.pathname === '/api/users' && url.searchParams.get('role') === 'branch-owner') {
        return route.fulfill({ json: { users: url.searchParams.has('branchId') ? [owner] : [owner, proposed] } });
      }
      if (url.pathname === '/api/prices/regions') return route.fulfill({ json: { regions: [{ code: 'NCR', name: 'Metro Manila (NCR)' }] } });
      if (url.pathname === '/api/prices') return route.fulfill({ json: { source: url.searchParams.get('regionCode') ? 'regional' : 'system-wide', prices: sizes.map((size, i) => ({ id: `p-${i}`, cylinder_size: size, unit_price: amounts[i], updated_at: new Date().toISOString() })) } });
      return route.fulfill({ json: { notifications: [], unreadCount: 0, branches: [], users: [] } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));

    // The sidebar item is named after what it opens; the page keeps one time scope.
    await page.goto(`${baseUrl}/franchise-admin/order-analytics`);
    await page.getByRole('heading', { name: 'Order Analytics', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Order Analytics', exact: true }).waitFor();
    await page.getByText('Current month', { exact: true }).waitFor();
    assert.equal(await page.getByText('January 2026').count(), 0, 'older months live on the history page');
    await page.getByRole('button', { name: 'Last 6 months' }).click();
    await page.waitForURL(/\/franchise-admin\/delivery-completion$/);
    await page.getByText('January 2026').waitFor();

    // SLA form shows the current value; Revise prefills and resubmits the same request.
    await page.goto(`${baseUrl}/franchise-admin/governance-requests`);
    await page.getByText('Currently 30 minutes').waitFor();
    await page.getByRole('row', { name: /SLA ask/ }).getByRole('button', { name: 'Revise' }).click();
    await page.getByText('Attach last month data').first().waitFor();
    await page.getByText('Currently not set').waitFor();
    assert.equal(await page.getByLabel('Threshold in minutes').inputValue(), '50');
    writes.length = 0;
    await page.getByRole('button', { name: 'Resubmit SLA request' }).click();
    await page.getByText('Revisions are temporarily unavailable. Please try again later.').waitFor();
    assert.deepEqual(writes.map(write => write.path), ['/api/governance/requests/sla-1/revise']);
    assert.equal(await page.getByLabel('Threshold in minutes').inputValue(), '50');
    revisionsAvailable = true;
    writes.length = 0;
    await page.getByRole('button', { name: 'Resubmit SLA request' }).click();
    await page.getByRole('button', { name: 'Submit SLA request' }).waitFor();
    assert.deepEqual(writes.map(write => write.path), ['/api/governance/requests/sla-1/revise']);
    assert.deepEqual(writes[0].body.payload, { segment: 'dispatch_to_in_transit', thresholdMinutes: 50 });

    // A returned price proposal reopens on Price Configuration, prefilled.
    await page.getByRole('row', { name: /NCR prices/ }).getByRole('button', { name: 'Revise' }).click();
    await page.waitForURL(/price-configuration\?revise=price-1/);
    await page.getByText('Too steep').waitFor();
    const price11 = page.getByLabel('11kg Cylinder proposed price in Philippine pesos', { exact: true });
    await page.waitForFunction(() => document.querySelector('[aria-label="11kg Cylinder proposed price in Philippine pesos"]')?.value === '700.00');
    assert.equal(await page.getByLabel('Reason for change').inputValue(), 'Supplier cost up');
    writes.length = 0;
    await page.getByRole('button', { name: 'Resubmit proposal' }).click();
    await page.getByRole('button', { name: 'Submit proposal' }).waitFor();
    assert.deepEqual(writes.map(write => write.path), ['/api/governance/requests/price-1/revise']);
    assert.equal(writes[0].body.payload.regionCode, 'NCR');
    assert.equal(writes[0].body.payload.prices.find(p => p.cylinderSize === '11kg').unitPrice, 700);
    assert.ok(price11);

    // An open proposal for the same region is flagged before a duplicate is sent.
    await page.goto(`${baseUrl}/franchise-admin/price-configuration`);
    await page.getByText(/You already have a proposal for System-wide default awaiting/).waitFor();

    // A returned Branch Owner change reopens on the branch's reassignment form.
    await page.goto(`${baseUrl}/franchise-admin/governance-requests`);
    await page.getByRole('row', { name: /Owner swap/ }).getByRole('button', { name: 'Revise' }).click();
    await page.waitForURL(/franchise-registry\?revise=owner-1/);
    await page.getByRole('heading', { name: 'Revise Branch Owner reassignment' }).waitFor();
    await page.getByText('Confirm the handover date').waitFor();
    assert.equal(await page.getByLabel('Proposed Branch Owner').inputValue(), proposed.id);
    writes.length = 0;
    await page.getByRole('button', { name: 'Resubmit request' }).click();
    await page.getByRole('heading', { name: 'Revise Branch Owner reassignment' }).waitFor({ state: 'hidden' });
    assert.deepEqual(writes.map(write => write.path), ['/api/governance/requests/owner-1/revise']);
    assert.deepEqual(writes[0].body.payload, { newOwnerId: proposed.id });

    // Registry: no dead "View All Branches"; status changes need a reason.
    assert.equal(await page.getByRole('button', { name: 'View All Branches' }).count(), 0);
    writes.length = 0;
    await page.getByRole('row', { name: /Amadeo/ }).getByRole('button', { name: 'Deactivate' }).click();
    let dialog = page.getByRole('alertdialog');
    assert.equal(await dialog.getByRole('button', { name: 'Deactivate' }).isDisabled(), true, 'a reason is required');
    await dialog.getByLabel(/Reason/).fill('Lease ended');
    await dialog.getByRole('button', { name: 'Deactivate' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('row', { name: /Silang/ }).getByRole('button', { name: 'Reactivate' }).click();
    dialog = page.getByRole('alertdialog');
    await dialog.getByLabel(/Reason/).fill('New lease signed');
    await dialog.getByRole('button', { name: 'Reactivate' }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(writes, [
      { method: 'DELETE', path: `/api/branches/${active.id}`, body: { reason: 'Lease ended' } },
      { method: 'POST', path: `/api/branches/${inactive.id}/reactivate`, body: { reason: 'New lease signed' } },
    ]);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
