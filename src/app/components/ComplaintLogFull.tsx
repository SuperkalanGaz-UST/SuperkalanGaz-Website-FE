import { Header } from './Header';
import { ArrowLeft } from 'lucide-react';
import { ComplaintLogTable } from './ComplaintLogTable';
export function ComplaintLogFull({ onBack }: { onBack: () => void }) {
  return <div className="flex-1 overflow-y-auto"><Header title="Complaint Log" /><div className="space-y-6 p-8"><button className="inline-flex items-center gap-2 text-sm text-[#007BC1] hover:underline" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Back to Ratings &amp; Reviews</button><ComplaintLogTable full /></div></div>;
}
