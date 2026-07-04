import { useState } from 'react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { RecentRatingsTable } from './RecentRatingsTable';
import { ComplaintLogTable } from './ComplaintLogTable';
import { Select } from './Select';
import { Star } from 'lucide-react';

export function CSATSatisfaction() {
  const [selectedBranch, setSelectedBranch] = useState('all');

  const branchData = {
    all: { rating: 4.3, stars: 4, total: 211, complaints: 3 },
    'quezon-city': { rating: 4.5, stars: 5, total: 89, complaints: 1 },
    'calamba': { rating: 4.2, stars: 4, total: 67, complaints: 1 },
    'sta-rosa': { rating: 4.1, stars: 4, total: 55, complaints: 1 },
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
                { value: 'all', label: 'All Branches' },
                { value: 'quezon-city', label: 'Quezon City' },
                { value: 'calamba', label: 'Calamba' },
                { value: 'sta-rosa', label: 'Sta. Rosa' },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-end" style={{ borderLeft: '4px solid #22c55e' }}>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Average Rating</div>
            <div className="flex items-center gap-2">
              <div className="text-4xl font-semibold text-gray-900">{currentData.rating}</div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= currentData.stars ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">out of 5</div>
          </div>
          <KPICard
            title="Total Ratings Received"
            value={currentData.total.toString()}
            accentColor="#f59e0b"
          />
          <KPICard
            title="Open Complaints"
            value={currentData.complaints.toString()}
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
