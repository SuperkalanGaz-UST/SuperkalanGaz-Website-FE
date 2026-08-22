'use client';

import {
  AlertCircle,
  Eye,
  FileImage,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
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
  verification_status: 'pending' | 'verified' | 'rejected';
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

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'Unknown size';
  if (value < 1024) return `${value} B`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date);
}

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
    row.size_bytes >= 0 &&
    row.size_bytes <= MAX_DOCUMENT_BYTES &&
    (row.verification_status === 'pending' ||
      row.verification_status === 'verified' ||
      row.verification_status === 'rejected') &&
    typeof row.uploaded_at === 'string'
  );
}

function statusClass(status: ReviewDocument['verification_status']): string {
  if (status === 'verified') return 'bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

function statusLabel(status: ReviewDocument['verification_status']): string {
  return status[0].toUpperCase() + status.slice(1);
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
      setError('The secure document service is unavailable. Account decisions are disabled.');
      onReviewStateChange?.('unavailable');
      return;
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      setError(
        response.status === 404
          ? 'Secure document review is not connected for this request. Account decisions are disabled.'
          : apiErrorMessage(body, 'The secure document service could not load this request.'),
      );
      onReviewStateChange?.('unavailable');
      return;
    }

    const rows = body && typeof body === 'object'
      ? (body as { documents?: unknown }).documents
      : null;
    if (!Array.isArray(rows) || !rows.every(isReviewDocument)) {
      setError('The document service returned an invalid response. Account decisions are disabled.');
      onReviewStateChange?.('unavailable');
      return;
    }

    setDocuments(rows);
    const state: DocumentReviewState =
      rows.length > 0 && rows.every((document) => document.verification_status === 'verified')
        ? 'ready'
        : 'incomplete';
    onReviewStateChange?.(state);
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
    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-[#007BC1]" /> Secure document review
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Files are streamed through NestJS. Opening a document must be recorded by the backend audit trail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>

      {!documents && !error && (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading verified document metadata…
        </div>
      )}

      {error && (
        <div className="m-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {documents && documents.length === 0 && (
        <div className="m-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          No required documents are attached. Account decisions are disabled.
        </div>
      )}

      {documents && documents.length > 0 && (
        <div className="divide-y divide-slate-100">
          {documents.map((document) => {
            const Icon = document.detected_mime_type === 'application/pdf' ? FileText : FileImage;
            return (
              <article key={document.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-[#007BC1]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{document.document_type}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(document.verification_status)}`}>
                      {statusLabel(document.verification_status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{document.file_name}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {document.detected_mime_type} · {formatBytes(document.size_bytes)} · Uploaded {formatDate(document.uploaded_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={openingId === document.id || document.verification_status === 'rejected'}
                  onClick={() => void openPreview(document)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#007BC1] px-3 py-2 text-xs font-semibold text-[#007BC1] hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {openingId === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Preview
                </button>
              </article>
            );
          })}
        </div>
      )}

      {documents && documents.length > 0 && documents.some((document) => document.verification_status !== 'verified') && (
        <div className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-xs text-amber-900">
          Every required document must have a verified status before an account decision can be recorded.
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
          <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{preview.name}</p>
                <p className="mt-1 text-xs text-slate-500">Secure preview · access should be audit logged</p>
              </div>
              <button type="button" onClick={closePreview} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close document preview">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 bg-slate-100 p-3">
              {preview.mimeType === 'application/pdf' ? (
                <iframe title={preview.name} src={preview.url} className="h-full w-full rounded-lg bg-white" />
              ) : (
                // The source is a short-lived in-memory Blob URL created from an authenticated API response.
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
