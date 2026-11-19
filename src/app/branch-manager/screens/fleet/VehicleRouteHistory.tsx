'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { fetchJson } from '../../../lib/api';
import { isBranchGeofence, type BranchGeofence } from '../../../lib/branchGeofence';
import { routeFixTime, type FleetVehicle, type RoutePoint, type VehicleRouteResponse } from './vehicleLocations';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import styles from './screen.module.css';

const FleetMap = dynamic(() => import('./FleetMap'), { ssr: false });
const noLiveVehicles: FleetVehicle[] = [];

function outsideRuns(points: RoutePoint[]) {
    const runs: { first: number; last: number; timestamp: string }[] = [];
    points.forEach((point, index) => {
        if (point.outside_geofence !== true) return;
        const previous = runs[runs.length - 1];
        if (previous?.last === index - 1) previous.last = index;
        else runs.push({ first: index, last: index, timestamp: routeFixTime.format(new Date(point.captured_at)) });
    });
    return runs;
}

interface RouteSearch {
    vehicleId: string;
    from: string;
    to: string;
}

export default function VehicleRouteHistory({ vehicle, scope, branchId, branchGeofence, onClose, onReturnFocus }: {
    vehicle: FleetVehicle;
    scope: string;
    branchId?: string;
    branchGeofence: BranchGeofence | null;
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
    const [playing, setPlaying] = useState(false);
    const vehicleId = vehicle.id;
    const matchesSearch = submitted?.vehicleId === vehicleId && submitted.from === range.from && submitted.to === range.to;
    const query = useQuery({
        queryKey: ['fleet-route-history', scope, branchId, submitted],
        queryFn: ({ signal }) => {
            if (!submitted) throw new Error('Select a vehicle and period');
            const params = new URLSearchParams({
                from: new Date(`${submitted.from}:00+08:00`).toISOString(),
                to: new Date(`${submitted.to}:00+08:00`).toISOString(),
            });
            if (branchId) params.set('branchId', branchId);
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
    const lastIndex = (route?.points.length ?? 0) - 1;
    const selectedIndex = Math.min(pointIndex, lastIndex);
    const point = route?.points[selectedIndex];
    const selectedTime = point ? routeFixTime.format(new Date(point.captured_at)) : '';
    const routeGeofence = route?.geofence;
    const geofence = useMemo(() => {
        if (routeGeofence === undefined) return branchGeofence;
        return isBranchGeofence(routeGeofence) ? routeGeofence : null;
    }, [routeGeofence, branchGeofence]);
    const outside = useMemo(() => route && geofence ? outsideRuns(route.points) : [], [route, geofence]);
    const outsideSelected = geofence !== null && point?.outside_geofence === true;

    useEffect(() => {
        if (!playing || !route || route.points.length < 2) return;
        const timer = window.setTimeout(() => {
            const next = Math.min(pointIndex + 1, route.points.length - 1);
            setPointIndex(next);
            if (next === route.points.length - 1) setPlaying(false);
        }, 500);
        const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
        document.addEventListener('visibilitychange', pauseWhenHidden);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', pauseWhenHidden);
        };
    }, [playing, pointIndex, route]);

    function seek(index: number) {
        setPlaying(false);
        setPointIndex(index);
    }

    function showRoute(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const from = new Date(`${range.from}:00+08:00`).getTime();
        const to = new Date(`${range.to}:00+08:00`).getTime();
        if (!vehicle.tracker_connected || !Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 24 * 60 * 60_000) {
            setValidationError('Choose a connected vehicle and a start before the end, within 24 hours.');
            return;
        }
        setValidationError('');
        setPlaying(false);
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
                        <DialogDescription className={styles.subtitle}>Movement only · minimum 10 seconds between points · Philippine time · up to 24 hours per search</DialogDescription>
                    </div>
                </div>
                <form className={styles.routeFilters} onSubmit={showRoute}>
                    <label>From
                        <input type="datetime-local" value={range.from} onChange={event => { const from = event.target.value; setPlaying(false); setRange(current => ({ ...current, from })); }} required />
                    </label>
                    <label>To
                        <input type="datetime-local" value={range.to} onChange={event => { const to = event.target.value; setPlaying(false); setRange(current => ({ ...current, to })); }} required />
                    </label>
                    <button className={styles.refreshButton} type="submit" disabled={!vehicle.tracker_connected || query.isFetching}>
                        {query.isFetching ? 'Loading route…' : 'Show route'}
                    </button>
                </form>
                {validationError && <p className={styles.notice} role="alert">{validationError}</p>}
                {matchesSearch && query.isError && <p className={styles.notice} role="alert">{query.error.message}</p>}
                {query.isFetching && <p className={styles.notice} role="status">Loading recorded GPS positions…</p>}
                {!submitted && <p className={styles.notice}>Choose a period to view this vehicle’s recorded GPS trail.</p>}
                {route && route.points.length === 0 && <p className={styles.notice} role="status">No movement recorded for this vehicle in the selected period.</p>}
                {route && point && (
                    <>
                        <FleetMap vehicles={noLiveVehicles} geofence={geofence} selection={null} route={route} routePoint={point} />
                        <div className={styles.routeTimeline}>
                            <div className={styles.routeSummary}>
                                <span>Start · {routeFixTime.format(new Date(route.points[0].captured_at))}</span>
                                <span>End · {routeFixTime.format(new Date(route.points[route.points.length - 1].captured_at))}</span>
                            </div>
                            <div className={styles.routeControls}>
                                <button type="button" className={styles.refreshButton} disabled={lastIndex === 0}
                                    aria-label={playing ? 'Pause route playback' : 'Play route playback'}
                                    onClick={() => {
                                        if (!playing && pointIndex >= lastIndex) setPointIndex(0);
                                        setPlaying(current => !current);
                                    }}>
                                    {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? 'Pause' : 'Play'}
                                </button>
                                <label htmlFor="route-position" className={outsideSelected ? styles.routeOutsideTime : undefined}>
                                    Recorded position · {selectedTime}{outsideSelected && ' · Outside geofence'}
                                </label>
                            </div>
                            <div className={styles.routeScrubber}>
                                <div className={styles.routeTrack} aria-hidden="true">
                                    {outside.map(({ first, last }) => (
                                        <span key={first} className={styles.routeOutsideMark} style={{
                                            left: `${100 * first / (lastIndex || 1)}%`,
                                            width: `${100 * (last - first) / (lastIndex || 1)}%`,
                                        }} />
                                    ))}
                                </div>
                                <input id="route-position" type="range" min="0" max={lastIndex} value={selectedIndex} disabled={lastIndex === 0}
                                    aria-label="Recorded position" aria-valuetext={`${selectedTime}${outsideSelected ? ' · Outside geofence' : ''}`}
                                    onChange={event => seek(Number(event.target.value))} />
                            </div>
                            <p className={styles.coordinates}>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)} · {route.points.length} recorded GPS points</p>
                            <p className={styles.routeGeofenceLegend} data-visible={geofence !== null}>
                                {geofence ? 'Current branch geofence' : route.geofence === null ? 'No branch geofence configured' : 'Branch geofence unavailable'}
                            </p>
                            {geofence && route.geofence === undefined && (
                                <p className={styles.routeGeofenceLegend}>The route API hasn’t supplied outside-geofence timestamps.</p>
                            )}
                            {outside.length > 0 && (
                                <div className={styles.routeOutsideTime}>
                                    <p>First recorded fix outside the geofence</p>
                                    <ul className={styles.routeOutsideList}>
                                        {outside.map(({ first, timestamp }) => (
                                            <li key={first}>
                                                <button type="button" onClick={() => seek(first)}>{timestamp}</button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
