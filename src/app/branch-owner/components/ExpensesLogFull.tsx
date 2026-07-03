import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search, X, ChevronDown, Calendar } from 'lucide-react';

// ─── Types & Data ─────────────────────────────────────────────────────────────

type Category =
  | 'Purchases'
  | 'Gasoline, Fuel & Oil'
  | 'Repairs & Maintenance'
  | 'Salary Disbursement'
  | 'Incentives'
  | '13th Month Pay'
  | 'Government Mandated Benefits'
  | 'Utilities'
  | 'Communication'
  | 'Rental'
  | 'Taxes & Licenses';

interface ExpenseRow {
  id: string;
  date: string;
  refNo: string;
  category: Category;
  description: string;
  amount: number;
  recordedBy: string;
  month: string;
}

const initialExpensesLog: ExpenseRow[] = [
  // Purchase Records
  { id: 'p1', date: 'May 6, 2026',  refNo: 'PUR-0001', category: 'Purchases',                 description: 'LPG Stock Purchase: 150 units (11kg)',      amount: 105000, recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: 'p2', date: 'Apr 15, 2026', refNo: 'PUR-0002', category: 'Purchases',                 description: 'LPG Stock Purchase: 100 units (11kg)',      amount: 70000,  recordedBy: 'Branch Manager: J. Reyes', month: 'April' },
  
  // Operational Records
  { id: '1',  date: 'May 5, 2026',  refNo: 'EXP-0001', category: 'Gasoline, Fuel & Oil',          description: 'Gasoline refill for 3 delivery riders',    amount: 2800,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '2',  date: 'May 5, 2026',  refNo: 'EXP-0002', category: 'Gasoline, Fuel & Oil',          description: 'Fuel refill — plate XYZ-9876',              amount: 1200,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '3',  date: 'May 4, 2026',  refNo: 'EXP-0003', category: 'Repairs & Maintenance',         description: 'Oil change — plate NCD-1234',               amount: 950,   recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '4',  date: 'May 4, 2026',  refNo: 'EXP-0004', category: 'Repairs & Maintenance',         description: 'Tire replacement — plate ABC-1122',         amount: 3800,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '5',  date: 'May 3, 2026',  refNo: 'EXP-0005', category: 'Salary Disbursement',             description: 'Monthly salary — J. Reyes',                 amount: 10500, recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '6',  date: 'May 3, 2026',  refNo: 'EXP-0006', category: 'Salary Disbursement',             description: 'Monthly salary — R. Cruz',                  amount: 10500, recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '7',  date: 'May 2, 2026',  refNo: 'EXP-0007', category: 'Utilities',                     description: 'Electricity bill — May 2026',               amount: 4200,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '8',  date: 'May 2, 2026',  refNo: 'EXP-0008', category: 'Communication',                 description: 'Internet subscription — May 2026',          amount: 1800,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '9',  date: 'May 1, 2026',  refNo: 'EXP-0009', category: 'Rental',                        description: 'Monthly branch space rental — May 2026',    amount: 10000, recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '10', date: 'May 1, 2026',  refNo: 'EXP-0010', category: 'Taxes & Licenses',              description: 'LTO registration — plate NCD-1234',         amount: 3500,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
];

const categoryPillStyle: Record<Category, string> = {
  'Purchases':                     'bg-sky-100 text-sky-700 border border-sky-200',
  'Gasoline, Fuel & Oil':          'bg-[#dbeafe] text-[#1e3a5f]',
  'Repairs & Maintenance':         'bg-amber-100 text-amber-800',
  'Salary Disbursement':           'bg-green-100 text-green-800',
  'Incentives':                    'bg-lime-100 text-lime-800',
  '13th Month Pay':                'bg-emerald-100 text-emerald-800',
  'Government Mandated Benefits':  'bg-green-200 text-green-900',
  'Utilities':                     'bg-teal-100 text-teal-800',
  'Communication':                 'bg-cyan-100 text-cyan-800',
  'Rental':                        'bg-purple-100 text-purple-800',
  'Taxes & Licenses':              'bg-red-100 text-red-700',
};

const ITEMS_PER_PAGE = 10;

const monthOptions = [
  { value: 'all',      label: 'All Months' },
  { value: 'December', label: 'December' },
  { value: 'January',  label: 'January' },
  { value: 'February', label: 'February' },
  { value: 'March',    label: 'March' },
  { value: 'April',    label: 'April' },
  { value: 'May',      label: 'May' },
];

const categoryOptions = [
  { value: 'all',                          label: 'All Categories' },
  { value: 'Purchases',                    label: 'Purchases' },
  { value: 'Gasoline, Fuel & Oil',         label: 'Gasoline, Fuel & Oil' },
  { value: 'Repairs & Maintenance',        label: 'Repairs & Maintenance' },
  { value: 'Salary Disbursement',          label: 'Salary Disbursement' },
  { value: 'Incentives',                   label: 'Incentives' },
  { value: '13th Month Pay',               label: '13th Month Pay' },
  { value: 'Government Mandated Benefits', label: 'Government Mandated Benefits' },
  { value: 'Utilities',                    label: 'Utilities' },
  { value: 'Communication',                label: 'Communication' },
  { value: 'Rental',                       label: 'Rental' },
  { value: 'Taxes & Licenses',             label: 'Taxes & Licenses' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpensesLogFull({ onBack }: { onBack?: () => void }) {
  const [expensesData, setExpensesData] = useState<ExpenseRow[]>(initialExpensesLog);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<{
    date: string;
    category: Category | '';
    description: string;
    amount: string;
  }>({
    date: '',
    category: '', 
    description: '',
    amount: ''
  });

  const filteredData = useMemo(() => {
    let data = expensesData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(row =>
        [row.date, row.refNo, row.category, row.description, `₱${row.amount.toLocaleString()}`, row.recordedBy]
          .some(v => v.toLowerCase().includes(q))
      );
    }
    if (filterCategory !== 'all') data = data.filter(r => r.category === filterCategory);
    if (filterMonth !== 'all') data = data.filter(r => r.month === filterMonth);
    return data;
  }, [searchQuery, filterCategory, filterMonth, expensesData]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const pageData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const hasFilters = searchQuery || filterCategory !== 'all' || filterMonth !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterMonth('all');
    setCurrentPage(1);
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.date || !newExpense.category || !newExpense.description || !newExpense.amount) return;

    const prefix = newExpense.category === 'Purchases' ? 'PUR' : 'EXP';
    const newRefNo = `${prefix}-${String(expensesData.length + 1).padStart(4, '0')}`;
    
    const d = new Date(newExpense.date);
    const formattedMonth = d.toLocaleString('en-US', { month: 'long' });
    const formattedDateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const expenseEntry: ExpenseRow = {
      id: Math.random().toString(36).substring(2, 9),
      date: formattedDateStr,
      refNo: newRefNo,
      category: newExpense.category as Category,
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      recordedBy: 'Branch Owner: M. Santos',
      month: formattedMonth
    };

    setExpensesData([expenseEntry, ...expensesData]);
    setIsModalOpen(false);
    
    setNewExpense({
      date: '',
      category: '',
      description: '',
      amount: ''
    });
  };

  return (
    <div className="flex-1 overflow-y-auto relative">
      <div style={{ position: 'static' }}>
        <Header title="Expenses Log" />
      </div>

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'operational-expenses' }));
              if (onBack) onBack();
            }}
            className="flex items-center gap-2 text-sm text-[#007BC1] hover:text-[#005a8f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back 
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="mr-8 bg-[#007BC1] hover:bg-[#005a8f] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            Add Transaction
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search reference numbers, descriptions, etc..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
              />
            </div>
            <Select
              value={filterCategory}
              onChange={v => { setFilterCategory(v); setCurrentPage(1); }}
              options={categoryOptions}
            />
            <Select
              value={filterMonth}
              onChange={v => { setFilterMonth(v); setCurrentPage(1); }}
              options={monthOptions}
            />
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-[#007BC1] hover:text-[#005a8f] transition-colors whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase pb-3 pr-4">Date</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase pb-3 pr-4">Ref No.</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase pb-3 pr-4">Category</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase pb-3 pr-4">Description</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase pb-3 pr-4">Amount</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase pb-3">Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-gray-400">No transactions match your filters.</td>
                  </tr>
                ) : (
                  pageData.map((row, idx) => (
                    <tr key={row.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                      <td className="py-4 pr-4 text-[13px] text-gray-900 whitespace-nowrap">{row.date}</td>
                      <td className="py-4 pr-4 text-[13px] text-gray-900 whitespace-nowrap font-mono">{row.refNo}</td>
                      <td className="py-4 pr-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${categoryPillStyle[row.category]}`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-[13px] text-gray-700 max-w-[300px] truncate">{row.description}</td>
                      <td className="py-4 pr-4 text-[13px] text-gray-900 whitespace-nowrap font-medium">
                        ₱{row.amount.toLocaleString()}
                      </td>
                      <td className="py-4 text-[13px] text-gray-600 whitespace-nowrap">{row.recordedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* ADD TRANSACTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Add New Transaction</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6">
              <div className="space-y-4">
                {/* Date Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      className={`appearance-none w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm bg-white [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${!newExpense.date ? 'text-gray-400' : 'text-gray-900'}`}
                    />
                    <Calendar className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                
                {/* Category Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div className="relative">
                    <select
                      required
                      value={newExpense.category}
                      onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as Category })}
                      className={`appearance-none w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm bg-white cursor-pointer ${!newExpense.category ? 'text-gray-400' : 'text-gray-900'}`}
                    >
                      <option value="" disabled hidden>Select Category</option>
                      {categoryOptions.filter(o => o.value !== 'all').map((opt) => (
                        <option key={opt.value} value={opt.value} className="text-gray-900">{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Description Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Stock replenishment or Electricity bill"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                {/* Amount Input (Spinners Removed) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#007BC1] hover:bg-[#005a8f] rounded-lg transition-colors"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}