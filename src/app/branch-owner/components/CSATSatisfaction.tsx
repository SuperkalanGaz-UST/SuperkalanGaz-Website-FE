import { Header } from './Header';
import { KPICard } from './KPICard';
import { RecentRatingsTable } from './RecentRatingsTable';
import { ComplaintLogTable } from './ComplaintLogTable';
import { Star, MessageSquare, AlertCircle, ArrowUpRight } from 'lucide-react';
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
          {/* Average Rating card — enhanced to match dashboard KPICard style */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative flex flex-col min-h-[120px]">
            <div
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#f59e0b26' }}
            >
              <Star className="w-4 h-4 text-[#f59e0b]" />
            </div>
            <div className="text-sm font-medium text-gray-500 pr-12">Average Rating</div>
            <div className="flex items-center gap-2 mt-2 leading-none">
              <div className="text-3xl font-bold text-gray-900">4.3</div>
              <div className="flex gap-0.5 mt-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= 4 ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium mt-auto pt-3 text-green-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+0.2 from last month</span>
            </div>
          </div>

          <KPICard
            title="Total Ratings Received"
            value="211"
            icon={<MessageSquare className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
            trend={{ text: '+18 from last month', direction: 'up', positive: true }}
          />
          <KPICard
            title="Open Complaints"
            value="3"
            icon={<AlertCircle className="w-4 h-4 text-[#ef4444]" />}
            accentColor="#ef4444"
            trend={{ text: '-1 from last month', direction: 'down', positive: true }}
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
