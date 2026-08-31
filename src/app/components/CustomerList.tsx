import { useState, useMemo } from 'react';
import { Search, ChevronDown, Star, Users, Gift, ShoppingCart } from 'lucide-react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { Pagination } from './Pagination';

const allCustomers = [
  { id: 'C001', name: 'Maria Dela Cruz Santos', phone: '+63 917 834 2291', primaryBranch: 'Quezon City', totalOrders: 18, loyaltyPoints: 18, avgRating: 4.2, lastOrder: 'Apr 12, 2025', status: 'Active' },
  { id: 'C002', name: 'Kainan ni Aling Nena',   phone: '+63 918 987 6543', primaryBranch: 'Calamba',     totalOrders: 14, loyaltyPoints: 14, avgRating: 4.7, lastOrder: 'Apr 10, 2025', status: 'Active' },
  { id: 'C003', name: 'Pedro Penduko',           phone: '+63 919 555 1122', primaryBranch: 'Sta. Rosa',   totalOrders: 12, loyaltyPoints: 12, avgRating: 3.9, lastOrder: 'Apr 8, 2025',  status: 'Active' },
  { id: 'C004', name: 'Carlos Miguel Reyes',     phone: '+63 922 333 4444', primaryBranch: 'Quezon City', totalOrders: 31, loyaltyPoints: 1,  avgRating: 4.5, lastOrder: 'Apr 5, 2025',  status: 'Reward Eligible' },
  { id: 'C005', name: 'Sofia Cruz Villanueva',   phone: '+63 923 777 8888', primaryBranch: 'Calamba',     totalOrders: 9,  loyaltyPoints: 9,  avgRating: 4.1, lastOrder: 'Apr 3, 2025',  status: 'Active' },
  { id: 'C006', name: 'Juan Dela Cruz',          phone: '+63 921 222 1111', primaryBranch: 'Sta. Rosa',   totalOrders: 5,  loyaltyPoints: 5,  avgRating: 3.5, lastOrder: 'Mar 30, 2025', status: 'Active' },
  { id: 'C007', name: 'Lola Basyang Fernandez',  phone: '+63 920 444 3333', primaryBranch: 'Quezon City', totalOrders: 28, loyaltyPoints: 28, avgRating: 4.8, lastOrder: 'Mar 28, 2025', status: 'Reward Eligible' },
  { id: 'C008', name: 'Ana Grace Reyes',         phone: '+63 924 111 2222', primaryBranch: 'Calamba',     totalOrders: 22, loyaltyPoints: 22, avgRating: 4.0, lastOrder: 'Mar 25, 2025', status: 'Reward Eligible' },
  { id: 'C009', name: 'Rita Lopez Bautista',     phone: '+63 925 222 3333', primaryBranch: 'Sta. Rosa',   totalOrders: 7,  loyaltyPoints: 7,  avgRating: 4.3, lastOrder: 'Mar 22, 2025', status: 'Active' },
  { id: 'C010', name: 'Benjamin Ramos Cruz',     phone: '+63 926 444 5555', primaryBranch: 'Quezon City', totalOrders: 12, loyaltyPoints: 12, avgRating: 3.7, lastOrder: 'Mar 20, 2025', status: 'Active' },
  { id: 'C011', name: 'Diana Santos Aquino',     phone: '+63 927 666 7777', primaryBranch: 'Calamba',     totalOrders: 35, loyaltyPoints: 5,  avgRating: 4.6, lastOrder: 'Mar 18, 2025', status: 'Active' },
  { id: 'C012', name: 'Edgar Gomez Torres',      phone: '+63 928 888 9999', primaryBranch: 'Sta. Rosa',   totalOrders: 29, loyaltyPoints: 29, avgRating: 4.2, lastOrder: 'Mar 15, 2025', status: 'Reward Eligible' },
  { id: 'C013', name: 'Fiona Marie Castillo',    phone: '+63 929 111 2222', primaryBranch: 'Quezon City', totalOrders: 31, loyaltyPoints: 1,  avgRating: 4.4, lastOrder: 'Mar 12, 2025', status: 'Active' },
  { id: 'C014', name: 'Gabriel Jose Cruz',       phone: '+63 930 333 4444', primaryBranch: 'Calamba',     totalOrders: 18, loyaltyPoints: 18, avgRating: 3.8, lastOrder: 'Mar 10, 2025', status: 'Active' },
  { id: 'C015', name: 'Helen Santos Lim',        phone: '+63 931 555 6666', primaryBranch: 'Sta. Rosa',   totalOrders: 24, loyaltyPoints: 24, avgRating: 4.1, lastOrder: 'Mar 8, 2025',  status: 'Reward Eligible' },
  { id: 'C016', name: 'Isagani Villanueva',      phone: '+63 932 777 8888', primaryBranch: 'Quezon City', totalOrders: 6,  loyaltyPoints: 6,  avgRating: 4.0, lastOrder: 'Mar 5, 2025',  status: 'Active' },
  { id: 'C017', name: 'Jasmine Torres Garcia',   phone: '+63 933 999 0000', primaryBranch: 'Calamba',     totalOrders: 43, loyaltyPoints: 13, avgRating: 4.9, lastOrder: 'Mar 3, 2025',  status: 'Active' },
  { id: 'C018', name: 'Kevin Aquino Reyes',      phone: '+63 934 111 3333', primaryBranch: 'Sta. Rosa',   totalOrders: 11, loyaltyPoints: 11, avgRating: 3.6, lastOrder: 'Mar 1, 2025',  status: 'Active' },
  { id: 'C019', name: 'Luz Mendoza Bautista',    phone: '+63 935 444 6666', primaryBranch: 'Quezon City', totalOrders: 19, loyaltyPoints: 19, avgRating: 4.3, lastOrder: 'Feb 26, 2025', status: 'Active' },
  { id: 'C020', name: 'Mario Dela Rosa Santos',  phone: '+63 936 777 0000', primaryBranch: 'Calamba',     totalOrders: 27, loyaltyPoints: 27, avgRating: 4.5, lastOrder: 'Feb 24, 2025', status: 'Reward Eligible' },
  { id: 'C021', name: 'Nora Corpuz Villanueva',  phone: '+63 937 222 5555', primaryBranch: 'Sta. Rosa',   totalOrders: 3,  loyaltyPoints: 3,  avgRating: 3.0, lastOrder: 'Feb 20, 2025', status: 'Active' },
  { id: 'C022', name: 'Oscar Tan Reyes',         phone: '+63 938 888 1111', primaryBranch: 'Quezon City', totalOrders: 15, loyaltyPoints: 15, avgRating: 4.2, lastOrder: 'Feb 18, 2025', status: 'Active' },
];

const ITEMS_PER_PAGE = 10;
const BRANCHES = ['All Branches', 'Quezon City', 'Calamba', 'Sta. Rosa'];
const STATUSES = ['All Statuses', 'Active', 'Reward Eligible'];

function BranchDot({ branch }: { branch: string }) {
  const color =
    branch === 'Quezon City' ? '#007BC1' :
    branch === 'Calamba'     ? '#0B75B8' : '#76B4DD';
  return <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block mr-1.5" style={{ backgroundColor: color }} />;
}

function FilterDropdown({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors bg-white min-w-[150px] justify-between"
      >
        <span className={value === label ? 'text-gray-400' : ''}>{value}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${value === opt ? 'text-[#007BC1] font-medium' : 'text-gray-700'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerList({ onViewCustomer }: { onViewCustomer: () => void }) {
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('All Branches');
  const [status, setStatus] = useState('All Statuses');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let d = allCustomers;
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.primaryBranch.toLowerCase().includes(q)
      );
    }
    if (branch !== 'All Branches') d = d.filter(c => c.primaryBranch === branch);
    if (status !== 'All Statuses') d = d.filter(c => c.status === status);
    return d;
  }, [search, branch, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const hasFilters = search || branch !== 'All Branches' || status !== 'All Statuses';

  const clear = () => { setSearch(''); setBranch('All Branches'); setStatus('All Statuses'); setPage(1); };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F7FA]">
      <div style={{ position: 'static' }}>
        <Header title="Customers" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-7">
          <KPICard
            title="Total Customers"
            value={allCustomers.length.toString()}
            icon={<Users className="w-4 h-4 text-[#007BC1]" />}
            accentColor="#007BC1"
          />
          <KPICard
            title="Reward Eligible"
            value={allCustomers.filter(c => c.status === 'Reward Eligible').length.toString()}
            icon={<Gift className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
          />
          <KPICard
            title="Avg. Orders per Customer"
            value={(allCustomers.reduce((s, c) => s + c.totalOrders, 0) / allCustomers.length).toFixed(1)}
            icon={<ShoppingCart className="w-4 h-4 text-[#22c55e]" />}
            accentColor="#22c55e"
          />
          <KPICard
            title="Avg. Rating"
            value={(allCustomers.reduce((s, c) => s + c.avgRating, 0) / allCustomers.length).toFixed(1)}
            subtitle="out of 5"
            icon={<Star className="w-4 h-4 text-[#a855f7]" />}
            accentColor="#a855f7"
          />
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Search + Filter bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, phone, or branch…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007BC1] focus:border-transparent"
              />
            </div>
            <FilterDropdown
              label="All Branches"
              value={branch}
              options={BRANCHES}
              onChange={(v) => { setBranch(v); setPage(1); }}
            />
            <FilterDropdown
              label="All Statuses"
              value={status}
              options={STATUSES}
              onChange={(v) => { setStatus(v); setPage(1); }}
            />
            {hasFilters && (
              <button onClick={clear} className="text-sm text-[#007BC1] hover:text-[#005a8f] transition-colors whitespace-nowrap">
                Clear
              </button>
            )}
          </div>

          {/* Result count */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              Showing <span className="font-medium text-gray-700">{filtered.length}</span> customer{filtered.length !== 1 ? 's' : ''}
              {hasFilters && ' matching filters'}
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Users className="w-3.5 h-3.5" />
              {allCustomers.length} total
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Customer', 'Phone', 'Primary Branch', 'Total Orders', 'Loyalty Points', 'Avg. Rating', 'Last Order', ''].map((h) => (
                    <th key={h} className="text-left text-[11px] font-medium text-gray-500 pb-3 pr-4 whitespace-nowrap uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                      No customers match your search or filters.
                    </td>
                  </tr>
                ) : slice.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-blue-50/30 transition-colors group">
                    {/* Name + ID */}
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#E0F0FB] flex items-center justify-center flex-shrink-0 text-[#007BC1] text-xs font-semibold">
                          {c.name.split(' ').slice(0, 2).map(w => w[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{c.name}</div>
                          <div className="text-[11px] text-gray-400">{c.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 pr-4 text-sm text-gray-600 whitespace-nowrap">{c.phone}</td>

                    {/* Branch */}
                    <td className="py-3.5 pr-4">
                      <span className="inline-flex items-center text-sm text-gray-700">
                        <BranchDot branch={c.primaryBranch} />
                        {c.primaryBranch}
                      </span>
                    </td>

                    {/* Total Orders */}
                    <td className="py-3.5 pr-4 text-sm font-semibold text-gray-800">{c.totalOrders}</td>

                    {/* Loyalty Points */}
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-col gap-1 min-w-[100px]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">{c.loyaltyPoints}/30</span>
                          {c.status === 'Reward Eligible' && (
                            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              Eligible
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.min((c.loyaltyPoints / 30) * 100, 100)}%`,
                              backgroundColor: c.status === 'Reward Eligible' ? '#f59e0b' : '#007BC1',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Avg Rating */}
                    <td className="py-3.5 pr-4">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {c.avgRating.toFixed(1)}
                      </span>
                    </td>

                    {/* Last Order */}
                    <td className="py-3.5 pr-4 text-sm text-gray-500 whitespace-nowrap">{c.lastOrder}</td>

                    {/* Action */}
                    <td className="py-3.5">
                      <button
                        onClick={onViewCustomer}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 text-xs font-medium text-[#007BC1] border border-[#007BC1] rounded-lg hover:bg-[#007BC1] hover:text-white transition-colors"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-5">
              <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
