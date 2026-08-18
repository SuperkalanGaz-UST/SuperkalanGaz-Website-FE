'use client';

import { useEffect, useRef } from 'react';
import {
  AttributionControl,
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
} from 'maplibre-gl';
import type { Feature, Polygon } from 'geojson';
import { OPENFREEMAP_STYLE_URL, toLngLat } from '../../lib/mapConfig';
import type { BranchGeofence } from '../../lib/branchGeofence';
import type { PositionedFleetRider as Rider } from '../../lib/fleetPresentationData';

function toGeofenceFeature(geofence: BranchGeofence): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        ...geofence.points.map(toLngLat),
        toLngLat(geofence.points[0]),
      ]],
    },
  };
}

function fitGeofence(
  map: MapLibreMap,
  geofence: BranchGeofence,
  duration: number,
): void {
  const firstPoint = toLngLat(geofence.points[0]);
  const bounds = geofence.points.reduce(
    (current, point) => current.extend(toLngLat(point)),
    new LngLatBounds(firstPoint, firstPoint),
  );
  map.fitBounds(bounds, {
    padding: 55,
    maxZoom: 16,
    duration,
  });
}

function markerColor(status: Rider['status']): string {
  if (status === 'outside-geofence') return '#f59e0b';
  if (status === 'inactive') return '#9ca3af';
  return '#22c55e';
}

function statusLabel(status: Rider['status']): string {
  if (status === 'outside-geofence') return 'Outside geofence';
  if (status === 'inactive') return 'Inactive';
  return 'Active';
}

function popupRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.style.fontSize = '0.8rem';
  row.append(`${label}: `);
  const strong = document.createElement('strong');
  strong.textContent = value;
  row.append(strong);
  return row;
}

function popupContent(rider: Rider): HTMLDivElement {
  const content = document.createElement('div');
  content.style.minWidth = '185px';

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;gap:.5rem';
  const name = document.createElement('strong');
  name.textContent = rider.name;
  const status = document.createElement('span');
  status.textContent = statusLabel(rider.status);
  status.style.cssText = `background:${markerColor(rider.status)};color:white;border-radius:999px;padding:2px 7px;font-size:.7rem;white-space:nowrap`;
  header.append(name, status);

  content.append(header, popupRow('Plate', rider.plateNumber));
  content.append(popupRow('Order', rider.currentOrder ?? 'None'));
  content.append(popupRow('Updated', rider.lastUpdated));
  return content;
}

function makeMarker(rider: Rider, onSelect: (id: string) => void): Marker {
  const element = document.createElement('button');
  element.type = 'button';
  element.title = `${rider.name} — ${statusLabel(rider.status)}`;
  element.setAttribute('aria-label', element.title);
  element.style.cssText = `width:20px;height:20px;padding:0;border-radius:50%;border:3px solid white;background:${markerColor(rider.status)};box-shadow:0 2px 7px rgba(0,0,0,.4);cursor:pointer`;
  element.addEventListener('click', () => onSelect(rider.id));

  return new Marker({ element, anchor: 'center' })
    .setLngLat(toLngLat([rider.lat, rider.lng]))
    .setPopup(new Popup({ offset: 14 }).setDOMContent(popupContent(rider)));
}

function syncRiderMarkers(
  map: MapLibreMap,
  riders: Rider[],
  markers: Map<string, Marker>,
  onSelect: (id: string) => void,
): void {
  markers.forEach((marker) => marker.remove());
  markers.clear();
  riders.forEach((rider) => {
    const marker = makeMarker(rider, onSelect).addTo(map);
    markers.set(rider.id, marker);
  });
}

interface BranchOwnerFleetMapProps {
  geofence: BranchGeofence;
  riders: Rider[];
  selectedRider: string | null;
  onSelectRider: (id: string) => void;
}

export function BranchOwnerFleetMap({
  geofence,
  riders,
  selectedRider,
  onSelectRider,
}: BranchOwnerFleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const ridersRef = useRef(riders);
  const onSelectRef = useRef(onSelectRider);
  const geofenceRef = useRef(geofence);
  ridersRef.current = riders;
  onSelectRef.current = onSelectRider;
  geofenceRef.current = geofence;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: toLngLat(geofenceRef.current.points[0]),
      zoom: 13,
      attributionControl: false,
    });
    const markers = markersRef.current;
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      map.addSource('branch-owner-geofence', {
        type: 'geojson',
        data: toGeofenceFeature(geofenceRef.current),
      });
      map.addLayer({
        id: 'branch-owner-geofence-fill',
        type: 'fill',
        source: 'branch-owner-geofence',
        paint: { 'fill-color': '#007BC1', 'fill-opacity': 0.1 },
      });
      map.addLayer({
        id: 'branch-owner-geofence-outline',
        type: 'line',
        source: 'branch-owner-geofence',
        paint: {
          'line-color': '#007BC1',
          'line-width': 2,
          'line-dasharray': [2.5, 2.5],
        },
      });

      fitGeofence(map, geofenceRef.current, 0);

      syncRiderMarkers(
        map,
        ridersRef.current,
        markers,
        (id) => onSelectRef.current(id),
      );
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource('branch-owner-geofence') as GeoJSONSource | undefined;
    source?.setData(toGeofenceFeature(geofence));
    fitGeofence(map, geofence, 900);
  }, [geofence]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncRiderMarkers(
      map,
      riders,
      markersRef.current,
      (id) => onSelectRef.current(id),
    );
  }, [riders]);

  useEffect(() => {
    if (!selectedRider) return;
    const rider = riders.find((candidate) => candidate.id === selectedRider);
    const marker = markersRef.current.get(selectedRider);
    if (!rider || !marker) return;

    mapRef.current?.flyTo({
      center: toLngLat([rider.lat, rider.lng]),
      zoom: 16,
      duration: 700,
    });
    if (!marker.getPopup()?.isOpen()) marker.togglePopup();
  }, [riders, selectedRider]);

  return <div ref={containerRef} className="h-full w-full" />;
}
