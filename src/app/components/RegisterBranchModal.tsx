import dynamic from 'next/dynamic';
import { useState } from 'react';

// Leaflet touches `window` at module load, so the map components must be
// loaded client-side only.
const DrawableMap = dynamic(
  () => import('./DrawableMap').then((m) => m.DrawableMap),
  { ssr: false },
);
const RadiusMap = dynamic(
  () => import('./RadiusMap').then((m) => m.RadiusMap),
  { ssr: false },
);
import { X, Check, Info } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, apiErrorMessage } from '../lib/api';
import { BranchCreatedModal } from './BranchCreatedModal';
import { StoreLocationCombobox, StoreLocation } from './StoreLocationCombobox';

interface RegisterBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Normalizes any Philippine mobile input to the canonical +63 country-code form.
 *
 * Accepts whatever the user (or a paste) throws at it — `0917…`, `917…`,
 * `+63 917…`, `63917…` — strips everything down to the 10 national digits
 * (which always start with 9), then re-emits it grouped as `+63 9XX XXX XXXX`.
 * Typing `09` therefore becomes `+63 9…` live in the field. The stored value is
 * just this string; strip the spaces at submit time if the API wants raw digits.
 */
function formatPHMobile(raw: string): string {
  let digits = raw.replace(/\D/g, ''); // keep digits only

  // Peel off a leading country code (63) or trunk prefix (0) so we're always
  // left with the 10-digit national number.
  if (digits.startsWith('63')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  digits = digits.slice(0, 10); // PH mobile national numbers are exactly 10 digits
  if (digits === '') return '';

  // Group as +63 9XX XXX XXXX, dropping trailing empty groups while still typing.
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return `+63 ${groups.join(' ')}`.trimEnd();
}

export function RegisterBranchModal({ isOpen, onClose }: RegisterBranchModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [ownerType, setOwnerType] = useState<'existing' | 'new'>('existing');
  const [geoMode, setGeoMode] = useState<'draw' | 'coordinates' | 'radius'>('draw');
  const [selectedOwner, setSelectedOwner] = useState('Maria Alvarez');

  // Form state — all Step 1 fields start empty; the old sample values now live
  // in each input's `placeholder` for visual reference only.
  const [branchName, setBranchName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [stockThreshold, setStockThreshold] = useState('');

  // The known_store_locations row this branch is being provisioned from. Set
  // when an existing location is chosen from the combobox; null for a free-text
  // ("create new") branch. Sent as source_store_location_id on submit and used
  // by the backend to flag a reference as already registered.
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);

  // A known reference location was picked: adopt its address + province as
  // editable DEFAULTS. City is intentionally left blank-but-editable (the seed
  // never carries a reliable city; we never fabricate one from the address).
  const handleSelectReference = (location: StoreLocation) => {
    setBranchName(location.name);
    setAddress(location.full_address);
    setProvince(location.province ?? '');
    setCity('');
    setSelectedReferenceId(location.id);
  };

  // "Create new branch: '<typed>'": a brand-new branch with no autofill. Keep
  // the typed name, clear the address fields, and record no reference.
  const handleCreateNewBranch = (typed: string) => {
    setBranchName(typed);
    setAddress('');
    setCity('');
    setProvince('');
    setSelectedReferenceId(null);
  };

  // New owner fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');

  // Geofence fields
  const [curfewStart, setCurfewStart] = useState('06:00');
  const [curfewEnd, setCurfewEnd] = useState('21:00');
  const [radius, setRadius] = useState(5);
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(null);

  // Barangay selection
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedBarangays, setSelectedBarangays] = useState<string[]>([]);

  // Sample data - replace with actual data from API
  const regions = ['Region IV-A (CALABARZON)', 'NCR', 'Region III (Central Luzon)'];
  const cities = selectedRegion === 'Region IV-A (CALABARZON)'
    ? ['Calamba City', 'Santa Rosa City', 'Biñan City', 'San Pedro City']
    : [];
  const districts = selectedCity ? ['District 1', 'District 2'] : [];
  const barangays = selectedDistrict || selectedCity
    ? ['Barangay 1 (Poblacion)', 'Barangay 2 (Poblacion)', 'Barangay 3 (Poblacion)', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Pansol', 'Real', 'Canlubang', 'Majada Labas']
    : [];

  const toggleBarangay = (barangay: string) => {
    if (selectedBarangays.includes(barangay)) {
      setSelectedBarangays(selectedBarangays.filter(b => b !== barangay));
    } else {
      setSelectedBarangays([...selectedBarangays, barangay]);
    }
  };

  const removeBarangay = (barangay: string) => {
    setSelectedBarangays(selectedBarangays.filter(b => b !== barangay));
  };

  // Polygon drawing state (Draw on map mode)
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);

  const handleAddPoint = (lat: number, lng: number) => {
    setPolygonPoints((prev) => [...prev, [lat, lng]]);
  };

  const handleUndoPoint = () => {
    setPolygonPoints((prev) => prev.slice(0, -1));
  };

  const handleClearPolygon = () => {
    setPolygonPoints([]);
    setIsDrawingPolygon(false);
  };

  /** Approximate polygon area in km² using the spherical excess formula */
  const calcArea = (pts: [number, number][]): number => {
    if (pts.length < 3) return 0;
    const R = 6371;
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [lat1, lng1] = pts[i];
      const [lat2, lng2] = pts[(i + 1) % pts.length];
      area +=
        ((lng2 - lng1) * Math.PI) / 180 *
        (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
    }
    return Math.abs((area * R * R) / 2);
  };

  const polygonArea = calcArea(polygonPoints);
  const polygonClosed = polygonPoints.length >= 3;

  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // One-time password returned when a brand-new owner login is provisioned.
  const [ownerTempPassword, setOwnerTempPassword] = useState<string | null>(null);

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  /**
   * Flattens the four wizard steps into the backend's CreateBranchDto and POSTs
   * it. apiFetch attaches the caller's Supabase token; the API verifies FA role
   * server-side. Only opens the success modal once the branch is persisted.
   */
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await apiFetch('/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: branchName,
          contactNumber,
          address,
          city,
          province,
          // Provenance: the reference this branch came from, or null for free-text.
          sourceStoreLocationId: selectedReferenceId,
          ownerType,
          ownerName: resolvedOwnerName,
          ownerEmail: resolvedOwnerEmail,
          ownerMobile: ownerType === 'new' ? mobile : undefined,
          // NOTE: low-stock threshold, geofence, and curfew are collected by the
          // wizard UI but intentionally NOT sent — they have no home in
          // core.branches yet (deferred). The API ignores them if sent.
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(apiErrorMessage(data, 'Could not create the branch. Please try again.'));
        return;
      }

      // Present only when a new owner was provisioned (no email infra to send it).
      setOwnerTempPassword(data?.owner?.tempPassword ?? null);
      setShowSuccess(true);
    } catch {
      toast.error('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onClose();
    setCurrentStep(1);
  };

  const handleRegisterAnother = () => {
    setShowSuccess(false);
    setOwnerTempPassword(null);
    setCurrentStep(1);
    setBranchName('');
    setSelectedReferenceId(null);
    setContactNumber('');
    setAddress('');
    setCity('');
    setProvince('');
    setStockThreshold('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setMobile('');
    setCurfewStart('06:00');
    setCurfewEnd('21:00');
    setRadius(5);
    setRadiusCenter(null);
    setSelectedRegion('');
    setSelectedCity('');
    setSelectedDistrict('');
    setSelectedBarangays([]);
  };

  const getGeofenceSummary = () => {
    if (geoMode === 'draw') return `Polygon · ${polygonPoints.length} vertices · ~${polygonArea.toFixed(2)} km²`;
    if (geoMode === 'radius') return `Radius · ${radius} km from center`;
    if (selectedBarangays.length > 0)
      return `${selectedBarangays.length} barangay${selectedBarangays.length > 1 ? 's' : ''} · ${selectedCity || city}`;
    return 'Barangay selection';
  };

  const resolvedOwnerName =
    ownerType === 'existing' ? selectedOwner : `${firstName} ${lastName}`.trim() || 'New Owner';
  const resolvedOwnerEmail =
    ownerType === 'existing'
      ? selectedOwner === 'Maria Alvarez'
        ? 'maria.alvarez@superkalan.ph'
        : 'ramon.dc@superkalan.ph'
      : email || 'owner@superkalan.ph';

  if (!isOpen && !showSuccess) return null;

  const isStepValid = (() => {
    if (currentStep === 1) {
      return (
        branchName.trim() !== '' &&
        contactNumber.trim() !== '' &&
        address.trim() !== '' &&
        city.trim() !== '' &&
        province.trim() !== '' &&
        stockThreshold.trim() !== ''
      );
    }
    if (currentStep === 2) {
      if (ownerType === 'existing') return true;
      return (
        firstName.trim() !== '' &&
        lastName.trim() !== '' &&
        email.trim() !== '' &&
        mobile.trim() !== ''
      );
    }
    if (currentStep === 3) {
      if (geoMode === 'coordinates') {
        return selectedCity !== '' && selectedBarangays.length > 0;
      }
      return true;
    }
    return true;
  })();

  const steps = [
    { number: 1, label: 'Branch details', status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'active' : 'idle' },
    { number: 2, label: 'Assign owner', status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : 'idle' },
    { number: 3, label: 'Geofence setup', status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : 'idle' },
    { number: 4, label: 'Review & confirm', status: currentStep === 4 ? 'active' : 'idle' },
  ];

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[620px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#E4E4E0]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[17px] font-medium text-[#1A1A18]">Register new branch account</h2>
              <p className="text-[13px] text-[#6B6B67] mt-1">System Admin · Franchise Registry</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full border border-[#E4E4E0] flex items-center justify-center text-[#6B6B67] hover:bg-gray-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Step Progress Bar */}
          <div className="flex items-center gap-3 mt-6">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex items-center gap-3 flex-1">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                        step.status === 'completed'
                          ? 'bg-[#1D9E75] text-white'
                          : step.status === 'active'
                          ? 'bg-[#185FA5] text-white'
                          : 'border border-[#E4E4E0] text-[#6B6B67]'
                      }`}
                    >
                      {step.status === 'completed' ? <Check className="w-4 h-4" /> : step.number}
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={`h-[1px] flex-1 ${idx === 0 && currentStep > 1 ? 'bg-[#1D9E75]' : 'bg-[#E4E4E0]'}`} />
                    )}
                  </div>
                  <span
                    className={`text-[11px] whitespace-nowrap ${
                      step.status === 'completed'
                        ? 'text-[#0F6E56]'
                        : step.status === 'active'
                        ? 'text-[#185FA5]'
                        : 'text-[#6B6B67]'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Step 1: Branch Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#6B6B67] mb-1">Branch name</label>
                  {/* Creatable combobox seeded from known Superkalan store locations.
                      Typing away from a selection clears the reference link so a
                      hand-edited name is treated as a new branch, not the reference. */}
                  <StoreLocationCombobox
                    value={branchName}
                    onChange={(v) => {
                      setBranchName(v);
                      setSelectedReferenceId(null);
                    }}
                    onSelectReference={handleSelectReference}
                    onCreateNew={handleCreateNewBranch}
                    placeholder="Search known locations…"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B6B67] mb-1">Contact number</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={contactNumber}
                    // Re-normalize to +63 form on every keystroke (controlled + masked).
                    onChange={(e) => setContactNumber(formatPHMobile(e.target.value))}
                    placeholder="+63 9XX XXX XXXX"
                    className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#6B6B67] mb-1">Full address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="National Hwy, Calamba, Laguna"
                  className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#6B6B67] mb-1">City / Municipality</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Calamba"
                    className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#6B6B67] mb-1">Province</label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="Laguna"
                    className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                  />
                </div>
              </div>

              <div className="w-[160px]">
                <label className="block text-xs text-[#6B6B67] mb-1">Low-stock alert threshold (cylinders)</label>
                <input
                  type="number"
                  value={stockThreshold}
                  onChange={(e) => setStockThreshold(e.target.value)}
                  placeholder="20"
                  className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                />
              </div>
            </div>
          )}

          {/* Step 2: Assign Owner */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#6B6B67] uppercase tracking-wider mb-2">Owner Type</label>
                <div className="inline-flex border border-[#E4E4E0] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setOwnerType('existing')}
                    className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                      ownerType === 'existing'
                        ? 'bg-[#E6F1FB] text-[#185FA5]'
                        : 'bg-white text-[#6B6B67]'
                    }`}
                  >
                    Existing owner
                  </button>
                  <div className="w-[0.5px] bg-[#E4E4E0]" />
                  <button
                    onClick={() => setOwnerType('new')}
                    className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                      ownerType === 'new'
                        ? 'bg-[#E6F1FB] text-[#185FA5]'
                        : 'bg-white text-[#6B6B67]'
                    }`}
                  >
                    New owner
                  </button>
                </div>
              </div>

              {ownerType === 'existing' ? (
                <div className="space-y-3">
                  <label className="block text-xs text-[#6B6B67] uppercase tracking-wider">Search Registered Owners</label>
                  <input
                    type="text"
                    placeholder="Search by name or email…"
                    className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-white outline-none focus:border-[#185FA5]"
                  />

                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedOwner('Maria Alvarez')}
                      className={`w-full p-3 border border-[#E4E4E0] rounded-lg flex items-center gap-3 cursor-pointer transition-all hover:border-[#185FA5] hover:shadow-sm ${
                        selectedOwner === 'Maria Alvarez' ? 'bg-white' : 'opacity-55 hover:opacity-100'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[#185FA5] text-xs font-medium flex-shrink-0">
                        MA
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-[13px] font-medium text-[#1A1A18]">Maria Alvarez</div>
                        <div className="text-[11px] text-[#6B6B67]">maria.alvarez@superkalan.ph · 2 active branches</div>
                      </div>
                      {selectedOwner === 'Maria Alvarez' && (
                        <span className="px-2 py-1 bg-[#EAF3DE] text-[#3B6D11] text-[10px] rounded-lg">Selected</span>
                      )}
                    </button>

                    <button
                      onClick={() => setSelectedOwner('Ramon Dela Cruz')}
                      className={`w-full p-3 border border-[#E4E4E0] rounded-lg flex items-center gap-3 cursor-pointer transition-all hover:border-[#185FA5] hover:shadow-sm ${
                        selectedOwner === 'Ramon Dela Cruz' ? 'bg-white' : 'opacity-55 hover:opacity-100'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-[#EAF3DE] flex items-center justify-center text-[#3B6D11] text-xs font-medium flex-shrink-0">
                        RD
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-[13px] font-medium text-[#1A1A18]">Ramon Dela Cruz</div>
                        <div className="text-[11px] text-[#6B6B67]">ramon.dc@superkalan.ph · 1 active branch</div>
                      </div>
                      {selectedOwner === 'Ramon Dela Cruz' && (
                        <span className="px-2 py-1 bg-[#EAF3DE] text-[#3B6D11] text-[10px] rounded-lg">Selected</span>
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2 p-3 bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg">
                    <Info className="w-3.5 h-3.5 text-[#185FA5] flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-[#185FA5]">
                      This owner will gain Branch Owner access to the new branch. Their existing branch access is not affected.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#6B6B67] mb-1">First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#6B6B67] mb-1">Last name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#6B6B67] mb-1">Email address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#6B6B67] mb-1">Mobile number</label>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 p-3 bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg">
                    <Info className="w-3.5 h-3.5 text-[#185FA5] flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-[#185FA5]">
                      A temporary password will be emailed to the owner. They must change it on first login.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Geofence Setup */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg">
                <Info className="w-3.5 h-3.5 text-[#185FA5] flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#185FA5]">
                  The geofence defines the delivery coverage area. Riders are alerted if they leave this boundary. You can draw a polygon or enter coordinates manually.
                </p>
              </div>

              <div>
                <label className="block text-xs text-[#6B6B67] uppercase tracking-wider mb-2">Branch Coverage Area</label>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setGeoMode('draw')}
                    className={`px-3.5 h-7 text-xs font-medium rounded-lg transition-colors ${
                      geoMode === 'draw'
                        ? 'bg-[#185FA5] text-white'
                        : 'bg-white border border-[#E4E4E0] text-[#6B6B67]'
                    }`}
                  >
                    Draw on map
                  </button>
                  <button
                    onClick={() => setGeoMode('coordinates')}
                    className={`px-3.5 h-7 text-xs font-medium rounded-lg transition-colors ${
                      geoMode === 'coordinates'
                        ? 'bg-[#185FA5] text-white'
                        : 'bg-white border border-[#E4E4E0] text-[#6B6B67]'
                    }`}
                  >
                    Select barangays
                  </button>
                  <button
                    onClick={() => setGeoMode('radius')}
                    className={`px-3.5 h-7 text-xs font-medium rounded-lg transition-colors ${
                      geoMode === 'radius'
                        ? 'bg-[#185FA5] text-white'
                        : 'bg-white border border-[#E4E4E0] text-[#6B6B67]'
                    }`}
                  >
                    Radius from center
                  </button>
                </div>
              </div>

              {geoMode === 'draw' && (
                <div className="space-y-3">
                  {/* Live Leaflet map */}
                  <div className="h-[230px] border border-[#E4E4E0] rounded-lg overflow-hidden relative">
                    <DrawableMap
                      points={polygonPoints}
                      isDrawing={isDrawingPolygon}
                      onAddPoint={handleAddPoint}
                    />
                    {/* Drawing mode badge overlay */}
                    {isDrawingPolygon && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[400] bg-[#185FA5] text-white text-[11px] px-3 py-1 rounded-full shadow pointer-events-none">
                        Click map to place points
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsDrawingPolygon((v) => !v)}
                      className={`px-3 h-[30px] text-xs rounded-lg font-medium transition-colors ${
                        isDrawingPolygon
                          ? 'bg-[#C0392B] text-white'
                          : 'bg-[#185FA5] text-white'
                      }`}
                    >
                      {isDrawingPolygon ? '◼ Stop drawing' : '⬡ Draw polygon'}
                    </button>
                    <button
                      onClick={handleUndoPoint}
                      disabled={polygonPoints.length === 0}
                      className="px-3 h-[30px] bg-white border border-[#E4E4E0] text-xs text-[#6B6B67] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F7F7F6] transition-colors"
                    >
                      ↺ Undo last point
                    </button>
                    <button
                      onClick={handleClearPolygon}
                      disabled={polygonPoints.length === 0}
                      className="px-3 h-[30px] bg-white border border-[#E4E4E0] text-xs text-[#6B6B67] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F7F7F6] transition-colors"
                    >
                      ✕ Clear
                    </button>
                  </div>

                  <div className="flex gap-2.5 flex-wrap">
                    <span className="px-2.5 py-1 border border-[#E4E4E0] rounded-lg text-[11px] text-[#6B6B67]">
                      Area · {polygonClosed ? `~${polygonArea.toFixed(2)} km²` : '—'}
                    </span>
                    <span className="px-2.5 py-1 border border-[#E4E4E0] rounded-lg text-[11px] text-[#6B6B67]">
                      Points · {polygonPoints.length}
                    </span>
                    {polygonClosed ? (
                      <span className="px-2.5 py-1 bg-[#EAF3DE] border border-[#C0DD97] rounded-lg text-[11px] text-[#3B6D11]">
                        Polygon closed
                      </span>
                    ) : polygonPoints.length > 0 ? (
                      <span className="px-2.5 py-1 bg-[#FFF3E0] border border-[#F0C070] rounded-lg text-[11px] text-[#C07A12]">
                        {isDrawingPolygon ? 'Drawing…' : 'Incomplete — need ≥ 3 points'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-[#F7F7F6] border border-[#E4E4E0] rounded-lg text-[11px] text-[#6B6B67]">
                        No polygon drawn
                      </span>
                    )}
                  </div>
                </div>
              )}

              {geoMode === 'coordinates' && (
                <div className="space-y-3">
                  <label className="block text-xs text-[#6B6B67] uppercase tracking-wider">Location Selector</label>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#6B6B67] mb-1">Region</label>
                      <select
                        value={selectedRegion}
                        onChange={(e) => {
                          setSelectedRegion(e.target.value);
                          setSelectedCity('');
                          setSelectedDistrict('');
                          setSelectedBarangays([]);
                        }}
                        className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                      >
                        <option value="">Select region</option>
                        {regions.map(region => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[#6B6B67] mb-1">City / Municipality</label>
                      <select
                        value={selectedCity}
                        onChange={(e) => {
                          setSelectedCity(e.target.value);
                          setSelectedDistrict('');
                          setSelectedBarangays([]);
                        }}
                        disabled={!selectedRegion}
                        className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select city</option>
                        {cities.map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#6B6B67] mb-1">District (optional)</label>
                    <select
                      value={selectedDistrict}
                      onChange={(e) => {
                        setSelectedDistrict(e.target.value);
                        setSelectedBarangays([]);
                      }}
                      disabled={!selectedCity}
                      className="w-full h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">All districts</option>
                      {districts.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>

                  {(selectedCity || selectedDistrict) && (
                    <>
                      <div>
                        <label className="block text-xs text-[#6B6B67] mb-2">Select Barangays</label>
                        <div className="border border-[#E4E4E0] rounded-lg bg-white max-h-[160px] overflow-y-auto">
                          {barangays.map((barangay) => (
                            <label
                              key={barangay}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-[#F7F7F6] cursor-pointer border-b border-[#E4E4E0] last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedBarangays.includes(barangay)}
                                onChange={() => toggleBarangay(barangay)}
                                className="w-4 h-4 text-[#185FA5] border-[#E4E4E0] rounded focus:ring-[#185FA5]"
                              />
                              <span className="text-[13px] text-[#1A1A18]">{barangay}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {selectedBarangays.length > 0 && (
                        <div>
                          <label className="block text-xs text-[#6B6B67] mb-2">
                            Selected Barangays ({selectedBarangays.length})
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {selectedBarangays.map((barangay) => (
                              <span
                                key={barangay}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#E6F1FB] text-[#185FA5] text-[11px] rounded-lg"
                              >
                                {barangay}
                                <button
                                  onClick={() => removeBarangay(barangay)}
                                  className="hover:text-[#0d3a6b]"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {geoMode === 'radius' && (
                <div className="space-y-3">
                  {/* Live interactive radius map */}
                  <div className="h-[230px] border border-[#E4E4E0] rounded-lg overflow-hidden relative">
                    <RadiusMap
                      center={radiusCenter}
                      radius={radius}
                      onSetCenter={(lat, lng) => setRadiusCenter([lat, lng])}
                    />
                  </div>

                  {/* Radius slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-[#6B6B67]">Delivery radius</label>
                      <span className="text-[13px] font-medium text-[#1A1A18]">{radius} km</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                      className="w-full accent-[#185FA5]"
                    />
                    <div className="flex justify-between text-[10px] text-[#A0A09C] mt-0.5">
                      <span>1 km</span>
                      <span>30 km</span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-2.5 flex-wrap">
                    <span className="px-2.5 py-1 border border-[#E4E4E0] rounded-lg text-[11px] text-[#6B6B67]">
                      Radius · {radius} km
                    </span>
                    <span className="px-2.5 py-1 border border-[#E4E4E0] rounded-lg text-[11px] text-[#6B6B67]">
                      Area · ~{(Math.PI * radius * radius).toFixed(1)} km²
                    </span>
                    {radiusCenter ? (
                      <>
                        <span className="px-2.5 py-1 border border-[#E4E4E0] rounded-lg text-[11px] font-mono text-[#6B6B67]">
                          {radiusCenter[0].toFixed(4)}, {radiusCenter[1].toFixed(4)}
                        </span>
                        <button
                          onClick={() => setRadiusCenter(null)}
                          className="px-2.5 py-1 bg-white border border-[#E4E4E0] rounded-lg text-[11px] text-[#6B6B67] hover:bg-[#F7F7F6] transition-colors"
                        >
                          ✕ Reset center
                        </button>
                        <span className="px-2.5 py-1 bg-[#EAF3DE] border border-[#C0DD97] rounded-lg text-[11px] text-[#3B6D11]">
                          Center set
                        </span>
                      </>
                    ) : (
                      <span className="px-2.5 py-1 bg-[#FFF3E0] border border-[#F0C070] rounded-lg text-[11px] text-[#C07A12]">
                        No center placed yet
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-[#6B6B67] mb-2">Time curfew — riders must return by</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={curfewStart}
                    onChange={(e) => setCurfewStart(e.target.value)}
                    className="w-[110px] h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                  />
                  <span className="text-[13px] text-[#6B6B67]">to</span>
                  <input
                    type="time"
                    value={curfewEnd}
                    onChange={(e) => setCurfewEnd(e.target.value)}
                    className="w-[110px] h-[34px] px-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Confirm */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <label className="block text-xs text-[#6B6B67] uppercase tracking-wider">Review Before Creating</label>

              <div className="border border-[#E4E4E0] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[140px_1fr]">
                  <div className="bg-[#F7F7F6] px-3 py-2.5 text-[13px] text-[#6B6B67] border-b border-[#E4E4E0]">Branch name</div>
                  <div className="bg-white px-3 py-2.5 text-[13px] text-[#1A1A18] border-b border-[#E4E4E0]">{branchName}</div>

                  <div className="bg-[#F7F7F6] px-3 py-2.5 text-[13px] text-[#6B6B67] border-b border-[#E4E4E0]">Address</div>
                  <div className="bg-white px-3 py-2.5 text-[13px] text-[#1A1A18] border-b border-[#E4E4E0]">{address}</div>

                  <div className="bg-[#F7F7F6] px-3 py-2.5 text-[13px] text-[#6B6B67] border-b border-[#E4E4E0]">Branch owner</div>
                  <div className="bg-white px-3 py-2.5 text-[13px] text-[#1A1A18] border-b border-[#E4E4E0]">
                    {ownerType === 'existing' ? `${selectedOwner} (existing)` : `${firstName} ${lastName} (new)`}
                  </div>

                  <div className="bg-[#F7F7F6] px-3 py-2.5 text-[13px] text-[#6B6B67] border-b border-[#E4E4E0]">Geofence</div>
                  <div className="bg-white px-3 py-2.5 text-[13px] text-[#1A1A18] border-b border-[#E4E4E0]">
                    {getGeofenceSummary()}
                  </div>

                  <div className="bg-[#F7F7F6] px-3 py-2.5 text-[13px] text-[#6B6B67] border-b border-[#E4E4E0]">Curfew window</div>
                  <div className="bg-white px-3 py-2.5 text-[13px] text-[#1A1A18] border-b border-[#E4E4E0]">{curfewStart} – {curfewEnd}</div>

                  <div className="bg-[#F7F7F6] px-3 py-2.5 text-[13px] text-[#6B6B67]">Initial status</div>
                  <div className="bg-white px-3 py-2.5 text-[13px] text-[#1A1A18] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1D9E75]"></span>
                    Active
                  </div>
                </div>
              </div>

              <div className="flex gap-2 p-3 bg-[#EAF3DE] border border-[#C0DD97] rounded-lg">
                <Check className="w-3.5 h-3.5 text-[#3B6D11] flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#3B6D11]">
                  All required fields are complete. Confirming will create the branch and send an access notification to the assigned owner.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#E4E4E0] flex items-center justify-between">
          <p className="text-xs text-[#6B6B67]">
            Step {currentStep} of 4 — {steps[currentStep - 1].label}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-4 h-[34px] bg-white border border-[#E4E4E0] text-[#1A1A18] text-[13px] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={currentStep === 4 ? handleSubmit : handleNext}
              disabled={!isStepValid || submitting}
              className={`px-4 h-[34px] text-[13px] rounded-lg font-medium transition-colors ${
                isStepValid && !submitting
                  ? 'bg-[#185FA5] text-white cursor-pointer'
                  : 'bg-[#E4E4E0] text-[#A0A09C] cursor-not-allowed'
              }`}
            >
              {currentStep === 4 ? (submitting ? 'Creating…' : 'Confirm & Create') : 'Continue →'}
            </button>
          </div>
        </div>
      </div>

      {/* Branch Created Modal */}
      {showSuccess && (
        <BranchCreatedModal
          branchName={branchName}
          address={address}
          ownerName={resolvedOwnerName}
          ownerEmail={resolvedOwnerEmail}
          ownerTempPassword={ownerTempPassword}
          onClose={handleSuccessClose}
          onRegisterAnother={handleRegisterAnother}
        />
      )}
    </div>
  );
}