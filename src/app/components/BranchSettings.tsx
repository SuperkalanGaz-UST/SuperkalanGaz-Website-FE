import { useState, useEffect, useCallback } from "react";
import { Header } from "./Header";
import { Select } from "./Select";
import { RegisterBranchModal } from "./RegisterBranchModal";
import { EditBranchModal } from "./EditBranchModal";
import { apiFetch, apiErrorMessage } from "../lib/api";
import { toast } from "sonner";

/** Delivery coverage polygon stored on a branch (null = none set). */
export interface BranchGeofence {
  type: "polygon";
  points: [number, number][];
}

/** A registered branch as returned by GET /branches. */
export interface BranchRow {
  id: string;
  name: string;
  code: string;
  status: "active" | "inactive";
  contact_number: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  geofence: BranchGeofence | null;
  created_at: string;
}

export function BranchSettings() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Live Franchise Registry data (replaces the former hardcoded rows).
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  // Edit modal target, and the branch pending a delete (deactivate) confirmation.
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<BranchRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [rewardThreshold, setRewardThreshold] = useState("30");
  const [dualAuth, setDualAuth] = useState(true);
  const [stock11kg, setStock11kg] = useState("10");
  const [stock22kg, setStock22kg] = useState("5");
  const [stock50kg, setStock50kg] = useState("3");
  const [deliverySLA, setDeliverySLA] = useState("60");
  const [notificationMethod, setNotificationMethod] = useState(
    "email-dashboard",
  );

  const handleSave = () => {
    alert("Settings saved successfully!");
  };

  const handleDiscard = () => {
    setRewardThreshold("30");
    setDualAuth(true);
    setStock11kg("10");
    setStock22kg("5");
    setStock50kg("3");
    setDeliverySLA("60");
    setNotificationMethod("email-dashboard");
  };

  const fetchBranches = useCallback(async () => {
    setLoadingBranches(true);
    setBranchesError(null);
    try {
      const res = await apiFetch("/branches");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBranchesError(apiErrorMessage(data, "Could not load branches."));
        setBranches([]);
        return;
      }
      setBranches((data?.branches ?? []) as BranchRow[]);
    } catch {
      setBranchesError("Could not reach the server.");
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  useEffect(() => {
    void fetchBranches();
  }, [fetchBranches]);

  // Refresh the registry after the registration modal closes (a branch may have
  // just been created).
  const handleModalClose = () => {
    setIsModalOpen(false);
    void fetchBranches();
  };

  // Reflect an edited branch in the table without a full refetch.
  const handleEditSaved = (updated: BranchRow) => {
    setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setEditingBranch(null);
  };

  // "Delete" is a soft-delete: it deactivates the branch (AGENTS.md §3.2 — never
  // a hard delete). The row stays and flips to Inactive.
  const handleConfirmDelete = async () => {
    if (!deletingBranch) return;
    setDeleteBusy(true);
    try {
      const res = await apiFetch(`/branches/${deletingBranch.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(apiErrorMessage(data, "Could not deactivate the branch."));
        return;
      }
      const updated = data?.branch as BranchRow | undefined;
      if (updated) {
        setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      }
      toast.success(`Branch "${deletingBranch.name}" deactivated.`);
      setDeletingBranch(null);
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <>
      <RegisterBranchModal isOpen={isModalOpen} onClose={handleModalClose} />

      {editingBranch && (
        <EditBranchModal
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSaved={handleEditSaved}
        />
      )}

      {deletingBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-[420px] shadow-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Deactivate branch?</h2>
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">{deletingBranch.name}</span> will be set
              to <span className="font-medium text-gray-700">Inactive</span>. Its record is kept for
              history and it can be reactivated later.
            </p>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setDeletingBranch(null)}
                disabled={deleteBusy}
                className="h-[36px] px-4 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteBusy}
                className="h-[36px] px-4 bg-[#CC1903] text-white text-sm font-medium rounded-lg hover:bg-[#a81402] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleteBusy ? "Deactivating…" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div style={{ position: 'static' }}>
          <Header title="Franchise Registry" />
        </div>

      <div className="p-8">
        <div className="max-w-3xl">
          {/* Branch Accounts */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Branch Accounts
            </h3>

            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-[#007BC1] text-white rounded-lg text-sm font-medium hover:bg-[#005a8f] transition-colors"
              >
                + Register New Branch
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                View All Branches
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-600 pb-3">Branch Name</th>
                    <th className="text-left text-xs font-medium text-gray-600 pb-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-600 pb-3">Date Registered</th>
                    <th className="text-right text-xs font-medium text-gray-600 pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBranches ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                        Loading branches…
                      </td>
                    </tr>
                  ) : branchesError ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-red-600">
                        {branchesError}
                      </td>
                    </tr>
                  ) : branches.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                        No branches registered yet.
                      </td>
                    </tr>
                  ) : (
                    branches.map((branch) => (
                      <tr key={branch.id} className="border-b border-gray-100">
                        <td className="py-3 text-sm text-gray-900">
                          <div>{branch.name}</div>
                          <div className="text-xs text-gray-400">{branch.code}</div>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                branch.status === "active" ? "bg-green-500" : "bg-gray-400"
                              }`}
                            ></span>
                            {branch.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-gray-600">
                          {formatDate(branch.created_at)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingBranch(branch)}
                              className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingBranch(branch)}
                              disabled={branch.status === "inactive"}
                              className="px-2.5 py-1 text-xs font-medium rounded-md border border-[#CC1903]/30 text-[#CC1903] hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* System-Wide Loyalty Policy */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System-Wide Loyalty Policy
            </h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reward Threshold (applies to all branches)
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
                Number of purchases before a free tank reward is flagged. Branch Owners cannot change this value.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Require dual authorization for all redemptions
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
            </div>
          </div>

          {/* System-Wide Low-Stock Policy */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System-Wide Low-Stock Alert Defaults
            </h3>

            <p className="text-xs text-gray-600 mb-4">
              These are default thresholds applied when a new branch is onboarded. Existing branches manage their own thresholds within these limits.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum allowed threshold — 11kg Cylinders
              </label>
              <input
                type="number"
                value={stock11kg}
                onChange={(e) => setStock11kg(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum allowed threshold — 22kg Cylinders
              </label>
              <input
                type="number"
                value={stock22kg}
                onChange={(e) => setStock22kg(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum allowed threshold — 50kg Cylinders
              </label>
              <input
                type="number"
                value={stock50kg}
                onChange={(e) => setStock50kg(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* System-Wide SLA Policy */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System-Wide SLA Policy
            </h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default SLA Threshold — All Branches (minutes)
              </label>
              <input
                type="number"
                value={deliverySLA}
                onChange={(e) => setDeliverySLA(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                This sets the default SLA applied to all new branches. Individual branches cannot override this.
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

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-[#007BC1] text-white rounded-lg font-medium hover:bg-[#005a8f] transition-colors"
            >
              Save Settings
            </button>
            <button
              onClick={handleDiscard}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Discard Changes
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
