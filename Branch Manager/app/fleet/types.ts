export type RiderStatus = "active" | "idle" | "outside" | "offline";

export interface Rider {
    id: string;
    name: string;
    plate: string;
    status: RiderStatus;
    lat: number;
    lng: number;
    currentOrder: string | null;
    lastUpdated: string;
}
