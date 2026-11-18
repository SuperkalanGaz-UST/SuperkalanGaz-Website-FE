'use client';

import type { FleetVehicle } from './vehicleLocations';

export default function VehicleGeofenceAlerts({ vehicles, unavailable = false }: { vehicles: FleetVehicle[]; unavailable?: boolean }) {
    const outside = vehicles.filter(vehicle => vehicle.geofence_status === 'outside');
    if (unavailable) return <p role="status" className="p-3 text-sm text-gray-500">Vehicle geofence status unavailable. Refresh to retry.</p>;
    if (outside.length > 0) return <div role="alert" aria-label="Vehicles outside assigned area" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {outside.map(vehicle => <p key={vehicle.id}><strong>{vehicle.display_name || vehicle.plate_number}</strong> is outside the branch’s assigned area.</p>)}
    </div>;
    if (vehicles.some(vehicle => vehicle.geofence_status === 'unknown')) return <p role="status" className="p-3 text-sm text-gray-500">A fresh vehicle GPS fix is needed to check the assigned area.</p>;
    if (vehicles.length > 0 && vehicles.every(vehicle => vehicle.geofence_status === 'unconfigured')) return <p role="status" className="p-3 text-sm text-gray-500">No branch area configured. A Franchise Administrator must set the branch geofence.</p>;
    if (vehicles.length > 0 && vehicles.every(vehicle => vehicle.geofence_status === 'inside')) return <p role="status" className="p-3 text-sm text-green-700">All vehicles with fresh GPS are inside the assigned area.</p>;
    return null;
}
