'use client';

import { useEffect, useRef } from "react";
import {
    AttributionControl,
    GeoJSONSource,
    LngLatBounds,
    Map as MapLibreMap,
    Marker,
    NavigationControl,
    Popup,
} from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import { OPENFREEMAP_STYLE_URL, toLngLat } from "../../../lib/mapConfig";
import type { BranchGeofence } from "../../../lib/branchGeofence";
import type {
    FleetRiderStatus,
    PositionedFleetRider as Rider,
} from "../../../lib/fleetPresentationData";

const riderColor = (status: FleetRiderStatus): string => {
    const colorVar =
        status === "active" ? "hsl(150, 60%, 30%)" :
        status === "outside-geofence" ? "hsl(35, 85%, 45%)" :
        "hsl(203, 10%, 45%)";
    return colorVar;
};

const formatStatusText = (status: FleetRiderStatus) => {
    switch (status) {
        case "active": return "Active";
        case "outside-geofence": return "Outside geofence";
        default: return "Inactive";
    }
};

function popupRow(label: string, value: string): HTMLDivElement {
    const row = document.createElement("div");
    row.style.fontSize = "0.8rem";
    row.append(`${label}: `);
    const strong = document.createElement("strong");
    strong.textContent = value;
    row.append(strong);
    return row;
}

function createPopupContent(rider: Rider): HTMLDivElement {
    const content = document.createElement("div");
    content.style.minWidth = "180px";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;gap:.5rem";
    const name = document.createElement("strong");
    name.textContent = rider.name;
    const status = document.createElement("span");
    status.textContent = formatStatusText(rider.status);
    status.style.cssText = `background:${riderColor(rider.status)};color:white;border-radius:999px;padding:2px 7px;font-size:.7rem;white-space:nowrap`;
    header.append(name, status);
    content.append(header, popupRow("Plate", rider.plateNumber));
    if (rider.currentOrder) content.append(popupRow("Order", rider.currentOrder));
    content.append(popupRow("Updated", rider.lastUpdated));
    return content;
}

function createRiderMarker(rider: Rider): Marker {
    const element = document.createElement("button");
    element.type = "button";
    element.title = `${rider.name} — ${formatStatusText(rider.status)}`;
    element.setAttribute("aria-label", element.title);
    element.style.cssText = `width:20px;height:20px;padding:0;border-radius:50%;border:3px solid white;background:${riderColor(rider.status)};box-shadow:0 2px 7px rgba(0,0,0,.4);cursor:pointer`;

    return new Marker({ element, anchor: "center" })
        .setLngLat(toLngLat([rider.lat, rider.lng]))
        .setPopup(new Popup({ offset: 14 }).setDOMContent(createPopupContent(rider)));
}

function syncRiderMarkers(
    map: MapLibreMap,
    riders: Rider[],
    markers: Map<string, Marker>,
): void {
    markers.forEach((marker) => marker.remove());
    markers.clear();
    riders.forEach((rider) => {
        const marker = createRiderMarker(rider).addTo(map);
        markers.set(rider.id, marker);
    });
}

function toGeofenceFeature(geofence: BranchGeofence): Feature<Polygon> {
    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [[
                ...geofence.points.map(toLngLat),
                toLngLat(geofence.points[0]),
            ]],
        },
    };
}

function fitGeofence(map: MapLibreMap, geofence: BranchGeofence, duration: number): void {
    const firstPoint = toLngLat(geofence.points[0]);
    const bounds = geofence.points.reduce(
        (current, point) => current.extend(toLngLat(point)),
        new LngLatBounds(firstPoint, firstPoint),
    );
    map.fitBounds(bounds, { padding: 55, maxZoom: 16, duration });
}

interface Props {
    riders: Rider[];
    geofence: BranchGeofence;
    mapCenter: [number, number] | null;
}

export default function FleetMap({ riders, geofence, mapCenter }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const ridersRef = useRef(riders);
    const geofenceRef = useRef(geofence);
    const markersRef = useRef(new Map<string, Marker>());
    ridersRef.current = riders;
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
        map.addControl(new NavigationControl({ showCompass: false }), "top-right");
        map.addControl(
            new AttributionControl({ compact: true }),
            "bottom-right",
        );
        map.on("load", () => {
            map.addSource("fleet-geofence", {
                type: "geojson",
                data: toGeofenceFeature(geofenceRef.current),
            });
            map.addLayer({
                id: "fleet-geofence-fill",
                type: "fill",
                source: "fleet-geofence",
                paint: { "fill-color": "hsl(203, 50%, 45%)", "fill-opacity": 0.15 },
            });
            map.addLayer({
                id: "fleet-geofence-outline",
                type: "line",
                source: "fleet-geofence",
                paint: {
                    "line-color": "hsl(203, 50%, 45%)",
                    "line-width": 2,
                    "line-dasharray": [2.5, 2.5],
                },
            });
            fitGeofence(map, geofenceRef.current, 0);
            syncRiderMarkers(map, ridersRef.current, markers);
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
        if (map?.isStyleLoaded()) syncRiderMarkers(map, riders, markersRef.current);
    }, [riders]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const source = map.getSource("fleet-geofence") as GeoJSONSource | undefined;
        source?.setData(toGeofenceFeature(geofence));
        fitGeofence(map, geofence, 900);
    }, [geofence]);

    useEffect(() => {
        if (mapCenter) {
            mapRef.current?.flyTo({ center: toLngLat(mapCenter), zoom: 15, duration: 1500 });
        }
    }, [mapCenter]);

    return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
