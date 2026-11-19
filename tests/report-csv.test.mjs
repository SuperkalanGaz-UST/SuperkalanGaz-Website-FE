import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportCsv } from '../src/app/branch-owner/components/report-csv.ts';

const branch = { id: 'branch-1', name: 'Amadeo Cavite' };
const period = { from: '2026-11-01', to: '2026-11-30' };
const response = { response_id: 'r-1', service_request_id: 'sr-1', branch_id: branch.id,
  submitted_at: '2026-11-19T10:29:00Z', rating: 5, review_comment: null,
  incident_raised: false, customer_name: 'Peña' };
const csatHeader = 'response_id,service_request_id,submitted_at,branch,rating,review_comment,incident_raised,customer_name';
const slaHeader = 'service_request_id,order_source,requested_at,dispatched_at,in_transit_at,delivered_at,request_to_dispatch_result,dispatch_to_transit_result,transit_to_delivery_result,overall_sla_result,branch';

test('CSAT exports record rows with a UTF-8 BOM, CRLF, ISO Manila dates, Unicode and no summaries', () => {
  const csv = buildReportCsv('csat', [response], branch, period);
  assert.equal(csv.filename, 'customer-satisfaction_amadeo-cavite_2026-11-01_to_2026-11-30.csv');
  assert.equal(csv.content, `\uFEFF${csatHeader}\r\nr-1,sr-1,2026-11-19 18:29,Amadeo Cavite,5,,No,Peña\r\n`);
  assert.deepEqual([...Buffer.from(csv.content).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(Buffer.from(csv.content).toString('utf8'), csv.content);
  assert.doesNotMatch(csv.content, /(?<!\r)\n|\r(?!\n)|average|response_rate|compliance_pct/i);
});

test('quotes commas, quotes and embedded line breaks, normalizes dashes and preserves missing ratings', () => {
  const csv = buildReportCsv('csat', [{ ...response, rating: null, customer_name: 'Peña, "Althea"',
    review_comment: '1–30, "good"\nNext\rLast\r\nDone', incident_raised: true }], branch, period);
  assert.equal(csv.content, `\uFEFF${csatHeader}\r\nr-1,sr-1,2026-11-19 18:29,Amadeo Cavite,,"1-30, ""good""\r\nNext\r\nLast\r\nDone",Yes,"Peña, ""Althea"""\r\n`);
});

test('neutralizes spreadsheet formulas in every text cell, including prefixes concealed by whitespace', () => {
  for (const dangerous of ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', '\t=1+1', '  +1', '−2+3']) {
    const csv = buildReportCsv('csat', [{ ...response, review_comment: dangerous }], branch, period);
    assert.ok(csv.content.includes(`5,'${dangerous.replace('−', '-')},No`));
  }
  const csv = buildReportCsv('csat', [{ ...response, response_id: '=response',
    service_request_id: '+request', customer_name: '@customer' }], { ...branch, name: '-branch' }, period);
  assert.ok(csv.content.includes("'=response,'+request,2026-11-19 18:29,'-branch,5,,No,'@customer"));
});

test('performance exports exactly one row per request with timestamps, evaluated results and empty missing values', () => {
  const csv = buildReportCsv('sla', [{ service_request_id: 'sr-1', branch_id: branch.id, order_source: 'Walk-in/Phone',
    requested_at: '2026-10-31T16:00:00Z', dispatched_at: null, in_transit_at: null,
    delivered_at: '2026-11-01T01:02:00Z', request_to_dispatch_result: 'Not evaluated',
    dispatch_to_transit_result: 'Not evaluated', transit_to_delivery_result: 'Not evaluated', overall_sla_result: 'Not evaluated' },
  { service_request_id: 'sr-2', branch_id: branch.id, order_source: 'Mobile App',
    request_to_dispatch_result: 'Within SLA', dispatch_to_transit_result: 'Breached',
    transit_to_delivery_result: 'Within SLA', overall_sla_result: 'Breached' }], branch, period);
  assert.equal(csv.filename, 'performance-metrics_amadeo-cavite_2026-11-01_to_2026-11-30.csv');
  assert.equal(csv.content, `\uFEFF${slaHeader}\r\nsr-1,Walk-in/Phone,2026-11-01 00:00,,,2026-11-01 09:02,Not evaluated,Not evaluated,Not evaluated,Not evaluated,Amadeo Cavite\r\nsr-2,Mobile App,,,,,Within SLA,Breached,Within SLA,Breached,Amadeo Cavite\r\n`);
});

test('empty periods export only the header, and multi-month filenames use the selected full range', () => {
  for (const type of ['csat', 'sla']) {
    const csv = buildReportCsv(type, [], branch, { from: '2026-06-01', to: '2026-11-30' });
    assert.equal(csv.content, `\uFEFF${type === 'csat' ? csatHeader : slaHeader}\r\n`);
    assert.ok(csv.filename.endsWith('_2026-06-01_to_2026-11-30.csv'));
  }
});

test('fails closed for unavailable records, invalid data and records outside the selected branch', () => {
  assert.throws(() => buildReportCsv('csat', undefined, branch, period), /unavailable/);
  assert.throws(() => buildReportCsv('csat', [{ ...response, branch_id: 'other' }], branch, period), /outside/);
  assert.throws(() => buildReportCsv('csat', [{ ...response, rating: 0 }], branch, period), /rating/);
  assert.throws(() => buildReportCsv('csat', [{ ...response, submitted_at: 'invalid' }], branch, period), /date/);
  assert.throws(() => buildReportCsv('sla', [{ ...response, overall_sla_result: 'Made up' }], branch, period), /SLA result/);
});
