'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Star, MessageSquare, AlertTriangle, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Tabs, TabsList, TabsTrigger } from '../../components/Tabs';
import { apiFetch, apiErrorMessage } from '../../../lib/api';
import styles from './screen.module.css';

/**
 * The delivery a rating is about (story BM-039). Carries all four SLA timestamps
 * so the Branch Manager can see where the delivery actually went wrong before
 * writing a resolution.
 */
interface ServiceRequestContext {
    id: string;
    order_source: string;
    status: string;
    customer_name: string;
    delivery_address: string;
    cylinder_size: string;
    quantity: number;
    rider_id: string | null;
    requested_at: string;
    dispatched_at: string | null;
    in_transit_at: string | null;
    delivered_at: string | null;
}

/**
 * A CSAT rating row from GET /csat/ratings. Ratings are submitted by customers on
 * mobile; this screen only reads them and records the BM's follow-up.
 */
interface RatingRow {
    id: string;
    branch_id: string;
    service_request_id: string;
    customer_id: string;
    stars: number;
    comment: string | null;
    submitted_at: string;
    resolution_status: 'Open' | 'Resolved';
    resolution_note: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
    // Enrichments appended by the list endpoint.
    customer_name: string | null;
    rider_name: string | null;
    service_request: ServiceRequestContext | null;
}

/** Branch CSAT KPIs (story BM-041). */
interface SummaryRow {
    open_count: number;
    resolved_count: number;
    low_csat_open_count: number;
    average_stars: number | null;
    total_ratings: number;
}

/** Queue filters → the API's ?resolution values. */
const RESOLUTION_TABS: { value: string; label: string }[] = [
    { value: 'Open', label: 'Open' },
    { value: 'Resolved', label: 'Resolved' },
    { value: 'all', label: 'All' },
];

/**
 * A lost/undelivered cylinder complaint from GET /csat/incidents (journey
 * BM-US-04). Unlike ratings, these are logged BY the Branch Manager (via the
 * Orders screen's "Log Complaint" action), not submitted by the customer.
 */
interface IncidentRow {
    id: string;
    branch_id: string;
    customer_id: string | null;
    service_request_id: string | null;
    category: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: string;
    reported_at: string;
    escalated: boolean;
    escalated_at: string | null;
    created_at: string;
    // Enrichments appended by the list endpoint.
    customer_name: string | null;
    rider_name: string | null;
    service_request: ServiceRequestContext | null;
}

/** Human-readable labels for incident categories. */
const CATEGORY_LABELS: Record<string, string> = {
    lost_cylinder: 'Lost / undelivered cylinder',
    late_delivery: 'Late delivery',
    wrong_item: 'Wrong item',
    safety: 'Safety concern',
    billing: 'Billing issue',
    other: 'Other',
};

/** Top-level view switcher: the two BM CSAT flows on one screen (BM-US-08 low
 * CSAT follow-up, BM-US-04 lost/undelivered cylinder reports). */
const VIEW_TABS: { value: string; label: string }[] = [
    { value: 'ratings', label: 'Ratings' },
    { value: 'incidents', label: 'Incidents' },
];

const formatDateTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(d);
};

/** Star rating as filled/empty glyphs — low scores are visually distinct (BM-038). */
function Stars({ value }: { value: number }) {
    return (
        <span className={value <= 3 ? styles.starsLow : styles.starsHigh} aria-label={`${value} of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={13} fill={n <= value ? 'currentColor' : 'none'} strokeWidth={n <= value ? 0 : 1.5} />
            ))}
        </span>
    );
}

/**
 * CSAT Feedback & Analytics — two Branch Manager flows on one screen:
 *  - closed-loop follow-up on low-rated deliveries (journey BM-US-08): lists
 *    flagged 1–3 star deliveries (BM-038), lets the BM review the associated
 *    service request inline (BM-039), and log a resolution note that marks the
 *    complaint addressed (BM-040/041);
 *  - lost/undelivered cylinder complaints (journey BM-US-04): review + escalate
 *    complaints logged from the Orders screen's "Log Complaint" action.
 */
export default function Csat() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [view, setView] = useState('ratings');

    const [resolution, setResolution] = useState('Open');
    // Low-CSAT band only by default (BM-038); the toggle widens to every rating.
    const [lowOnly, setLowOnly] = useState(true);
    const [ratings, setRatings] = useState<RatingRow[]>([]);
    const [summary, setSummary] = useState<SummaryRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Expanded delivery-context panel (BM-039).
    const [detailId, setDetailId] = useState<string | null>(null);
    // Resolve-with-note panel (BM-040/041).
    const [resolveId, setResolveId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [noteError, setNoteError] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    // Incidents view (BM-US-04).
    const [incidentStatus, setIncidentStatus] = useState('open');
    const [incidents, setIncidents] = useState<IncidentRow[]>([]);
    const [incidentsLoading, setIncidentsLoading] = useState(true);
    const [incidentsError, setIncidentsError] = useState<string | null>(null);
    const [incidentDetailId, setIncidentDetailId] = useState<string | null>(null);
    const [escalatingId, setEscalatingId] = useState<string | null>(null);

    const loadRatings = useCallback(async (res: string, low: boolean) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ resolution: res });
            if (low) params.set('maxStars', '3');
            const r = await apiFetch(`/csat/ratings?${params.toString()}`);
            const data = await r.json();
            if (!r.ok) throw new Error(apiErrorMessage(data, 'Failed to load feedback'));
            setRatings(data.ratings as RatingRow[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load feedback');
            setRatings([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSummary = useCallback(async () => {
        try {
            const r = await apiFetch('/csat/summary');
            const data = await r.json();
            if (!r.ok) return;
            setSummary(data.summary as SummaryRow);
        } catch {
            // Non-fatal: the KPI tiles just stay blank.
        }
    }, []);

    useEffect(() => { loadRatings(resolution, lowOnly); }, [resolution, lowOnly, loadRatings]);
    useEffect(() => { loadSummary(); }, [loadSummary]);

    const loadIncidents = useCallback(async (status: string) => {
        setIncidentsLoading(true);
        setIncidentsError(null);
        try {
            const r = await apiFetch(`/csat/incidents?status=${encodeURIComponent(status)}`);
            const data = await r.json();
            if (!r.ok) throw new Error(apiErrorMessage(data, 'Failed to load incidents'));
            setIncidents(data.incidents as IncidentRow[]);
        } catch (err) {
            setIncidentsError(err instanceof Error ? err.message : 'Failed to load incidents');
            setIncidents([]);
        } finally {
            setIncidentsLoading(false);
        }
    }, []);

    // Only load incidents once the BM actually switches to that view — the
    // ratings view (the default) never needs this request.
    useEffect(() => {
        if (view === 'incidents') loadIncidents(incidentStatus);
    }, [view, incidentStatus, loadIncidents]);

    const handleEscalate = async (id: string) => {
        setEscalatingId(id);
        try {
            const r = await apiFetch(`/csat/incidents/${id}/escalate`, { method: 'POST' });
            const data = await r.json();
            if (!r.ok) {
                if (r.status === 409) {
                    toast.error(apiErrorMessage(data, 'This incident is already escalated'));
                    await loadIncidents(incidentStatus);
                    return;
                }
                if (r.status === 404) { toast.error('Incident not found'); return; }
                toast.error(apiErrorMessage(data, 'Failed to escalate'));
                return;
            }
            toast.success('Incident flagged as escalated.');
            await loadIncidents(incidentStatus);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to escalate');
        } finally {
            setEscalatingId(null);
        }
    };

    const openResolve = (id: string) => {
        setResolveId(id);
        setNote('');
        setNoteError(null);
    };

    const handleResolve = async (id: string) => {
        if (!note.trim()) { setNoteError('A resolution note is required'); return; }
        setResolvingId(id);
        try {
            const r = await apiFetch(`/csat/ratings/${id}/resolve`, {
                method: 'POST',
                body: JSON.stringify({ note: note.trim() }),
            });
            const data = await r.json();
            if (!r.ok) {
                // 409: already resolved (a concurrent action won) — reconcile the queue.
                if (r.status === 409) {
                    setResolveId(null);
                    await Promise.all([loadRatings(resolution, lowOnly), loadSummary()]);
                    return;
                }
                setNoteError(apiErrorMessage(data, 'Failed to resolve'));
                return;
            }
            setResolveId(null);
            // Refresh both: the row leaves the Open queue and the KPI decrements.
            await Promise.all([loadRatings(resolution, lowOnly), loadSummary()]);
        } catch (err) {
            setNoteError(err instanceof Error ? err.message : 'Failed to resolve');
        } finally {
            setResolvingId(null);
        }
    };

    if (!mounted) return null;

    return (
        <div>
            {/* View switcher — the two BM CSAT flows on one screen. */}
            <div className={styles.viewSwitcher}>
                <Tabs value={view} onValueChange={setView}>
                    <TabsList>
                        {VIEW_TABS.map((t) => (
                            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>

            {view === 'ratings' && (
            <>
            {/* KPI tiles — Open Complaints is the figure BM-041 watches decrement. */}
            <div className={styles.summaryGrid}>
                <div className={`${styles.summaryCard} ${styles.summaryAccent}`}>
                    <div className={styles.summaryLabel}>Open Complaints</div>
                    <div className={styles.summaryValue}>{summary ? summary.open_count : '—'}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Low CSAT Open (1–3★)</div>
                    <div className={styles.summaryValue}>{summary ? summary.low_csat_open_count : '—'}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Resolved</div>
                    <div className={styles.summaryValue}>{summary ? summary.resolved_count : '—'}</div>
                </div>
                <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Average Rating</div>
                    <div className={styles.summaryValue}>
                        {summary?.average_stars != null ? summary.average_stars.toFixed(2) : '—'}
                        {summary?.average_stars != null && <span className={styles.summaryUnit}> / 5</span>}
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeaderFlex}>
                    <Tabs value={resolution} onValueChange={setResolution}>
                        <TabsList>
                            {RESOLUTION_TABS.map((t) => (
                                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <div className={styles.headerActions}>
                        <label className={styles.lowToggle} title="Show only the 1–3 star band flagged for follow-up">
                            <input
                                type="checkbox"
                                checked={lowOnly}
                                onChange={(e) => setLowOnly(e.target.checked)}
                            />
                            <span>Low CSAT only (1–3★)</span>
                        </label>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { loadRatings(resolution, lowOnly); loadSummary(); }}
                            disabled={loading}
                        >
                            <RefreshCw size={16} /> Refresh
                        </Button>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Rating</th>
                                <th>Customer</th>
                                <th>Comment</th>
                                <th>Submitted</th>
                                <th>Status</th>
                                <th className={styles.actionsCol}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={6} className={styles.emptyState}>Loading…</td></tr>
                            )}
                            {!loading && error && (
                                <tr><td colSpan={6} className={styles.emptyState}>{error}</td></tr>
                            )}
                            {!loading && !error && ratings.length === 0 && (
                                <tr><td colSpan={6} className={styles.emptyState}>
                                    <MessageSquare size={20} /> No feedback in this view.
                                </td></tr>
                            )}
                            {!loading && !error && ratings.map((r) => {
                                const isLow = r.stars <= 3;
                                const isResolving = resolveId === r.id;
                                return (
                                    <React.Fragment key={r.id}>
                                        {/* Low-CSAT rows are visually distinct (BM-038 AC). */}
                                        <tr className={isLow ? styles.lowRow : undefined}>
                                            <td><Stars value={r.stars} /></td>
                                            <td className={styles.boldText}>{r.customer_name ?? '—'}</td>
                                            <td className={styles.commentCell}>{r.comment ?? <span className={styles.mutedText}>No comment</span>}</td>
                                            <td className={styles.mutedText}>{formatDateTime(r.submitted_at)}</td>
                                            <td>
                                                <Badge variant={r.resolution_status === 'Resolved' ? 'success' : 'warning'}>
                                                    {r.resolution_status}
                                                </Badge>
                                                {r.resolution_status === 'Resolved' && r.resolved_at && (
                                                    <div className={styles.mutedText}>{formatDateTime(r.resolved_at)}</div>
                                                )}
                                            </td>
                                            <td className={styles.actionsCell}>
                                                <div className={styles.actionButtons}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setDetailId(detailId === r.id ? null : r.id)}
                                                    >
                                                        {detailId === r.id ? 'Hide' : 'Delivery'}
                                                    </Button>
                                                    {r.resolution_status === 'Open' && (
                                                        <Button
                                                            variant="accent"
                                                            size="sm"
                                                            onClick={() => openResolve(r.id)}
                                                            disabled={isResolving}
                                                        >
                                                            Resolve
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Delivery context — the associated service request (BM-039). */}
                                        {detailId === r.id && (
                                            <tr className={styles.panelRow}>
                                                <td colSpan={6}>
                                                    {r.service_request ? (
                                                        <div className={styles.panel}>
                                                            <div className={styles.panelTitle}>Associated Service Request</div>
                                                            <div className={styles.detailGrid}>
                                                                <div><span className={styles.detailLabel}>Order</span>{r.service_request.quantity}× {r.service_request.cylinder_size}</div>
                                                                <div><span className={styles.detailLabel}>Source</span>{r.service_request.order_source}</div>
                                                                <div><span className={styles.detailLabel}>Status</span>{r.service_request.status}</div>
                                                                <div><span className={styles.detailLabel}>Rider</span>{r.rider_name ?? '—'}</div>
                                                                <div className={styles.detailWide}><span className={styles.detailLabel}>Address</span>{r.service_request.delivery_address}</div>
                                                            </div>
                                                            <div className={styles.panelTitle}>SLA Timeline</div>
                                                            <div className={styles.detailGrid}>
                                                                <div><span className={styles.detailLabel}>Requested</span>{formatDateTime(r.service_request.requested_at)}</div>
                                                                <div><span className={styles.detailLabel}>Dispatched</span>{formatDateTime(r.service_request.dispatched_at)}</div>
                                                                <div><span className={styles.detailLabel}>In Transit</span>{formatDateTime(r.service_request.in_transit_at)}</div>
                                                                <div><span className={styles.detailLabel}>Delivered</span>{formatDateTime(r.service_request.delivered_at)}</div>
                                                            </div>
                                                            {r.resolution_status === 'Resolved' && r.resolution_note && (
                                                                <>
                                                                    <div className={styles.panelTitle}>Resolution</div>
                                                                    <div className={styles.resolutionNote}>{r.resolution_note}</div>
                                                                </>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className={styles.panel}>
                                                            <span className={styles.mutedText}>The associated service request is not available.</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}

                                        {/* Log a resolution note and mark addressed (BM-040 + BM-041). */}
                                        {isResolving && (
                                            <tr className={styles.panelRow}>
                                                <td colSpan={6}>
                                                    <div className={styles.resolvePanel}>
                                                        <label className={styles.fieldLabel}>Resolution note</label>
                                                        <textarea
                                                            className={styles.textArea}
                                                            rows={3}
                                                            placeholder="e.g. Called the customer, apologised for the delay, refunded the delivery fee and re-briefed the rider."
                                                            value={note}
                                                            onChange={(e) => { setNote(e.target.value); setNoteError(null); }}
                                                        />
                                                        {noteError && <div className={styles.fieldError}>{noteError}</div>}
                                                        <div className={styles.panelActions}>
                                                            <Button variant="ghost" size="sm" onClick={() => setResolveId(null)} disabled={resolvingId === r.id}>
                                                                Cancel
                                                            </Button>
                                                            <Button variant="accent" size="sm" onClick={() => handleResolve(r.id)} disabled={resolvingId === r.id}>
                                                                {resolvingId === r.id ? 'Saving…' : 'Log & Mark Addressed'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            </>
            )}

            {view === 'incidents' && (
                <div className={styles.card}>
                    <div className={styles.cardHeaderFlex}>
                        <Tabs value={incidentStatus} onValueChange={setIncidentStatus}>
                            <TabsList>
                                <TabsTrigger value="open">Open</TabsTrigger>
                                <TabsTrigger value="all">All</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button variant="ghost" size="sm" onClick={() => loadIncidents(incidentStatus)} disabled={incidentsLoading}>
                            <RefreshCw size={16} /> Refresh
                        </Button>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Issue Type</th>
                                    <th>Customer</th>
                                    <th>Description</th>
                                    <th>Reported</th>
                                    <th>Status</th>
                                    <th className={styles.actionsCol}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incidentsLoading && (
                                    <tr><td colSpan={6} className={styles.emptyState}>Loading…</td></tr>
                                )}
                                {!incidentsLoading && incidentsError && (
                                    <tr><td colSpan={6} className={styles.emptyState}>{incidentsError}</td></tr>
                                )}
                                {!incidentsLoading && !incidentsError && incidents.length === 0 && (
                                    <tr><td colSpan={6} className={styles.emptyState}>
                                        <AlertTriangle size={20} /> No complaints logged in this view.
                                    </td></tr>
                                )}
                                {!incidentsLoading && !incidentsError && incidents.map((i) => (
                                    <React.Fragment key={i.id}>
                                        <tr>
                                            <td className={styles.boldText}>{CATEGORY_LABELS[i.category] ?? i.category}</td>
                                            <td>{i.customer_name ?? '—'}</td>
                                            <td className={styles.commentCell}>{i.description}</td>
                                            <td className={styles.mutedText}>{formatDateTime(i.reported_at)}</td>
                                            <td>
                                                <Badge variant={i.status === 'open' ? 'warning' : 'secondary'}>{i.status}</Badge>
                                                {i.escalated && (
                                                    <div className={styles.escalatedTag}>
                                                        <Flag size={11} /> Escalated {formatDateTime(i.escalated_at)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className={styles.actionsCell}>
                                                <div className={styles.actionButtons}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setIncidentDetailId(incidentDetailId === i.id ? null : i.id)}
                                                    >
                                                        {incidentDetailId === i.id ? 'Hide' : 'Delivery'}
                                                    </Button>
                                                    {!i.escalated && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleEscalate(i.id)}
                                                            disabled={escalatingId === i.id}
                                                        >
                                                            {escalatingId === i.id ? 'Escalating…' : 'Escalate'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Delivery context — the associated service request. */}
                                        {incidentDetailId === i.id && (
                                            <tr className={styles.panelRow}>
                                                <td colSpan={6}>
                                                    {i.service_request ? (
                                                        <div className={styles.panel}>
                                                            <div className={styles.panelTitle}>Associated Service Request</div>
                                                            <div className={styles.detailGrid}>
                                                                <div><span className={styles.detailLabel}>Order</span>{i.service_request.quantity}× {i.service_request.cylinder_size}</div>
                                                                <div><span className={styles.detailLabel}>Source</span>{i.service_request.order_source}</div>
                                                                <div><span className={styles.detailLabel}>Status</span>{i.service_request.status}</div>
                                                                <div><span className={styles.detailLabel}>Rider</span>{i.rider_name ?? '—'}</div>
                                                                <div className={styles.detailWide}><span className={styles.detailLabel}>Address</span>{i.service_request.delivery_address}</div>
                                                            </div>
                                                            <div className={styles.panelTitle}>SLA Timeline</div>
                                                            <div className={styles.detailGrid}>
                                                                <div><span className={styles.detailLabel}>Requested</span>{formatDateTime(i.service_request.requested_at)}</div>
                                                                <div><span className={styles.detailLabel}>Dispatched</span>{formatDateTime(i.service_request.dispatched_at)}</div>
                                                                <div><span className={styles.detailLabel}>In Transit</span>{formatDateTime(i.service_request.in_transit_at)}</div>
                                                                <div><span className={styles.detailLabel}>Delivered</span>{formatDateTime(i.service_request.delivered_at)}</div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className={styles.panel}>
                                                            <span className={styles.mutedText}>The associated service request is not available.</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
