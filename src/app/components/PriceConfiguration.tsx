import { useState } from 'react';
import { Header } from './Header';

export function PriceConfiguration() {
  const [price50kg, setPrice50kg] = useState('1,500.00');
  const [price22kg, setPrice22kg] = useState('1,100.00');
  const [price11kg, setPrice11kg] = useState('650.00');
  const [price5kg, setPrice5kg] = useState('350.00');
  const [price27kg, setPrice27kg] = useState('200.00');

  const handleSave = () => {
    alert('Prices saved successfully!');
  };

  const handleCancel = () => {
    setPrice50kg('1,500.00');
    setPrice22kg('1,100.00');
    setPrice11kg('650.00');
    setPrice5kg('350.00');
    setPrice27kg('200.00');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header
          title="Price Configuration"
          subtitle="Manage system-wide pricing for LPG cylinders."
        />
      </div>

      <div className="p-8">
        <div className="max-w-2xl">
          <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              LPG Base Price Configuration
            </h2>
            <p className="text-sm text-gray-600 mb-8">
              Set the system-wide standard retail prices for all LPG cylinder sizes.
            </p>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  50kg Cylinder
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
                    ₱
                  </span>
                  <input
                    type="text"
                    value={price50kg}
                    onChange={(e) => setPrice50kg(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B75B8] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  22kg Cylinder
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
                    ₱
                  </span>
                  <input
                    type="text"
                    value={price22kg}
                    onChange={(e) => setPrice22kg(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B75B8] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  11kg Cylinder
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
                    ₱
                  </span>
                  <input
                    type="text"
                    value={price11kg}
                    onChange={(e) => setPrice11kg(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B75B8] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  5kg Cylinder
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
                    ₱
                  </span>
                  <input
                    type="text"
                    value={price5kg}
                    onChange={(e) => setPrice5kg(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B75B8] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2.7kg Cylinder
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">
                    ₱
                  </span>
                  <input
                    type="text"
                    value={price27kg}
                    onChange={(e) => setPrice27kg(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0B75B8] focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-[#0B75B8] text-white font-medium rounded-lg hover:bg-[#095a8f] transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
