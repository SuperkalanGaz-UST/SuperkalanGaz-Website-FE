import { useState } from 'react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { RecentRatingsTable } from './RecentRatingsTable';
import { ComplaintLogTable } from './ComplaintLogTable';
import { Select } from './Select';
import { Star, MessageSquare, AlertCircle, ArrowUpRight } from 'lucide-react';

export function CSATSatisfaction() {
  const [selectedBranch, setSelectedBranch] = useState('all');

  const branchData = {
    all:           { rating: 4.3, stars: 4, total: 211, complaints: 3 },
    'quezon-city': { rating: 4.5, stars: 5, total: 89,  complaints: 1 },
    'calamba':     { rating: 4.2, stars: 4, total: 67,  complaints: 1 },
    'sta-rosa':    { rating: 4.1, stars: 4, total: 55,  complaints: 1 },
  };

  const currentData = branchData[selectedBranch as keyof typeof branchData];

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Ratings & Reviews" />
      </div>

      <div className="p-8">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Branch
          </label>
          <div className="max-w-xs">
            <Select
              value={selectedBranch}
              onChange={setSelectedBranch}
              options={[
                { value: 'all',          label: 'All Branches' },
                { value: 'quezon-city',  label: 'Quezon City' },
                { value: 'calamba',      label: 'Calamba' },
                { value: 'sta-rosa',     label: 'Sta. Rosa' },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Average Rating card — styled to match dashboard KPICard */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative flex flex-col min-h-[120px]">
            <div
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#f59e0b26' }}
            >
              <Star className="w-4 h-4 text-[#f59e0b]" />
            </div>
            <div className="text-sm font-medium text-gray-500 pr-12">Average Rating</div>
            <div className="flex items-center gap-2 mt-2 leading-none">
              <div className="text-3xl font-bold text-gray-900">{currentData.rating}</div>
              <div className="flex gap-0.5 mt-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= currentData.stars ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-gray-300'
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
            value={currentData.total.toString()}
            icon={<MessageSquare className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
            subtitle="+18 from last month"
          />
          <KPICard
            title="Open Complaints"
            value={currentData.complaints.toString()}
            icon={<AlertCircle className="w-4 h-4 text-[#ef4444]" />}
            accentColor="#ef4444"
            subtitle="-1 from last month"
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
