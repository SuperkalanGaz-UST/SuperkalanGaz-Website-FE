'use client';

import React, { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/Badge";
import type { RiderStatus, Rider } from "./types";

const GEOFENCE_POLYGON: [number, number][] = [
    [14.565, 121.015], [14.560, 121.035], [14.545, 121.030], [14.542, 121.010], [14.555, 121.005],
];
const MAKATI_CENTER: [number, number] = [14.5547, 121.0244];

const createRiderIcon = (status: RiderStatus) => {
    const colorVar =
        status === "active" ? "hsl(150, 60%, 30%)" :
        status === "outside" ? "hsl(0, 85%, 45%)" :
        status === "idle" ? "hsl(35, 85%, 45%)" : "hsl(203, 10%, 45%)";
    return L.divIcon({
        className: "custom-leaflet-icon",
        html: `<div style="background-color:${colorVar};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -8],
    });
};

const getStatusBadgeVariant = (status: RiderStatus) => {
    switch (status) {
        case "active": return "success" as const;
        case "outside": return "destructive" as const;
        case "idle": return "warning" as const;
        default: return "secondary" as const;
    }
};

const formatStatusText = (status: RiderStatus) => {
    switch (status) {
        case "active": return "Active";
        case "outside": return "Outside Zone";
        case "idle": return "Idle";
        default: return "Offline";
    }
};

function MapController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, 15, { duration: 1.5 });
    }, [center, map]);
    return null;
}

interface Props {
    riders: Rider[];
    mapCenter: [number, number] | null;
}

export default function FleetMap({ riders, mapCenter }: Props) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return <div style={{ height: "100%", background: "var(--muted)" }} />;

    return (
        <MapContainer center={MAKATI_CENTER} zoom={14} style={{ height: "100%", width: "100%" }} zoomControl={true}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polygon positions={GEOFENCE_POLYGON} pathOptions={{ color: "hsl(203, 50%, 45%)", fillColor: "hsl(203, 50%, 45%)", fillOpacity: 0.15, weight: 2, dashArray: "5, 5" }} />
            {riders.map((rider) => (
                <Marker key={rider.id} position={[rider.lat, rider.lng]} icon={createRiderIcon(rider.status)}>
                    <Popup>
                        <div style={{ minWidth: 180 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", gap: "0.5rem" }}>
                                <strong>{rider.name}</strong>
                                <Badge variant={getStatusBadgeVariant(rider.status)}>{formatStatusText(rider.status)}</Badge>
                            </div>
                            <div style={{ fontSize: "0.8rem" }}>Plate: <strong>{rider.plate}</strong></div>
                            {rider.currentOrder && <div style={{ fontSize: "0.8rem" }}>Order: <strong>{rider.currentOrder}</strong></div>}
                            <div style={{ fontSize: "0.8rem" }}>Updated: {rider.lastUpdated}</div>
                        </div>
                    </Popup>
                </Marker>
            ))}
            <MapController center={mapCenter} />
        </MapContainer>
    );
}
