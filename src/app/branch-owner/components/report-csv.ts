type ReportType = 'csat' | 'sla';
type CsvValue = string | number | null;

const CSAT_COLUMNS = [
  'response_id', 'service_request_id', 'submitted_at', 'branch',
  'rating', 'review_comment', 'incident_raised', 'customer_name',
] as const;
const SLA_COLUMNS = [
  'service_request_id', 'order_source', 'requested_at', 'dispatched_at',
  'in_transit_at', 'delivered_at', 'request_to_dispatch_result',
  'dispatch_to_transit_result', 'transit_to_delivery_result', 'overall_sla_result', 'branch',
] as const;
const SLA_RESULTS = ['Within SLA', 'Breached', 'Not evaluated'];

function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Invalid text in CSV records.');
  return value;
}

function timestamp(value: unknown): string {
  if (value == null || value === '') return '';
  const date = new Date(text(value));
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date in CSV records.');
  // Report date boundaries are in Manila; exports use the same time zone,
  // regardless of the timezone of the staff member's browser.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

function rating(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error('Invalid rating in CSV records.');
  }
  return value;
}

function incident(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'boolean') throw new Error('Invalid incident flag in CSV records.');
  return value ? 'Yes' : 'No';
}

function result(value: unknown): string {
  const status = text(value);
  if (status !== '' && !SLA_RESULTS.includes(status)) throw new Error('Invalid SLA result in CSV records.');
  return status;
}

function csvCell(value: CsvValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  let safe = value.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\r\n|\r|\n/g, '\r\n');
  // Check leading whitespace too, so a tab cannot conceal a formula prefix.
  if (/^\s*[=+\-@]/.test(safe)) safe = `'${safe}`;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildReportCsv(
  type: ReportType,
  records: unknown,
  branch: { id: string; name: string },
  period: { from: string; to: string },
): { content: string; filename: string } {
  // An older/malformed API response must not silently produce an empty export.
  if (!Array.isArray(records)) throw new Error('CSV records are unavailable. Please reload the report and try again.');
  const rows: CsvValue[][] = [type === 'csat' ? [...CSAT_COLUMNS] : [...SLA_COLUMNS]];
  for (const value of records) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid CSV record.');
    }
    const row = value as Record<string, unknown>;
    if (row.branch_id !== branch.id) throw new Error('CSV record is outside the selected branch.');
    if (!text(type === 'csat' ? row.response_id : row.service_request_id)) throw new Error('CSV record has no identifier.');
    if (type === 'csat') {
      rows.push([
        text(row.response_id), text(row.service_request_id), timestamp(row.submitted_at), branch.name,
        rating(row.rating), text(row.review_comment), incident(row.incident_raised), text(row.customer_name),
      ]);
    } else {
      const source = text(row.order_source);
      if (source !== '' && source !== 'Mobile App' && source !== 'Walk-in/Phone') throw new Error('Invalid order source in CSV records.');
      rows.push([
        text(row.service_request_id), source, timestamp(row.requested_at), timestamp(row.dispatched_at),
        timestamp(row.in_transit_at), timestamp(row.delivered_at), result(row.request_to_dispatch_result),
        result(row.dispatch_to_transit_result), result(row.transit_to_delivery_result), result(row.overall_sla_result), branch.name,
      ]);
    }
  }
  const branchSlug = branch.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'branch';
  const reportSlug = type === 'csat' ? 'customer-satisfaction' : 'performance-metrics';
  return {
    content: `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`,
    filename: `${reportSlug}_${branchSlug}_${period.from}_to_${period.to}.csv`,
  };
}
