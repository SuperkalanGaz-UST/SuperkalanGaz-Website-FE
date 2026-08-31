'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, X } from 'lucide-react';
import { apiErrorMessage, apiFetch } from '../lib/api';

interface DeliveryProofViewerProps {
  serviceRequestId: string;
  serviceRequestCode?: string;
  branchId?: string | null;
}

/**
 * Fetches a private Proof of Delivery only after the staff member asks to see
 * it. The image is downloaded through the NestJS API with the current session
 * token; the browser never receives a storage key or service credential.
 */
export function DeliveryProofViewer({
  serviceRequestId,
  serviceRequestCode,
  branchId,
}: DeliveryProofViewerProps) {
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const loadProof = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
      setPhotoUrl(null);
    }

    try {
      const params = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
      const response = await apiFetch(
        `/service-requests/${encodeURIComponent(serviceRequestId)}/delivery-proof${params}`,
      );
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(data, 'Proof of Delivery is unavailable.'));
      }
      const blob = await response.blob();
      setPhotoUrl(URL.createObjectURL(blob));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Proof of Delivery is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void loadProof()}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#007BC1] px-2.5 py-1.5 text-xs font-semibold text-[#007BC1] transition-colors hover:bg-blue-50"
      >
        <ImageIcon size={14} />
        View Proof
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
          <div
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-proof-title"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 id="delivery-proof-title" className="text-base font-semibold text-gray-900">
                  Proof of Delivery
                </h2>
                {serviceRequestCode && (
                  <p className="mt-0.5 text-xs text-gray-500">{serviceRequestCode}</p>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close Proof of Delivery"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex min-h-[260px] items-center justify-center bg-gray-50 p-5">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={18} className="animate-spin" /> Loading proof…
                </div>
              ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoUrl}
                  alt={`Proof of Delivery${serviceRequestCode ? ` for ${serviceRequestCode}` : ''}`}
                  className="max-h-[70vh] max-w-full rounded-lg object-contain"
                />
              ) : (
                <p className="text-sm text-gray-500">No photo available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
