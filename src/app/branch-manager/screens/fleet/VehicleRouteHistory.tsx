'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { fetchJson } from '../../../lib/api';
import { routeFixTime, type FleetVehicle, type VehicleRouteResponse } from './vehicleLocations';
import styles from './screen.module.css';

const FleetMap = dynamic(() => import('./FleetMap'), { ssr: false });

interface RouteSearch {
    vehicleId: string;
    from: string;
    to: string;
}

export default function VehicleRouteHistory({ vehicles, scope }: { vehicles: FleetVehicle[]; scope: string }) {
    const [selectedId, setSelectedId] = useState('');
    const [range, setRange] = useState(() => {
        const to = new Date(Date.now() + 8 * 60 * 60_000).toISOString().slice(0, 16);
        return { from: `${to.slice(0, 10)}T00:00`, to };
    });
    const [submitted, setSubmitted] = useState<RouteSearch | null>(null);
    const [validationError, setValidationError] = useState('');
    const [pointIndex, setPointIndex] = useState(0);
    const connectedVehicles = vehicles.filter(vehicle => vehicle.tracker_connected);
    const vehicleId = selectedId || connectedVehicles[0]?.id || '';
    const vehicleAvailable = connectedVehicles.some(vehicle => vehicle.id === vehicleId);
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
        enabled: !!submitted && matchesSearch && vehicleAvailable,
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
        gcTime: 0,
    });
    const route = matchesSearch && vehicleAvailable && !query.isError && !query.isFetching ? query.data : undefined;
    const point = route?.points[Math.min(pointIndex, route.points.length - 1)];

    function showRoute(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const from = new Date(`${range.from}:00+08:00`).getTime();
        const to = new Date(`${range.to}:00+08:00`).getTime();
        if (!vehicleAvailable || !Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 24 * 60 * 60_000) {
            setValidationError('Choose a connected vehicle and a start before the end, within 24 hours.');
            return;
        }
        setValidationError('');
        setPointIndex(0);
        if (matchesSearch) void query.refetch();
        else setSubmitted({ vehicleId, ...range });
    }

    return (
        <section className={styles.mapPanel} aria-labelledby="route-history-title">
            <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle} id="route-history-title">Route history</h2>
                <span className={styles.subtitle}>Philippine time · up to 24 hours per search</span>
            </div>
            <form className={styles.routeFilters} onSubmit={showRoute}>
                <label>Vehicle
                    <select value={vehicleId} onChange={event => setSelectedId(event.target.value)} required>
                        {connectedVehicles.length === 0 && <option value="">No connected vehicles</option>}
                        {connectedVehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate_number}</option>)}
                    </select>
                </label>
                <label>From
                    <input type="datetime-local" value={range.from} onChange={event => setRange({ ...range, from: event.target.value })} required />
                </label>
                <label>To
                    <input type="datetime-local" value={range.to} onChange={event => setRange({ ...range, to: event.target.value })} required />
                </label>
                <button className={styles.refreshButton} type="submit" disabled={!vehicleAvailable || query.isFetching}>
                    {query.isFetching ? 'Loading route…' : 'Show route'}
                </button>
            </form>
            {validationError && <p className={styles.notice} role="alert">{validationError}</p>}
            {matchesSearch && query.isError && <p className={styles.notice} role="alert">{query.error.message}</p>}
            {query.isFetching && <p className={styles.notice} role="status">Loading recorded GPS positions…</p>}
            {!submitted && <p className={styles.notice}>Choose a vehicle and period to view its recorded GPS trail.</p>}
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
        </section>
    );
}
