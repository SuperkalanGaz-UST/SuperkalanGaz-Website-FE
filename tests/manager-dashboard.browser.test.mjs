import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic authenticated manager; all Auth/API calls are intercepted.
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;

async function setup(browser, { empty = false, failed = false, deferFeedback = false } = {}) {
  let releaseFeedback;
  const feedbackGate = new Promise(resolve => { releaseFeedback = resolve; });
  const branchId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: '55555555-5555-4555-8555-555555555555', email: 'manager@example.invalid',
    app_metadata: { role: 'branch-manager', status: 'Active', display_name: 'Dashboard Manager', branch_ids: [branchId], branches: ['Dashboard Branch'] },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const session = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: user.id, exp, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
  const paths = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin === authOrigin) return url.pathname === '/auth/v1/user' ? route.fulfill({ json: user }) : url.pathname === '/auth/v1/token' ? route.fulfill({ json: session }) : route.abort();
    if (url.origin !== apiOrigin) return route.abort();
    paths.push(url.pathname);
    if (deferFeedback && url.pathname === '/api/csat/manager-dashboard') await feedbackGate;
    if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
    if (failed && ['/api/csat/manager-dashboard', '/api/inventory/stock-levels', '/api/service-requests'].includes(url.pathname)) {
      return route.fulfill({ status: 503, json: { message: 'Dashboard data unavailable' } });
    }
    if (url.pathname === '/api/csat/manager-dashboard') return route.fulfill({ json: { summary: {
      from: '2026-11-01', to: '2026-11-30', average_stars: empty ? null : 4,
      total_ratings: empty ? 0 : 400, star_counts: { 1: empty ? 0 : 100, 2: 0, 3: 0, 4: 0, 5: empty ? 0 : 300 },
      unresolved_low_ratings: empty ? 0 : 7,
    } } });
    if (url.pathname === '/api/service-requests') return route.fulfill({ json: { serviceRequests: empty ? [] : [
      { id: 'late-order', sr_code: 'SR-LATE', customer_name: 'Late Customer', status: 'Pending', requested_at: new Date().toISOString(), sla_breached: false, sla_at_risk: true },
      { id: 'done-order', sr_code: 'SR-DONE', customer_name: 'Done Customer', status: 'Delivered', requested_at: new Date().toISOString(), sla_breached: true, sla_at_risk: false },
      { id: 'stored-flag-only', sr_code: 'SR-STORED', customer_name: 'Stored Flag Customer', status: 'Pending', requested_at: new Date().toISOString(), sla_breached: true, sla_at_risk: false },
      { id: 'closed-order', sr_code: 'SR-CLOSED', customer_name: 'Closed Customer', status: 'Cancelled', requested_at: new Date().toISOString(), sla_breached: false, sla_at_risk: true },
    ] } });
    if (url.pathname === '/api/inventory/stock-levels') return route.fulfill({ json: { stockLevels: empty ? [] : [
      { stock_level_id: 'out', product_id: 'out', product_name: 'Empty Cylinder', current_qty: 0, threshold_qty: 10 },
      { stock_level_id: 'low', product_id: 'low', product_name: 'Low Cylinder', current_qty: 5, threshold_qty: 5 },
      { stock_level_id: null, product_id: 'unknown', product_name: 'Unrecorded Cylinder', current_qty: 0, threshold_qty: 10 },
      { stock_level_id: 'healthy', product_id: 'healthy', product_name: 'Healthy Cylinder', current_qty: 20, threshold_qty: 10 },
    ] } });
    return route.fulfill({ json: { summary: null, serviceRequests: [], ratings: [], incidents: [], riders: [], notifications: [], unreadCount: 0, stockLevels: [] } });
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/branch-manager/dashboard`);
  return { context, page, paths, releaseFeedback };
}

test('monthly CSAT uses complete distribution and grouped alerts lead to their operational screens', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page, paths } = await setup(browser);
    await page.getByRole('button', { name: /^Out of stock/ }).waitFor();
    await page.getByRole('button', { name: /^SLA breached/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Low stock/ }).count(), 0, 'only two groups are shown on the card');
    const header = page.getByRole('heading', { name: 'Critical Alerts', exact: true }).locator('..');
    await header.getByText('5 need action', { exact: true }).waitFor();
    const slaAlert = page.getByRole('button', { name: /^SLA breached/ });
    await slaAlert.getByText('1', { exact: true }).waitFor();
    await slaAlert.getByText('SR-LATE: Late Customer', { exact: true }).waitFor();
    assert.equal(await slaAlert.getByText(/SR-STORED|SR-DONE|SR-CLOSED/).count(), 0);
    await page.getByText('1 late', { exact: true }).waitFor();
    assert.equal(paths.includes('/api/csat/ratings'), false, 'dashboard distribution must not use the capped ratings list');
    await page.getByRole('heading', { name: 'Critical Alerts', exact: true }).locator('..').getByRole('button', { name: 'See all' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /^Low stock/ }).waitFor();
    await dialog.getByRole('button', { name: /^Stock not recorded/ }).waitFor();
    await dialog.getByRole('button', { name: /^Low-rating feedback awaiting action/ }).waitFor();
    const alertRows = (await dialog.getByRole('button').allTextContents()).filter(text => text !== 'Close');
    assert.match(alertRows[0], /^Out of stock/);
    assert.match(alertRows[1], /^SLA breached/);
    assert.match(alertRows[2], /^Low-rating feedback awaiting action/);
    assert.match(alertRows[3], /^Low stock/);
    assert.match(alertRows[4], /^Stock not recorded/);
    assert.equal(await dialog.getByText('Healthy Cylinder', { exact: true }).count(), 0);
    await dialog.getByRole('button', { name: /^Stock not recorded/ }).click();
    await page.waitForURL('**/branch-manager/inventory');

    await page.goto(`${baseUrl}/branch-manager/dashboard`);
    await page.getByRole('button', { name: /^SLA breached/ }).click();
    await page.waitForURL('**/branch-manager/service-requests');
    await page.goto(`${baseUrl}/branch-manager/dashboard`);
    await page.getByRole('heading', { name: 'Critical Alerts', exact: true }).locator('..').getByRole('button', { name: 'See all' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Low-rating feedback awaiting action/ }).click();
    await page.waitForURL('**/branch-manager/csat');

    await page.goto(`${baseUrl}/branch-manager/dashboard`);
    await page.getByRole('heading', { name: 'CSAT Overview', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Go to slide 2' }).first().click();
    const csat = page.getByRole('heading', { name: 'CSAT Overview', exact: true }).locator('../..');
    await csat.getByText('400 reviews this month', { exact: true }).waitFor();
    assert.equal(await csat.getByText('75%', { exact: true }).count(), 1);
    assert.equal(await csat.getByText('25%', { exact: true }).count(), 1);
    assert.ok(paths.includes('/api/csat/manager-dashboard'));
  } finally { await browser.close(); }
});

test('empty dashboard distinguishes missing feedback from a zero score', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page } = await setup(browser, { empty: true });
    await page.getByText('No critical alerts.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Go to slide 2' }).first().click();
    await page.getByText('No ratings this month.', { exact: true }).waitFor();
    assert.equal(await page.getByText('0.0', { exact: true }).count(), 0);
  } finally { await browser.close(); }
});

test('loading waits for every alert source before showing counts or the priority list', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  let release;
  try {
    const { page, releaseFeedback } = await setup(browser, { deferFeedback: true });
    release = releaseFeedback;
    const card = page.getByRole('heading', { name: 'Critical Alerts', exact: true }).locator('../..');
    await card.getByRole('status').getByText('Loading alerts…', { exact: true }).waitFor({ state: 'attached' });
    assert.equal(await card.getByText(/need action/).count(), 0);
    assert.equal(await card.getByRole('button', { name: 'See all' }).isDisabled(), true);
    assert.equal(await card.getByRole('button', { name: /^Out of stock|^SLA breached|^Low stock/ }).count(), 0);
    assert.equal(await card.getByText('No critical alerts.', { exact: true }).count(), 0);
    releaseFeedback();
    await card.getByRole('button', { name: /^Out of stock/ }).waitFor();
    await card.getByRole('button', { name: /^SLA breached/ }).waitFor();
    await card.getByText('5 need action', { exact: true }).waitFor();
    assert.equal(await card.getByRole('status').count(), 0);
    assert.equal(await card.getByRole('button', { name: 'See all' }).isEnabled(), true);
  } finally { release?.(); await browser.close(); }
});

test('alert badges, collapsed chips, keyboard navigation, contrast and narrow layouts preserve the existing actions', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { context, page } = await setup(browser);
    await context.route(`${apiOrigin}/api/service-requests`, route => route.fulfill({ json: { serviceRequests: [] } }));
    await context.route(`${apiOrigin}/api/inventory/stock-levels`, route => route.fulfill({ json: { stockLevels:
      ['50kg LPG Cylinder', '22kg LPG Cylinder', '11kg LPG Cylinder', '5kg LPG Cylinder', '2.7kg LPG Cylinder'].map((name, index) => ({
        stock_level_id: null, product_id: String(index), product_name: name, current_qty: 0, threshold_qty: 10,
      })),
    } }));
    await page.reload();
    const stock = page.getByRole('button', { name: /^Stock not recorded/ });
    await stock.getByText('+3 more', { exact: true }).waitFor();
    await stock.getByText('5', { exact: true }).waitFor();
    assert.equal(await stock.getByText('11kg LPG Cylinder', { exact: true }).count(), 0);
    assert.equal(await stock.getByText('50kg LPG Cylinder', { exact: true }).count(), 1);
    const feedback = page.getByRole('button', { name: /^Low-rating feedback awaiting action/ });
    await feedback.getByText('7', { exact: true }).waitFor();
    assert.equal(await feedback.getByText('Respond', { exact: true }).count(), 1);
    const alertPanel = page.getByRole('heading', { name: 'Critical Alerts', exact: true }).locator('../..');
    const csatPanel = page.getByRole('heading', { name: 'CSAT Overview', exact: true }).locator('../..');
    const alertHeight = await alertPanel.evaluate(element => element.getBoundingClientRect().height);
    const csatHeight = await csatPanel.evaluate(element => element.getBoundingClientRect().height);
    assert.equal(alertHeight, csatHeight, 'both carousel cards have the same height');
    assert.ok(alertHeight <= 366, 'carousel cards remain compact');
    const dot = await alertPanel.getByRole('button', { name: 'Go to slide 1' }).boundingBox();
    assert.equal(dot.height, 8, 'original compact dots are restored');

    // Check actual rendered text/background pairs, including the solid count badges.
    for (const row of [stock, feedback]) {
      const minimumContrast = await row.evaluate(element => {
        const luminance = color => {
          const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
            const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        return Math.min(...[...element.querySelectorAll('span')].filter(span => span.childElementCount === 0 && span.textContent.trim()).map(span => {
          let background = span;
          while (getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
          const a = luminance(getComputedStyle(span).color);
          const b = luminance(getComputedStyle(background).backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        }));
      });
      assert.ok(minimumContrast >= 4.5, `Text contrast ${minimumContrast} must meet AA`);
    }

    if (process.env.DASHBOARD_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.DASHBOARD_SCREENSHOT_DIR}/critical-alerts-desktop.png`, fullPage: true });
    // Exercise the reusable row in a narrow card without changing the dashboard shell.
    const card = page.getByRole('heading', { name: 'Critical Alerts', exact: true }).locator('../..');
    await card.evaluate(element => { element.style.width = '280px'; });
    await stock.scrollIntoViewIfNeeded();
    const bounds = await stock.boundingBox();
    const cardBounds = await card.boundingBox();
    assert.ok(bounds.height >= 44 && bounds.width >= 44);
    assert.ok(bounds.x >= cardBounds.x && bounds.x + bounds.width <= cardBounds.x + cardBounds.width, 'alert fits its narrow card');
    if (process.env.DASHBOARD_SCREENSHOT_DIR) await card.screenshot({ path: `${process.env.DASHBOARD_SCREENSHOT_DIR}/critical-alerts-narrow.png` });
    await card.evaluate(element => { element.style.width = ''; });
    await page.getByRole('heading', { name: 'Critical Alerts', exact: true }).locator('..').getByRole('button', { name: 'See all' }).click();
    await page.getByRole('dialog').getByText('2.7kg LPG Cylinder', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await stock.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/branch-manager/inventory');
    await page.goto(`${baseUrl}/branch-manager/dashboard`);
    await page.getByRole('button', { name: /^Stock not recorded/ }).getByText('+3 more', { exact: true }).click();
    await page.waitForURL('**/branch-manager/inventory');
  } finally { await browser.close(); }
});

test('failed dashboard sources show unavailable states instead of healthy alerts or zero percentages', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const { page } = await setup(browser, { failed: true });
    await page.getByText('Stock alerts unavailable.', { exact: true }).waitFor();
    await page.getByText('SLA alerts unavailable.', { exact: true }).waitFor();
    await page.getByText('Feedback alerts unavailable.', { exact: true }).waitFor();
    assert.equal(await page.getByText('No critical alerts.', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Go to slide 2' }).first().click();
    const csat = page.getByRole('heading', { name: 'CSAT Overview', exact: true }).locator('../..');
    await csat.getByText('Dashboard data unavailable', { exact: true }).waitFor();
    assert.equal(await csat.getByText('0%', { exact: true }).count(), 0);
  } finally { await browser.close(); }
});
