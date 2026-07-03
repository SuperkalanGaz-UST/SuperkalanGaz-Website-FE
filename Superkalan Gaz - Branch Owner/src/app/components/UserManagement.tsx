import { useState, useEffect } from 'react';
import { Header } from './Header';
import { Pencil, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '../contexts/BranchContext';

interface BranchManager {
  id: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  status: 'Active' | 'Inactive';
  dateCreated: string;
  lastLogin: string;
}

const branchManagersData: Record<string, BranchManager[]> = {
  'Quezon City Branch': [
    {
      id: '1',
      name: 'Maria Santos',
      email: 'maria.santos@superkalan.com',
      phone: '+63 917 234 5678',
      username: 'maria.santos',
      password: 'password123',
      status: 'Active',
      dateCreated: 'Feb 10, 2026',
      lastLogin: 'May 2, 2026 — 9:42 AM',
    },
    {
      id: '2',
      name: 'Jose Reyes',
      email: 'jose.reyes@superkalan.com',
      phone: '+63 917 345 6789',
      username: 'jose.reyes',
      password: 'password123',
      status: 'Active',
      dateCreated: 'Jan 15, 2026',
      lastLogin: 'May 1, 2026 — 3:15 PM',
    },
  ],
  'Makati Branch': [
    {
      id: '3',
      name: 'Ana Cruz',
      email: 'ana.cruz@superkalan.com',
      phone: '+63 917 456 7890',
      username: 'ana.cruz',
      password: 'password123',
      status: 'Active',
      dateCreated: 'Mar 5, 2026',
      lastLogin: 'May 2, 2026 — 10:30 AM',
    },
    {
      id: '4',
      name: 'Roberto Lim',
      email: 'roberto.lim@superkalan.com',
      phone: '+63 917 567 8901',
      username: 'roberto.lim',
      password: 'password123',
      status: 'Active',
      dateCreated: 'Apr 12, 2026',
      lastLogin: 'May 1, 2026 — 2:45 PM',
    },
  ],
  'Mandaluyong Branch': [
    {
      id: '5',
      name: 'Carlo Bautista',
      email: 'carlo.bautista@superkalan.com',
      phone: '+63 917 678 9012',
      username: 'carlo.bautista',
      password: 'password123',
      status: 'Active',
      dateCreated: 'Feb 20, 2026',
      lastLogin: 'May 2, 2026 — 11:15 AM',
    },
  ],
};

export function UserManagement() {
  const { selectedBranch } = useBranch();
  const [managers, setManagers] = useState<BranchManager[]>(branchManagersData[selectedBranch]);

  useEffect(() => {
    setManagers(branchManagersData[selectedBranch]);
  }, [selectedBranch]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingManager, setEditingManager] = useState<BranchManager | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const handleAddClick = () => {
    setEditingManager(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      confirmPassword: '',
      status: 'Active',
    });
    setShowModal(true);
  };

  const handleEditClick = (manager: BranchManager) => {
    setEditingManager(manager);
    setFormData({
      name: manager.name,
      email: manager.email,
      phone: manager.phone,
      username: manager.username,
      password: manager.password,
      confirmPassword: manager.password,
      status: manager.status,
    });
    setShowModal(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingManager(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (editingManager) {
      setManagers(managers.map(m =>
        m.id === editingManager.id
          ? {
              ...m,
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              username: formData.username,
              password: formData.password,
              status: formData.status,
            }
          : m
      ));
      toast.success('Branch manager account updated successfully.');
    } else {
      const newManager: BranchManager = {
        id: String(Date.now()),
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        username: formData.username,
        password: formData.password,
        status: formData.status,
        dateCreated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        lastLogin: 'Never',
      };
      setManagers([...managers, newManager]);
      toast.success('Branch manager account created successfully.');
    }

    handleCloseModal();
  };

  const handleConfirmDelete = () => {
    if (deletingId) {
      setManagers(managers.filter(m => m.id !== deletingId));
      toast.success('Branch manager account deleted.');
      setShowDeleteDialog(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header
          title="User Management"
          subtitle="Manage branch manager accounts for your branch."
        />
      </div>

      <div className="p-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900">Branch Manager Accounts</h3>
            <button
              onClick={handleAddClick}
              className="px-4 py-2 bg-[#007BC1] text-white rounded-lg text-sm hover:bg-[#005a8f] transition-colors"
            >
              Add Branch Manager
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Name</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Email</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Status</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Date Created</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Last Login</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((manager, index) => (
                  <tr
                    key={manager.id}
                    className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}
                  >
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">{manager.name}</td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{manager.email}</td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                          manager.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {manager.status}
                      </span>
                    </td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{manager.dateCreated}</td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{manager.lastLogin}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(manager)}
                          className="p-1.5 text-gray-600 hover:text-[#007BC1] hover:bg-gray-100 rounded transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(manager.id)}
                          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-[480px] max-h-[85vh] flex flex-col">
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">
                {editingManager ? 'Edit Branch Manager' : 'Add Branch Manager'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable Body */}
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email address"
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Enter username"
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      className="w-full h-[44px] px-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Re-enter password"
                      className="w-full h-[44px] px-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formData.status === 'Active'}
                        onChange={() => setFormData({ ...formData, status: 'Active' })}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        formData.status === 'Active' ? 'border-[#007BC1]' : 'border-gray-300'
                      }`}>
                        {formData.status === 'Active' && (
                          <div className="w-2 h-2 rounded-full bg-[#007BC1]"></div>
                        )}
                      </div>
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formData.status === 'Inactive'}
                        onChange={() => setFormData({ ...formData, status: 'Inactive' })}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        formData.status === 'Inactive' ? 'border-[#007BC1]' : 'border-gray-300'
                      }`}>
                        {formData.status === 'Inactive' && (
                          <div className="w-2 h-2 rounded-full bg-[#007BC1]"></div>
                        )}
                      </div>
                      <span className="text-sm text-gray-700">Inactive</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-xs text-gray-500 px-6">
                This account will have Branch Manager access for Quezon City Branch only.
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-normal text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-normal hover:bg-[#152942] transition-colors"
                >
                  {editingManager ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-[400px] p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Account</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this branch manager account? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
