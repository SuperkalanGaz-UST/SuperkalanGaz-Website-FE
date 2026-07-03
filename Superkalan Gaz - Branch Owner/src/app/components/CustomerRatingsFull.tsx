import { useState, useMemo } from "react";
import { Header } from "./Header";
import { Pagination } from "./Pagination";
import { Select } from "./Select";
import { ArrowLeft, Search, Star } from "lucide-react";

const fullRatingsData = [
  {
    customer: "Maria Santos",
    orderId: "ORD-1047",
    rating: 5,
    comment: "Fast delivery! Very satisfied.",
    date: "Apr 30, 2026",
  },
  {
    customer: "Juan Dela Cruz",
    orderId: "ORD-1051",
    rating: 4,
    comment: "Good service, but could be faster.",
    date: "Apr 29, 2026",
  },
  {
    customer: "Pedro Penduko",
    orderId: "ORD-1049",
    rating: 3,
    comment: "Delivery was late.",
    date: "Apr 29, 2026",
  },
  {
    customer: "Lola Basyang",
    orderId: "ORD-1050",
    rating: 5,
    comment: "Excellent! Will order again.",
    date: "Apr 28, 2026",
  },
  {
    customer: "Kainan ni Aling Nena",
    orderId: "ORD-1048",
    rating: 4,
    comment: "Rider was very polite.",
    date: "Apr 28, 2026",
  },
  {
    customer: "Mang Inasal Brgy",
    orderId: "ORD-1052",
    rating: 5,
    comment: "Perfect service as always!",
    date: "Apr 27, 2026",
  },
  {
    customer: "Carlos Miguel",
    orderId: "ORD-1046",
    rating: 4,
    comment: "Tank was clean and properly sealed.",
    date: "Apr 26, 2026",
  },
  {
    customer: "Ana Reyes",
    orderId: "ORD-1045",
    rating: 5,
    comment: "Very professional rider.",
    date: "Apr 25, 2026",
  },
  {
    customer: "Sofia Cruz",
    orderId: "ORD-1044",
    rating: 3,
    comment: "Took longer than expected.",
    date: "Apr 24, 2026",
  },
  {
    customer: "Rita Lopez",
    orderId: "ORD-1043",
    rating: 5,
    comment: "Great service, highly recommend!",
    date: "Apr 23, 2026",
  },
  {
    customer: "Ben Reyes",
    orderId: "ORD-1042",
    rating: 4,
    comment: "Satisfied with the delivery.",
    date: "Apr 22, 2026",
  },
  {
    customer: "Diana Cruz",
    orderId: "ORD-1041",
    rating: 2,
    comment: "Rider was late and no call ahead.",
    date: "Apr 21, 2026",
  },
  {
    customer: "Edgar Santos",
    orderId: "ORD-1040",
    rating: 5,
    comment: "Excellent timing and service!",
    date: "Apr 20, 2026",
  },
  {
    customer: "Fiona Reyes",
    orderId: "ORD-1039",
    rating: 4,
    comment: "Good overall experience.",
    date: "Apr 19, 2026",
  },
  {
    customer: "Gabriel Cruz",
    orderId: "ORD-1038",
    rating: 5,
    comment: "Very happy with the service.",
    date: "Apr 18, 2026",
  },
];

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? "fill-[#f59e0b] text-[#f59e0b]"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

export function CustomerRatingsFull({
  onBack,
}: {
  onBack: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRating, setFilterRating] = useState("all");

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let data = fullRatingsData;

    if (searchQuery) {
      data = data.filter(
        (row) =>
          row.customer
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          row.orderId
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          row.comment
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    if (filterRating !== "all") {
      const ratingValue = parseInt(filterRating);
      data = data.filter((row) => row.rating === ratingValue);
    }

    return data;
  }, [searchQuery, filterRating]);

  const totalPages = Math.ceil(
    filteredData.length / itemsPerPage,
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const hasActiveFilters =
    searchQuery || filterRating !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setFilterRating("all");
    setCurrentPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: "static" }} className="pt-4">
        <Header title="Customer Ratings" />
      </div>

      <div className="p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#007BC1] hover:text-[#005a8f] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by customer, order, or comment..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
              />
            </div>
            <Select
              value={filterRating}
              onChange={(value) => {
                setFilterRating(value);
                setCurrentPage(1);
              }}
              options={[
                { value: "all", label: "All Ratings" },
                { value: "5", label: "5 Stars" },
                { value: "4", label: "4 Stars" },
                { value: "3", label: "3 Stars" },
                { value: "2", label: "2 Stars" },
                { value: "1", label: "1 Star" },
              ]}
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-[#007BC1] hover:text-[#005a8f] transition-colors whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table
              className="w-full"
              style={{ tableLayout: "fixed" }}
            >
              <colgroup>
                <col style={{ width: "160px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "140px" }} />
                <col style={{ minWidth: "230px" }} />
                <col style={{ width: "120px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">
                    Customer Name
                  </th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">
                    Order No.
                  </th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">
                    Rating
                  </th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">
                    Comment
                  </th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100"
                  >
                    <td className="py-4 px-3 text-[13px] text-gray-900 whitespace-nowrap">
                      {row.customer}
                    </td>
                    <td className="py-4 px-3 text-[13px] text-gray-600 whitespace-nowrap">
                      {row.orderId}
                    </td>
                    <td className="py-4 px-3">
                      <RatingStars rating={row.rating} />
                    </td>
                    <td className="py-4 px-3 text-[13px] text-gray-600">
                      {row.comment}
                    </td>
                    <td className="py-4 px-3 text-[13px] text-gray-600 whitespace-nowrap">
                      {row.date}
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}