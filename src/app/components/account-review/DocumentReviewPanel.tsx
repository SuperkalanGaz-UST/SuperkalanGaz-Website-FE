'use client';

import {
  AlertCircle,
  Eye,
  FileImage,
  FileText,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage, apiFetch } from '../../lib/api';

export type DocumentReviewState = 'loading' | 'ready' | 'incomplete' | 'unavailable';

interface ReviewDocument {
  id: string;
  document_type: string;
  file_name: string;
  detected_mime_type: 'application/pdf' | 'image/jpeg' | 'image/png';
  size_bytes: number;
  uploaded_at: string;
}

interface DocumentReviewPanelProps {
  requestId: string;
  onReviewStateChange?: (state: DocumentReviewState) => void;
}

interface PreviewState {
  url: string;
  name: string;
  mimeType: ReviewDocument['detected_mime_type'];
}

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set<ReviewDocument['detected_mime_type']>([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

function isReviewDocument(value: unknown): value is ReviewDocument {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.document_type === 'string' &&
    typeof row.file_name === 'string' &&
    typeof row.detected_mime_type === 'string' &&
    ALLOWED_MIME_TYPES.has(row.detected_mime_type as ReviewDocument['detected_mime_type']) &&
    typeof row.size_bytes === 'number' &&
    row.size_bytes > 0 &&
    row.size_bytes <= MAX_DOCUMENT_BYTES &&
    typeof row.uploaded_at === 'string'
  );
}

export function DocumentReviewPanel({
  requestId,
  onReviewStateChange,
}: DocumentReviewPanelProps) {
  const [documents, setDocuments] = useState<ReviewDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const closePreview = useCallback(() => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  const load = useCallback(async () => {
    setDocuments(null);
    setError(null);
    onReviewStateChange?.('loading');

    let response: Response;
    try {
      response = await apiFetch(`/staff-registration/requests/${requestId}/documents`, {
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      setError('Documents are temporarily unavailable. Account decisions are disabled.');
      onReviewStateChange?.('unavailable');
      return;
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      setError(
        response.status === 404
          ? 'Document review is not connected for this request.'
          : apiErrorMessage(body, 'Documents could not be loaded.'),
      );
      onReviewStateChange?.('unavailable');
      return;
    }

    const rows = body && typeof body === 'object'
      ? (body as { documents?: unknown }).documents
      : null;
    if (!Array.isArray(rows) || !rows.every(isReviewDocument)) {
      setError('The document service returned an invalid response.');
      onReviewStateChange?.('unavailable');
      return;
    }

    setDocuments(rows);
    onReviewStateChange?.(rows.length > 0 ? 'ready' : 'incomplete');
  }, [onReviewStateChange, requestId]);

  useEffect(() => {
    void load();
    return closePreview;
  }, [closePreview, load]);

  const openPreview = async (document: ReviewDocument) => {
    closePreview();
    setOpeningId(document.id);
    try {
      const response = await apiFetch(
        `/staff-registration/requests/${requestId}/documents/${document.id}/content`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(body, 'The document could not be opened.'));
      }

      const contentType = response.headers.get('Content-Type')?.split(';')[0].trim();
      if (!contentType || !ALLOWED_MIME_TYPES.has(contentType as ReviewDocument['detected_mime_type'])) {
        throw new Error('The document service returned an unsupported file type.');
      }
      const blob = await response.blob();
      if (blob.size === 0 || blob.size > MAX_DOCUMENT_BYTES) {
        throw new Error('The document content failed the configured size check.');
      }
      setPreview({
        url: URL.createObjectURL(blob),
        name: document.file_name,
        mimeType: contentType as ReviewDocument['detected_mime_type'],
      });
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'The document could not be opened.',
      );
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <section className="border-t border-slate-100 px-6 py-5">
      <h3 className="text-sm font-semibold text-slate-900">Submitted documents</h3>

      {!documents && !error && (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-[#007BC1]" /> Loading documents…
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" /> {error}
          </span>
          <button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {documents && documents.length === 0 && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No documents are attached. Account decisions are disabled.
        </p>
      )}

      {documents && documents.length > 0 && (
        <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {documents.map((document) => {
            const Icon = document.detected_mime_type === 'application/pdf' ? FileText : FileImage;
            return (
              <article key={document.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-[#007BC1]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{document.document_type}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{document.file_name}</p>
                </div>
                <button
                  type="button"
                  disabled={openingId === document.id}
                  onClick={() => void openPreview(document)}
                  className="inline-flex min-w-20 items-center justify-center gap-2 rounded-lg border border-[#007BC1] px-3 py-2 text-xs font-semibold text-[#007BC1] hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {openingId === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  View
                </button>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 flex-none" />
        Compare the submitted details with each document before deciding.
      </p>

      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{preview.name}</p>
                <p className="mt-1 text-xs text-slate-500">Secure document preview</p>
              </div>
              <button type="button" onClick={closePreview} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close document preview">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 bg-slate-100 p-3">
              {preview.mimeType === 'application/pdf' ? (
                <iframe title={preview.name} src={preview.url} className="h-full w-full rounded-lg bg-white" />
              ) : (
                // The source is a short-lived Blob URL from an authenticated API response.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={`Preview of ${preview.name}`} className="h-full w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
