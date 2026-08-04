'use client';

import { Loader2, LogOut } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface LogoutConfirmationDialogProps {
  open: boolean;
  loggingOut: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

/** One confirmation path shared by every dashboard logout control. */
export function LogoutConfirmationDialog({
  open,
  loggingOut,
  onOpenChange,
  onConfirm,
}: LogoutConfirmationDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loggingOut) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className="max-w-md rounded-2xl">
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll need to sign in again to access the dashboard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void onConfirm()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
