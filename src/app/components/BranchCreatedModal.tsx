import { CheckCircle, User, Building2, X, Copy, ExternalLink, PlusCircle } from 'lucide-react';
import { useState } from 'react';

interface BranchCreatedModalProps {
  /** Real branch reference/code returned by the API (e.g. the badge value). */
  branchReference: string;
  branchName: string;
  province: string;
  /** Accepted for caller parity; not shown here — it lives on the branch detail page. */
  address: string;
  /** Accepted for caller parity; not shown here — it lives on the branch detail page. */
  geofenceSummary: string;
  ownerName: string;
  ownerEmail: string;
  ownerInvitationSent?: boolean;
  onClose: () => void;
  onRegisterAnother: () => void;
}

export function BranchCreatedModal({
  branchReference,
  branchName,
  province,
  ownerName,
  ownerEmail,
  ownerInvitationSent,
  onClose,
  onRegisterAnother,
}: BranchCreatedModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(branchReference).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div
        className="bg-white rounded-xl w-[480px] max-h-[85vh] shadow-xl overflow-hidden flex flex-col"
        style={{ animation: 'modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Header — flat solid brand blue (no gradient; DESIGN.md §2) */}
        <div className="relative bg-[#007BC1] px-6 py-6 flex-shrink-0">
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

          <h2 className="text-white text-2xl font-semibold mb-1">
            Branch Account Created!
          </h2>
          <p className="text-white/80 text-sm">
            {branchName}{province ? `, ${province}` : ''} has been successfully registered.
          </p>
        </div>

        {/* Body — internal scroll is a fallback only; after trimming this fits
            without scrolling at typical desktop heights. */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* Reference-code badge — branch-pill token (§4) */}
          <div className="inline-flex items-center gap-2 bg-blue-50 text-[#00568A] rounded-full text-xs px-3 py-1">
            <Building2 className="w-3.5 h-3.5" />
            <span className="font-mono font-medium">{branchReference}</span>
            <button
              onClick={handleCopy}
              className="ml-0.5 text-[#00568A]/70 hover:text-[#00568A] transition-colors"
              title="Copy branch reference"
            >
              {copied ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {ownerInvitationSent ? (
            <div className="flex items-start gap-2.5 bg-blue-50 rounded-xl px-3.5 py-3">
              <User className="w-4 h-4 text-[#00568A] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#00568A] leading-relaxed">
                An invitation email was sent to <span className="font-semibold">{ownerEmail}</span>.
                {' '}The Branch Owner follows the link and sets their own password. The account
                stays pending until setup is complete. If the link expires, resend it from Edit branch.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 bg-blue-50 rounded-xl px-3.5 py-3">
              <User className="w-4 h-4 text-[#00568A] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#00568A] leading-relaxed">
                <span className="font-semibold">{ownerName}</span> now has Branch Owner
                access to this branch using their existing account.
              </p>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onClose}
              className="w-full h-[38px] bg-[#007BC1] hover:bg-[#0069a6] text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Branch Account
            </button>

            <div className="flex gap-2">
              <button
                onClick={onRegisterAnother}
                className="flex-1 h-[36px] bg-white border border-gray-200 text-gray-700 text-sm rounded-xl flex items-center justify-center gap-1.5 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-gray-500" />
                Register Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 h-[36px] bg-white border border-gray-200 text-gray-700 text-sm rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Done
              </button>
            </div>
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
