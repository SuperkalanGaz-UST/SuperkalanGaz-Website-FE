import { CheckCircle, MapPin, User, Clock, Building2, X, Copy, ExternalLink, PlusCircle } from 'lucide-react';
import { useState } from 'react';

interface BranchCreatedModalProps {
  branchName: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  /** One-time password for a newly provisioned owner; null for existing owners. */
  ownerTempPassword?: string | null;
  onClose: () => void;
  onRegisterAnother: () => void;
}

function generateBranchId() {
  return `BRN-2026-00${Math.floor(Math.random() * 3) + 4}`;
}

export function BranchCreatedModal({
  branchName,
  address,
  ownerName,
  ownerEmail,
  ownerTempPassword,
  onClose,
  onRegisterAnother,
}: BranchCreatedModalProps) {
  const [branchId] = useState(generateBranchId);
  const [copied, setCopied] = useState(false);
  const [pwCopied, setPwCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(branchId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPassword = () => {
    if (!ownerTempPassword) return;
    navigator.clipboard.writeText(ownerTempPassword).catch(() => {});
    setPwCopied(true);
    setTimeout(() => setPwCopied(false), 2000);
  };

  const ownerInitials = ownerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Parse city/province from address context
  const addressParts = address.split(',');
  const cityDisplay = addressParts[1]?.trim() || 'Calamba';
  const provinceDisplay = addressParts[2]?.trim() || 'Laguna';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div
        className="bg-white rounded-2xl w-[480px] shadow-xl overflow-hidden"
        style={{ animation: 'modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Success Banner */}
        <div className="relative bg-gradient-to-br from-[#0E5FA5] to-[#0F8A6A] px-6 pt-8 pb-10 overflow-hidden">
          {/* decorative rings */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full border border-white/10" />
          <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full border border-white/10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full border border-white/10 -translate-x-1/2 translate-y-1/2" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>

          {/* Check icon */}
          <div
            className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-4"
            style={{ animation: 'checkBounce 0.4s 0.15s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <CheckCircle className="w-8 h-8 text-white" strokeWidth={2} />
          </div>

          <h2 className="text-white text-[18px] font-semibold mb-0.5">
            Branch Account Created!
          </h2>
          <p className="text-white/70 text-[13px]">
            {branchName} has been successfully registered in the system.
          </p>

          {/* Branch ID pill */}
          <div className="mt-4 inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl px-3 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-white/80" />
            <span className="text-white text-[13px] font-mono font-medium">{branchId}</span>
            <button
              onClick={handleCopy}
              className="ml-1 text-white/60 hover:text-white transition-colors"
              title="Copy Branch ID"
            >
              {copied ? (
                <CheckCircle className="w-3.5 h-3.5 text-[#A8EDCB]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Details Card — floats over banner bottom */}
        <div className="mx-4 -mt-4 bg-white border border-[#E4E4E0] rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-[#E4E4E0]">
            {/* Owner row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[#185FA5] text-[11px] font-semibold flex-shrink-0">
                {ownerInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#6B6B67]">Assigned owner</div>
                <div className="text-[13px] font-medium text-[#1A1A18] truncate">{ownerName}</div>
              </div>
              <span className="px-2 py-0.5 bg-[#EAF3DE] text-[#3B6D11] text-[10px] rounded-lg flex-shrink-0">
                Access granted
              </span>
            </div>

            {/* Location row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#F2F0FF] flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-[#5B4FCF]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#6B6B67]">Location</div>
                <div className="text-[13px] font-medium text-[#1A1A18] truncate">
                  {cityDisplay}, {provinceDisplay}
                </div>
                <div className="text-[11px] text-[#6B6B67] truncate">{address}</div>
              </div>
            </div>

            {/* Geofence row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#FFF3E0] flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#C07A12]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#6B6B67]">Coverage geofence</div>
                <div className="text-[13px] font-medium text-[#1A1A18]">Polygon · 5 vertices · ~12.4 km²</div>
              </div>
              <span className="px-2 py-0.5 bg-[#EAF3DE] text-[#3B6D11] text-[10px] rounded-lg flex-shrink-0">
                Set
              </span>
            </div>

            {/* Status row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-[#EDFDF5] flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-[#1D9E75]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[#6B6B67]">Registered</div>
                <div className="text-[13px] font-medium text-[#1A1A18]">
                  May 2, 2026 — 10:34 AM
                </div>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-[#1D9E75] bg-[#EDFDF5] border border-[#A6E6CC] px-2 py-0.5 rounded-lg flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
                Active
              </span>
            </div>
          </div>
        </div>

        {/* New-owner credentials: no email infra, so the temp password is shown
            here once and must be handed to the owner manually. */}
        {ownerTempPassword ? (
          <div className="mx-4 mt-3 bg-[#FFF8E6] border border-[#F0D488] rounded-xl px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <User className="w-3.5 h-3.5 text-[#B4820E] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#8A6608] leading-relaxed">
                A Branch Owner login was created for{' '}
                <span className="font-semibold">{ownerEmail}</span>. Share this
                temporary password securely — it won&apos;t be shown again. The owner
                must change it on first login.
              </p>
            </div>
            <div className="mt-2.5 flex items-center gap-2 bg-white border border-[#F0D488] rounded-lg px-3 py-2">
              <span className="flex-1 text-[13px] font-mono font-medium text-[#1A1A18] break-all">
                {ownerTempPassword}
              </span>
              <button
                onClick={handleCopyPassword}
                className="flex-shrink-0 text-[#B4820E] hover:text-[#8A6608] transition-colors"
                title="Copy temporary password"
              >
                {pwCopied ? (
                  <CheckCircle className="w-4 h-4 text-[#1D9E75]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-4 mt-3 flex items-start gap-2.5 bg-[#E6F1FB] border border-[#B5D4F4] rounded-xl px-3.5 py-3">
            <User className="w-3.5 h-3.5 text-[#185FA5] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#185FA5] leading-relaxed">
              <span className="font-semibold">{ownerName}</span> now has Branch Owner
              access to this branch using their existing account.
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-4 py-4 flex flex-col gap-2.5 mt-1">
          <button
            onClick={onClose}
            className="w-full h-[38px] text-white text-[13px] font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
            style={{ background: '#185FA5' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#14508f')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#185FA5')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Branch Account
          </button>

          <div className="flex gap-2">
            <button
              onClick={onRegisterAnother}
              className="flex-1 h-[36px] bg-white border border-[#E4E4E0] text-[#1A1A18] text-[13px] rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#F7F7F6] transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#6B6B67]" />
              Register Another
            </button>
            <button
              onClick={onClose}
              className="flex-1 h-[36px] bg-white border border-[#E4E4E0] text-[#6B6B67] text-[13px] rounded-xl hover:bg-[#F7F7F6] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes checkBounce {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}