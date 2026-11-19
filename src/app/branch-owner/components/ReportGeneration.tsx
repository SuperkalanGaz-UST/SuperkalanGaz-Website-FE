'use client';

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
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
import { fetchJson } from '../../lib/api';
import { useAccount } from '../../contexts/AccountContext';
import { useBranch } from '../contexts/BranchContext';
import { Header } from './Header';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import styles from './ReportGeneration.module.css';
import { buildReportCsv } from './report-csv';

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

function downloadCsv(content: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
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
          <p data-metric-label className="truncate text-xs font-medium text-gray-600">{label}</p>
          <p data-metric-value className={`mt-3 text-[30px] font-semibold leading-none tracking-[-0.03em] ${valueClassName}`}>
            {value}
          </p>
          {note && <p data-metric-note className="mt-2 text-[11px] text-gray-500">{note}</p>}
        </div>
        {icon}
      </div>
    </div>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  return (
    <span className={styles.ratingStars} role="img" aria-label={rating === null ? 'No ratings yet' : `${rating} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map(index => (
        <span key={index} className={styles.ratingStar} aria-hidden="true">
          <Star className={styles.starTrack} />
          <span className={styles.starFill} style={{ width: `${Math.max(0, Math.min(1, (rating ?? 0) - index)) * 100}%` }}><Star /></span>
        </span>
      ))}
    </span>
  );
}

function ResponseRateNote({ responses, delivered }: { responses: number; delivered: number }) {
  const fullText = delivered === 0
    ? 'No delivered orders'
    : `${responses} of ${delivered} delivered ${delivered === 1 ? 'order' : 'orders'}`;
  const shortText = `${responses} of ${delivered} delivered`;
  const noteRef = useRef<HTMLParagraphElement>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const note = noteRef.current;
    const context = document.createElement('canvas').getContext('2d');
    if (!note || !context) return;
    const fitText = () => {
      const font = getComputedStyle(note);
      context.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
      setCompact(delivered !== 0 && context.measureText(fullText).width > note.clientWidth);
    };
    fitText();
    // Recheck the same wording when cards resize or print typography is applied.
    const observer = new ResizeObserver(fitText);
    observer.observe(note);
    window.addEventListener('beforeprint', fitText);
    window.addEventListener('afterprint', fitText);
    document.fonts.addEventListener('loadingdone', fitText);
    return () => {
      observer.disconnect();
      window.removeEventListener('beforeprint', fitText);
      window.removeEventListener('afterprint', fitText);
      document.fonts.removeEventListener('loadingdone', fitText);
    };
  }, [delivered, fullText]);

  return <p ref={noteRef} className={styles.statNote}>{compact ? shortText : fullText}</p>;
}

function CsatPreview({ report }: { report: CsatReport }) {
  const responseRate = report.responseRate ?? 0;
  return (
    <div data-csat-screen>
      <div className={styles.csatStats}>
        <div className={styles.csatStat}>
          <div className={styles.statLabel}>Average rating <Star className={styles.averageStar} aria-hidden="true" /></div>
          <p className={styles.statNumber}>{report.averageStars === null ? '—' : report.averageStars}</p>
          <p className={styles.statNote}>Out of 5 stars</p>
        </div>
        <div className={styles.csatStat}>
          <div className={styles.statLabel}>Responses <MessageSquareText className={`${styles.statIcon} ${styles.responsesIcon}`} aria-hidden="true" /></div>
          <p className={styles.statNumber}>{report.totalResponses}</p>
          <p className={styles.statNote} aria-hidden="true">&nbsp;</p>
        </div>
        <div className={styles.csatStat}>
          <div className={styles.statLabel}>Response rate <TrendingUp className={`${styles.statIcon} ${styles.responseRateIcon}`} aria-hidden="true" /></div>
          <p className={styles.statNumber}>{displayPercent(report.responseRate)}</p>
          <ResponseRateNote responses={report.totalResponses} delivered={report.deliveredRequests} />
        </div>
        <div className={styles.csatStat}>
          <div className={styles.statLabel}>Incidents raised <TriangleAlert className={`${styles.statIcon} ${styles.incidentsIcon}`} aria-hidden="true" /></div>
          <p className={styles.statNumber}>{report.incidentsRaised}</p>
          <p className={styles.statNote}>In this period</p>
        </div>
      </div>
      <div className={styles.csatCharts}>
        <section className={styles.distribution}>
          <div className={styles.chartHeading}>
            <h3>Rating distribution</h3>
            <div className={styles.ratingSummary}><RatingStars rating={report.averageStars} /><span>{report.averageStars === null ? 'No ratings yet' : `${report.averageStars} / 5`}</span></div>
          </div>
          <div className={styles.ratingRows}>
            {([5, 4, 3, 2, 1] as const).map(star => {
              const count = report.ratingDistribution[star];
              const percentage = report.totalResponses ? (count / report.totalResponses) * 100 : 0;
              return (
                <div className={styles.ratingRow} key={star}>
                  <span className={styles.ratingLabel}>{star} <Star aria-hidden="true" /></span>
                  <div className={styles.ratingTrack} role="meter" aria-label={`${star} star ratings`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
                    <div className={styles.ratingBar} style={{ width: `${percentage}%` }} />
                  </div>
                  <span className={styles.ratingCount}>{count} ({Number(percentage.toFixed(1))}%)</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className={styles.responseOverview}>
          <h3>Response overview</h3>
          <div className={styles.responseContent}>
            <div className={styles.responseDonut} style={{ background: `conic-gradient(#1677bd 0 ${responseRate}%, #e2e8f0 ${responseRate}% 100%)` }} aria-label={`${displayPercent(report.responseRate)} response rate`}>
              <div className={styles.donutCenter}><strong>{report.totalResponses}</strong><span>responses</span></div>
            </div>
            <div className={styles.responseLegend}>
              <div><span className={styles.respondedDot} /><div><p>Responded</p><span>{report.totalResponses} ({displayPercent(report.responseRate)})</span></div></div>
              <div><span className={styles.noResponseDot} /><div><p>No response</p><span>{Math.max(report.deliveredRequests - report.totalResponses, 0)}</span></div></div>
            </div>
          </div>
        </section>
      </div>
    </div>
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
      <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${styles.slaSummary}`} data-sla-summary>
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

      <div className={`mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.9fr)] ${styles.slaCharts}`}>
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
    selectedBranchId,
    availableBranches,
    assignedBranchesLoading,
    assignedBranchesError,
  } = useBranch();
  const queryClient = useQueryClient();
  const [draftType, setDraftType] = useState<ReportType>('csat');
  const [draftMonth, setDraftMonth] = useState(currentMonthValue);
  const [preview, setPreview] = useState<PreviewSelection>(() => ({ type: 'csat', month: currentMonthValue() }));
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

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

  const endpoint = preview.type === 'csat' ? '/csat/reports/summary' : '/service-requests/reports/sla';
  const params = new URLSearchParams({ from: previewPeriod.from, to: previewPeriod.to });
  if (selectedBranchId) params.set('branchId', selectedBranchId);

  const isQueryEnabled = !assignedBranchesLoading && !(needsResolvedBranch && !selectedBranchId) && !assignedBranchesError;

  const {
    data: reportData,
    isLoading: reportLoadingQuery,
    isFetching: reportFetching,
    error: reportQueryError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['reports', preview.type, previewPeriod.from, previewPeriod.to, selectedBranchId],
    queryFn: async () => {
      const payload: unknown = await fetchJson(`${endpoint}?${params.toString()}`);
      const reportValue = isRecord(payload) ? payload.report : null;
      const parsed = preview.type === 'csat'
        ? parseCsatReport(reportValue)
        : parseSlaReport(reportValue);
      if (!parsed) {
        throw new Error('The server returned an invalid report response.');
      }
      return { ...parsed, csvRecords: isRecord(reportValue) ? reportValue.csv_records : undefined };
    },
    enabled: isQueryEnabled,
    staleTime: 30_000,
  });

  const loadedReport = useMemo(() => {
    if (!reportData) return null;
    return preview.type === 'csat'
      ? { type: 'csat' as const, data: reportData as CsatReport }
      : { type: 'sla' as const, data: reportData as SlaReport };
  }, [reportData, preview.type]);

  const loading = isQueryEnabled ? reportLoadingQuery : false;
  const error = assignedBranchesError || (reportQueryError ? reportQueryError.message || 'The report could not be loaded.' : null);
  // Cached data remains available after a failed refetch, but is not a valid export.
  const canExport = Boolean(isQueryEnabled && selectedBranchId && loadedReport && !loading && !reportFetching && !error && draftMonth && draftMonth <= maxMonth);
  const generatedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const clearSetup = () => {
    const month = currentMonthValue();
    setDraftType('csat');
    setDraftMonth(month);
    setPreview({ type: 'csat', month });
  };

  const handleExport = (format: ExportFormat) => {
    if (!canExport || !loadedReport || !selectedBranchId) return;
    if (format === 'csv') {
      try {
        const csv = buildReportCsv(preview.type, reportData?.csvRecords,
          { id: selectedBranchId, name: selectedBranch }, previewPeriod);
        downloadCsv(csv.content, csv.filename);
        notify('CSV report downloaded.');
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : 'CSV export failed. Please try again.');
      }
      return;
    }
    notify('Opening the print dialog. Choose “Save as PDF” to export.');
    window.print();
  };

  const navigateToDetail = () => {
    window.dispatchEvent(
      new CustomEvent('navigate', {
        detail: preview.type === 'csat' ? 'csat' : 'order-analytics',
      }),
    );
  };

  const reportTitle = preview.type === 'csat' ? 'Customer Satisfaction' : 'Performance Metrics';

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
                <legend className="mb-3 text-[13px] font-semibold text-[#475569]">Report type</legend>
                <div className="space-y-2.5">
                  {([
                    ['csat', 'Customer Satisfaction'],
                    ['sla', 'Performance Metrics'],
                  ] as const).map(([value, label]) => {
                    const selected = draftType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setDraftType(value);
                          setPreview(current => ({ ...current, type: value }));
                        }}
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
                <label htmlFor="report-month" className="mb-3 block text-[13px] font-semibold text-[#475569]">
                  Reporting period
                </label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    id="report-month"
                    type="month"
                    value={draftMonth}
                    max={maxMonth}
                    onChange={(event) => {
                      const month = event.target.value;
                      setDraftMonth(month);
                      if (month && month <= maxMonth) setPreview(current => ({ ...current, month }));
                    }}
                    className="h-12 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm font-medium text-gray-800 outline-none transition focus:border-[#087fc3] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

            </div>

            <div className="mt-auto border-t border-gray-100 px-5 py-5">
              <div>
                <button
                  type="button"
                  onClick={clearSetup}
                  className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </aside>

          <section
            className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            data-report-preview
          >
            <div className={`flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between ${styles.previewHeader}`}>
              <div className="flex min-w-0 gap-3">
                <span className="mt-0.5 h-12 w-1 shrink-0 rounded-full bg-[#087fc3]" />
                <div className="min-w-0">
                  <p className={styles.printBrand}>Superkalan Gaz · Branch report</p>
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-gray-900">{reportTitle}</h2>
                  <p className={`mt-1 text-xs text-gray-500 ${styles.screenMeta}`}>{previewPeriod.label} · {selectedBranch}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2" data-report-actions>
                <button
                  type="button"
                  onClick={navigateToDetail}
                  className="px-2 py-2 text-[13px] font-medium text-[#087fc3] hover:underline"
                >
                  {preview.type === 'csat' ? 'View ratings and reviews' : 'View order analytics'}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" disabled={!canExport} className={styles.exportButton}>
                      <Download size={16} aria-hidden="true" />Export<ChevronDown size={14} aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-36 bg-white text-[#0F172A]">
                    <DropdownMenuItem disabled={!canExport} onSelect={() => handleExport('pdf')}>PDF</DropdownMenuItem>
                    <DropdownMenuItem disabled={!canExport} onSelect={() => handleExport('csv')}>CSV</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className={`min-h-[470px] bg-[#fbfcfd] p-4 sm:p-5 ${styles.previewBody}`}>
              {loading && (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <RefreshCw className="h-7 w-7 animate-spin text-[#087fc3]" />
                  <p className="mt-4 text-sm font-medium text-gray-700">Loading branch report…</p>
                  <p className={`mt-1 text-xs text-gray-500 ${styles.screenMeta}`}>The rest of the dashboard remains available.</p>
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
                    onClick={() => void queryClient.invalidateQueries({ queryKey: ['reports', preview.type, previewPeriod.from, previewPeriod.to, selectedBranchId] })}
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

            <footer className={`flex flex-col gap-2 border-t border-gray-100 px-5 py-3 text-[11px] text-gray-500 sm:flex-row sm:items-center sm:justify-between ${styles.screenMeta} ${styles.reportFooter}`}>
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
          @page {
            margin: 12mm;
          }
          /* Remove dashboard siblings instead of leaving their layout space hidden. */
          body:has([data-report-preview]) *:not(:has([data-report-preview])):not([data-report-preview]):not([data-report-preview] *) {
            display: none !important;
          }
          /* The branch transition's translate also creates a print containing block. */
          body:has([data-report-preview]),
          body:has([data-report-preview]) *:has([data-report-preview]) {
            display: block !important;
            position: static !important;
            transform: none !important;
            translate: none !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          [data-report-preview] {
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            overflow: visible !important;
            border: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          [data-report-preview] section,
          [data-report-preview] footer {
            break-inside: avoid;
          }
          [data-report-actions] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
