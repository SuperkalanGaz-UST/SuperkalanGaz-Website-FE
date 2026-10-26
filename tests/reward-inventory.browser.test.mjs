import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

// All Auth/API calls are synthetic. No real inventory, catalog or redemption writes.
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const authOrigin = new URL(env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1].trim()).origin;
const apiOrigin = new URL(env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? 'http://localhost:3001').origin;
const branches = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Reward Alpha', geofence: null },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Reward Beta', geofence: null },
];
const itemA = '33333333-3333-4333-8333-333333333333';
const itemB = '44444444-4444-4444-8444-444444444444';
const fiftyKgId = '9d2438c1-501a-4d5f-8d3a-83aed6a1d26d';
const sizes = ['50kg', '22kg', '11kg', '5kg', '2.7kg'];
const launch = () => chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });

async function setup(browser, role, store) {
  const selectedBranches = role === 'branch-owner' ? branches : [branches[0]];
  const user = {
    id: '55555555-5555-4555-8555-555555555555', email: `${role}@example.invalid`,
    app_metadata: { role, status: 'Active', display_name: 'Reward Test', branch_ids: selectedBranches.map(b => b.id), branches: selectedBranches.map(b => b.name) },
    user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString(),
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.synthetic`,
    refresh_token: 'synthetic', expires_at: exp, expires_in: 3600, token_type: 'bearer', user,
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const writes = [];
  const reads = [];
  const stock = branchId => ({
    branch_id: branchId, product_id: 'product-11kg', product_name: '11kg LPG Cylinder', cylinder_size: '11kg',
    current_qty: store.lpg, threshold_qty: 10, capacity_qty: 40,
  });
  const reward = branchId => ({
    branch_id: branchId, catalog_item_id: branchId === branches[0].id ? itemA : itemB,
    item_name: 'Umbrella', description: 'Household reward', category: 'rewards', points_cost: 30,
    current_qty: store.quantities[branchId], threshold_qty: 5, capacity_qty: 30,
  });
  await context.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: `sb-${new URL(authOrigin).hostname.split('.')[0]}-auth-token`, session,
  });
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
    if (request.method() !== 'GET') writes.push({ path: url.pathname, body: request.postDataJSON() });
    if (url.pathname === '/api/users/me') return route.fulfill({ json: { user: { ...user.app_metadata, id: user.id, email: user.email } } });
    if (url.pathname === '/api/branches/assigned') return route.fulfill({ json: { branches: selectedBranches } });
    if (url.pathname === '/api/inventory/stock-levels/owner' || url.pathname === '/api/inventory/stock-levels') {
      const branchId = role === 'branch-owner' ? url.searchParams.get('branchId') : branches[0].id;
      assert.ok(selectedBranches.some(b => b.id === branchId));
      return route.fulfill({ json: { stockLevels: [stock(branchId)] } });
    }
    if (url.pathname === '/api/inventory/reward-stock-levels/owner' || url.pathname === '/api/inventory/reward-stock-levels') {
      const branchId = url.searchParams.get('branchId');
      assert.ok(selectedBranches.some(b => b.id === branchId));
      reads.push(branchId);
      if (branchId === branches[1].id && store.delay) await store.delay;
      if (store.mode === 'error') return route.fulfill({ status: 503, json: { message: 'Reward stock unavailable. Please retry.' } });
      const row = reward(branchId);
      if (store.mode === 'wrong-branch') row.branch_id = branches[1].id;
      const rows = [row, ...(branchId === branches[0].id ? [{
        ...row, branch_id: branchId, catalog_item_id: '66666666-6666-4666-8666-666666666666',
        item_name: 'Mug', points_cost: 40, current_qty: 0, threshold_qty: 2, capacity_qty: 20,
      }] : [])];
      return route.fulfill({ json: { rewardStockLevels: store.mode === 'empty' ? [] : rows } });
    }
    if (url.pathname === '/api/inventory/reward-stock-levels/intake') {
      assert.equal(role, 'branch-manager');
      const payload = request.postDataJSON();
      assert.deepEqual(payload, { branchId: branches[0].id, catalogItemId: itemA, receivedQty: 5 });
      store.quantities[branches[0].id] += payload.receivedQty;
      return route.fulfill({ json: { rewardStockLevel: reward(branches[0].id) } });
    }
    if (url.pathname === '/api/inventory/stock-levels/intake') {
      const payload = request.postDataJSON();
      assert.deepEqual(payload, { productId: 'product-11kg', receivedQty: 2 });
      store.lpg += payload.receivedQty;
      return route.fulfill({ json: { stockLevel: stock(branches[0].id) } });
    }
    if (url.pathname === '/api/inventory/reorder-requests') return route.fulfill({ json: { reorderRequests: [] } });
    if (url.pathname.startsWith('/api/prices/for-branch/')) return route.fulfill({ json: { prices: sizes.map((size, index) => ({ id: `price-${size}`, cylinder_size: size, unit_price: 600 + index, updated_at: '2026-10-22' })) } });
    return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { page, context, writes, reads, errors };
}
async function selectOwner(page, name) {
  await page.getByRole('button', { name: /Select branch|Reward Alpha|Reward Beta/, exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}
async function screenshot(page, name) {
  if (!process.env.TEST_ARTIFACT_DIR) return;
  await mkdir(process.env.TEST_ARTIFACT_DIR, { recursive: true });
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].filter(img => {
    const box = img.getBoundingClientRect();
    return box.top < innerHeight && box.bottom > 0;
  }).every(img => img.complete));
  await page.screenshot({ path: `${process.env.TEST_ARTIFACT_DIR}/${name}.png`, fullPage: true });
}
const storeFor = () => ({ quantities: { [branches[0].id]: 3, [branches[1].id]: 20 }, lpg: 7, mode: 'success', delay: null });

test('Manager inventory tabs share categories, preserve preselection, sort table rows and filter order controls', { timeout: 90_000 }, async () => {
  const browser = await launch();
  try {
    const manager = await setup(browser, 'branch-manager', storeFor());
    let stockReads = 0;
    await manager.context.route('**/api/inventory/stock-levels', route => {
      stockReads++;
      return route.fulfill({ json: { stockLevels: sizes.map((size, index) => ({
        product_id: size === '50kg' ? fiftyKgId : `product-${size}`, product_name: `${size} LPG Cylinder`,
        current_qty: [14, 0, 40, 10, 120][index], threshold_qty: 10, capacity_qty: 100,
      })) } });
    });
    const logRows = [
      { id: 'lpg-request', product_id: 'product-11kg', product_name: 'LPG log row' },
      { id: 'reward-request', product_id: itemA, product_name: 'Reward log row' },
      { id: 'unknown-request', product_id: 'unknown-product', product_name: 'Unknown log row' },
      { id: 'fifty-request', product_id: fiftyKgId, product_name: 'Delivered 50kg', status: 'Delivered' },
    ].map(row => ({ ...row, requested_qty: 10, status: row.status ?? 'Pending', requested_by_name: 'Test Manager', requested_at: '2026-10-22' }));
    await manager.context.route('**/api/inventory/reorder-requests', route => route.fulfill({ json: { reorderRequests: logRows } }));
    const page = manager.page;
    await page.goto(`${baseUrl}/branch-manager/inventory`);
    const currentTab = page.getByRole('tab', { name: 'Current Inventory', exact: true });
    const ordersTab = page.getByRole('tab', { name: 'Order Stocks', exact: true });
    const currentPanel = page.getByRole('tabpanel', { name: 'Current Inventory', exact: true });
    const ordersPanel = page.getByRole('tabpanel', { name: 'Order Stocks', exact: true });
    const intakeCard = page.getByRole('heading', { name: /^(Manual Stock Intake|Record Reward Stock)$/ }).locator('..').locator('..');
    const reorderCard = page.getByRole('heading', { name: 'New Reorder Request', exact: true }).locator('..').locator('..');
    const table = currentPanel.getByRole('table');
    await table.getByText('22kg LPG Cylinder', { exact: true }).waitFor();
    assert.equal(await currentTab.getAttribute('aria-selected'), 'true');
    assert.equal(await ordersPanel.count(), 0);
    assert.equal(await page.locator('form').count(), 2, 'Existing forms stay mounted');
    assert.deepEqual(await table.getByRole('columnheader').allTextContents(), ['Item', 'Stock Level', 'Status', 'Action']);
    assert.deepEqual(await table.locator('h3').allTextContents(), ['2.7kg LPG Cylinder', '5kg LPG Cylinder', '11kg LPG Cylinder', '22kg LPG Cylinder', '50kg LPG Cylinder']);
    assert.equal(await table.getByText('LPG cylinder', { exact: true }).count(), 0);
    for (const [status, count] of [['Out of Stock', 1], ['Critical', 0], ['Low Stock', 1], ['In Stock', 3]]) assert.equal(await table.getByText(status, { exact: true }).count(), count);
    const summary = currentPanel.locator('dl[aria-label="LPG Cylinders stock summary"]');
    assert.equal(await currentPanel.getByRole('heading', { name: 'Current Inventory', exact: true }).count(), 0);
    assert.equal(await summary.evaluate(el => el.closest('[class*="currentInventoryCard"]') !== null), false, 'KPI tiles sit outside the table card');
    const togglePosition = await currentPanel.getByRole('group', { name: 'Stock category' }).evaluate(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y + document.querySelector('main').scrollTop }));
    const navigationHeight = await page.locator('[class*="stockTabsRow"]').evaluate(el => el.getBoundingClientRect().height);
    for (const [label, value] of [['Total Items', '5'], ['In Stock', '3'], ['Low Stock', '1'], ['Out of Stock', '1']]) assert.equal(await summary.getByText(label, { exact: true }).locator('..').locator('dd').textContent(), value);
    assert.equal(await currentTab.locator('[class*="criticalDot"]').count(), 0);
    assert.equal(await currentPanel.getByRole('button', { name: 'LPG Cylinders', exact: true }).textContent(), 'LPG Cylinders');
    for (const text of ['Monitor stock levels and record received items for this branch.', 'Monitor available stock and record received items for this branch.']) assert.equal(await page.getByText(text, { exact: true }).count(), 0);
    for (const size of ['2.7kg', '5kg', '11kg', '22kg', '50kg']) {
      const itemImage = table.getByRole('img', { name: `${size} LPG Cylinder`, exact: true });
      assert.match(decodeURIComponent(await itemImage.getAttribute('src')), new RegExp(`/catalog/${size}\\.png`));
    }
    const alignment = await table.evaluate(el => {
      const rows = [...el.querySelectorAll('tbody tr')];
      const head = [...el.querySelectorAll('th')].map(th => th.getBoundingClientRect().x);
      return rows.map(row => ({ height: row.getBoundingClientRect().height, columns: [...row.querySelectorAll('td')].map((cell, index) => Math.abs(cell.getBoundingClientRect().x - head[index])) }));
    });
    assert.ok(alignment.every(row => Math.abs(row.height - alignment[0].height) < 1 && row.columns.every(diff => diff < 1)), 'Desktop headers, cells and row heights align');
    assert.equal(await currentPanel.getByRole('button', { name: 'Reward Merchandise', exact: true }).textContent(), 'Reward Merchandise');
    assert.equal(await table.getByRole('progressbar', { name: '2.7kg LPG Cylinder stock capacity' }).getAttribute('aria-valuetext'), '120 of 100 units');
    await screenshot(page, 'manager-current-lpg-desktop');
    const readsBefore = { stock: stockReads, rewards: manager.reads.length };
    await table.getByRole('button', { name: 'Record stock for 5kg LPG Cylinder', exact: true }).click();
    await ordersPanel.waitFor();
    assert.equal(await intakeCard.getByRole('combobox').inputValue(), 'product-5kg');
    assert.equal(await intakeCard.getByRole('spinbutton').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.getByRole('button', { name: "Confirm today's stock count", exact: true }).count(), 0);
    const orderTogglePosition = await ordersPanel.getByRole('group', { name: 'Stock category' }).evaluate(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y + document.querySelector('main').scrollTop }));
    assert.ok(Math.abs(orderTogglePosition.x - togglePosition.x) < 1 && Math.abs(orderTogglePosition.y - togglePosition.y) < 1, 'Category toggle stays in the same position on both tabs');
    assert.equal(await page.locator('[class*="stockTabsRow"]').evaluate(el => el.getBoundingClientRect().height), navigationHeight);
    for (const label of ['LPG Cylinders', 'Reward Merchandise']) assert.equal(await ordersPanel.getByRole('button', { name: label, exact: true }).textContent(), label);
    for (const card of [intakeCard, reorderCard]) {
      assert.equal(await card.getByRole('combobox').locator('option').filter({ hasText: /LPG Cylinder/ }).count(), 5);
      assert.equal(await card.getByRole('combobox').locator(`option[value="${fiftyKgId}"]`).count(), 1);
      assert.equal(await card.getByRole('combobox').locator('option').filter({ hasText: /Reward/ }).count(), 0);
      assert.deepEqual(await card.getByRole('combobox').locator('option:not([value=""])').allTextContents(), ['2.7kg LPG Cylinder', '5kg LPG Cylinder', '11kg LPG Cylinder', '22kg LPG Cylinder', '50kg LPG Cylinder']);
      assert.equal(await card.getByRole('combobox').locator('option[value=""]').evaluate(el => el.hidden && el.disabled), true);
      assert.equal(await card.getByRole('combobox').evaluate(el => getComputedStyle(el).appearance), 'none');
    }
    await page.getByRole('cell', { name: 'LPG log row', exact: true }).waitFor();
    assert.equal(await page.getByRole('cell', { name: /Reward log row|Unknown log row/ }).count(), 0);
    await page.getByRole('cell', { name: 'Delivered 50kg', exact: true }).waitFor();
    assert.equal(await page.getByText('Record received stock or request LPG replenishment for this branch.', { exact: true }).count(), 0);
    assert.equal(await ordersPanel.getByRole('heading', { name: 'Order Stocks', exact: true }).count(), 0);
    await intakeCard.getByRole('spinbutton').fill('17');
    await reorderCard.getByRole('combobox').selectOption('product-11kg');
    await reorderCard.getByRole('spinbutton').fill('42');
    await currentTab.click();
    await table.getByRole('button', { name: 'Record stock for 11kg LPG Cylinder', exact: true }).click();
    await ordersPanel.waitFor();
    assert.equal(await intakeCard.getByRole('combobox').inputValue(), 'product-11kg');
    assert.equal(await intakeCard.getByRole('spinbutton').inputValue(), '17', 'Record stock preserves quantity');
    assert.equal(await reorderCard.getByRole('spinbutton').inputValue(), '42', 'Top-level tabs preserve forms');
    await screenshot(page, 'manager-order-lpg-desktop');
    const rewardToggle = ordersPanel.getByRole('button', { name: 'Reward Merchandise', exact: true });
    await rewardToggle.click();
    assert.equal(await page.getByText('Record reward items received for this branch.', { exact: true }).count(), 0);
    assert.equal(await ordersPanel.getByText(/request LPG|replenishment/).count(), 0);
    assert.equal(await intakeCard.getByRole('combobox').inputValue(), '');
    assert.equal(await intakeCard.getByRole('spinbutton').inputValue(), '10');
    assert.deepEqual(await intakeCard.getByRole('combobox').locator('option:not([value=""])').allTextContents(), ['Umbrella', 'Mug']);
    assert.equal(await intakeCard.getByRole('combobox').locator('option').filter({ hasText: /LPG Cylinder/ }).count(), 0);
    assert.equal(await reorderCard.count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Reorder Request Log', exact: true }).count(), 0);
    const intakeBox = await intakeCard.boundingBox();
    const formsBox = await page.locator('[class*="formsGrid"]').boundingBox();
    assert.ok(Math.abs(intakeBox.width - formsBox.width) < 1);
    const ordersBox = await ordersPanel.boundingBox();
    assert.ok(formsBox.width <= 680 && Math.abs(formsBox.x - ordersBox.x) < 1, 'Reward card is capped and left aligned');
    assert.equal(await intakeCard.getByRole('button', { name: 'Record Stock', exact: true }).evaluate(el => el.classList.contains('btn-primary')), true);
    await intakeCard.getByRole('spinbutton').fill('6');
    await ordersTab.press('Home');
    assert.equal(await currentTab.getAttribute('aria-selected'), 'true');
    assert.equal(await currentPanel.getByRole('button', { name: 'Reward Merchandise', exact: true }).getAttribute('aria-pressed'), 'true');
    await table.getByText('Umbrella', { exact: true }).waitFor();
    assert.deepEqual(await table.locator('h3').allTextContents(), ['Umbrella', 'Mug'], 'Rewards sort by points instead of stock status');
    await table.getByText('Household reward · 30 points', { exact: true }).waitFor();
    await screenshot(page, 'manager-current-rewards-desktop');
    await table.getByRole('button', { name: 'Record stock for Mug', exact: true }).focus();
    await page.keyboard.press('Enter');
    await ordersPanel.waitFor();
    assert.equal(await intakeCard.getByRole('combobox').inputValue(), 'reward:66666666-6666-4666-8666-666666666666');
    assert.equal(await intakeCard.getByRole('spinbutton').inputValue(), '6');
    assert.equal(await intakeCard.getByRole('spinbutton').evaluate(el => el === document.activeElement), true);
    await rewardToggle.press('Home');
    assert.equal(await ordersPanel.getByRole('button', { name: 'LPG Cylinders', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await intakeCard.getByRole('combobox').inputValue(), '');
    assert.equal(await reorderCard.getByRole('combobox').inputValue(), '');
    assert.equal(await reorderCard.getByRole('spinbutton').inputValue(), '10');
    await ordersPanel.getByRole('button', { name: 'LPG Cylinders', exact: true }).press('End');
    assert.equal(stockReads, readsBefore.stock);
    assert.equal(manager.reads.length, readsBefore.rewards);
    assert.deepEqual(manager.writes, [], 'Navigation and Record stock never write');
    await screenshot(page, 'manager-order-rewards-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Minimize sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor();
    await currentTab.click();
    await page.waitForFunction(() => { const main = document.querySelector('main'); return main.scrollWidth <= main.clientWidth; });
    const mobileSummary = currentPanel.locator('dl[aria-label="Reward Merchandise stock summary"]');
    assert.equal(await mobileSummary.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1);
    const mobileToggle = await currentPanel.getByRole('group', { name: 'Stock category' }).evaluate(el => el.getBoundingClientRect().y + document.querySelector('main').scrollTop);
    const mobileNavigationHeight = await page.locator('[class*="stockTabsRow"]').evaluate(el => el.getBoundingClientRect().height);
    assert.equal(await table.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await screenshot(page, 'manager-current-rewards-mobile');
    await table.getByRole('button', { name: 'Record stock for Umbrella', exact: true }).click();
    await ordersPanel.waitFor();
    assert.equal(await intakeCard.getByRole('spinbutton').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.getByRole('button', { name: "Confirm today's stock count", exact: true }).count(), 0);
    assert.equal(await page.locator('[class*="stockTabsRow"]').evaluate(el => el.getBoundingClientRect().height), mobileNavigationHeight);
    assert.ok(Math.abs(await ordersPanel.getByRole('group', { name: 'Stock category' }).evaluate(el => el.getBoundingClientRect().y + document.querySelector('main').scrollTop) - mobileToggle) < 1);
    await screenshot(page, 'manager-order-rewards-mobile');
    await page.setViewportSize({ width: 900, height: 1000 });
    await currentTab.click();
    assert.equal(await currentPanel.locator('dl[aria-label="Reward Merchandise stock summary"]').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
    assert.equal(await table.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await screenshot(page, 'manager-current-rewards-tablet');
    let releaseEmpty;
    const pendingEmpty = new Promise(resolve => { releaseEmpty = resolve; });
    await manager.context.route('**/api/inventory/reward-stock-levels**', async route => {
      await pendingEmpty;
      await route.fulfill({ json: { rewardStockLevels: [] } });
    });
    await page.reload();
    await currentPanel.getByRole('button', { name: 'Reward Merchandise', exact: true }).click();
    await page.getByText('Loading reward stock…', { exact: true }).waitFor();
    releaseEmpty();
    await page.getByText('No reward items yet', { exact: true }).waitFor();
    await manager.context.route('**/api/inventory/reorder-requests', route => route.fulfill({ json: { reorderRequests: logRows.filter(row => row.product_id === itemA || row.product_id === 'unknown-product') } }));
    await page.reload();
    await ordersTab.click();
    await page.getByText('No reorder requests yet', { exact: true }).waitFor();
    assert.deepEqual(manager.errors, []);
    await manager.context.close();
  } finally { await browser.close(); }
});
test('Four loaded rewards agree across table, section and KPIs while the native intake field remains empty', { timeout: 60_000 }, async () => {
  const browser = await launch();
  try {
    const manager = await setup(browser, 'branch-manager', storeFor());
    let releaseRewards;
    const rewardsGate = new Promise(resolve => { releaseRewards = resolve; });
    const rewards = [
      { item_name: 'Mug', points_cost: 40 }, { item_name: 'Notebook and Pen', points_cost: 10 },
      { item_name: 'Umbrella', points_cost: 30 }, { item_name: 'Desk Calendar', points_cost: 20 },
    ].map((item, index) => ({ ...item, branch_id: branches[0].id, catalog_item_id: `88888888-8888-4888-8888-88888888888${index}`,
      category: 'rewards', description: null, current_qty: index === 0 ? 9 : 10, threshold_qty: 10, capacity_qty: 100,
    }));
    await manager.context.route('**/api/inventory/reward-stock-levels**', async route => {
      await rewardsGate;
      return route.fulfill({ json: { rewardStockLevels: rewards } });
    });
    const page = manager.page;
    await page.goto(`${baseUrl}/branch-manager/inventory`);
    await page.getByRole('button', { name: 'Reward Merchandise', exact: true }).click();
    await page.getByText('Loading reward stock…', { exact: true }).waitFor();
    const summary = page.locator('dl[aria-label="Reward Merchandise stock summary"]');
    assert.equal(await summary.getByText('Total Items', { exact: true }).locator('..').locator('dd').textContent(), '—');
    releaseRewards();
    const table = page.getByRole('table', { name: 'Reward Merchandise current inventory', exact: true });
    await table.getByText('Notebook and Pen', { exact: true }).waitFor();
    assert.equal(await table.locator('tbody tr').count(), 4);
    const strip = page.getByText('Reward merchandise', { exact: true }).locator('..');
    await strip.getByText('4 items', { exact: true }).waitFor();
    for (const [label, value] of [['Total Items', '4'], ['In Stock', '0'], ['Low Stock', '4'], ['Out of Stock', '0']]) assert.equal(await summary.getByText(label, { exact: true }).locator('..').locator('dd').textContent(), value);
    await page.getByRole('tab', { name: 'Order Stocks', exact: true }).click();
    const select = page.getByRole('combobox');
    assert.equal(await select.inputValue(), '');
    assert.deepEqual(await select.evaluate(el => ({ index: el.selectedIndex, label: el.selectedOptions[0].text, hidden: el.selectedOptions[0].hidden, disabled: el.selectedOptions[0].disabled })), { index: 0, label: 'Select product...', hidden: true, disabled: true });
    assert.deepEqual(await select.locator('option:not([value=""])').allTextContents(), ['Notebook and Pen', 'Desk Calendar', 'Umbrella', 'Mug']);
    await select.click();
    assert.equal(await select.inputValue(), '', 'Opening the native popup does not commit its first item');
    await page.keyboard.press('Escape');
    await select.focus();
    assert.equal(await select.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await screenshot(page, 'manager-reward-empty-native-select');
    await page.getByRole('button', { name: 'Record Stock', exact: true }).click();
    await page.getByText('Product is required', { exact: true }).waitFor();
    assert.deepEqual(manager.writes, []);
    assert.deepEqual(manager.errors, []);
    await manager.context.close();
  } finally { await browser.close(); }
});

test('Manager native product pickers dismiss on outer scroll and context changes while empty-product validation is preserved', { timeout: 60_000 }, async () => {
  const browser = await launch();
  try {
    const manager = await setup(browser, 'branch-manager', storeFor());
    const page = manager.page;
    await page.setViewportSize({ width: 1440, height: 640 });
    await page.goto(`${baseUrl}/branch-manager/inventory`);
    await page.getByRole('tab', { name: 'Order Stocks', exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: 'Order Stocks', exact: true });
    const reorder = page.getByRole('heading', { name: 'New Reorder Request', exact: true }).locator('..').locator('..');
    const intake = page.getByRole('heading', { name: /^(Manual Stock Intake|Record Reward Stock)$/ }).locator('..').locator('..');
    await intake.getByRole('combobox').locator('option[value="product-11kg"]').waitFor({ state: 'attached' });
    for (const card of [reorder, intake]) {
      assert.equal(await card.getByRole('spinbutton').inputValue(), '10');
      await card.getByRole('button', { name: /Submit Request|Update Inventory/ }).click();
      await card.getByText('Product is required', { exact: true }).waitFor();
      const select = card.getByRole('combobox');
      assert.equal(await select.evaluate(el => el.tagName), 'SELECT');
      await select.click();
      await page.locator('main').evaluate(el => el.scrollTop += el.scrollTop > 0 ? -40 : 40);
      await page.waitForFunction(() => !(document.activeElement instanceof HTMLSelectElement));
      assert.equal(await select.inputValue(), '');
      await select.focus();
      await select.evaluate(el => el.dispatchEvent(new Event('scroll')));
      assert.equal(await select.evaluate(el => el === document.activeElement), true, 'Picker-internal scrolling is ignored');
      await select.click();
      await page.keyboard.press('Escape');
      assert.equal(await select.inputValue(), '');
      await card.getByRole('spinbutton').click();
      assert.equal(await select.evaluate(el => el === document.activeElement), false, 'Outside interaction dismisses native picker');
    }
    await intake.getByRole('combobox').focus();
    await page.evaluate(() => document.getElementById('inventory-current-tab').click());
    await page.waitForFunction(() => !(document.activeElement instanceof HTMLSelectElement));
    await page.getByRole('tab', { name: 'Order Stocks', exact: true }).click();
    await intake.getByRole('combobox').focus();
    await panel.getByRole('button', { name: 'Reward Merchandise', exact: true }).evaluate(el => el.click());
    await page.waitForFunction(() => !(document.activeElement instanceof HTMLSelectElement));
    await intake.getByRole('button', { name: 'Record Stock', exact: true }).click();
    await intake.getByText('Product is required', { exact: true }).waitFor();
    await screenshot(page, 'manager-reward-native-picker-validation');
    assert.deepEqual(manager.writes, [], 'Missing products never reach either intake endpoint or reorder endpoint');
    assert.deepEqual(manager.errors, []);
    await manager.context.close();
  } finally { await browser.close(); }
});

test('Manager reward images reuse Owner assets, unknown items keep aligned placeholders, and equal-point order is stable', { timeout: 60_000 }, async () => {
  const browser = await launch();
  try {
    const manager = await setup(browser, 'branch-manager', storeFor());
    const fixtures = [
      { item_name: 'Mug', points_cost: 40 },
      { item_name: 'Notebook and Pen', points_cost: 10 },
      { item_name: 'Umbrella', points_cost: 30 },
      { item_name: 'Desk Calendar', points_cost: 20 },
      { item_name: 'Custom reward', points_cost: 20 },
    ].map((item, index) => ({ ...item, branch_id: branches[0].id,
      catalog_item_id: `77777777-7777-4777-8777-77777777777${index}`, description: null, category: 'rewards', current_qty: index, threshold_qty: 10, capacity_qty: 100,
    }));
    await manager.context.route('**/api/inventory/reward-stock-levels**', route => route.fulfill({ json: { rewardStockLevels: fixtures } }));
    const page = manager.page;
    await page.goto(`${baseUrl}/branch-manager/inventory`);
    await page.getByRole('button', { name: 'Reward Merchandise', exact: true }).click();
    const table = page.getByRole('table', { name: 'Reward Merchandise current inventory', exact: true });
    await table.getByText('Notebook and Pen', { exact: true }).waitFor();
    assert.deepEqual(await table.locator('h3').allTextContents(), ['Notebook and Pen', 'Desk Calendar', 'Custom reward', 'Umbrella', 'Mug']);
    for (const [name, asset] of [['Notebook and Pen', 'notebook'], ['Desk Calendar', 'calendar'], ['Umbrella', 'umbrella'], ['Mug', 'mug']]) {
      assert.match(decodeURIComponent(await table.getByRole('img', { name, exact: true }).getAttribute('src')), new RegExp(`/catalog/reward-${asset}\\.png`));
    }
    await table.getByRole('img', { name: 'No matching image for Custom reward', exact: true }).waitFor();
    const slots = await table.locator('[class*="itemImageSlot"]').evaluateAll(elements => elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
    assert.equal(slots.length, 5);
    assert.ok(slots.every(slot => slot.width === 64 && slot.height === 64));
    await page.getByRole('tab', { name: 'Order Stocks', exact: true }).click();
    const options = page.getByRole('combobox');
    assert.deepEqual(await options.locator('option:not([value=""])').allTextContents(), ['Notebook and Pen', 'Desk Calendar', 'Custom reward', 'Umbrella', 'Mug']);
    await page.getByRole('tab', { name: 'Current Inventory', exact: true }).click();
    await screenshot(page, 'manager-reward-images-and-placeholder');
    assert.deepEqual(manager.writes, []);
    assert.deepEqual(manager.errors, []);
    await manager.context.close();
  } finally { await browser.close(); }
});

test('Manager confirmation continues while hidden in Order Stocks and LPG reorder submission and delivery are preserved', { timeout: 60_000 }, async () => {
  const browser = await launch();
  try {
    const store = storeFor();
    const manager = await setup(browser, 'branch-manager', store);
    const actions = [];
    const row = { id: 'reorder-delivery-test', product_id: 'product-11kg', product_name: '11kg LPG Cylinder', requested_qty: 20, status: 'Pending', requested_by_name: 'Test Manager', requested_at: '2026-10-22' };
    await manager.context.route('**/api/inventory/reorder-requests', route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { reorderRequests: [] } });
      assert.deepEqual(route.request().postDataJSON(), { productId: 'product-11kg', requestedQty: 20 });
      actions.push('reorder');
      return route.fulfill({ json: { reorderRequest: row } });
    });
    await manager.context.route('**/api/inventory/reorder-requests/reorder-delivery-test/status', route => {
      assert.deepEqual(route.request().postDataJSON(), { status: 'Delivered' });
      actions.push('delivery');
      store.lpg += 20;
      return route.fulfill({ json: { reorderRequest: { ...row, status: 'Delivered' } } });
    });
    let releaseConfirmation;
    const confirmationGate = new Promise(resolve => { releaseConfirmation = resolve; });
    await manager.context.route('**/api/inventory/stock-checks', async route => {
      assert.equal(route.request().method(), 'POST');
      actions.push('confirm');
      await confirmationGate;
      return route.fulfill({ json: {} });
    });
    const page = manager.page;
    await page.goto(`${baseUrl}/branch-manager/inventory`);
    await page.getByRole('tab', { name: 'Order Stocks', exact: true }).click();
    const reorder = page.getByRole('heading', { name: 'New Reorder Request', exact: true }).locator('..').locator('..');
    await reorder.getByRole('combobox').locator('option[value="product-11kg"]').waitFor({ state: 'attached' });
    await reorder.getByRole('combobox').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    assert.equal(await reorder.getByRole('combobox').inputValue(), 'product-11kg');
    await reorder.getByRole('spinbutton').fill('20');
    await reorder.getByRole('button', { name: 'Submit Request', exact: true }).click();
    await page.getByRole('button', { name: 'Mark Delivered', exact: true }).click();
    await page.getByRole('cell', { name: 'Delivered', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Current Inventory', exact: true }).click();
    await page.getByRole('progressbar', { name: '11kg LPG Cylinder stock capacity', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuetext') === '27 of 40 units');
    await page.getByRole('button', { name: "Confirm today's stock count", exact: true }).click();
    await page.getByRole('button', { name: 'Confirming...', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Order Stocks', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: /Confirming|Confirmed today|Confirm today's/ }).count(), 0);
    await page.getByRole('tab', { name: 'Current Inventory', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Confirming...', exact: true }).isDisabled(), true);
    await page.getByRole('tab', { name: 'Order Stocks', exact: true }).click();
    releaseConfirmation();
    await page.getByText('Stock count confirmed for today.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Confirmed today at/ }).count(), 0);
    await page.getByRole('tab', { name: 'Current Inventory', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: /Confirmed today at/ }).isDisabled(), true);
    assert.deepEqual(actions, ['reorder', 'delivery', 'confirm']);
    assert.deepEqual(manager.errors, []);
    await manager.context.close();
  } finally { await browser.close(); }
});

test('Manager adds reward stock through Manual Stock Intake; Owner sees that stock in the correct branch; LPG intake remains available', { timeout: 90_000 }, async () => {
  const browser = await launch();
  try {
    const store = storeFor();
    const manager = await setup(browser, 'branch-manager', store);
    await manager.page.goto(`${baseUrl}/branch-manager/inventory`);
    await manager.page.getByRole('button', { name: 'Reward Merchandise', exact: true }).click();
    const rewardSection = manager.page.getByRole('tabpanel', { name: 'Current Inventory', exact: true });
    await rewardSection.getByText('Umbrella', { exact: true }).waitFor();
    const intakeCard = manager.page.getByRole('heading', { name: /^(Manual Stock Intake|Record Reward Stock)$/ }).locator('..').locator('..');
    await rewardSection.getByRole('button', { name: 'Record stock for Umbrella', exact: true }).click();
    await intakeCard.getByRole('combobox').selectOption(`reward:${itemA}`);
    await intakeCard.getByRole('spinbutton').fill('5');
    await intakeCard.getByRole('button', { name: 'Record Stock', exact: true }).click();
    await manager.page.getByText('Reward inventory updated.', { exact: true }).waitFor();
    assert.equal(store.quantities[branches[0].id], 8);
    assert.equal(store.quantities[branches[1].id], 20);
    await manager.page.getByRole('button', { name: 'LPG Cylinders', exact: true }).click();
    await intakeCard.getByRole('combobox').selectOption('product-11kg');
    await intakeCard.getByRole('spinbutton').fill('2');
    await intakeCard.getByRole('button', { name: 'Update Inventory', exact: true }).click();
    await manager.page.getByText('Inventory updated.', { exact: true }).waitFor();
    assert.equal(store.lpg, 9);
    await screenshot(manager.page, 'manager-reward-intake');

    const owner = await setup(browser, 'branch-owner', store);
    await owner.page.goto(`${baseUrl}/branch-owner/inventory`);
    await owner.page.getByText('Select an assigned branch to view its inventory.', { exact: true }).waitFor();
    assert.equal(owner.reads.length, 0);
    await selectOwner(owner.page, branches[0].name);
    await owner.page.getByText('9 units', { exact: true }).waitFor();
    await owner.page.getByRole('button', { name: 'Reward Merchandise', exact: true }).click();
    await owner.page.getByText('8 units', { exact: true }).waitFor();
    await owner.page.getByText('In Stock', { exact: true }).waitFor();
    await owner.page.getByText('Household reward · 30 points', { exact: true }).waitFor();
    await owner.page.getByText('Out of Stock', { exact: true }).waitFor();
    assert.equal(await owner.page.getByText('17', { exact: true }).count(), 1, 'Summary includes LPG and real reward units');
    await screenshot(owner.page, 'owner-rewards-alpha');
    await owner.page.setViewportSize({ width: 900, height: 1000 });
    assert.equal(await owner.page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth), false, 'Tablet inventory fits its content canvas');
    await screenshot(owner.page, 'owner-rewards-tablet');
    await owner.page.setViewportSize({ width: 390, height: 844 });
    await owner.page.getByRole('button', { name: 'Minimize sidebar', exact: true }).click();
    await owner.page.getByRole('button', { name: 'Expand sidebar', exact: true }).waitFor();
    await owner.page.waitForFunction(() => { const main = document.querySelector('main'); return main.scrollWidth <= main.clientWidth; });
    assert.equal(await owner.page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth), false, 'Mobile inventory has no horizontal overflow');
    const title = await owner.page.getByRole('heading', { name: 'Inventory', exact: true }).boundingBox();
    const badge = await owner.page.getByRole('button', { name: branches[0].name, exact: true }).boundingBox();
    assert.ok(title.y + title.height <= badge.y, 'Mobile title and branch control do not overlap');
    await screenshot(owner.page, 'owner-rewards-mobile');
    await owner.page.getByText('Mug', { exact: true }).scrollIntoViewIfNeeded();
    await screenshot(owner.page, 'owner-rewards-mobile-rows');
    await owner.page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await owner.page.setViewportSize({ width: 1440, height: 1100 });
    let release;
    store.delay = new Promise(resolve => { release = resolve; });
    await selectOwner(owner.page, branches[1].name);
    await owner.page.getByText('Loading stock levels…', { exact: true }).waitFor();
    assert.equal(await owner.page.getByText('8 units', { exact: true }).count(), 0);
    release();
    await owner.page.getByText('20 units', { exact: true }).waitFor();
    await screenshot(owner.page, 'owner-rewards-beta');
    await selectOwner(owner.page, branches[0].name);
    await owner.page.getByText('8 units', { exact: true }).waitFor();
    let releaseLate;
    store.delay = new Promise(resolve => { releaseLate = resolve; });
    await selectOwner(owner.page, branches[1].name);
    await owner.page.getByText('Loading stock levels…', { exact: true }).waitFor();
    await selectOwner(owner.page, branches[0].name);
    releaseLate();
    await owner.page.getByText('8 units', { exact: true }).waitFor();
    assert.equal(await owner.page.getByText('20 units', { exact: true }).count(), 0, 'Late responses cannot overwrite the selected branch');
    assert.deepEqual(owner.writes, []);
    assert.equal(await owner.page.getByRole('button', { name: /Update Inventory|Add item|Adjust stock|Delete|Submit Request/i }).count(), 0);
    assert.deepEqual(manager.errors, []);
    assert.deepEqual(owner.errors, []);
    await manager.context.close();
    await owner.context.close();
  } finally { await browser.close(); }
});

test('Reward reads fail closed, retry and show empty catalog without hiding LPG inventory', { timeout: 90_000 }, async () => {
  const browser = await launch();
  try {
    const store = storeFor();
    store.mode = 'error';
    const { context, page, writes } = await setup(browser, 'branch-owner', store);
    await page.goto(`${baseUrl}/branch-owner/inventory`);
    await page.getByText('Select an assigned branch to view its inventory.', { exact: true }).waitFor();
    await selectOwner(page, branches[0].name);
    await page.getByText('7 units', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reward Merchandise', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Reward stock unavailable.' }).waitFor();
    store.mode = 'wrong-branch';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'did not match the selected branch' }).waitFor();
    assert.equal(await page.getByRole('progressbar').count(), 0);
    store.mode = 'empty';
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByText('No active reward merchandise in this branch’s catalog.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'LPG Cylinders', exact: true }).click();
    await page.getByText('7 units', { exact: true }).waitFor();
    assert.deepEqual(writes, []);
    await context.close();
  } finally { await browser.close(); }
});
