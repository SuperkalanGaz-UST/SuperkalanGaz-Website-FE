import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// Synthetic sessions with all Auth/API requests intercepted; no live data changes.
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(
  env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim(),
).origin;
const apiOrigin = new URL(
  env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ??
    'http://localhost:3001',
).origin;
const branchA = '00000000-0000-4000-8000-000000000001';
const branchB = '00000000-0000-4000-8000-000000000002';
const staffId = '00000000-0000-4000-8000-000000000003';
const month = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
  .format(new Date())
  .slice(0, 7);
const branches = [
  { id: branchA, name: 'Expense Branch A', geofence: null },
  { id: branchB, name: 'Expense Branch B', geofence: null },
];

async function contextFor(browser, role) {
  const user = {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'expenses@example.invalid',
    app_metadata: {
      role,
      status: 'Active',
      display_name: 'Expense Test',
      branch_ids: role === 'branch-owner' ? [branchA, branchB] : [branchA],
      branches:
        role === 'branch-owner'
          ? branches.map((b) => b.name)
          : [branches[0].name],
    },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  };
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp: expiresAt, role: 'authenticated' })}.synthetic`,
    refresh_token: 'synthetic-test',
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
  });
  await context.addInitScript(
    ({ session, key }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      session,
      key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`,
    },
  );
  const state = {
    writes: [],
    salaryReads: [],
    expenseReads: [],
    failNextSave: false,
    unavailable: false,
    rows: [],
  };
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseUrl).origin) return route.continue();
    if (url.origin === authOrigin) {
      if (url.pathname === '/auth/v1/user')
        return route.fulfill({ json: user });
      if (url.pathname === '/auth/v1/token')
        return route.fulfill({ json: session });
      return route.abort();
    }
    if (url.origin !== apiOrigin) return route.abort();
    if (url.pathname === '/api/users/me')
      return route.fulfill({
        json: {
          user: { ...user.app_metadata, id: user.id, email: user.email },
        },
      });
    if (url.pathname === '/api/branches/assigned')
      return route.fulfill({ json: { branches } });
    if (url.pathname === '/api/expenses') {
      state.expenseReads.push(url.searchParams.get('branchId'));
      return route.fulfill({
        json: {
          expenses:
            url.searchParams.get('month') === month &&
            url.searchParams.get('branchId') !== branchB
              ? [
                  {
                    id: 'operating-1',
                    branch_id: branchA,
                    expense_date: `${month}-15`,
                    category: 'Utilities',
                    description: 'Water bill',
                    amount: 1000,
                    reference_no: null,
                    recorded_by: 'manager',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                ]
              : [],
        },
      });
    }
    if (url.pathname === '/api/salary-expenses/staff')
      return route.fulfill({
        json: { staff: [{ id: staffId, name: 'Ana Test', role: 'driver' }] },
      });
    if (url.pathname === '/api/salary-expenses') {
      assert.equal(
        role,
        'branch-owner',
        'Other roles must never request compensation',
      );
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        state.writes.push(payload);
        assert.equal('total' in payload, false);
        if (state.failNextSave) {
          state.failNextSave = false;
          return route.fulfill({
            status: 503,
            json: { message: 'Could not save salary entry. Please retry.' },
          });
        }
        const row = {
          ...payload,
          id: `salary-${state.rows.length}`,
          staffName: 'Ana Test',
          staffRole: 'driver',
          regularPay: 18000,
          overtimePay: 1200,
          total: 19200,
        };
        state.rows.push(row);
        return route.fulfill({ json: { salary: row } });
      }
      const branch = url.searchParams.get('branchId');
      state.salaryReads.push(branch);
      if (state.unavailable)
        return route.fulfill({
          status: 503,
          json: { message: 'Salary connection unavailable' },
        });
      return route.fulfill({
        json: {
          salaries: state.rows.filter(
            (row) =>
              row.branchId === branch &&
              row.periodEnd.startsWith(url.searchParams.get('month')),
          ),
        },
      });
    }
    return route.fulfill({
      json: {
        serviceRequests: [],
        branches: [],
        customers: [],
        users: [],
        notifications: [],
        unreadCount: 0,
        summary: null,
        ratings: [],
        requests: [],
        riders: [],
        vehicles: [],
        stockLevels: [],
      },
    });
  });
  return { context, state };
}
async function screenshot(page, name) {
  if (!process.env.TEST_ARTIFACT_DIR) return;
  await mkdir(process.env.TEST_ARTIFACT_DIR, { recursive: true });
  await page.screenshot({
    path: `${process.env.TEST_ARTIFACT_DIR}/${name}.png`,
    fullPage: true,
  });
}

test(
  'Owner modal calculations, retry, overview, responsive layout and branch isolation',
  { timeout: 120_000 },
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const { context, state } = await contextFor(browser, 'branch-owner');
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${baseUrl}/branch-owner/operational-expenses`);
      await page
        .getByText('Select an authorized branch to view its expenses.')
        .waitFor();
      assert.equal(state.salaryReads.length, 0);
      await page
        .getByRole('button', { name: 'Select branch', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Expense Branch A', exact: true })
        .click();
      await page
        .getByRole('tab', { name: 'Salaries & Overtime', exact: true })
        .click();
      await page
        .getByText('No salary entries recorded for this month.')
        .waitFor();
      assert.ok(state.salaryReads.every((id) => id === branchA));
      assert.ok(state.expenseReads.every((id) => id === branchA));
      await screenshot(page, 'salary-list-empty');
      await page
        .getByRole('button', { name: 'Record salary', exact: true })
        .click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByRole('combobox').selectOption(staffId);
      await dialog.getByLabel('Regular hours', { exact: true }).fill('144');
      await dialog.getByLabel('Hourly rate (₱)', { exact: true }).fill('125');
      await dialog.getByLabel('Overtime hours', { exact: true }).fill('6');
      await dialog
        .getByLabel('OT hourly rate (₱)', { exact: true })
        .fill('200');
      assert.match(
        await dialog
          .getByLabel('Calculated regular pay', { exact: true })
          .innerText(),
        /18,000/,
      );
      assert.match(
        await dialog
          .getByLabel('Calculated overtime pay', { exact: true })
          .innerText(),
        /1,200/,
      );
      assert.match(
        await dialog
          .getByLabel('Calculated total', { exact: true })
          .innerText(),
        /19,200/,
      );
      const box = await dialog.boundingBox();
      assert.ok(box.width >= 900 && box.width <= 1100);
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector('[role=dialog]')).opacity ===
          '1',
      );
      await screenshot(page, 'salary-record-modal-desktop');
      state.failNextSave = true;
      await dialog
        .getByRole('button', { name: 'Save entry', exact: true })
        .click();
      await dialog
        .getByRole('alert')
        .filter({ hasText: 'Could not save' })
        .waitFor();
      assert.equal(
        await dialog.getByLabel('Regular hours', { exact: true }).inputValue(),
        '144',
      );
      await dialog
        .getByRole('button', { name: 'Save entry', exact: true })
        .click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(state.writes.length, 2);
      assert.equal(state.writes[0].requestId, state.writes[1].requestId);
      assert.equal(state.writes[1].branchId, branchA);
      await page.getByRole('cell', { name: /Ana Test/ }).waitFor();
      await screenshot(page, 'salary-list-desktop');
      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await page.getByRole('region', { name: 'Salary overview' }).waitFor();
      await page.getByText('₱20,200.00', { exact: true }).waitFor();
      await page.locator('.recharts-wrapper > .recharts-surface').waitFor();
      await screenshot(page, 'opex-overview-desktop');
      await page
        .getByRole('button', { name: 'View salary entries →', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Record salary', exact: true })
        .click();
      await page.setViewportSize({ width: 700, height: 850 });
      await page.waitForFunction(() => {
        const box = document
          .querySelector('[role=dialog]')
          .getBoundingClientRect();
        return box.x >= 0 && box.right <= innerWidth;
      });
      const responsiveBox = await dialog.boundingBox();
      assert.ok(
        responsiveBox.x >= 0 && responsiveBox.x + responsiveBox.width <= 700,
      );
      assert.equal(
        await dialog.evaluate((el) => el.scrollWidth > el.clientWidth),
        false,
      );
      await screenshot(page, 'salary-record-modal-small');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await page.setViewportSize({ width: 1600, height: 1100 });
      await page
        .getByRole('button', { name: 'Expense Branch A', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Expense Branch B', exact: true })
        .click();
      await page
        .getByRole('tab', { name: 'Salaries & Overtime', exact: true })
        .click();
      await page
        .getByText('No salary entries recorded for this month.')
        .waitFor();
      assert.equal(
        await page.getByRole('cell', { name: /Ana Test/ }).count(),
        0,
      );
      assert.ok(state.salaryReads.includes(branchB));
      state.unavailable = true;
      await page
        .getByLabel('Expense month', { exact: true })
        .selectOption({ index: 1 });
      await page
        .getByRole('alert')
        .filter({ hasText: 'Salary connection unavailable' })
        .waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: 'Record salary', exact: true })
          .count(),
        0,
      );
      state.unavailable = false;
      await page
        .getByRole('button', { name: 'Retry loading expenses', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Record salary', exact: true })
        .waitFor();
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await browser.close();
    }
  },
);

test(
  'Branch Manager has no salary categories, controls or compensation requests',
  { timeout: 60_000 },
  async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const { context, state } = await contextFor(browser, 'branch-manager');
      const page = await context.newPage();
      await page.goto(`${baseUrl}/branch-manager/expenses`);
      await page
        .getByRole('heading', { name: 'Expense Entries', exact: true })
        .waitFor();
      assert.equal(
        (await page.locator('option').allTextContents()).some((text) =>
          /salary|wages|overtime/i.test(text),
        ),
        false,
      );
      assert.equal(
        await page
          .getByRole('tab', { name: 'Salaries & Overtime', exact: true })
          .count(),
        0,
      );
      assert.equal(state.salaryReads.length, 0);
      assert.equal(state.writes.length, 0);
      await screenshot(page, 'branch-manager-operational-expenses');
      await context.close();
    } finally {
      await browser.close();
    }
  },
);
