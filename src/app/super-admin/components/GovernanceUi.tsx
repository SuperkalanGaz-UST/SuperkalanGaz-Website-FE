import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white ${className}`}>
      {children}
    </section>
  );
}

export function StatusChip({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone =
    normalized.includes('approved') ||
    normalized.includes('completed') ||
    normalized.includes('active')
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : normalized.includes('reject') || normalized.includes('inactive')
        ? 'bg-red-50 text-red-700 ring-red-200'
        : normalized.includes('high')
          ? 'bg-red-50 text-red-700 ring-red-200'
          : normalized.includes('low')
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
            : 'bg-amber-50 text-amber-700 ring-amber-200';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>
      {value.replaceAll('-', ' ')}
    </span>
  );
}

export function LoadingState({ label = 'Loading governance data…' }: { label?: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-gray-500">
      <Loader2 className="h-5 w-5 animate-spin text-[#007BC1]" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 font-semibold text-red-800 underline underline-offset-4"
      >
        Try again
      </button>
    </div>
  );
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function humanize(value: string): string {
  return value
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
