import { useEffect, useState } from "react";
import { BranchGeofenceEditor } from "./BranchGeofenceEditor";
import { isBranchGeofence, type BranchGeofence } from "../lib/branchGeofence";
import { X } from "lucide-react";
import { apiFetch, apiErrorMessage } from "../lib/api";
import { toast } from "sonner";
import type { BranchRow } from "./BranchSettings";
import { ProvinceCombobox } from "./ProvinceCombobox";
import { CityMunicipalityCombobox } from "./CityMunicipalityCombobox";
import { BranchPricingRegionField } from './BranchPricingRegionField';
import { provinceFocus } from "../lib/phProvinces";
import { cityMunicipalityFocus } from "../lib/phCitiesMunicipalities";
import { formatPhMobileNational, normalizePhMobile } from "../lib/phMobile";

/** The branch's linked owner, as returned by GET /users. */
interface OwnerProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  phone: string | null;
  status: "Active" | "Inactive" | "Pending";
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
  // Keep only the editable national digits in state. The fixed +63 prefix is a
  // separate UI element and the API receives canonical E.164.
  const [contactNumber, setContactNumber] = useState(
    formatPhMobileNational(branch.contact_number ?? ""),
  );
  const [contactNumberTouched, setContactNumberTouched] = useState(false);
  const [address, setAddress] = useState(branch.address ?? "");
  const [city, setCity] = useState(branch.city ?? "");
  const [province, setProvince] = useState(branch.province ?? "");
  const [region, setRegion] = useState(branch.region ?? '');

  const addressKey = [address.trim(), city.trim(), province.trim()].join(', ');
  const [coverage, setCoverage] = useState<BranchGeofence | null>(branch.geofence);
  const [coverageAddress, setCoverageAddress] = useState(addressKey);
  const geofence = coverageAddress === addressKey ? coverage : null;

  // --- Linked owner ---
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerReload, setOwnerReload] = useState(0);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerPhoneTouched, setOwnerPhoneTouched] = useState(false);
  const [ownerStatus, setOwnerStatus] = useState<"Active" | "Inactive" | "Pending">("Active");

  const [resendingInvitation, setResendingInvitation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // owner_id is the canonical association. Directory order and branch labels
  // cannot identify an owner, especially when several accounts retain old scope.
  useEffect(() => {
    let cancelled = false;
    setOwner(null);
    setOwnerError(null);
    if (!branch.owner_id) {
      setOwnerLoading(false);
      return;
    }
    const ownerId = branch.owner_id;
    setOwnerLoading(true);
    (async () => {
      try {
        const res = await apiFetch(
          `/users?role=branch-owner&branchId=${encodeURIComponent(branch.id)}`,
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(apiErrorMessage(data, "Failed to load the owner."));
        const profiles: OwnerProfile[] = Array.isArray(data?.users) ? data.users : [];
        const assigned = profiles.find((profile) => profile.id === ownerId);
        if (!assigned) {
          throw new Error("The assigned Branch Owner could not be loaded. Retry before saving.");
        }
        if (!cancelled) {
          setOwner(assigned);
          setOwnerName(assigned.display_name ?? assigned.username ?? "");
          setOwnerEmail(assigned.email ?? "");
          setOwnerPhone(formatPhMobileNational(assigned.phone ?? ""));
          setOwnerStatus(assigned.status);
        }
      } catch (err) {
        if (!cancelled) setOwnerError(err instanceof Error ? err.message : "Failed to load the owner.");
      } finally {
        if (!cancelled) setOwnerLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [branch.id, branch.owner_id, ownerReload]);

  const handleProvinceChange = (nextProvince: string) => {
    if (nextProvince !== province) setCity("");
    setProvince(nextProvince);
  };

  const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const contactNationalDigits = normalizePhMobile(contactNumber);
  const canonicalContactNumber = contactNationalDigits ? `+63${contactNationalDigits}` : null;
  const ownerPhoneNationalDigits = normalizePhMobile(ownerPhone);
  const canonicalOwnerPhone = ownerPhoneNationalDigits ? `+63${ownerPhoneNationalDigits}` : null;
  const showContactError = contactNumberTouched && canonicalContactNumber === null;
  const showOwnerPhoneError = ownerPhoneTouched && canonicalOwnerPhone === null;
  const ownerValid =
    !owner || owner.status === "Pending" ||
    (ownerName.trim() !== "" &&
      emailValid(ownerEmail.trim()) &&
      canonicalOwnerPhone !== null);
  const canSave =
    (!geofence || isBranchGeofence(geofence)) &&
    name.trim() !== "" &&
    canonicalContactNumber !== null &&
    address.trim() !== "" &&
    city.trim() !== "" &&
    province.trim() !== "" &&
    ownerValid &&
    !ownerLoading &&
    !ownerError &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      // 1) Branch details + geofence. A rename cascades to Auth app_metadata server-side.
      const res = await apiFetch(`/branches/${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          contactNumber: canonicalContactNumber,
          address: address.trim(),
          city: city.trim(),
          province: province.trim(),
          region: region || null,
          geofence,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(apiErrorMessage(data, "Could not update the branch."));
        return;
      }

      // 2) Owner profile — only the fields that actually changed.
      if (owner && owner.status !== "Pending") {
        const patch: Record<string, unknown> = {};
        if (ownerName.trim() !== (owner.display_name ?? owner.username ?? ""))
          patch.name = ownerName.trim();
        if (ownerEmail.trim() !== (owner.email ?? "")) patch.email = ownerEmail.trim();
        if (canonicalOwnerPhone !== (owner.phone ?? "")) patch.phone = canonicalOwnerPhone;
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

      if (!data?.branch) {
        toast.error("The branch was updated, but the server returned an incomplete response.");
        return;
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
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-[620px] max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-[17px] font-medium text-[#1A1A18]">Edit branch account</h2>
            <p className="text-[13px] text-[#6B6B67] mt-1">
              Franchise Administrator · Franchise Registry
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit branch dialog"
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Branch details */}
          <div className="space-y-4">
            <BranchPricingRegionField value={region} onChange={setRegion} disabled={submitting} />
            <div>
              <label className={label}>Branch name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Contact number</label>
              <div
                className={`flex items-center h-[38px] rounded-lg border overflow-hidden ${
                  showContactError
                    ? "border-[#C0392B] focus-within:border-[#C0392B]"
                    : "border-gray-300 focus-within:ring-2 focus-within:ring-[#007BC1] focus-within:border-transparent"
                }`}
              >
                <span className="pl-3 pr-2 text-sm text-gray-500 border-r border-gray-200 select-none">
                  +63
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(formatPhMobileNational(e.target.value))}
                  onBlur={() => setContactNumberTouched(true)}
                  aria-invalid={showContactError}
                  placeholder="9XX XXX XXXX"
                  className="flex-1 min-w-0 h-full px-3 text-sm bg-transparent outline-none"
                />
              </div>
              {showContactError && (
                <p className="mt-1 text-xs text-[#C0392B]">Enter a valid PH mobile number</p>
              )}
            </div>
            <div>
              <label className={label}>Full address</label>
              <input aria-label="Full address" value={address} onChange={(e) => setAddress(e.target.value)} className={field} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Province</label>
                <ProvinceCombobox
                  value={province}
                  onChange={handleProvinceChange}
                  placeholder="Search province…"
                />
              </div>
              <div>
                <label className={label}>City / Municipality</label>
                <CityMunicipalityCombobox
                  province={province}
                  value={city}
                  onChange={setCity}
                  placeholder="Search city or municipality…"
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-[#6B6B67] -mt-2">
            Branch Owner reassignment is handled through a governance request for Super
            Administrator approval. This form updates the current owner&apos;s profile only.
          </p>

          {/* Geofence */}
          <div className="space-y-3">
            <h3 className={sectionTitle}>Coverage geofence</h3>
            <BranchGeofenceEditor address={{ address, city, province }} key={addressKey} value={geofence}
              onChange={(value) => { setCoverage(value); setCoverageAddress(addressKey); }}
              focus={cityMunicipalityFocus(province, city) ?? provinceFocus(province)} />
          </div>

          {/* Owner details */}
          <div className="space-y-3">
            <h3 className={sectionTitle}>Current owner profile</h3>
            {ownerLoading ? (
              <p className="text-sm text-gray-500">Loading owner…</p>
            ) : ownerError ? (
              <div role="alert" className="space-y-2 text-sm text-[#C0392B]">
                <p>{ownerError}</p>
                <button type="button" onClick={() => setOwnerReload((count) => count + 1)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                  Retry owner lookup
                </button>
              </div>
            ) : !owner ? (
              <p className="text-sm text-gray-500">
                No Branch Owner is linked to this branch.
              </p>
            ) : (
              <div className="space-y-4">
                {owner.status === "Pending" && <div className="space-y-2 rounded-lg bg-blue-50 p-3 text-sm text-[#00568A]">
                  <p>This Branch Owner must follow their invitation link and set their own password before signing in.</p>
                  <button type="button" disabled={resendingInvitation} className="px-3 py-2 border rounded-lg bg-white disabled:opacity-50"
                    onClick={async () => {
                      setResendingInvitation(true);
                      try {
                        const response = await apiFetch(`/branches/${branch.id}/owner-invitation/resend`, { method: 'POST' });
                        const body = await response.json().catch(() => null);
                        if (!response.ok) throw new Error(apiErrorMessage(body, 'Could not resend the invitation.'));
                        toast.success('Branch Owner invitation email sent.');
                      } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not resend the invitation.'); }
                      finally { setResendingInvitation(false); }
                    }}>{resendingInvitation ? 'Sending invitation…' : 'Resend invitation'}</button>
                </div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Owner name</label>
                    <input
                      aria-label="Owner name"
                      disabled={owner.status === "Pending"}
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={label}>Status</label>
                    <select
                      disabled={owner.status === "Pending"}
                      value={ownerStatus}
                      onChange={(e) => setOwnerStatus(e.target.value as "Active" | "Inactive")}
                      className={field}
                    >
                      {owner.status === "Pending" && <option value="Pending">Pending invitation</option>}
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
                      disabled={owner.status === "Pending"}
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={label}>Mobile number</label>
                    <div
                      className={`flex items-center h-[38px] rounded-lg border overflow-hidden ${
                        showOwnerPhoneError
                          ? "border-[#C0392B] focus-within:border-[#C0392B]"
                          : "border-gray-300 focus-within:ring-2 focus-within:ring-[#007BC1] focus-within:border-transparent"
                      }`}
                    >
                      <span className="pl-3 pr-2 text-sm text-gray-500 border-r border-gray-200 select-none">
                        +63
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        disabled={owner.status === "Pending"}
                      value={ownerPhone}
                        onChange={(e) => setOwnerPhone(formatPhMobileNational(e.target.value))}
                        onBlur={() => setOwnerPhoneTouched(true)}
                        aria-invalid={showOwnerPhoneError}
                        placeholder="9XX XXX XXXX"
                        className="flex-1 min-w-0 h-full px-3 text-sm bg-transparent outline-none"
                      />
                    </div>
                    {showOwnerPhoneError && (
                      <p className="mt-1 text-xs text-[#C0392B]">
                        Enter a valid PH mobile number
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="h-[36px] px-4 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
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
