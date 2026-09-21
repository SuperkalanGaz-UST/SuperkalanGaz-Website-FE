'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface IdleLogoutWarningDialogProps {
  open: boolean;
  warningSeconds: number;
  onStayLoggedIn: () => void;
}

/**
 * Purely presentational countdown — the actual logout is driven by
 * useIdleTimer's own onTimeout, independent of this component reaching
 * zero, so there's a single source of truth for when the session ends.
 */
export function IdleLogoutWarningDialog({ open, warningSeconds, onStayLoggedIn }: IdleLogoutWarningDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(warningSeconds);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(warningSeconds);
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [open, warningSeconds]);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className="max-w-md rounded-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle>You&apos;ve been inactive</AlertDialogTitle>
          <AlertDialogDescription>
            For security, you&apos;ll be automatically logged out in {secondsLeft}s.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-2 flex justify-end">
          <AlertDialogAction
            onClick={onStayLoggedIn}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#007BC1] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#00679f]"
          >
            Stay signed in
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
