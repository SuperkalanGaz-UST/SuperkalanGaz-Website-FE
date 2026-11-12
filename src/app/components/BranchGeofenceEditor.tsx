import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { apiFetch, apiErrorMessage } from '../lib/api';
import { circlePoints, geofenceSummary, isBranchCoordinate, type BranchGeofence } from '../lib/branchGeofence';

const DrawableMap = dynamic(() => import('./DrawableMap').then((m) => m.DrawableMap), { ssr: false });

type Props = {
  address: { address: string; city: string; province: string };
  value: BranchGeofence | null;
  onChange: (value: BranchGeofence | null) => void;
  focus?: { center: [number, number]; zoom: number };
};

export function BranchGeofenceEditor({ value, onChange, focus, address }: Props) {
  const [matches, setMatches] = useState<{ label: string; center: [number, number] }[]>([]);
  const [locating, setLocating] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  async function locateAddress() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLocating(true);
    setMatches([]);
    setLookupMessage('');
    try {
      const response = await apiFetch('/branches/locate-address', { method: 'POST', body: JSON.stringify(address), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(data, 'Address search is unavailable. Try again or place the pin manually.'));
      if (controller.signal.aborted) return;
      if (!Array.isArray(data?.matches)) throw new Error('Address search returned an invalid response. Try again or place the pin manually.');
      const results = data.matches.filter((match: unknown): match is { label: string; center: [number, number] } => {
        if (!match || typeof match !== 'object') return false;
        const item = match as Record<string, unknown>;
        return typeof item.label === 'string' && isBranchCoordinate(item.center);
      });
      setMatches(results);
      setLookupMessage(results.length ? 'Choose an address match, then confirm the branch pin on the map.' : 'No address match found. Check the address or place the branch pin manually.');
    } catch (error) {
      if (!controller.signal.aborted) setLookupMessage(error instanceof Error ? error.message : 'Address search is unavailable. Try again or place the pin manually.');
    } finally {
      if (!controller.signal.aborted) setLocating(false);
    }
  }

  const [mode, setMode] = useState<'circle' | 'polygon'>(value && !value.radiusMeters ? 'polygon' : 'circle');
  const [placingPin, setPlacingPin] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [radius, setRadius] = useState(value?.radiusMeters ?? 1000);
  const center = value?.center;
  const points = value?.points ?? [];
  const radiusValid = Number.isFinite(radius) && radius >= 100 && radius <= 50000;
  const button = 'px-3 py-2 rounded-lg border border-[#E4E4E0] text-xs disabled:opacity-40';

  function placeCenter(lat: number, lng: number) {
    const nextCenter: [number, number] = [lat, lng];
    onChange(mode === 'circle'
      ? { type: 'polygon', center: nextCenter, radiusMeters: radius, points: radiusValid ? circlePoints(nextCenter, radius) : [] }
      : { type: 'polygon', center: nextCenter, points });
    setPlacingPin(false);
  }

  function changeMode(next: 'circle' | 'polygon') {
    if (next === mode) return;
    setMode(next);
    setDrawing(false);
    onChange(next === 'circle' && center
      ? { type: 'polygon', center, radiusMeters: radius, points: radiusValid ? circlePoints(center, radius) : [] }
      : center ? { type: 'polygon', center, points: [] } : null);
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-[#F7F7F6] border border-[#E4E4E0] rounded-lg space-y-2">
        <p className="text-xs text-[#6B6B67]">Branch address</p>
        <p className="text-sm">{[address.address, address.city, address.province].filter(Boolean).join(', ')}</p>
        <button type="button" onClick={locateAddress} disabled={locating || !address.address || !address.city || !address.province} className={`${button} bg-white`}>{locating ? 'Locating address…' : 'Locate address'}</button>
        {lookupMessage && <p role="status" className="text-xs text-[#6B6B67]">{lookupMessage}</p>}
        {matches.map((match, index) => <button key={index} type="button" className="block w-full text-left p-2 text-xs border border-[#B5D4F4] rounded-lg bg-white hover:bg-[#E6F1FB]" onClick={() => { placeCenter(...match.center); setMatches([]); setLookupMessage('Address located. Confirm the pin marks the exact branch location.'); }}>{match.label}</button>)}
        <p className="text-[11px] text-[#6B6B67]">Address search: Nominatim · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a></p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={mode === 'circle'} onClick={() => changeMode('circle')} className={`${button} ${mode === 'circle' ? 'bg-[#185FA5] text-white' : 'bg-white'}`}>Circle radius</button>
        <button type="button" aria-pressed={mode === 'polygon'} onClick={() => changeMode('polygon')} className={`${button} ${mode === 'polygon' ? 'bg-[#185FA5] text-white' : 'bg-white'}`}>Draw polygon</button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" aria-pressed={placingPin} onClick={() => { setPlacingPin(!placingPin); setDrawing(false); }} className={`${button} bg-white`}>
          {placingPin ? 'Cancel pin placement' : center ? 'Move branch pin' : 'Place branch pin'}
        </button>
        {mode === 'circle' && <label className="text-xs text-[#6B6B67]">Geofence radius (metres)
          <input aria-label="Geofence radius (metres)" type="number" min="100" max="50000" step="100" value={radius || ''} aria-invalid={!radiusValid}
            onChange={(event) => {
              const next = Number(event.target.value);
              setRadius(next);
              if (center) onChange({ type: 'polygon', center, radiusMeters: next, points: next >= 100 && next <= 50000 ? circlePoints(center, next) : [] });
            }} className="block mt-1 px-3 py-2 w-40 border border-[#E4E4E0] rounded-lg text-sm text-[#1A1A18]" />
        </label>}
      </div>
      {mode === 'circle' && !radiusValid && <p role="alert" className="text-xs text-red-700">Enter a radius from 100 to 50,000 metres.</p>}
      <p className="text-xs text-[#6B6B67]">{placingPin ? 'Click the map at the branch location.' : center ? 'Drag the pin or use Move branch pin to confirm the exact branch location.' : 'Place a pin at the branch location to set the centre of the circle.'}</p>
      <div className="h-[300px] border border-[#E4E4E0] rounded-lg overflow-hidden relative">
        <DrawableMap points={points} isDrawing={drawing} branchCenter={center} showVertices={mode === 'polygon'}
          onPlaceCenter={placingPin ? placeCenter : undefined} onMoveCenter={placeCenter}
          onAddPoint={(lat, lng) => onChange({ type: 'polygon', ...(center ? { center } : {}), points: [...points, [lat, lng]] })}
          focus={focus} />
        {(placingPin || drawing) && <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#185FA5] text-white text-xs px-3 py-1 rounded-full pointer-events-none">{placingPin ? 'Click to place branch pin' : 'Click to add polygon points'}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mode === 'polygon' && <>
          <button type="button" className={`${button} bg-[#185FA5] text-white`} onClick={() => { setDrawing(!drawing); setPlacingPin(false); }}>{drawing ? 'Stop drawing' : 'Start drawing'}</button>
          <button type="button" className={button} disabled={!points.length} onClick={() => onChange({ type: 'polygon', ...(center ? { center } : {}), points: points.slice(0, -1) })}>Undo last point</button>
        </>}
        <button type="button" className={button} disabled={!value} onClick={() => { onChange(null); setDrawing(false); setPlacingPin(false); }}>Clear geofence</button>
        <span role="status" className="text-xs text-[#6B6B67]">{geofenceSummary(value)}{mode === 'polygon' && points.length > 0 && points.length < 3 ? ' · need at least 3 points' : ''}</span>
      </div>
      {center && <p className="text-xs text-[#6B6B67]">Branch centre: {center[0].toFixed(6)}, {center[1].toFixed(6)}</p>}
    </div>
  );
}
