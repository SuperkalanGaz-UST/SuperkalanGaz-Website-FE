'use client';

import { useEffect, useRef, useState } from 'react';
import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup } from 'maplibre-gl';
import type { BranchGeofence } from '../../../lib/branchGeofence';
import { OPENFREEMAP_STYLE_URL, toLngLat } from '../../../lib/mapConfig';
import { routeFixTime, vehicleFixTime, type FleetVehicle, type RoutePoint, type VehicleLocation, type VehicleRouteResponse } from './vehicleLocations';
import styles from './screen.module.css';

interface Props {
    vehicles: FleetVehicle[];
    geofence: BranchGeofence | null;
    selection: { id: string } | null;
    route?: VehicleRouteResponse;
    routePoint?: RoutePoint;
}

function vehicleMarker(vehicle: FleetVehicle, position: VehicleLocation) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = styles.vehiclePin;
    element.dataset.stale = String(position.stale);
    element.setAttribute('aria-label', `Vehicle ${vehicle.plate_number} location`);
    const icon = document.createElement('span');
    icon.textContent = '🏍';
    icon.setAttribute('aria-hidden', 'true');
    const plate = document.createElement('span');
    plate.textContent = vehicle.plate_number;
    element.append(icon, plate);

    const content = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = vehicle.display_name ? `${vehicle.display_name} · ${vehicle.plate_number}` : vehicle.plate_number;
    const time = document.createElement('div');
    time.textContent = `${position.stale ? 'Last known fix' : 'GPS fix'} · ${vehicleFixTime.format(new Date(position.captured_at))}`;
    content.append(label, time);

    return new Marker({ element })
        .setLngLat(toLngLat([position.latitude, position.longitude]))
        .setPopup(new Popup({ offset: 16 }).setDOMContent(content));
}

export default function FleetMap({ vehicles, geofence, selection, route, routePoint }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markersRef = useRef(new Map<string, Marker>());
    const fittedVehicles = useRef(false);
    const fittedGeofence = useRef(false);
    const [mapError, setMapError] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;
        let map: MapLibreMap;
        try {
            map = new MapLibreMap({
                container: containerRef.current,
                style: OPENFREEMAP_STYLE_URL,
                attributionControl: false,
            });
        } catch {
            setMapError(true);
            return;
        }
        mapRef.current = map;
        fittedVehicles.current = false;
        fittedGeofence.current = false;
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
        map.on('styleimagemissing', ({ id }) => {
            if (!map.hasImage(id)) map.addImage(id, new ImageData(1, 1));
        });
        map.on('error', () => setMapError(true));
        map.on('load', () => setMapError(false));

        return () => {
            mapRef.current = null;
            map.remove();
        };
    }, [retry]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !geofence) return;

        const points = geofence.points.map(toLngLat);
        const addGeofence = () => {
            map.addSource('fleet-geofence', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] },
                },
            });
            map.addLayer({
                id: 'fleet-geofence-fill',
                type: 'fill',
                source: 'fleet-geofence',
                paint: { 'fill-color': '#397fa4', 'fill-opacity': 0.15 },
            });
            map.addLayer({
                id: 'fleet-geofence-outline',
                type: 'line',
                source: 'fleet-geofence',
                paint: { 'line-color': '#397fa4', 'line-width': 2, 'line-dasharray': [2.5, 2.5] },
            });
        };
        if (map.isStyleLoaded()) addGeofence();
        else map.once('load', addGeofence);

        return () => {
            map.off('load', addGeofence);
            if (mapRef.current !== map || !map.getSource('fleet-geofence')) return;
            map.removeLayer('fleet-geofence-outline');
            map.removeLayer('fleet-geofence-fill');
            map.removeSource('fleet-geofence');
        };
    }, [geofence, retry]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const markers = markersRef.current;
        const bounds = new LngLatBounds();
        geofence?.points.forEach(point => bounds.extend(toLngLat(point)));
        for (const vehicle of vehicles) {
            if (!vehicle.position) continue;
            const marker = vehicleMarker(vehicle, vehicle.position).addTo(map);
            markers.set(vehicle.id, marker);
            bounds.extend(marker.getLngLat());
        }
        if ((!fittedVehicles.current && markers.size > 0) || (!fittedGeofence.current && geofence)) {
            map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 });
            fittedVehicles.current = markers.size > 0;
            fittedGeofence.current = geofence !== null;
        }

        return () => {
            markers.forEach(marker => marker.remove());
            markers.clear();
        };
    }, [vehicles, geofence, retry]);

    useEffect(() => {
        const marker = selection ? markersRef.current.get(selection.id) : undefined;
        if (!marker) return;
        mapRef.current?.easeTo({ center: marker.getLngLat(), zoom: 16, duration: 300 });
        if (!marker.getPopup()?.isOpen()) marker.togglePopup();
    }, [selection, retry]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !route || route.points.length === 0) return;
        const points = route.points.map(point => toLngLat([point.latitude, point.longitude]));
        const endpoints: Marker[] = [];
        const bounds = new LngLatBounds();
        geofence?.points.forEach(point => bounds.extend(toLngLat(point)));
        points.forEach(point => bounds.extend(point));
        map.fitBounds(bounds, { padding: 55, maxZoom: 16, duration: 0 });

        for (const [index, label] of [[0, 'Start'], [points.length - 1, 'End']] as const) {
            const element = document.createElement('span');
            element.className = styles.routeEndpoint;
            element.textContent = label;
            endpoints.push(new Marker({ element, anchor: label === 'Start' ? 'right' : 'left' }).setLngLat(points[index]).addTo(map));
        }
        const addRoute = () => {
            if (points.length < 2) return;
            map.addSource('vehicle-route', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } },
            });
            map.addLayer({
                id: 'vehicle-route-line', type: 'line', source: 'vehicle-route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#0073ad', 'line-width': 4 },
            });
        };
        if (map.isStyleLoaded()) addRoute();
        else map.once('load', addRoute);
        return () => {
            endpoints.forEach(marker => marker.remove());
            map.off('load', addRoute);
            if (mapRef.current !== map || !map.getSource('vehicle-route')) return;
            map.removeLayer('vehicle-route-line');
            map.removeSource('vehicle-route');
        };
    }, [geofence, route, retry]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !route || !routePoint) return;
        const element = document.createElement('button');
        element.type = 'button';
        element.className = styles.vehiclePin;
        element.textContent = `🏍 ${route.vehicle.plate_number}`;
        element.setAttribute('aria-label', 'Recorded vehicle position');
        const popup = document.createElement('div');
        popup.textContent = routeFixTime.format(new Date(routePoint.captured_at));
        const marker = new Marker({ element })
            .setLngLat(toLngLat([routePoint.latitude, routePoint.longitude]))
            .setPopup(new Popup({ offset: 16 }).setDOMContent(popup)).addTo(map);
        return () => { marker.remove(); };
    }, [route, routePoint, retry]);

    return (
        <div className={styles.mapFrame}>
            <div ref={containerRef} className={styles.map} aria-label={route ? 'Vehicle route history map' : 'Vehicle hardware GPS map'} />
            {mapError && (
                <div className={styles.mapError} role="status">
                    <span>{route ? 'Map unavailable. Recorded coordinates remain available below.' : 'Map unavailable. Vehicle coordinates are listed in the roster.'}</span>
                    <button className={styles.refreshButton} type="button" onClick={() => {
                        setMapError(false);
                        setRetry(value => value + 1);
                    }}>Retry map</button>
                </div>
            )}
        </div>
    );
}
