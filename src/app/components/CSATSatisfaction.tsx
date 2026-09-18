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
          <KPICard
            title="Average Rating"
            value={currentData.rating.toString()}
            icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
            trend={{ text: '+0.2 from last month', direction: 'up', positive: true }}
          />

          <KPICard
            title="Total Ratings Received"
            value={currentData.total.toString()}
            icon={<MessageSquare className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
            trend={{ text: '+18 from last month', direction: 'up', positive: true }}
          />
          <KPICard
            title="Open Complaints"
            value={currentData.complaints.toString()}
            icon={<AlertCircle className="w-4 h-4 text-[#ef4444]" />}
            accentColor="#ef4444"
            trend={{ text: '-1 from last month', direction: 'down', positive: false }}
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
