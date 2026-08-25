'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  MapPin,
  MessageSquareText,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  TriangleAlert,
  Truck,
} from 'lucide-react';
import { apiErrorMessage, apiFetch } from '../../lib/api';
import { useAccount } from '../../contexts/AccountContext';
import { useBranch } from '../contexts/BranchContext';
import { Header } from './Header';

type ReportType = 'csat' | 'sla';
type ExportFormat = 'pdf' | 'csv';
type SegmentKey =
  | 'request_to_dispatch'
  | 'dispatch_to_in_transit'
  | 'in_transit_to_delivery';
type OrderSource = 'Mobile App' | 'Walk-in/Phone';

interface CsatReport {
  averageStars: number | null;
  totalResponses: number;
  deliveredRequests: number;
  responseRate: number | null;
  incidentsRaised: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

interface SlaMetric {
  evaluatedRequests: number;
  compliantRequests: number;
  breachedRequests: number;
  complianceRate: number | null;
}

interface SlaSourceMetric extends SlaMetric {
  totalRequests: number;
  notEvaluated: number;
}

interface SlaReport {
  totalServiceRequests: number;
  evaluatedRequests: number;
  withinSla: number;
  breaches: number;
  notEvaluated: number;
  overallComplianceRate: number | null;
  segments: Record<SegmentKey, SlaMetric>;
  orderSources: Record<OrderSource, SlaSourceMetric>;
}

type LoadedReport =
  | { type: 'csat'; data: CsatReport }
  | { type: 'sla'; data: SlaReport };

interface PreviewSelection {
  type: ReportType;
  month: string;
}

const DEFAULT_MONTH = '2026-05';
const REPORT_SEGMENTS: Array<{ key: SegmentKey; label: string }> = [
  { key: 'request_to_dispatch', label: 'Request → Dispatch' },
  { key: 'dispatch_to_in_transit', label: 'Dispatch → In Transit' },
  { key: 'in_transit_to_delivery', label: 'In Transit → Delivery' },
];
const ORDER_SOURCES: OrderSource[] = ['Mobile App', 'Walk-in/Phone'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function parseCsatReport(value: unknown): CsatReport | null {
  if (!isRecord(value) || !isRecord(value.rating_distribution)) return null;
  const distribution = value.rating_distribution;
  if (![1, 2, 3, 4, 5].every((star) => isFiniteNumber(distribution[String(star)]))) {
    return null;
  }
  if (
    !isNullableNumber(value.average_stars) ||
    !isFiniteNumber(value.total_responses) ||
    !isFiniteNumber(value.delivered_requests) ||
    !isNullableNumber(value.response_rate) ||
    !isFiniteNumber(value.incidents_raised)
  ) {
    return null;
  }

  return {
    averageStars: value.average_stars,
    totalResponses: value.total_responses,
    deliveredRequests: value.delivered_requests,
    responseRate: value.response_rate,
    incidentsRaised: value.incidents_raised,
    ratingDistribution: {
      1: distribution['1'] as number,
      2: distribution['2'] as number,
      3: distribution['3'] as number,
      4: distribution['4'] as number,
      5: distribution['5'] as number,
    },
  };
}

function parseSlaMetric(value: unknown): SlaMetric | null {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.evaluated_requests) ||
    !isFiniteNumber(value.compliant_requests) ||
    !isFiniteNumber(value.breached_requests) ||
    !isNullableNumber(value.compliance_rate)
  ) {
    return null;
  }
  return {
    evaluatedRequests: value.evaluated_requests,
    compliantRequests: value.compliant_requests,
    breachedRequests: value.breached_requests,
    complianceRate: value.compliance_rate,
  };
}

function parseSlaReport(value: unknown): SlaReport | null {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.total_service_requests) ||
    !isFiniteNumber(value.evaluated_requests) ||
    !isFiniteNumber(value.within_sla) ||
    !isFiniteNumber(value.breaches) ||
    !isFiniteNumber(value.not_evaluated) ||
    !isNullableNumber(value.overall_compliance_rate) ||
    !Array.isArray(value.segments) ||
    !Array.isArray(value.order_sources)
  ) {
    return null;
  }

  const segmentMap: Partial<Record<SegmentKey, SlaMetric>> = {};
  for (const item of value.segments) {
    if (!isRecord(item) || typeof item.segment !== 'string') continue;
    if (!REPORT_SEGMENTS.some(({ key }) => key === item.segment)) continue;
    const metric = parseSlaMetric(item);
    if (metric) segmentMap[item.segment as SegmentKey] = metric;
  }
  if (!REPORT_SEGMENTS.every(({ key }) => segmentMap[key])) return null;

  const sourceMap: Partial<Record<OrderSource, SlaSourceMetric>> = {};
  for (const item of value.order_sources) {
    if (!isRecord(item) || !ORDER_SOURCES.includes(item.source as OrderSource)) continue;
    const metric = parseSlaMetric(item);
    if (
      !metric ||
      !isFiniteNumber(item.total_requests) ||
      !isFiniteNumber(item.not_evaluated)
    ) {
      continue;
    }
    sourceMap[item.source as OrderSource] = {
      ...metric,
      totalRequests: item.total_requests,
      notEvaluated: item.not_evaluated,
    };
  }
  if (!ORDER_SOURCES.every((source) => sourceMap[source])) return null;

  return {
    totalServiceRequests: value.total_service_requests,
    evaluatedRequests: value.evaluated_requests,
    withinSla: value.within_sla,
    breaches: value.breaches,
    notEvaluated: value.not_evaluated,
    overallComplianceRate: value.overall_compliance_rate,
    segments: segmentMap as Record<SegmentKey, SlaMetric>,
    orderSources: sourceMap as Record<OrderSource, SlaSourceMetric>,
  };
}

function currentMonthValue(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '9999';
  const month = parts.find((part) => part.type === 'month')?.value ?? '12';
  return `${year}-${month}`;
}

function monthDetails(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
    new Date(year, month - 1, 1),
  );
  return {
    from: `${monthValue}-01`,
    to: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
    label: `${monthName} 1–${lastDay}, ${year}`,
  };
}

function displayPercent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(report: LoadedReport, branch: string, period: string): void {
  const rows: Array<Array<string | number | null>> = [
    ['Branch', branch],
    ['Reporting period', period],
    [],
  ];

  if (report.type === 'csat') {
    const data = report.data;
    rows.push(
      ['CSAT Summary'],
      ['Average rating', data.averageStars],
      ['Responses', data.totalResponses],
      ['Delivered Service Requests', data.deliveredRequests],
      ['Response rate', data.responseRate],
      ['Incidents raised', data.incidentsRaised],
      [],
      ['Rating', 'Responses'],
      ...([5, 4, 3, 2, 1] as const).map((star) => [star, data.ratingDistribution[star]]),
    );
  } else {
    const data = report.data;
    rows.push(
      ['SLA Compliance'],
      ['Overall compliance', data.overallComplianceRate],
      ['Service Requests', data.totalServiceRequests],
      ['Evaluated', data.evaluatedRequests],
      ['Within SLA', data.withinSla],
      ['SLA breaches', data.breaches],
      ['Not evaluated', data.notEvaluated],
      [],
      ['SLA segment', 'Compliance rate', 'Evaluated', 'Within SLA', 'Breached'],
      ...REPORT_SEGMENTS.map(({ key, label }) => {
        const metric = data.segments[key];
        return [
          label,
          metric.complianceRate,
          metric.evaluatedRequests,
          metric.compliantRequests,
          metric.breachedRequests,
        ];
      }),
      [],
      ['Order source', 'Compliance rate', 'Total', 'Evaluated', 'Not evaluated'],
      ...ORDER_SOURCES.map((source) => {
        const metric = data.orderSources[source];
        return [
          source,
          metric.complianceRate,
          metric.totalRequests,
          metric.evaluatedRequests,
          metric.notEvaluated,
        ];
      }),
    );
  }

  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  const branchSlug = branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const periodSlug = period.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  anchor.href = url;
  anchor.download = `${branchSlug || 'branch'}-${report.type}-${periodSlug}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RadioMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? 'border-[#087fc3] bg-[#087fc3]' : 'border-gray-300 bg-white'
      }`}
      aria-hidden="true"
    >
      {selected && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon,
  valueClassName = 'text-[#086fb4]',
  note,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  valueClassName?: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-600">{label}</p>
          <p className={`mt-3 text-[30px] font-semibold leading-none tracking-[-0.03em] ${valueClassName}`}>
            {value}
          </p>
          {note && <p className="mt-2 text-[11px] text-gray-500">{note}</p>}
        </div>
        {icon}
      </div>
    </div>
  );
}

function CsatPreview({ report }: { report: CsatReport }) {
  const maxCount = Math.max(...Object.values(report.ratingDistribution), 1);
  const responseRate = report.responseRate ?? 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Average rating"
          value={report.averageStars === null ? '—' : `${report.averageStars} / 5`}
          icon={<Star className="h-6 w-6 fill-[#087fc3] text-[#087fc3]" />}
        />
        <MetricCard
          label="Responses"
          value={String(report.totalResponses)}
          note={`${report.deliveredRequests} delivered Service Requests`}
          icon={<MessageSquareText className="h-6 w-6 text-[#087fc3]" />}
        />
        <MetricCard
          label="Response rate"
          value={displayPercent(report.responseRate)}
          valueClassName="text-emerald-600"
          icon={<TrendingUp className="h-6 w-6 text-emerald-600" />}
        />
        <MetricCard
          label="Incidents raised"
          value={String(report.incidentsRaised)}
          valueClassName="text-red-600"
          icon={<TriangleAlert className="h-6 w-6 text-red-500" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.8fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Rating distribution</h3>
          <div className="mt-5 space-y-4">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = report.ratingDistribution[star];
              const percentage = report.totalResponses
                ? Math.round((count / report.totalResponses) * 100)
                : 0;
              return (
                <div key={star} className="grid grid-cols-[52px_minmax(0,1fr)_70px] items-center gap-3">
                  <span className="text-xs font-medium text-gray-600">{star} {star === 1 ? 'star' : 'stars'}</span>
                  <div className="h-3 overflow-hidden rounded-sm bg-gray-100">
                    <div
                      className="h-full rounded-sm bg-[#1677bd]"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-right text-xs text-gray-600">{count} ({percentage}%)</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Response overview</h3>
          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-center xl:flex-col 2xl:flex-row">
            <div
              className="relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#1677bd 0 ${responseRate}%, #e5e7eb ${responseRate}% 100%)`,
              }}
              aria-label={`${displayPercent(report.responseRate)} response rate`}
            >
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-2xl font-semibold text-gray-900">{report.totalResponses}</span>
                <span className="text-[11px] text-gray-500">responses</span>
              </div>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#1677bd]" />
                <div><p className="font-medium text-gray-800">Responded</p><p className="text-gray-500">{report.totalResponses} ({displayPercent(report.responseRate)})</p></div>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gray-200" />
                <div><p className="font-medium text-gray-800">No response</p><p className="text-gray-500">{Math.max(report.deliveredRequests - report.totalResponses, 0)}</p></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function ComplianceBar({ metric }: { metric: SlaMetric }) {
  if (metric.complianceRate === null) {
    return (
      <div className="h-3 overflow-hidden rounded-sm bg-gray-100" aria-label="Not evaluated">
        <div className="h-full w-full bg-[repeating-linear-gradient(135deg,#e5e7eb_0,#e5e7eb_5px,#f3f4f6_5px,#f3f4f6_10px)]" />
      </div>
    );
  }
  return (
    <div className="flex h-3 overflow-hidden rounded-sm bg-gray-100" aria-label={`${metric.complianceRate}% compliant`}>
      <div className="h-full bg-emerald-500" style={{ width: `${metric.complianceRate}%` }} />
      <div className="h-full flex-1 bg-red-500" />
    </div>
  );
}

function SlaPreview({ report }: { report: SlaReport }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Overall compliance"
          value={displayPercent(report.overallComplianceRate)}
          valueClassName="text-emerald-600"
          note={`${report.evaluatedRequests} evaluated`}
          icon={<ShieldCheck className="h-6 w-6 text-emerald-600" />}
        />
        <MetricCard
          label="Service Requests"
          value={String(report.totalServiceRequests)}
          icon={<ClipboardList className="h-6 w-6 text-[#087fc3]" />}
        />
        <MetricCard
          label="Within SLA"
          value={String(report.withinSla)}
          valueClassName="text-emerald-600"
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
        />
        <MetricCard
          label="SLA breaches"
          value={String(report.breaches)}
          valueClassName="text-red-600"
          note={report.notEvaluated ? `${report.notEvaluated} not evaluated` : undefined}
          icon={<TriangleAlert className="h-6 w-6 text-red-500" />}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.9fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Compliance by SLA segment</h3>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-2">
            {[
              { label: 'Requested', icon: <ClipboardList className="h-5 w-5" /> },
              { label: 'Dispatched', icon: <Truck className="h-5 w-5" /> },
              { label: 'In Transit', icon: <MapPin className="h-5 w-5" /> },
              { label: 'Delivered', icon: <CheckCircle2 className="h-5 w-5" /> },
            ].map((step, index) => (
              <div key={step.label} className="contents">
                <div className="flex min-w-0 flex-col items-center text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#087fc3]">{step.icon}</span>
                  <span className="mt-2 text-[11px] font-medium text-gray-600">{step.label}</span>
                </div>
                {index < 3 && <span className="mt-4 text-gray-400">→</span>}
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-5">
            {REPORT_SEGMENTS.map(({ key, label }) => {
              const metric = report.segments[key];
              return (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                    <span className="text-xs font-semibold text-gray-800">{displayPercent(metric.complianceRate)}</span>
                  </div>
                  <ComplianceBar metric={metric} />
                  <p className="mt-1.5 text-[10px] text-gray-500">
                    {metric.evaluatedRequests
                      ? `${metric.compliantRequests} within SLA · ${metric.breachedRequests} breached`
                      : 'Not evaluated — timestamp or active threshold unavailable'}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">Compliance by order source</h3>
          <div className="mt-7 space-y-9">
            {ORDER_SOURCES.map((source) => {
              const metric = report.orderSources[source];
              const Icon = source === 'Mobile App' ? Smartphone : Phone;
              return (
                <div key={source}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#087fc3]" />
                      <span className="text-xs font-medium text-gray-800">{source}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold leading-none text-emerald-600">{displayPercent(metric.complianceRate)}</p>
                      <p className="mt-1 text-[10px] text-gray-500">{metric.totalRequests} requests</p>
                    </div>
                  </div>
                  <ComplianceBar metric={metric} />
                  {metric.notEvaluated > 0 && <p className="mt-1.5 text-[10px] text-gray-500">{metric.notEvaluated} not evaluated</p>}
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex flex-wrap gap-4 border-t border-gray-100 pt-4 text-[11px] text-gray-600">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Within SLA</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Breached</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-200" />Not evaluated</span>
          </div>
        </section>
      </div>
    </>
  );
}

export function ReportGeneration() {
  const account = useAccount();
  const {
    selectedBranch,
    availableBranches,
    assignedBranches,
    assignedBranchesLoading,
    assignedBranchesError,
  } = useBranch();
  const [draftType, setDraftType] = useState<ReportType>('csat');
  const [draftMonth, setDraftMonth] = useState(DEFAULT_MONTH);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [preview, setPreview] = useState<PreviewSelection>({ type: 'csat', month: DEFAULT_MONTH });
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedReport, setLoadedReport] = useState<LoadedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const selectedBranchId = useMemo(
    () => assignedBranches?.find((branch) => branch.name === selectedBranch)?.id,
    [assignedBranches, selectedBranch],
  );
  const needsResolvedBranch = availableBranches.length > 1;
  const previewPeriod = useMemo(() => monthDetails(preview.month), [preview.month]);
  const maxMonth = currentMonthValue();
  const accountName = account.displayName.split(' — ')[0].split(' - ')[0];

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (assignedBranchesLoading || (needsResolvedBranch && !selectedBranchId)) {
      if (!assignedBranchesLoading && assignedBranchesError) {
        setLoading(false);
        setLoadedReport(null);
        setError(assignedBranchesError);
      }
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    const loadReport = async () => {
      setLoading(true);
      setError(null);
      setLoadedReport(null);
      const params = new URLSearchParams({ from: previewPeriod.from, to: previewPeriod.to });
      if (selectedBranchId) params.set('branchId', selectedBranchId);
      const endpoint = preview.type === 'csat'
        ? '/csat/reports/summary'
        : '/service-requests/reports/sla';

      try {
        const response = await apiFetch(`${endpoint}?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setError(apiErrorMessage(payload, 'The report could not be loaded.'));
          return;
        }
        const reportValue = isRecord(payload) ? payload.report : null;
        const parsed = preview.type === 'csat'
          ? parseCsatReport(reportValue)
          : parseSlaReport(reportValue);
        if (!parsed) {
          setError('The server returned an invalid report response.');
          return;
        }
        setLoadedReport(
          preview.type === 'csat'
            ? { type: 'csat', data: parsed as CsatReport }
            : { type: 'sla', data: parsed as SlaReport },
        );
        setGeneratedAt(new Date());
      } catch {
        setError(
          controller.signal.aborted
            ? 'The report request timed out. Try again.'
            : 'The Reports service is unavailable. Check the API connection and retry.',
        );
      } finally {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    };

    void loadReport();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    assignedBranchesError,
    assignedBranchesLoading,
    needsResolvedBranch,
    preview.month,
    preview.type,
    previewPeriod.from,
    previewPeriod.to,
    refreshKey,
    selectedBranchId,
  ]);

  const updatePreview = () => {
    const next = { type: draftType, month: draftMonth };
    if (preview.type === next.type && preview.month === next.month) {
      setRefreshKey((value) => value + 1);
    } else {
      setPreview(next);
    }
  };

  const clearSetup = () => {
    setDraftType('csat');
    setDraftMonth(DEFAULT_MONTH);
    setExportFormat('pdf');
    setPreview({ type: 'csat', month: DEFAULT_MONTH });
  };

  const handleExport = () => {
    if (!loadedReport) return;
    if (exportFormat === 'csv') {
      downloadCsv(loadedReport, selectedBranch, previewPeriod.label);
      notify('CSV report downloaded.');
      return;
    }
    notify('Opening the print dialog. Choose “Save as PDF” to export.');
    window.setTimeout(() => window.print(), 120);
  };

  const navigateToDetail = () => {
    window.dispatchEvent(
      new CustomEvent('navigate', {
        detail: preview.type === 'csat' ? 'csat' : 'order-analytics',
      }),
    );
  };

  const reportTitle = preview.type === 'csat' ? 'CSAT Summary' : 'SLA Compliance';
  const exportLabel = `Export ${exportFormat.toUpperCase()}`;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div style={{ position: 'static' }}>
        <Header title="Reports" />
      </div>

      <main className="px-5 pb-8 pt-5 sm:px-8">
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="flex h-fit flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-5 pb-4 pt-5">
              <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">Report setup</h2>
            </div>

            <div className="space-y-6 px-5 pb-5">
              <fieldset>
                <legend className="mb-3 text-xs font-semibold text-gray-800">Report type</legend>
                <div className="space-y-2.5">
                  {([
                    ['csat', 'CSAT Summary'],
                    ['sla', 'SLA Compliance'],
                  ] as const).map(([value, label]) => {
                    const selected = draftType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDraftType(value)}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3.5 text-left text-sm transition-colors ${
                          selected
                            ? 'border-[#087fc3] bg-blue-50/70 font-semibold text-gray-900 ring-1 ring-[#087fc3]'
                            : 'border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50'
                        }`}
                        aria-pressed={selected}
                      >
                        <RadioMark selected={selected} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor="report-month" className="mb-3 block text-xs font-semibold text-gray-800">
                  Reporting period
                </label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    id="report-month"
                    type="month"
                    value={draftMonth}
                    max={maxMonth}
                    onChange={(event) => setDraftMonth(event.target.value)}
                    className="h-12 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm font-medium text-gray-800 outline-none transition focus:border-[#087fc3] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <fieldset>
                <legend className="mb-3 text-xs font-semibold text-gray-800">Export format</legend>
                <div className="flex gap-6">
                  {(['pdf', 'csv'] as const).map((format) => (
                    <label key={format} className="flex cursor-pointer items-center gap-2 text-sm font-medium uppercase text-gray-700">
                      <input
                        type="radio"
                        name="branch-owner-export-format"
                        value={format}
                        checked={exportFormat === format}
                        onChange={() => setExportFormat(format)}
                        className="h-4 w-4 accent-[#087fc3]"
                      />
                      {format}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-auto border-t border-gray-100 px-5 py-5">
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <button
                  type="button"
                  onClick={clearSetup}
                  className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={updatePreview}
                  disabled={!draftMonth || draftMonth > maxMonth}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#087fc3] px-4 text-sm font-medium text-white transition hover:bg-[#066da8] disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <RefreshCw className="h-4 w-4" />
                  Update preview
                </button>
              </div>
              <div className="mt-4 flex items-start gap-2 text-[11px] leading-4 text-gray-500">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#087fc3]" />
                <span>Data is restricted by the API to {selectedBranch}.</span>
              </div>
            </div>
          </aside>

          <section
            className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            data-report-preview
          >
            <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="mt-0.5 h-12 w-1 shrink-0 rounded-full bg-[#087fc3]" />
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-gray-900">{reportTitle}</h2>
                  <p className="mt-1 text-xs text-gray-500">{previewPeriod.label} · {selectedBranch}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2" data-report-actions>
                <button
                  type="button"
                  onClick={navigateToDetail}
                  className="px-2 py-2 text-xs font-medium text-[#087fc3] hover:underline"
                >
                  {preview.type === 'csat' ? 'View ratings and reviews' : 'View order analytics'}
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={!loadedReport || loading}
                  className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exportLabel}
                </button>
              </div>
            </div>

            <div className="min-h-[470px] bg-[#fbfcfd] p-4 sm:p-5">
              {loading && (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#087fc3]" />
                  <p className="mt-4 text-sm font-medium text-gray-700">Loading branch report…</p>
                  <p className="mt-1 text-xs text-gray-500">The rest of the dashboard remains available.</p>
                </div>
              )}

              {!loading && error && (
                <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <AlertCircle className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">Report unavailable</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">{error}</p>
                  <button
                    type="button"
                    onClick={() => setRefreshKey((value) => value + 1)}
                    className="mt-5 flex h-10 items-center gap-2 rounded-lg bg-[#087fc3] px-4 text-sm font-medium text-white hover:bg-[#066da8]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && loadedReport?.type === 'csat' && <CsatPreview report={loadedReport.data} />}
              {!loading && !error && loadedReport?.type === 'sla' && <SlaPreview report={loadedReport.data} />}
            </div>

            <footer className="flex flex-col gap-2 border-t border-gray-100 px-5 py-3 text-[11px] text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                {generatedAt
                  ? `Generated ${generatedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })} · ${accountName}`
                  : 'Waiting for report data'}
              </span>
              <span className="flex items-center gap-2 font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Branch-scoped data
              </span>
            </footer>
          </section>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] flex max-w-sm items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl" role="status">
          <FileText className="h-4 w-4 shrink-0 text-sky-300" />
          {toast}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          [data-report-preview],
          [data-report-preview] * {
            visibility: visible !important;
          }
          [data-report-preview] {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          [data-report-actions] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
