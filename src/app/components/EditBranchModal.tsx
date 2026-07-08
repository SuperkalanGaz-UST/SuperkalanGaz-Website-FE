import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { apiFetch, apiErrorMessage } from "../lib/api";
import { toast } from "sonner";
import type { BranchRow } from "./BranchSettings";

// Leaflet touches `window` at module load, so load the map client-side only.
const DrawableMap = dynamic(
  () => import("./DrawableMap").then((m) => m.DrawableMap),
  { ssr: false },
);

/** The branch's linked owner, as returned by GET /users. */
interface OwnerProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  phone: string | null;
  status: "Active" | "Inactive";
}

interface EditBranchModalProps {
  branch: BranchRow;
  onClose: () => void;
  onSaved: (updated: BranchRow) => void;
}

/**
 * Franchise Registry "Edit" — updates a branch's details, its delivery-coverage
 * polygon, and the linked owner's profile. Branch fields + geofence go to
 * PATCH /branches/:id; owner changes go to PATCH /users/:id. All values render
 * from real API data.
 */
export function EditBranchModal({ branch, onClose, onSaved }: EditBranchModalProps) {
  // --- Branch fields ---
  const [name, setName] = useState(branch.name);
  const [contactNumber, setContactNumber] = useState(branch.contact_number ?? "");
  const [address, setAddress] = useState(branch.address ?? "");
  const [city, setCity] = useState(branch.city ?? "");
  const [province, setProvince] = useState(branch.province ?? "");

  // --- Geofence (draw-on-map polygon) ---
  const [points, setPoints] = useState<[number, number][]>(branch.geofence?.points ?? []);
  const [isDrawing, setIsDrawing] = useState(false);
  const polygonClosed = points.length >= 3;

  // --- Linked owner ---
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerStatus, setOwnerStatus] = useState<"Active" | "Inactive">("Active");

  const [submitting, setSubmitting] = useState(false);

  // Load the owner linked to this branch (owners carry the branch name in their
  // `branches` array). If several cover it, edit the first (primary).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOwnerLoading(true);
      try {
        const res = await apiFetch(
          `/users?role=branch-owner&branch=${encodeURIComponent(branch.name)}`,
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorMessage(data, "Failed to load the owner."));
        const first = (data?.users as OwnerProfile[])?.[0] ?? null;
        if (!cancelled) {
          setOwner(first);
          if (first) {
            setOwnerName(first.display_name ?? first.username ?? "");
            setOwnerEmail(first.email ?? "");
            setOwnerPhone(first.phone ?? "");
            setOwnerStatus(first.status);
          }
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load the owner.");
      } finally {
        if (!cancelled) setOwnerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branch.name]);

  const addPoint = (lat: number, lng: number) => setPoints((prev) => [...prev, [lat, lng]]);
  const undoPoint = () => setPoints((prev) => prev.slice(0, -1));
  const clearPolygon = () => {
    setPoints([]);
    setIsDrawing(false);
  };

  const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const ownerValid =
    !owner || (ownerName.trim() !== "" && emailValid(ownerEmail.trim()));
  const canSave =
    name.trim() !== "" && address.trim() !== "" && ownerValid && !submitting;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      // 1) Branch details + geofence. A rename cascades to profiles server-side.
      const res = await apiFetch(`/branches/${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          contactNumber: contactNumber.trim(),
          address: address.trim(),
          city: city.trim(),
          province: province.trim(),
          geofence: polygonClosed ? { type: "polygon", points } : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(apiErrorMessage(data, "Could not update the branch."));
        return;
      }

      // 2) Owner profile — only the fields that actually changed.
      if (owner) {
        const patch: Record<string, unknown> = {};
        if (ownerName.trim() !== (owner.display_name ?? owner.username ?? ""))
          patch.name = ownerName.trim();
        if (ownerEmail.trim() !== (owner.email ?? "")) patch.email = ownerEmail.trim();
        if (ownerPhone.trim() !== (owner.phone ?? "")) patch.phone = ownerPhone.trim();
        if (ownerStatus !== owner.status) patch.status = ownerStatus;

        if (Object.keys(patch).length > 0) {
          const ores = await apiFetch(`/users/${owner.id}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          });
          const odata = await ores.json().catch(() => null);
          if (!ores.ok) {
            toast.error(apiErrorMessage(odata, "Branch saved, but the owner update failed."));
            return;
          }
        }
      }

      onSaved(data.branch as BranchRow);
      toast.success(`Branch "${name.trim()}" updated.`);
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "w-full px-3 h-[38px] text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none";
  const label = "block text-sm font-medium text-gray-500 mb-1";
  const sectionTitle = "text-sm font-semibold text-gray-900";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-[560px] max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Edit Branch</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Branch details */}
          <div className="space-y-4">
            <div>
              <label className={label}>Branch name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Contact number</label>
              <input
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Full address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={field} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>City / Municipality</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>Province</label>
                <input value={province} onChange={(e) => setProvince(e.target.value)} className={field} />
              </div>
            </div>
          </div>

          {/* Geofence */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={sectionTitle}>Coverage geofence</h3>
              <span className="text-xs text-gray-500">
                {polygonClosed
                  ? `Polygon · ${points.length} vertices`
                  : points.length > 0
                    ? `${points.length} point${points.length > 1 ? "s" : ""} · need ≥ 3`
                    : "No coverage set"}
              </span>
            </div>
            <div className="h-[230px] border border-gray-200 rounded-lg overflow-hidden relative">
              <DrawableMap points={points} isDrawing={isDrawing} onAddPoint={addPoint} />
              {isDrawing && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[400] bg-[#007BC1] text-white text-[11px] px-3 py-1 rounded-full shadow pointer-events-none">
                  Click map to place points
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsDrawing((v) => !v)}
                className={`px-3 h-[30px] text-xs rounded-lg font-medium transition-colors ${
                  isDrawing ? "bg-[#CC1903] text-white" : "bg-[#007BC1] text-white"
                }`}
              >
                {isDrawing ? "◼ Stop drawing" : "⬡ Draw polygon"}
              </button>
              <button
                onClick={undoPoint}
                disabled={points.length === 0}
                className="px-3 h-[30px] bg-white border border-gray-200 text-xs text-gray-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ↺ Undo last point
              </button>
              <button
                onClick={clearPolygon}
                disabled={points.length === 0}
                className="px-3 h-[30px] bg-white border border-gray-200 text-xs text-gray-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ✕ Clear
              </button>
            </div>
          </div>

          {/* Owner details */}
          <div className="space-y-3">
            <h3 className={sectionTitle}>Owner details</h3>
            {ownerLoading ? (
              <p className="text-sm text-gray-500">Loading owner…</p>
            ) : !owner ? (
              <p className="text-sm text-gray-500">
                No Branch Owner is linked to this branch.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Owner name</label>
                    <input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={label}>Status</label>
                    <select
                      value={ownerStatus}
                      onChange={(e) => setOwnerStatus(e.target.value as "Active" | "Inactive")}
                      className={field}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Email address</label>
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={label}>Mobile number</label>
                    <input
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className={field}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="h-[36px] px-4 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            className="h-[36px] px-4 bg-[#007BC1] text-white text-sm font-medium rounded-lg hover:bg-[#0069a6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
