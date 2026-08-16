'use client';

import React, { useEffect, useRef } from "react";
import {
    AttributionControl,
    Map as MapLibreMap,
    Marker,
    NavigationControl,
    Popup,
} from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import { OPENFREEMAP_STYLE_URL, toLngLat } from "../../../lib/mapConfig";
import type { RiderStatus, Rider } from "./types";

const GEOFENCE_POLYGON: [number, number][] = [
    [14.565, 121.015], [14.560, 121.035], [14.545, 121.030], [14.542, 121.010], [14.555, 121.005],
];
const MAKATI_CENTER: [number, number] = [14.5547, 121.0244];

const riderColor = (status: RiderStatus): string => {
    const colorVar =
        status === "active" ? "hsl(150, 60%, 30%)" :
        status === "outside" ? "hsl(0, 85%, 45%)" :
        status === "idle" ? "hsl(35, 85%, 45%)" : "hsl(203, 10%, 45%)";
    return colorVar;
};

const formatStatusText = (status: RiderStatus) => {
    switch (status) {
        case "active": return "Active";
        case "outside": return "Outside Zone";
        case "idle": return "Idle";
        default: return "Offline";
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
    content.append(header, popupRow("Plate", rider.plate));
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

const geofenceData: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
        type: "Polygon",
        coordinates: [[...GEOFENCE_POLYGON.map(toLngLat), toLngLat(GEOFENCE_POLYGON[0])]],
    },
};

interface Props {
    riders: Rider[];
    mapCenter: [number, number] | null;
}

export default function FleetMap({ riders, mapCenter }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const ridersRef = useRef(riders);
    const markersRef = useRef(new Map<string, Marker>());
    ridersRef.current = riders;

    useEffect(() => {
        if (!containerRef.current) return;

        const map = new MapLibreMap({
            container: containerRef.current,
            style: OPENFREEMAP_STYLE_URL,
            center: toLngLat(MAKATI_CENTER),
            zoom: 14,
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
            map.addSource("fleet-geofence", { type: "geojson", data: geofenceData });
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
        if (mapCenter) {
            mapRef.current?.flyTo({ center: toLngLat(mapCenter), zoom: 15, duration: 1500 });
        }
    }, [mapCenter]);

    return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
