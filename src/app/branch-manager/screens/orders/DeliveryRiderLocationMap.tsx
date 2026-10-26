'use client';

import { useEffect, useRef, useState } from 'react';
import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import { OPENFREEMAP_STYLE_URL } from '../../../lib/mapConfig';
import { dispatchLocation, isLocationStale, type DispatchRider } from '../../../lib/deliveryRiderLocation';
import styles from './DeliveryRiderLocations.module.css';

export default function DeliveryRiderLocationMap({ riders, selectedId, onSelect, now }: {
  riders: DispatchRider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const fitted = useRef(false);
  const [mapError, setMapError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: container.current,
        style: OPENFREEMAP_STYLE_URL,
        attributionControl: false,
      });
    } catch {
      setMapError(true);
      return;
    }
    mapRef.current = map;
    fitted.current = false;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    map.on('error', () => setMapError(true));
    map.on('load', () => setMapError(false));
    return () => { mapRef.current = null; map.remove(); };
  }, [retry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: Marker[] = [];
    const bounds = new LngLatBounds();
    for (const rider of riders) {
      const location = dispatchLocation(rider);
      if (!location) continue;
      const element = document.createElement('button');
      element.type = 'button';
      element.className = styles.pin;
      element.dataset.stale = String(isLocationStale(location, now));
      element.dataset.selected = String(rider.id === selectedId);
      element.setAttribute('aria-label', `Show location of ${rider.name}`);
      element.title = `${rider.name} · ${rider.status}`;
      element.textContent = rider.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('');
      element.addEventListener('click', () => onSelect(rider.id));
      const coordinates: [number, number] = [location.longitude, location.latitude];
      markers.push(new Marker({ element }).setLngLat(coordinates).addTo(map));
      bounds.extend(coordinates);
    }
    const selected = riders.find(rider => rider.id === selectedId);
    const location = selected ? dispatchLocation(selected) : null;
    if (location) map.easeTo({ center: [location.longitude, location.latitude], zoom: 15, duration: 300 });
    else if (!fitted.current && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 65, maxZoom: 14, duration: 0 });
      fitted.current = true;
    }
    return () => { markers.forEach(marker => marker.remove()); };
  }, [riders, selectedId, onSelect, now, retry]);

  return (
    <div className={styles.mapFrame}>
      <div ref={container} className={styles.map} aria-label="Delivery Rider phone location map" />
      {mapError && <div className={styles.mapError} role="status">
        <span>Map unavailable. Latest phone coordinates are listed beside it.</span>
        <button type="button" onClick={() => { setMapError(false); setRetry(value => value + 1); }}>Retry map</button>
      </div>}
    </div>
  );
}
