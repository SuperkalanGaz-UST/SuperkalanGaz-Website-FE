'use client';

import { useEffect, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { apiFetch, apiErrorMessage } from '../lib/api';

export function ExpenseReceiptViewer({ id, name, branchId }: { id: string; name: string; branchId?: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    let url: string | undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
        const response = await apiFetch(`/expenses/${encodeURIComponent(id)}/receipt${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error(apiErrorMessage(await response.json().catch(() => null), 'Receipt unavailable.'));
        const blob = await response.blob();
        if (!active) return;
        url = URL.createObjectURL(blob);
        setFile({ url, type: blob.type });
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Receipt unavailable.'); }
    })();
    return () => { active = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [open, id, branchId]);
  return <>
    <button type="button" onClick={() => { setFile(null); setError(null); setOpen(true); }} className="inline-flex max-w-full flex-wrap items-center gap-1 text-left text-xs font-medium text-[#007BC1] hover:text-[#005a8f]">
      <Paperclip size={14} aria-hidden="true" /> <span>File noted</span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
        <p className="break-all text-sm text-slate-600">{name}</p>
        {error ? <p role="alert" className="py-8 text-center text-sm text-red-700">{error}</p>
          : !file ? <p role="status" className="py-8 text-center text-sm text-slate-600">Loading receipt…</p>
          : file.type === 'application/pdf' ? <iframe title={`Receipt: ${name}`} src={file.url} className="h-[65vh] w-full rounded-lg border" />
          // Authenticated blob URL is intentionally rendered without the Next image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={file.url} alt={`Receipt: ${name}`} className="max-h-[65vh] w-full rounded-lg object-contain" />}
      </DialogContent>
    </Dialog>
  </>;
}
