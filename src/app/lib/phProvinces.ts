/**
 * Philippine provinces (all 82) plus the National Capital Region ("Metro
 * Manila"), each paired with an approximate geographic center and a sensible
 * default Leaflet zoom.
 *
 * This backs the Province dropdown in branch registration: picking a province
 * both records the value AND frames the geofence map over that area, so the
 * user starts drawing the coverage polygon already zoomed into the right place
 * instead of panning across the whole country.
 *
 * Centers are approximate provincial centroids (or the capital's vicinity for
 * archipelagic provinces) — good enough to frame the map, not survey-grade.
 */
export interface PHProvince {
  /** Canonical province label; also the stored `province` value. */
  name: string;
  /** [lat, lng] to center the map on when this province is selected. */
  center: [number, number];
  /** Leaflet zoom that comfortably frames the province at that center. */
  zoom: number;
}

/**
 * Metro Manila is listed first (it is not technically a province but is where
 * most branches live), then the provinces alphabetically.
 */
export const PH_PROVINCES: PHProvince[] = [
  { name: 'Metro Manila', center: [14.5995, 120.9842], zoom: 11 },

  { name: 'Abra', center: [17.5951, 120.7983], zoom: 10 },
  { name: 'Agusan del Norte', center: [8.9456, 125.5319], zoom: 10 },
  { name: 'Agusan del Sur', center: [8.4463, 125.75], zoom: 9 },
  { name: 'Aklan', center: [11.8166, 122.0942], zoom: 10 },
  { name: 'Albay', center: [13.1775, 123.528], zoom: 10 },
  { name: 'Antique', center: [11.3683, 122.0645], zoom: 9 },
  { name: 'Apayao', center: [18.0111, 121.171], zoom: 10 },
  { name: 'Aurora', center: [15.98, 121.64], zoom: 9 },
  { name: 'Basilan', center: [6.4296, 121.987], zoom: 10 },
  { name: 'Bataan', center: [14.6417, 120.4818], zoom: 11 },
  { name: 'Batanes', center: [20.4487, 121.9702], zoom: 10 },
  { name: 'Batangas', center: [13.7565, 121.0583], zoom: 10 },
  { name: 'Benguet', center: [16.5568, 120.797], zoom: 10 },
  { name: 'Biliran', center: [11.5833, 124.4642], zoom: 11 },
  { name: 'Bohol', center: [9.85, 124.1435], zoom: 10 },
  { name: 'Bukidnon', center: [8.0515, 125.0985], zoom: 9 },
  { name: 'Bulacan', center: [14.7943, 120.8799], zoom: 10 },
  { name: 'Cagayan', center: [18.2489, 121.8787], zoom: 9 },
  { name: 'Camarines Norte', center: [14.139, 122.7633], zoom: 10 },
  { name: 'Camarines Sur', center: [13.525, 123.3486], zoom: 9 },
  { name: 'Camiguin', center: [9.1732, 124.7297], zoom: 11 },
  { name: 'Capiz', center: [11.3889, 122.6277], zoom: 10 },
  { name: 'Catanduanes', center: [13.7089, 124.2422], zoom: 10 },
  { name: 'Cavite', center: [14.2456, 120.8786], zoom: 11 },
  { name: 'Cebu', center: [10.3157, 123.8854], zoom: 9 },
  { name: 'Cotabato', center: [7.2, 124.85], zoom: 9 },
  { name: 'Davao de Oro', center: [7.5, 126.1], zoom: 10 },
  { name: 'Davao del Norte', center: [7.5619, 125.6549], zoom: 10 },
  { name: 'Davao del Sur', center: [6.7656, 125.3284], zoom: 10 },
  { name: 'Davao Occidental', center: [6.1055, 125.6087], zoom: 10 },
  { name: 'Davao Oriental', center: [7.3172, 126.542], zoom: 9 },
  { name: 'Dinagat Islands', center: [10.128, 125.6083], zoom: 10 },
  { name: 'Eastern Samar', center: [11.5, 125.5], zoom: 9 },
  { name: 'Guimaras', center: [10.5929, 122.6325], zoom: 11 },
  { name: 'Ifugao', center: [16.8331, 121.171], zoom: 10 },
  { name: 'Ilocos Norte', center: [18.1647, 120.7116], zoom: 10 },
  { name: 'Ilocos Sur', center: [17.2278, 120.5739], zoom: 10 },
  { name: 'Iloilo', center: [10.95, 122.55], zoom: 9 },
  { name: 'Isabela', center: [16.9754, 121.8107], zoom: 9 },
  { name: 'Kalinga', center: [17.4739, 121.3542], zoom: 10 },
  { name: 'La Union', center: [16.6159, 120.3209], zoom: 10 },
  { name: 'Laguna', center: [14.1407, 121.4692], zoom: 10 },
  { name: 'Lanao del Norte', center: [8.073, 124.0], zoom: 10 },
  { name: 'Lanao del Sur', center: [7.8232, 124.4198], zoom: 9 },
  { name: 'Leyte', center: [10.8, 124.9], zoom: 9 },
  { name: 'Maguindanao del Norte', center: [7.2, 124.3], zoom: 10 },
  { name: 'Maguindanao del Sur', center: [6.95, 124.45], zoom: 10 },
  { name: 'Marinduque', center: [13.4767, 121.9032], zoom: 11 },
  { name: 'Masbate', center: [12.3574, 123.5504], zoom: 9 },
  { name: 'Misamis Occidental', center: [8.3375, 123.7071], zoom: 10 },
  { name: 'Misamis Oriental', center: [8.5046, 124.622], zoom: 9 },
  { name: 'Mountain Province', center: [17.0663, 121.101], zoom: 10 },
  { name: 'Negros Occidental', center: [10.292, 123.0224], zoom: 9 },
  { name: 'Negros Oriental', center: [9.6168, 123.0113], zoom: 9 },
  { name: 'Northern Samar', center: [12.3, 124.65], zoom: 10 },
  { name: 'Nueva Ecija', center: [15.5784, 121.1113], zoom: 10 },
  { name: 'Nueva Vizcaya', center: [16.3301, 121.171], zoom: 10 },
  { name: 'Occidental Mindoro', center: [13.1024, 120.7651], zoom: 9 },
  { name: 'Oriental Mindoro', center: [13.0565, 121.4069], zoom: 9 },
  { name: 'Palawan', center: [9.8349, 118.7384], zoom: 8 },
  { name: 'Pampanga', center: [15.0794, 120.62], zoom: 11 },
  { name: 'Pangasinan', center: [15.8949, 120.2863], zoom: 9 },
  { name: 'Quezon', center: [13.9333, 122.05], zoom: 9 },
  { name: 'Quirino', center: [16.27, 121.54], zoom: 10 },
  { name: 'Rizal', center: [14.6037, 121.3084], zoom: 11 },
  { name: 'Romblon', center: [12.5778, 122.2695], zoom: 10 },
  { name: 'Samar', center: [11.9, 125.0], zoom: 9 },
  { name: 'Sarangani', center: [5.928, 125.1866], zoom: 10 },
  { name: 'Siquijor', center: [9.214, 123.515], zoom: 11 },
  { name: 'Sorsogon', center: [12.9433, 124.0064], zoom: 10 },
  { name: 'South Cotabato', center: [6.2969, 124.8511], zoom: 10 },
  { name: 'Southern Leyte', center: [10.3333, 125.1667], zoom: 10 },
  { name: 'Sultan Kudarat', center: [6.5069, 124.4198], zoom: 9 },
  { name: 'Sulu', center: [6.0, 121.0], zoom: 10 },
  { name: 'Surigao del Norte', center: [9.7833, 125.4833], zoom: 10 },
  { name: 'Surigao del Sur', center: [8.7512, 126.1378], zoom: 9 },
  { name: 'Tarlac', center: [15.4755, 120.596], zoom: 10 },
  { name: 'Tawi-Tawi', center: [5.1339, 119.95], zoom: 9 },
  { name: 'Zambales', center: [15.5082, 120.0691], zoom: 10 },
  { name: 'Zamboanga del Norte', center: [8.4, 123.3], zoom: 9 },
  { name: 'Zamboanga del Sur', center: [7.8383, 123.2968], zoom: 10 },
  { name: 'Zamboanga Sibugay', center: [7.7, 122.7], zoom: 10 },
];

/** Fallback framing when no province is selected (roughly CALABARZON / Metro Manila). */
export const PH_DEFAULT_FOCUS: { center: [number, number]; zoom: number } = {
  center: [14.2115, 121.1653],
  zoom: 13,
};

/**
 * Returns the map framing (center + zoom) for a province name, or the national
 * default when the value is empty or unrecognized (e.g. an autofilled reference
 * whose province label doesn't match the canonical list).
 */
export function provinceFocus(province: string): { center: [number, number]; zoom: number } {
  const match = PH_PROVINCES.find(
    (p) => p.name.toLowerCase() === province.trim().toLowerCase(),
  );
  return match ? { center: match.center, zoom: match.zoom } : PH_DEFAULT_FOCUS;
}
