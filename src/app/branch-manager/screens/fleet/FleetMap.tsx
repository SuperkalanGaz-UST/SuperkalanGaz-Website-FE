'use client';

import { useEffect, useRef, useState } from 'react';
import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup } from 'maplibre-gl';
import type { BranchGeofence } from '../../../lib/branchGeofence';
import { OPENFREEMAP_STYLE_URL, toLngLat } from '../../../lib/mapConfig';
import { vehicleFixTime, type FleetVehicle, type VehicleLocation } from './vehicleLocations';
import styles from './screen.module.css';

interface Props {
    vehicles: FleetVehicle[];
    geofence: BranchGeofence | null;
    selection: { id: string } | null;
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

export default function FleetMap({ vehicles, geofence, selection }: Props) {
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

    return (
        <div className={styles.mapFrame}>
            <div ref={containerRef} className={styles.map} aria-label="Vehicle hardware GPS map" />
            {mapError && (
                <div className={styles.mapError} role="status">
                    <span>Map unavailable. Vehicle coordinates are listed in the roster.</span>
                    <button className={styles.refreshButton} type="button" onClick={() => {
                        setMapError(false);
                        setRetry(value => value + 1);
                    }}>Retry map</button>
                </div>
            )}
        </div>
    );
}
