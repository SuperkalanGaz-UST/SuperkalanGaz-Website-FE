import { Header } from './Header';
import { KPICard } from './KPICard';
import { RecentRatingsTable } from './RecentRatingsTable';
import { ComplaintLogTable } from './ComplaintLogTable';
import { Star } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';

export function CSATSatisfaction() {
  const { selectedBranch } = useBranch();

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Ratings & Reviews" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-end" style={{ borderLeft: '4px solid #22c55e' }}>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Average Rating</div>
            <div className="flex items-center gap-2">
              <div className="text-4xl font-semibold text-gray-900">4.3</div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= 4 ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">out of 5</div>
          </div>
          <KPICard
            title="Total Ratings Received"
            value="211"
            accentColor="#f59e0b"
          />
          <KPICard
            title="Open Complaints"
            value="3"
            accentColor="#ef4444"
          />
        </div>

        <div className="mb-8">
          <RecentRatingsTable />
        </div>

        <ComplaintLogTable />
      </div>
    </div>
  );
}
