import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon paths under Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface RadiusMapProps {
  /** Current center; null means not yet placed */
  center: [number, number] | null;
  /** Radius in kilometres */
  radius: number;
  /** Called whenever the user clicks the map to set/move the center */
  onSetCenter: (lat: number, lng: number) => void;
}

/** Captures map clicks + drag starts; updates cursor */
function ClickCapture({
  onSetCenter,
  onInteract,
}: {
  onSetCenter: (lat: number, lng: number) => void;
  onInteract: () => void;
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      onInteract();
      onSetCenter(e.latlng.lat, e.latlng.lng);
    },
    dragstart() {
      onInteract();
    },
    movestart() {
      onInteract();
    },
  });

  useEffect(() => {
    map.getContainer().style.cursor = 'crosshair';
  }, [map]);

  return null;
}

/** Flies the map to a new center when it first appears */
function FlyToCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom(), { duration: 0.6 });
  }, [center[0], center[1]]);
  return null;
}

export function RadiusMap({ center, radius, onSetCenter }: RadiusMapProps) {
  const defaultCenter: [number, number] = [14.2115, 121.1653];
  // Becomes true the moment the user clicks or pans — hides the intro overlay
  const [hasInteracted, setHasInteracted] = useState(false);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center ?? defaultCenter}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickCapture
          onSetCenter={onSetCenter}
          onInteract={() => setHasInteracted(true)}
        />

        {center && (
          <>
            <FlyToCenter center={center} />
            <Circle
              center={center}
              radius={radius * 1000}
              pathOptions={{
                color: '#185FA5',
                weight: 2,
                fillColor: '#185FA5',
                fillOpacity: 0.12,
                dashArray: '6 4',
              }}
            />
            <Marker position={center} />
          </>
        )}
      </MapContainer>

      {/* Instruction overlay — hidden once the user interacts OR places a point */}
      {!center && !hasInteracted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <div className="bg-white/90 backdrop-blur-sm border border-[#E4E4E0] rounded-xl px-4 py-2.5 shadow text-center">
            <p className="text-[13px] text-[#1A1A18] font-medium">Click anywhere on the map</p>
            <p className="text-[11px] text-[#6B6B67] mt-0.5">to place the delivery center point</p>
          </div>
        </div>
      )}

      {/* Coordinates badge */}
      {center && (
        <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-sm border border-[#E4E4E0] rounded-lg px-2.5 py-1 shadow pointer-events-none">
          <p className="text-[11px] text-[#6B6B67] font-mono">
            {center[0].toFixed(5)}, {center[1].toFixed(5)}
          </p>
        </div>
      )}
    </div>
  );
}