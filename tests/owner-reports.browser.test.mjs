import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// All Auth/API requests are intercepted; no real accounts or reports are changed.
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const branch = { id: '11111111-1111-4111-8111-111111111111', name: 'Report Branch', geofence: null };
const fixedTime = new Date('2026-11-30T16:30:00Z'); // December 1 in Manila, November 30 in UTC.
const csat = {
  average_stars: 4.5, total_responses: 2, delivered_requests: 4, response_rate: 50,
  incidents_raised: 1, rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
  csv_records: [{ response_id: 'response-1', service_request_id: 'request-1', branch_id: branch.id,
    submitted_at: '2026-12-01T00:29:00Z', rating: 5, review_comment: 'Good, "quick" service – salamat!',
    incident_raised: false, customer_name: 'Peña, Althea' }],
};
const metric = { evaluated_requests: 4, compliant_requests: 3, breached_requests: 1, compliance_rate: 75 };
const sla = {
  total_service_requests: 4, evaluated_requests: 4, within_sla: 3, breaches: 1,
  not_evaluated: 0, overall_compliance_rate: 75,
  segments: ['request_to_dispatch', 'dispatch_to_in_transit', 'in_transit_to_delivery'].map(segment => ({ segment, ...metric })),
  order_sources: ['Mobile App', 'Walk-in/Phone'].map(source => ({ source, ...metric, total_requests: 4, not_evaluated: 0 })),
  csv_records: [{ service_request_id: 'request-1', branch_id: branch.id, order_source: 'Mobile App',
    requested_at: '2026-12-01T00:00:00Z', dispatched_at: '2026-12-01T00:05:00Z',
    in_transit_at: null, delivered_at: '2026-12-01T00:30:00Z', request_to_dispatch_result: 'Within SLA',
    dispatch_to_transit_result: 'Not evaluated', transit_to_delivery_result: 'Not evaluated', overall_sla_result: 'Breached' }],
};
const launch = () => chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });

async function setup(browser, csatResponse = csat) {
  const user = {
    id: '22222222-2222-4222-8222-222222222222', email: 'report-owner@example.invalid',
    app_metadata: { role: 'branch-owner', status: 'Active', display_name: 'Report Owner', branch_ids: [branch.id], branches: [branch.name] },
    user_metadata: {}, aud: 'authenticated', created_at: fixedTime.toISOString(),
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(new Date('2027-02-01T00:00:00Z').getTime() / 1000);
  const session = {
    access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.synthetic`,
    refresh_token: 'synthetic', expires_at: exp, expires_in: 86400, token_type: 'bearer', user,
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC' });
  await context.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
    window.__reportPrintCalls = 0;
    window.print = () => { window.__reportPrintCalls++; };
  }, { key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session });
  const state = { mode: 'success', gate: null, reads: [], writes: [], pageErrors: [] };
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin === authOrigin) {
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.pathname === '/auth/v1/token') return route.fulfill({ json: session });
      return route.abort();
    }
    if (url.origin !== apiOrigin) return route.abort();
    if (request.method() !== 'GET') state.writes.push(url.pathname);
    if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
    if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: [branch] } });
    if (['/api/csat/reports/summary', '/api/service-requests/reports/sla'].includes(url.pathname)) {
      assert.equal(url.searchParams.get('branchId'), branch.id);
      state.reads.push({ type: url.pathname.includes('/csat/') ? 'csat' : 'sla', from: url.searchParams.get('from'), to: url.searchParams.get('to') });
      if (state.gate) await state.gate;
      if (state.mode === 'error') return route.fulfill({ status: 503, json: { message: 'Report service temporarily unavailable' } });
      if (state.mode === 'invalid') return route.fulfill({ json: { report: null } });
      return route.fulfill({ json: { report: url.pathname.includes('/csat/') ? csatResponse : sla } });
    }
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => state.pageErrors.push(error.message));
  await page.clock.setFixedTime(fixedTime);
  await page.goto(`${baseUrl}/branch-owner/reports`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-csat-screen]').getByText(csatResponse.average_stars === null ? 'No ratings yet' : `${csatResponse.average_stars} / 5`, { exact: true }).first().waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-report-actions] button:last-child').disabled);
  return { page, context, state, preview: page.locator('[data-report-preview]') };
}

async function exportReport(page, format) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: format, exact: true }).click();
}

test('Owner reports update automatically and Reset uses the current Manila month, including a month rollover', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const { page, state } = await setup(browser);
    assert.equal(await page.locator('#report-month').inputValue(), '2026-12');
    assert.ok(state.reads.some(read => read.from === '2026-12-01' && read.to === '2026-12-31'));
    await page.locator('#report-month').fill('2026-02');
    await page.locator('[data-report-preview]').getByText(/February 1–28, 2026/).waitFor();
    await page.clock.setFixedTime(new Date('2026-12-31T16:30:00Z'));
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.locator('[data-report-preview]').getByText(/January 1–31, 2027/).waitFor();
    assert.equal(await page.locator('#report-month').inputValue(), '2027-01');
    assert.equal(await page.getByRole('radio').count(), 0);
    assert.ok(state.reads.some(read => read.from === '2027-01-01' && read.to === '2027-01-31'));
    assert.deepEqual(state.pageErrors, []);
  } finally { await browser.close(); }
});

for (const type of ['csat', 'sla']) {
  test(`Owner ${type} exports are blocked during refresh and after cached-report errors, then restored by Retry`, { timeout: 60000 }, async () => {
    const browser = await launch();
    try {
      const { page, state, preview } = await setup(browser);
      if (type === 'sla') {
        await page.getByRole('button', { name: 'Performance Metrics', exact: true }).click();
        await preview.getByText('75%', { exact: true }).first().waitFor();
      }
      const exportButton = () => page.getByRole('button', { name: 'Export', exact: true });
      await exportButton().waitFor({ state: 'visible' });
      assert.equal(await exportButton().isEnabled(), true);
      let release;
      state.mode = 'error';
      state.gate = new Promise(resolve => { release = resolve; });
      // Revisit a stale cached report using its existing type controls.
      await page.clock.setFixedTime(new Date(fixedTime.getTime() + 31_000));
      await page.getByRole('button', { name: type === 'csat' ? 'Performance Metrics' : 'Customer Satisfaction', exact: true }).click();
      await page.getByRole('button', { name: type === 'csat' ? 'Customer Satisfaction' : 'Performance Metrics', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-report-actions] button:last-child').disabled);
      assert.equal(await exportButton().isDisabled(), true);
      release(); state.gate = null;
      await preview.getByRole('heading', { name: 'Report unavailable', exact: true }).waitFor();
      assert.equal(await exportButton().isDisabled(), true);
      assert.equal(await exportButton().isDisabled(), true);
      await exportButton().evaluate(button => button.click());
      assert.equal(await page.evaluate(() => window.__reportPrintCalls), 0);
      state.mode = 'invalid';
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await preview.getByText('The server returned an invalid report response.', { exact: true }).waitFor();
      assert.equal(await exportButton().isDisabled(), true);
      state.mode = 'success';
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await (type === 'csat' ? page.locator('[data-csat-screen]') : preview).getByText(type === 'csat' ? '4.5 / 5' : '75%', { exact: true }).first().waitFor();
      assert.equal(await exportButton().isEnabled(), true);
      await exportReport(page, 'PDF');
      assert.equal(await page.evaluate(() => window.__reportPrintCalls), 1);
      const downloadPending = page.waitForEvent('download');
      const readsBeforeCsv = state.reads.length;
      await exportReport(page, 'CSV');
      const download = await downloadPending;
      assert.equal(download.suggestedFilename(), `${type === 'csat' ? 'customer-satisfaction' : 'performance-metrics'}_report-branch_2026-12-01_to_2026-12-31.csv`);
      let csv = '';
      for await (const chunk of await download.createReadStream()) csv += chunk.toString();
      assert.equal(csv.charCodeAt(0), 0xfeff);
      assert.ok(csv.startsWith(`\uFEFF${type === 'csat' ? 'response_id,service_request_id' : 'service_request_id,order_source'}`));
      assert.ok(csv.includes(type === 'csat' ? '"Peña, Althea"' : 'Within SLA,Not evaluated,Not evaluated,Breached'));
      assert.doesNotMatch(csv, /(?<!\r)\n|\r(?!\n)|Average rating|Overall compliance|\u2013/);
      assert.equal(state.reads.length, readsBeforeCsv, 'Export reuses the current report response without additional API calls');
      if (process.env.TEST_ARTIFACT_DIR) {
        await mkdir(process.env.TEST_ARTIFACT_DIR, { recursive: true });
        await download.saveAs(`${process.env.TEST_ARTIFACT_DIR}/${download.suggestedFilename()}`);
      }
      assert.deepEqual(state.writes, []);
      assert.deepEqual(state.pageErrors, []);
    } finally { await browser.close(); }
  });
}

test('Owner PDFs use current cards and colors with complete single-page A4 layouts', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const { page, preview, state } = await setup(browser);
    for (const type of ['csat', 'sla']) {
      if (type === 'sla') {
        await page.getByRole('button', { name: 'Performance Metrics', exact: true }).click();
        await preview.getByText('75%', { exact: true }).first().waitFor();
      }
      await page.emulateMedia({ media: 'print' });
      if (type === 'csat') {
        const printReport = page.locator('[data-csat-screen]');
        assert.equal(await printReport.isVisible(), true);
        assert.equal(await printReport.locator(':scope > div:first-child > div').count(), 4);
        assert.equal(await printReport.getByText('Response rate', { exact: true }).isVisible(), true);
        assert.equal(await printReport.locator('svg').first().evaluate(icon => getComputedStyle(icon).fill), 'rgb(245, 179, 1)');
        assert.equal(await printReport.getByRole('meter', { name: '5 star ratings', exact: true }).getAttribute('aria-valuenow'), '50');
      }
      await preview.getByText('Superkalan Gaz · Branch report', { exact: true }).waitFor();
      const layout = await preview.evaluate(report => {
        const ancestors = [];
        for (let node = report.parentElement; node; node = node.parentElement) {
          if (node.tagName === 'HTML') break;
          const style = getComputedStyle(node);
          ancestors.push({ transform: style.transform, translate: style.translate, overflow: style.overflow });
        }
        const rect = report.getBoundingClientRect();
        return { x: rect.x, width: rect.width, viewportWidth: innerWidth, ancestors,
          hiddenControls: getComputedStyle(document.querySelector('[data-report-actions]')).display === 'none',
          hiddenSetup: getComputedStyle(document.querySelector('main aside')).display === 'none' };
      });
      assert.equal(layout.x, 0, 'No sidebar space remains on the left');
      assert.equal(layout.width, layout.viewportWidth, 'Report uses the full printable content width');
      assert.equal(layout.hiddenControls, true);
      assert.equal(layout.hiddenSetup, true);
      for (const ancestor of layout.ancestors) assert.deepEqual(ancestor, { transform: 'none', translate: 'none', overflow: 'visible' });
      const artifactDir = process.env.TEST_ARTIFACT_DIR;
      if (artifactDir) await mkdir(artifactDir, { recursive: true });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, ...(artifactDir ? { path: `${artifactDir}/owner-${type}.pdf` } : {}) });
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length, 1, `${type} report fits A4 without an extra or clipped page`);
      await page.emulateMedia({ media: 'screen' });
      assert.ok(await preview.evaluate(report => report.getBoundingClientRect().x > 0), 'Dashboard layout returns after printing');
    }
    assert.deepEqual(state.pageErrors, []);
  } finally { await browser.close(); }
});

test('CSAT screen has dark equal cards, amber percentage bars and the existing report-type and month controls', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const sample = { average_stars: 3.71, total_responses: 14, delivered_requests: 32, response_rate: 43.8,
      incidents_raised: 3, rating_distribution: { 1: 1, 2: 1, 3: 2, 4: 7, 5: 3 } };
    const { page, preview, state } = await setup(browser, sample);
    const screen = page.locator('[data-csat-screen]');
    const cards = screen.locator(':scope > div:first-child > div');
    assert.equal(await cards.count(), 4);
    await cards.nth(1).getByText('14', { exact: true }).waitFor();
    await cards.nth(2).getByText('43.8%', { exact: true }).waitFor();
    assert.equal((await cards.nth(1).locator('[class*="statNote"]').textContent()).trim(), '');
    await cards.nth(2).getByText(/^14 of 32 delivered(?: orders)?$/).waitFor();
    assert.equal(await screen.getByText('Response rate', { exact: true }).count(), 1);
    const layout = await cards.evaluateAll(elements => elements.map(card => ({
      width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height,
      color: getComputedStyle(card.querySelector('[class*="statNumber"]')).color,
      noteSize: parseFloat(getComputedStyle(card.querySelector('[class*="statNote"]')).fontSize),
      noteColor: getComputedStyle(card.querySelector('[class*="statNote"]')).color,
    })));
    assert.ok(Math.max(...layout.map(card => card.width)) - Math.min(...layout.map(card => card.width)) < 1);
    assert.ok(Math.max(...layout.map(card => card.height)) - Math.min(...layout.map(card => card.height)) < 1);
    for (const card of layout) {
      assert.equal(card.color, 'rgb(15, 23, 42)');
      assert.ok(card.noteSize >= 13);
      assert.equal(card.noteColor, 'rgb(71, 85, 105)');
    }
    const meter = screen.getByRole('meter', { name: '4 star ratings', exact: true });
    assert.equal(await meter.getAttribute('aria-valuenow'), '50');
    const bar = await meter.evaluate(track => ({
      ratio: track.firstElementChild.getBoundingClientRect().width / track.getBoundingClientRect().width,
      fill: getComputedStyle(track.firstElementChild).backgroundColor, background: getComputedStyle(track).backgroundColor,
    }));
    assert.ok(Math.abs(bar.ratio - 0.5) < 0.01);
    assert.equal(bar.fill, 'rgb(245, 179, 1)');
    assert.equal(bar.background, 'rgb(254, 243, 199)');
    await screen.getByText('7 (50%)', { exact: true }).waitFor();
    assert.equal(await screen.locator('[class*="averageStar"]').evaluate(icon => getComputedStyle(icon).fill), 'rgb(245, 179, 1)');
    assert.equal(await cards.nth(1).locator('svg').evaluate(icon => getComputedStyle(icon).color), 'rgb(8, 127, 195)');
    const originalIconColors = await cards.locator('svg').evaluateAll(icons => icons.map(icon => getComputedStyle(icon).color));
    const expectedColors = await page.evaluate(() => ['var(--color-emerald-600, #059669)', 'var(--color-red-500, #ef4444)'].map(color => {
      const node = document.createElement('span'); node.style.color = color; document.body.append(node);
      const value = getComputedStyle(node).color; node.remove(); return value;
    }));
    assert.equal(originalIconColors[2], expectedColors[0]);
    assert.equal(originalIconColors[3], expectedColors[1]);
    assert.equal(await page.getByRole('button', { name: 'Refresh report', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Customer Satisfaction', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#report-month').inputValue(), '2026-12');
    assert.equal(await page.getByRole('tab').count(), 0);
    assert.equal(await page.getByRole('radio').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Update preview', exact: true }).count(), 0);
    assert.equal(await page.getByText(/Data is restricted by the API/).count(), 0);
    assert.equal(await preview.getByText('Branch-scoped data', { exact: true }).count(), 1);
    if (process.env.TEST_ARTIFACT_DIR) {
      await mkdir(process.env.TEST_ARTIFACT_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/csat-screen.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    for (const card of await cards.all()) assert.equal(await card.evaluate(element => element.scrollWidth <= element.clientWidth), true);
    await page.getByRole('button', { name: 'Performance Metrics', exact: true }).click();
    const slaCards = page.locator('[data-sla-summary] > div');
    await slaCards.first().getByText('75%', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Refresh report', exact: true }).count(), 0);
    assert.deepEqual(await slaCards.locator('svg').evaluateAll(icons => icons.map(icon => getComputedStyle(icon).color)), [originalIconColors[2], originalIconColors[1], originalIconColors[2], originalIconColors[3]]);
    assert.deepEqual(await slaCards.locator('[data-metric-value]').evaluateAll(values => values.map(value => getComputedStyle(value).color)), Array(4).fill('rgb(15, 23, 42)'));
    await page.getByRole('button', { name: 'Customer Satisfaction', exact: true }).click();
    await screen.getByText('3.71 / 5', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'View ratings and reviews', exact: true }).click();
    await page.waitForURL(url => url.pathname.endsWith('/csat'));
    await page.getByRole('heading', { name: 'Customer Ratings & Reviews', exact: true }).waitFor();
    assert.equal(await page.getByTitle('Refresh', { exact: true }).count(), 0);
    assert.deepEqual(state.writes, []);
    assert.deepEqual(state.pageErrors, []);
  } finally { await browser.close(); }
});

test('Response subtexts use live counts, singular/zero wording and fit without changing card styling', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    for (const sample of [
      { responses: 14, delivered: 32, rate: 43.8, full: '14 of 32 delivered orders', short: '14 of 32 delivered' },
      { responses: 1, delivered: 1, rate: 100, full: '1 of 1 delivered order', short: '1 of 1 delivered' },
      { responses: 0, delivered: 0, rate: null, full: 'No delivered orders', short: 'No delivered orders' },
    ]) {
      const { page, context, state } = await setup(browser, {
        average_stars: sample.responses ? 5 : null, total_responses: sample.responses, delivered_requests: sample.delivered,
        response_rate: sample.rate, incidents_raised: 0, rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: sample.responses },
      });
      try {
        const cards = page.locator('[data-csat-screen] > div:first-child > div');
        const responseNote = cards.nth(1).locator('[class*="statNote"]');
        const rateNote = cards.nth(2).locator('[class*="statNote"]');
        await page.setViewportSize({ width: 1920, height: 1000 });
        await rateNote.getByText(sample.full, { exact: true }).waitFor();
        assert.equal((await responseNote.textContent()).trim(), '');
        assert.equal(await cards.nth(1).locator('[class*="statNumber"]').textContent(), String(sample.responses));
        assert.equal(await cards.nth(2).locator('[class*="statNumber"]').textContent(), sample.rate === null ? '—' : `${sample.rate}%`);
        await page.setViewportSize({ width: 1280, height: 1000 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (sample.responses === 14) await rateNote.getByText(sample.short, { exact: true }).waitFor();
        const notes = await cards.locator('[class*="statNote"]').evaluateAll(elements => elements.map(element => {
          const style = getComputedStyle(element);
          return { size: style.fontSize, weight: style.fontWeight, color: style.color, lineHeight: style.lineHeight,
            whiteSpace: style.whiteSpace, height: element.getBoundingClientRect().height };
        }));
        for (const note of notes) assert.deepEqual(note, notes[0]);
        assert.equal(notes[0].whiteSpace, 'nowrap');
        for (const card of await cards.all()) {
          const fit = await card.evaluate(element => ({ width: element.clientWidth, contentWidth: element.scrollWidth, text: element.textContent }));
          assert.ok(fit.contentWidth <= fit.width, JSON.stringify({ sample, fit }));
        }
        await page.emulateMedia({ media: 'print' });
        await page.waitForFunction(({ full, short }) => {
          const text = document.querySelector('[data-csat-screen] > div:first-child > div:nth-child(3) [class*="statNote"]').textContent;
          return text === full || text === short;
        }, sample);
        assert.equal((await responseNote.textContent()).trim(), '');
        assert.deepEqual(state.pageErrors, []);
        assert.deepEqual(state.writes, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
