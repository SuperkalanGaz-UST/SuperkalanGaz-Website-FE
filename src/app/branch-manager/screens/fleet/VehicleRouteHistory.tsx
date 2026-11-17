'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { fetchJson } from '../../../lib/api';
import { routeFixTime, type FleetVehicle, type VehicleRouteResponse } from './vehicleLocations';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import styles from './screen.module.css';

const FleetMap = dynamic(() => import('./FleetMap'), { ssr: false });

interface RouteSearch {
    vehicleId: string;
    from: string;
    to: string;
}

export default function VehicleRouteHistory({ vehicle, scope, onClose, onReturnFocus }: {
    vehicle: FleetVehicle;
    scope: string;
    onClose: () => void;
    onReturnFocus: () => void;
}) {
    const [range, setRange] = useState(() => {
        const to = new Date(Date.now() + 8 * 60 * 60_000).toISOString().slice(0, 16);
        return { from: `${to.slice(0, 10)}T00:00`, to };
    });
    const [submitted, setSubmitted] = useState<RouteSearch | null>(null);
    const [validationError, setValidationError] = useState('');
    const [pointIndex, setPointIndex] = useState(0);
    const vehicleId = vehicle.id;
    const matchesSearch = submitted?.vehicleId === vehicleId && submitted.from === range.from && submitted.to === range.to;
    const query = useQuery({
        queryKey: ['fleet-route-history', scope, submitted],
        queryFn: ({ signal }) => {
            if (!submitted) throw new Error('Select a vehicle and period');
            const params = new URLSearchParams({
                from: new Date(`${submitted.from}:00+08:00`).toISOString(),
                to: new Date(`${submitted.to}:00+08:00`).toISOString(),
            });
            return fetchJson<VehicleRouteResponse>(`/vehicles/${encodeURIComponent(submitted.vehicleId)}/route?${params}`, { signal });
        },
        enabled: !!submitted && matchesSearch && vehicle.tracker_connected,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        staleTime: Infinity,
        gcTime: 0,
    });
    const route = matchesSearch && vehicle.tracker_connected && !query.isError && !query.isFetching ? query.data : undefined;
    const point = route?.points[Math.min(pointIndex, route.points.length - 1)];

    function showRoute(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const from = new Date(`${range.from}:00+08:00`).getTime();
        const to = new Date(`${range.to}:00+08:00`).getTime();
        if (!vehicle.tracker_connected || !Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 24 * 60 * 60_000) {
            setValidationError('Choose a connected vehicle and a start before the end, within 24 hours.');
            return;
        }
        setValidationError('');
        setPointIndex(0);
        if (matchesSearch) void query.refetch();
        else setSubmitted({ vehicleId, ...range });
    }

    return (
        <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className={styles.routeDialog} onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }}>
                <div className={styles.panelHeader}>
                    <div>
                        <DialogTitle className={styles.panelTitle}>Route history · {vehicle.plate_number}</DialogTitle>
                        <DialogDescription className={styles.subtitle}>Philippine time · up to 24 hours per search</DialogDescription>
                    </div>
                </div>
                <form className={styles.routeFilters} onSubmit={showRoute}>
                    <label>From
                        <input type="datetime-local" value={range.from} onChange={event => { const from = event.target.value; setRange(current => ({ ...current, from })); }} required />
                    </label>
                    <label>To
                        <input type="datetime-local" value={range.to} onChange={event => { const to = event.target.value; setRange(current => ({ ...current, to })); }} required />
                    </label>
                    <button className={styles.refreshButton} type="submit" disabled={!vehicle.tracker_connected || query.isFetching}>
                        {query.isFetching ? 'Loading route…' : 'Show route'}
                    </button>
                </form>
                {validationError && <p className={styles.notice} role="alert">{validationError}</p>}
                {matchesSearch && query.isError && <p className={styles.notice} role="alert">{query.error.message}</p>}
                {query.isFetching && <p className={styles.notice} role="status">Loading recorded GPS positions…</p>}
                {!submitted && <p className={styles.notice}>Choose a period to view this vehicle’s recorded GPS trail.</p>}
                {route && route.points.length === 0 && <p className={styles.notice} role="status">No recorded GPS positions for this vehicle in the selected period.</p>}
                {route && point && (
                    <>
                        <FleetMap vehicles={[]} geofence={null} selection={null} route={route} routePoint={point} />
                        <div className={styles.routeTimeline}>
                            <div className={styles.routeSummary}>
                                <span>Start · {routeFixTime.format(new Date(route.points[0].captured_at))}</span>
                                <span>End · {routeFixTime.format(new Date(route.points[route.points.length - 1].captured_at))}</span>
                            </div>
                            <label htmlFor="route-position">Recorded position · {routeFixTime.format(new Date(point.captured_at))}</label>
                            <input id="route-position" type="range" min="0" max={route.points.length - 1} value={Math.min(pointIndex, route.points.length - 1)}
                                disabled={route.points.length === 1} onChange={event => setPointIndex(Number(event.target.value))} />
                            <p className={styles.coordinates}>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)} · {route.points.length} recorded GPS points</p>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
