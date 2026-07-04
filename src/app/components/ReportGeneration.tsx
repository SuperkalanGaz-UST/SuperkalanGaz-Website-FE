import { useState } from "react";
import { Header } from "./Header";
import { DatePicker } from "./DatePicker";

type ReportType = "csat" | "sla";
type ExportFormat = "pdf" | "csv";

export function ReportGeneration() {
  const [selectedReport, setSelectedReport] =
    useState<ReportType>("csat");
  const [fromDate, setFromDate] = useState("2026-05-01");
  const [toDate, setToDate] = useState("2026-05-31");
  const [exportFormat, setExportFormat] =
    useState<ExportFormat>("pdf");
  const [showToast, setShowToast] = useState(false);

  const handleGenerateReport = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleClear = () => {
    setSelectedReport("csat");
    setFromDate("2026-05-01");
    setToDate("2026-05-31");
    setExportFormat("pdf");
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: "static" }}>
        <Header title="Reports" />
      </div>

      <div className="p-8">
        <div
          className="mx-auto"
          style={{ width: "calc(60% + 160px)", paddingLeft: "80px", paddingRight: "80px" }}
        >
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {/* Card Header */}
            <div className="border-b border-gray-200 px-4 py-4">
              <h2 className="text-xl font-bold text-gray-900">
                Generate Report
              </h2>
            </div>

            {/* Card Body */}
            <div className="py-4 px-8">
              {/* Report Type Section */}
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Report Type
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedReport("csat")}
                    className={`relative rounded-lg transition-all flex items-center justify-center py-3 px-3 ${
                      selectedReport === "csat"
                        ? "border-2 border-[#1e3a5f] bg-[#1e3a5f]/10"
                        : "border border-gray-300 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <h4 className="font-normal text-sm text-gray-900">
                      Monthly CSAT Summary
                    </h4>
                  </button>

                  <button
                    onClick={() => setSelectedReport("sla")}
                    className={`relative rounded-lg transition-all flex items-center justify-center py-3 px-3 ${
                      selectedReport === "sla"
                        ? "border-2 border-[#1e3a5f] bg-[#1e3a5f]/10"
                        : "border border-gray-300 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <h4 className="font-normal text-sm text-gray-900">
                      SLA Compliance Report
                    </h4>
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 my-5"></div>

              {/* Date Range Section */}
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Date Range
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <DatePicker
                    label="From"
                    value={fromDate}
                    onChange={setFromDate}
                  />
                  <DatePicker
                    label="To"
                    value={toDate}
                    onChange={setToDate}
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 my-5"></div>

              {/* Export Format Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Export Format
                </h3>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className="relative">
                      <input
                        type="radio"
                        name="exportFormat"
                        checked={exportFormat === "pdf"}
                        onChange={() => setExportFormat("pdf")}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          exportFormat === "pdf"
                            ? "border-[#007BC1] bg-[#007BC1]"
                            : "border-gray-400"
                        }`}
                      >
                        {exportFormat === "pdf" && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-900">
                      PDF
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className="relative">
                      <input
                        type="radio"
                        name="exportFormat"
                        checked={exportFormat === "csv"}
                        onChange={() => setExportFormat("csv")}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          exportFormat === "csv"
                            ? "border-[#007BC1] bg-[#007BC1]"
                            : "border-gray-400"
                        }`}
                      >
                        {exportFormat === "csv" && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-900">
                      CSV
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons - Outside Card */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={handleClear}
              className="h-[44px] px-6 border-2 border-gray-300 text-gray-700 rounded-lg font-normal hover:bg-gray-50 transition-colors flex items-center justify-center text-sm"
            >
              Clear
            </button>
            <button
              onClick={handleGenerateReport}
              className="h-[44px] px-6 bg-[#007BC1] text-white rounded-lg font-normal hover:bg-[#005a8f] transition-colors flex items-center justify-center text-sm"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg">
          <p className="font-medium">
            Report generated successfully. Your download will
            begin shortly.
          </p>
        </div>
      )}
    </div>
  );
}