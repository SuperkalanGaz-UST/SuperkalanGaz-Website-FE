import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's broken default icon paths under Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DrawableMapProps {
  points: [number, number][];
  isDrawing: boolean;
  onAddPoint: (lat: number, lng: number) => void;
  /**
   * Where to frame the map initially — typically the center of the selected
   * province, so drawing starts already zoomed into the right area. Defaults to
   * the national fallback when omitted (e.g. the edit modal that has no picker).
   */
  focus?: { center: [number, number]; zoom: number };
}

function ClickCapture({
  isDrawing,
  onAddPoint,
}: {
  isDrawing: boolean;
  onAddPoint: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = isDrawing ? 'crosshair' : '';
  }, [isDrawing, map]);

  return null;
}

/**
 * On open, frame the map to the polygon that was seeded in (an existing branch's
 * saved geofence). Captured once at mount so it never fights the user's view
 * while they draw — a from-scratch map (no seeded points) keeps its default view.
 */
function FitToSavedPolygon({ points }: { points: [number, number][] }) {
  const map = useMap();
  const seeded = useRef(points);

  useEffect(() => {
    const pts = seeded.current;
    if (pts.length >= 2) {
      map.fitBounds(pts as L.LatLngBoundsExpression, { padding: [24, 24], maxZoom: 16 });
    } else if (pts.length === 1) {
      map.setView(pts[0], 15);
    }
  }, [map]);

  return null;
}

export function DrawableMap({ points, isDrawing, onAddPoint, focus }: DrawableMapProps) {
  const center: [number, number] = focus?.center ?? [14.2115, 121.1653];
  const zoom = focus?.zoom ?? 13;
  const isClosed = points.length >= 3;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickCapture isDrawing={isDrawing} onAddPoint={onAddPoint} />
      <FitToSavedPolygon points={points} />

      {isClosed && (
        <Polygon
          positions={points}
          pathOptions={{
            color: '#185FA5',
            weight: 2,
            fillColor: '#185FA5',
            fillOpacity: 0.15,
            dashArray: '6 4',
          }}
        />
      )}

      {points.length >= 2 && !isClosed && (
        <Polyline
          positions={points}
          pathOptions={{ color: '#185FA5', weight: 2, dashArray: '6 4' }}
        />
      )}

      {points.map((pt, i) => (
        <CircleMarker
          key={i}
          center={pt}
          radius={5}
          pathOptions={{
            color: '#185FA5',
            fillColor: i === 0 ? '#1D9E75' : '#ffffff',
            fillOpacity: 1,
            weight: 2,
          }}
        />
      ))}
    </MapContainer>
  );
}