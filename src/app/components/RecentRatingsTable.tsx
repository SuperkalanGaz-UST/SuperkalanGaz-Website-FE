import { Star } from 'lucide-react';

const ratingsData = [
  { customer: 'Maria Santos', orderId: 'ORD-1047', rating: 5, comment: 'Fast delivery! Very satisfied.', date: 'Apr 30, 2026' },
  { customer: 'Juan Dela Cruz', orderId: 'ORD-1051', rating: 4, comment: 'Good service, but could be faster.', date: 'Apr 29, 2026' },
  { customer: 'Pedro Penduko', orderId: 'ORD-1049', rating: 3, comment: 'Delivery was late.', date: 'Apr 29, 2026' },
  { customer: 'Lola Basyang', orderId: 'ORD-1050', rating: 5, comment: 'Excellent! Will order again.', date: 'Apr 28, 2026' },
  { customer: 'Kainan ni Aling Nena', orderId: 'ORD-1048', rating: 4, comment: 'Rider was very polite.', date: 'Apr 28, 2026' },
  { customer: 'Mang Inasal Brgy', orderId: 'ORD-1052', rating: 5, comment: 'Perfect service as always!', date: 'Apr 27, 2026' },
];

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

export function RecentRatingsTable() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Customer Ratings</h3>
        <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'customer-ratings-full' })); }} className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors">
          View all
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '160px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '140px' }} />
            <col style={{ minWidth: '230px' }} />
            <col style={{ width: '120px' }} />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Customer Name</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Order No.</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Rating</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Comment</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Date</th>
            </tr>
          </thead>
          <tbody>
            {ratingsData.map((row, index) => (
              <tr key={index} className="border-b border-gray-100">
                <td className="py-4 px-3 text-[13px] text-gray-900 whitespace-nowrap">{row.customer}</td>
                <td className="py-4 px-3 text-[13px] text-gray-600 whitespace-nowrap">{row.orderId}</td>
                <td className="py-4 px-3">
                  <RatingStars rating={row.rating} />
                </td>
                <td className="py-4 px-3 text-[13px] text-gray-600">{row.comment}</td>
                <td className="py-4 px-3 text-[13px] text-gray-600 whitespace-nowrap">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
