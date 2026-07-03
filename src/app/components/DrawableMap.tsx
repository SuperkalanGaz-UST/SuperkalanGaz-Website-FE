import { useEffect } from 'react';
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

export function DrawableMap({ points, isDrawing, onAddPoint }: DrawableMapProps) {
  const center: [number, number] = [14.2115, 121.1653];
  const isClosed = points.length >= 3;

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickCapture isDrawing={isDrawing} onAddPoint={onAddPoint} />

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