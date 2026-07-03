import { useState } from "react";
import { Header } from "./Header";
import { Select } from "./Select";
import { useBranch } from "../contexts/BranchContext";
import { toast } from "sonner";

export function BranchSettings() {
  const { selectedBranch } = useBranch();
  const [rewardThreshold, setRewardThreshold] = useState("30");
  const [dualAuth, setDualAuth] = useState(true);
  const [stock11kg, setStock11kg] = useState("20");
  const [stock22kg, setStock22kg] = useState("10");
  const [stock50kg, setStock50kg] = useState("5");
  const [deliverySLA, setDeliverySLA] = useState("60");
  const [notificationMethod, setNotificationMethod] = useState(
    "email-dashboard",
  );
  const [openingTime, setOpeningTime] = useState("07:00");
  const [closingTime, setClosingTime] = useState("20:00");

  const handleSave = () => {
    toast.success("Settings saved successfully!", {
      style: {
        background: "#22c55e",
        color: "#ffffff",
        border: "none",
      },
    });
  };

  const handleDiscard = () => {
    setRewardThreshold("30");
    setDualAuth(true);
    setStock11kg("20");
    setStock22kg("10");
    setStock50kg("5");
    setDeliverySLA("60");
    setNotificationMethod("email-dashboard");
    setOpeningTime("07:00");
    setClosingTime("20:00");
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Settings" subtitle="Configure branch operations." />
      </div>

      <div className="p-8">
        <div className="max-w-3xl">
          {/* Loyalty Program Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Loyalty Program
            </h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reward Threshold
              </label>
              <input
                type="number"
                value={rewardThreshold}
                onChange={(e) =>
                  setRewardThreshold(e.target.value)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Number of purchases before a free tank reward is
                flagged
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Require dual authorization for redemptions
                </label>
                <button
                  onClick={() => setDualAuth(!dualAuth)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    dualAuth ? "bg-[#007BC1]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      dualAuth
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Branch Manager must manually approve each
                loyalty redemption before dispatch
              </p>
            </div>
          </div>

          {/* Low-Stock Alerts */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Low-Stock Alerts
            </h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                11kg Cylinders
              </label>
              <input
                type="number"
                value={stock11kg}
                onChange={(e) => setStock11kg(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                System will alert when 11kg cylinder stock falls below this number
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                22kg Cylinders
              </label>
              <input
                type="number"
                value={stock22kg}
                onChange={(e) => setStock22kg(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                System will alert when 22kg cylinder stock falls below this number
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                50kg Cylinders
              </label>
              <input
                type="number"
                value={stock50kg}
                onChange={(e) => setStock50kg(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                System will alert when 50kg cylinder stock falls below this number
              </p>
            </div>
          </div>

          {/* SLA Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              SLA
            </h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Standard Delivery SLA (minutes)
              </label>
              <input
                type="number"
                value={deliverySLA}
                onChange={(e) => setDeliverySLA(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Target delivery time for all orders in this
                branch
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SLA Breach Notification Method
              </label>
              <Select
                value={notificationMethod}
                onChange={setNotificationMethod}
                options={[
                  { value: "email", label: "Email Only" },
                  { value: "dashboard", label: "Dashboard Alert Only" },
                  { value: "email-dashboard", label: "Email + Dashboard Alert" },
                  { value: "sms", label: "SMS Only" },
                  { value: "all", label: "All Methods" },
                ]}
              />
            </div>
          </div>

          {/* Branch Operating Hours */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Branch Operating Hours
            </h3>

            <div className="grid grid-cols-2 gap-6 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Opening Time
                </label>
                <input
                  type="time"
                  value={openingTime}
                  onChange={(e) =>
                    setOpeningTime(e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Closing Time
                </label>
                <input
                  type="time"
                  value={closingTime}
                  onChange={(e) =>
                    setClosingTime(e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Operating hours are used for time-based curfew
              rules applied to fleet riders.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="h-[36px] px-4 py-2 bg-[#007BC1] text-white rounded-lg text-[13px] font-normal hover:bg-[#005a8f] transition-colors"
            >
              Save Settings
            </button>
            <button
              onClick={handleDiscard}
              className="h-[36px] px-4 py-2 border border-[#007BC1] text-[#007BC1] bg-transparent rounded-lg text-[13px] font-normal hover:bg-[#007BC1]/5 transition-colors"
            >
              Discard Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}