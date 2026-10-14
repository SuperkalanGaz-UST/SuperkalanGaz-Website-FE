/** OpenFreeMap serves OpenStreetMap-derived vector tiles in MapLibre style format. */
export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export type LatLng = readonly [latitude: number, longitude: number];
export type LngLat = [longitude: number, latitude: number];

/**
 * Domain data is stored as [latitude, longitude], while MapLibre and GeoJSON
 * require [longitude, latitude]. Keeping the conversion here prevents subtle
 * coordinate-order regressions at each map boundary.
 */
export function toLngLat([latitude, longitude]: LatLng): LngLat {
  return [longitude, latitude];
}
