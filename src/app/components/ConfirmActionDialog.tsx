'use client';

import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

const TONES = {
  primary: { icon: 'bg-blue-50 text-[#007BC1]', button: 'bg-[#007BC1] hover:bg-[#0069a6]' },
  warning: { icon: 'bg-amber-50 text-amber-700', button: 'bg-amber-600 hover:bg-amber-700' },
  danger: { icon: 'bg-red-50 text-red-600', button: 'bg-red-600 hover:bg-red-700' },
} as const;

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  icon: ReactNode;
  tone?: keyof typeof TONES;
  busy: boolean;
  /** When set, a reason (5+ characters) is required and passed to onConfirm. */
  reasonLabel?: string;
  onConfirm: (reason: string) => void | Promise<void>;
}

/**
 * Second step for consequential actions, styled like LogoutConfirmationDialog.
 * Mount it with a `key` per target so a typed reason never carries over.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busyLabel,
  icon,
  tone = 'primary',
  busy,
  reasonLabel,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [reason, setReason] = useState('');
  const reasonMissing = !!reasonLabel && reason.trim().length < 5;
  const styles = TONES[tone];

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <div className={`mb-1 flex h-11 w-11 items-center justify-center rounded-full ${styles.icon}`}>
            {icon}
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-gray-600">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {reasonLabel && (
          <label className="block text-sm font-medium text-gray-800">
            {reasonLabel} <span className="text-red-600">*</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={1000}
              disabled={busy}
              className="mt-2 w-full resize-none rounded-xl border border-gray-300 p-3 text-sm font-normal outline-none focus:border-[#007BC1] focus:ring-2 focus:ring-blue-100"
            />
            <span className="mt-1 block text-xs font-normal text-gray-500">At least 5 characters. Saved to the audit trail.</span>
          </label>
        )}
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <button
            type="button"
            disabled={busy || reasonMissing}
            onClick={() => void onConfirm(reason.trim())}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? busyLabel : confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
