import { useEffect, useRef } from 'react';
import {
  AttributionControl,
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
} from 'maplibre-gl';
import type { FeatureCollection, LineString, Point, Polygon } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  OPENFREEMAP_STYLE_URL,
  toLngLat,
} from '../lib/mapConfig';

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

const SHAPE_SOURCE_ID = 'branch-geofence-shape';
const POINTS_SOURCE_ID = 'branch-geofence-points';

function shapeData(points: [number, number][]): FeatureCollection<LineString | Polygon> {
  if (points.length < 2) return { type: 'FeatureCollection', features: [] };

  const coordinates = points.map(toLngLat);
  const geometry: LineString | Polygon =
    points.length >= 3
      ? { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] }
      : { type: 'LineString', coordinates };

  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry }],
  };
}

function pointsData(points: [number, number][]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((point, index) => ({
      type: 'Feature',
      properties: { first: index === 0 },
      geometry: { type: 'Point', coordinates: toLngLat(point) },
    })),
  };
}

function updateSources(map: MapLibreMap, points: [number, number][]): void {
  (map.getSource(SHAPE_SOURCE_ID) as GeoJSONSource | undefined)?.setData(shapeData(points));
  (map.getSource(POINTS_SOURCE_ID) as GeoJSONSource | undefined)?.setData(pointsData(points));
}

function addGeofenceLayers(map: MapLibreMap, points: [number, number][]): void {
  map.addSource(SHAPE_SOURCE_ID, { type: 'geojson', data: shapeData(points) });
  map.addSource(POINTS_SOURCE_ID, { type: 'geojson', data: pointsData(points) });

  map.addLayer({
    id: 'branch-geofence-fill',
    type: 'fill',
    source: SHAPE_SOURCE_ID,
    paint: { 'fill-color': '#185FA5', 'fill-opacity': 0.15 },
  });
  map.addLayer({
    id: 'branch-geofence-line',
    type: 'line',
    source: SHAPE_SOURCE_ID,
    paint: {
      'line-color': '#185FA5',
      'line-width': 2,
      'line-dasharray': [3, 2],
    },
  });
  map.addLayer({
    id: 'branch-geofence-point-circles',
    type: 'circle',
    source: POINTS_SOURCE_ID,
    paint: {
      'circle-radius': 5,
      'circle-color': ['case', ['boolean', ['get', 'first'], false], '#1D9E75', '#ffffff'],
      'circle-stroke-color': '#185FA5',
      'circle-stroke-width': 2,
    },
  });
}

function fitInitialPoints(map: MapLibreMap, points: [number, number][]): void {
  if (points.length >= 2) {
    const bounds = points.reduce(
      (current, point) => current.extend(toLngLat(point)),
      new LngLatBounds(toLngLat(points[0]), toLngLat(points[0])),
    );
    map.fitBounds(bounds, { padding: 24, maxZoom: 16, duration: 0 });
  } else if (points.length === 1) {
    map.jumpTo({ center: toLngLat(points[0]), zoom: 15 });
  }
}

export function DrawableMap({ points, isDrawing, onAddPoint, focus }: DrawableMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pointsRef = useRef(points);
  const isDrawingRef = useRef(isDrawing);
  const onAddPointRef = useRef(onAddPoint);
  const initialPointsRef = useRef(points);
  const initialLatitude = focus?.center[0] ?? 14.2115;
  const initialLongitude = focus?.center[1] ?? 121.1653;
  const initialZoom = focus?.zoom ?? 13;
  const focusKey = `${initialLatitude}:${initialLongitude}:${initialZoom}`;
  const previousFocusKeyRef = useRef(focusKey);

  pointsRef.current = points;
  isDrawingRef.current = isDrawing;
  onAddPointRef.current = onAddPoint;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: toLngLat([initialLatitude, initialLongitude]),
      zoom: initialZoom,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new AttributionControl({ compact: true }),
      'bottom-right',
    );

    map.on('click', (event) => {
      if (isDrawingRef.current) {
        onAddPointRef.current(event.lngLat.lat, event.lngLat.lng);
      }
    });
    map.on('load', () => {
      addGeofenceLayers(map, pointsRef.current);
      fitInitialPoints(map, initialPointsRef.current);
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // The map owns its DOM lifecycle; prop changes are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) updateSources(map, points);
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = isDrawing ? 'crosshair' : '';
  }, [isDrawing]);

  useEffect(() => {
    if (previousFocusKeyRef.current === focusKey) return;
    previousFocusKeyRef.current = focusKey;
    mapRef.current?.flyTo({
      center: toLngLat([initialLatitude, initialLongitude]),
      zoom: initialZoom,
      duration: 700,
    });
  }, [focusKey, initialLatitude, initialLongitude, initialZoom]);

  return <div ref={containerRef} className="h-full w-full" />;
}
