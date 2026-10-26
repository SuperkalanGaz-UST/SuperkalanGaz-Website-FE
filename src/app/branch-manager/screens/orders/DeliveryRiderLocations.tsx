'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronUp, MapPin, RefreshCw } from 'lucide-react';
import { dispatchLocation, isLocationStale, operationalLocationLabel, type DispatchRider } from '../../../lib/deliveryRiderLocation';
import styles from './DeliveryRiderLocations.module.css';

const LocationMap = dynamic(() => import('./DeliveryRiderLocationMap'), {
  ssr: false,
  loading: () => <div className={styles.message}>Loading location map…</div>,
});

export function DeliveryRiderLocations({ riders, loading, refreshing, error, onRefresh }: {
  riders: DispatchRider[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const positioned = riders.filter(rider => dispatchLocation(rider));
  const active = riders.filter(rider => ['Available', 'On Delivery'].includes(rider.status));

  return (
    <section className={styles.panel} aria-label="Delivery Rider locations">
      <div className={styles.header}>
        <div>
          <h2><MapPin size={18} />Delivery Rider locations</h2>
          <p>Latest phone locations for dispatch · refreshes every 15 seconds.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" disabled={refreshing} onClick={onRefresh} aria-label="Refresh Delivery Rider locations"><RefreshCw size={15} />Refresh</button>
          <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="delivery-rider-locations-body">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{open ? 'Hide map' : 'Show map'}
          </button>
        </div>
      </div>
      {open && <div id="delivery-rider-locations-body">
        {loading ? <div className={styles.message}>Loading Delivery Rider locations…</div>
          : error ? <div className={styles.message} role="alert">Delivery Rider locations unavailable. {error} Use Refresh to retry.</div>
            : active.length === 0 ? <div className={styles.message}>No Delivery Riders are Available or On Delivery. Phone location appears when they go Available and allow location access.</div>
              : <div className={styles.body}>
                {positioned.length > 0
                  ? <LocationMap riders={positioned} selectedId={selectedId} onSelect={setSelectedId} now={now} />
                  : <div className={styles.message}>No phone locations received yet. Delivery Riders must allow location access and keep the app open.</div>}
                <div className={styles.roster} aria-label="Delivery Rider phone locations">
                  {active.map(rider => {
                    const location = dispatchLocation(rider);
                    const stale = location ? isLocationStale(location, now) : false;
                    return <button key={rider.id} type="button" disabled={!location} className={styles.rider} data-selected={selectedId === rider.id} onClick={() => setSelectedId(rider.id)}>
                      <span className={styles.riderHeader}><strong>{rider.name}</strong><span>{rider.status}</span></span>
                      <span>{rider.assigned_vehicle
                        ? `Assigned vehicle: ${rider.assigned_vehicle.plate_number}${rider.assigned_vehicle.status === 'maintenance' ? ' · Maintenance' : ''}`
                        : rider.assigned_vehicle === null ? 'No vehicle assigned' : 'Vehicle assignment unavailable'}</span>
                      <span className={stale ? styles.stale : styles.fresh}>{operationalLocationLabel(rider, now)}{stale ? ' · last known position' : ''}</span>
                      {location && <>
                        <span className={styles.coordinates}>Phone GPS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
                        <span>Captured {new Date(location.capturedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                          {location.accuracyM !== null ? ` · Accuracy ±${Math.round(location.accuracyM)} m` : ' · Accuracy unavailable'}</span>
                      </>}
                    </button>;
                  })}
                </div>
              </div>}
        <p className={styles.note}>Vehicles link automatically from the Branch Manager’s saved assignment. Phone location is shared while Available or On Delivery with the app open. Amber pins show positions at least 15 minutes old. Vehicle GPS remains separate.</p>
      </div>}
    </section>
  );
}
