// Branch Manager late orders, delivery confirmation and complaint resolve. Synthetic session, all API calls mocked.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const branch = { id: '11111111-1111-4111-8111-111111111111', name: 'Test Branch', geofence: null };
const user = {
  id: '55555555-5555-4555-8555-555555555555', email: 'bm@example.invalid',
  app_metadata: { role: 'branch-manager', status: 'Active', display_name: 'BM Test', branch_ids: [branch.id], branches: [branch.name] },
  user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
};
const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const session = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
const sr = (code, name, extra) => ({
  id: `00000000-0000-4000-8000-0000000000${code.slice(-2)}`, sr_code: code, branch_id: branch.id, customer_id: null, customer_code: null,
  order_source: 'Mobile App', status: 'Pending', customer_name: name, customer_contact: '+639171234567', delivery_address: 'Amadeo',
  cylinder_size: '11kg', quantity: 1, unit_price: 679, total_amount: 679, special_instructions: null, rider_id: null,
  requested_at: '2026-11-19T01:00:00Z', dispatched_at: null, in_transit_at: null, delivered_at: null, delay_reason: null,
  sla_breached: false, sla_breach_segment: null, sla_breached_at: null, created_at: '2026-11-19T01:00:00Z', sla_at_risk: false, sla_at_risk_segment: null,
  ...extra,
});
const requests = [
  sr('SR-0001', 'On Time Cruz', { requested_at: '2026-11-19T00:00:00Z' }),
  sr('SR-0002', 'At Risk Reyes', { status: 'En Route', order_source: 'Walk-in/Phone', sla_at_risk: true, dispatched_at: '2026-11-19T00:30:00Z', requested_at: '2026-11-19T00:10:00Z' }),
  sr('SR-0003', 'Late Santos', { sla_breached: true, requested_at: '2026-11-19T00:20:00Z' }),
];
const incident = {
  id: '99999999-9999-4999-8999-999999999999', branch_id: branch.id, customer_id: null, service_request_id: requests[0].id,
  category: 'lost_cylinder', description: 'Cylinder never arrived', status: 'open', priority: 'medium', reported_at: '2026-11-19T02:00:00Z',
  first_response_at: null, resolution_note: null, escalated: false, escalated_at: null, created_at: '2026-11-19T02:00:00Z',
  customer_name: 'On Time Cruz', rider_name: null, service_request: null,
};

test('late tab, Log delay on row, Mark Delivered confirm and complaint resolve', { timeout: 120000 }, async () => {
  const writes = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (url.origin === baseUrl) return route.continue();
      if (url.origin === authOrigin) return url.pathname === '/auth/v1/user' ? route.fulfill({ json: user }) : url.pathname === '/auth/v1/token' ? route.fulfill({ json: session }) : route.abort();
      if (url.origin !== apiOrigin) return route.abort();
      if (method !== 'GET') writes.push({ path: url.pathname, body: route.request().postData() });
      if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
      if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [branch] } });
      if (url.pathname === '/api/service-requests' && method === 'GET') return route.fulfill({ json: { serviceRequests: requests } });
      if (url.pathname.endsWith('/deliver')) return route.fulfill({ json: { serviceRequest: { ...requests[1], status: 'Delivered' } } });
      if (url.pathname === '/api/csat/incidents') return route.fulfill({ json: { incidents: [incident] } });
      if (url.pathname.endsWith('/resolve')) return route.fulfill({ json: { incident: { ...incident, status: 'resolved' }, serviceRequestStatus: 'Cancelled' } });
      return route.fulfill({ json: { serviceRequests: [], requests: [], riders: [], prices: [], notifications: [], unreadCount: 0, ratings: [], summary: null, catalog: [], items: [] } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${baseUrl}/branch-manager/service-requests`);
    await page.getByText('Late Santos').waitFor();
    await page.getByText('At risk / Late (2)').click();
    const rows = page.locator('tbody tr').filter({ hasText: /SR-000/ });
    assert.deepEqual(await rows.locator('td:nth-child(3)').allInnerTexts(), ['SR-0003', 'SR-0002'], 'late first, then at risk; on-time hidden');
    assert.equal(await page.getByRole('button', { name: 'Log delay' }).count(), 2, 'Log delay sits on each late/at-risk row');

    await page.getByRole('button', { name: 'Mark Delivered' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByText('SR-0002 · At Risk Reyes').waitFor();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(writes.length, 0, 'cancel sends nothing');
    await page.getByRole('button', { name: 'Mark Delivered' }).click();
    await dialog.getByRole('button', { name: 'Mark Delivered' }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.ok(writes.some(w => w.path === `/api/service-requests/${requests[1].id}/deliver`), 'confirmed delivery is sent');

    writes.length = 0;
    await page.goto(`${baseUrl}/branch-manager/csat`);
    await page.getByRole('button', { name: 'Incidents', exact: true }).click();
    await page.getByText('Cylinder never arrived').waitFor();
    await page.getByRole('button', { name: 'Resolve' }).click();
    const confirm = dialog.getByRole('button', { name: 'Resolve' });
    assert.equal(await confirm.isDisabled(), true, 'a resolution note is required');
    await dialog.getByRole('textbox').fill('Refunded the customer');
    await confirm.click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(writes.map(w => [w.path, JSON.parse(w.body)]), [[`/api/csat/incidents/${incident.id}/resolve`, { note: 'Refunded the customer' }]]);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
