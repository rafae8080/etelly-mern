import { useState, useEffect } from "react";
import { X, Pencil, Trash2, UserCog, Copy } from "lucide-react";

export default function ManageUsersPage() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState("");
  const [alertType, setAlertType] = useState("success");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "barangay_official",
    password: "",
  });

  // ===== FETCH USERS =====
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setUsers(data);
      setFilteredUsers(data);
    } catch (err) {
      showAlert("Failed to fetch users", "error");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ===== SEARCH FILTER =====
  useEffect(() => {
    const filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  // ===== HELPERS =====
  const showAlert = (message, type = "success") => {
    setAlert(message);
    setAlertType(type);
    setTimeout(() => setAlert(""), 3000);
  };

  const getFirstName = (fullName) => fullName?.split(" ")[0] || "";
  const getLastName = (fullName) =>
    fullName?.split(" ").slice(1).join(" ") || "";

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
    setFormData((prev) => ({ ...prev, password }));
    setShowPassword(true);
  };

  const copyPassword = async () => {
    const passwordToCopy = generatedPassword || formData.password;
    if (!passwordToCopy) return showAlert("No password to copy!", "error");
    await navigator.clipboard.writeText(passwordToCopy);
    showAlert("Password copied to clipboard!");
  };

  // ===== MODAL HANDLERS =====
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setSelectedUser(null);
    setGeneratedPassword("");
    setShowPassword(false);
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      role: "barangay_official",
      password: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setIsEditMode(true);
    setSelectedUser(user);
    setGeneratedPassword("");
    setShowPassword(false);
    setFormData({
      email: user.email,
      firstName: getFirstName(user.name),
      lastName: getLastName(user.name),
      role: user.role,
      password: "",
    });
    setIsModalOpen(true);
    setOpenActionMenu(null);
  };

  // ===== CREATE USER =====
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showAlert("User created successfully!");
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      showAlert(err.message || "Failed to create user", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ===== UPDATE USER =====
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://localhost:5000/api/users/${selectedUser._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showAlert("User updated successfully!");
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      showAlert(err.message || "Failed to update user", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ===== DELETE USER =====
  const openDeleteConfirmation = (userId) => {
    setUserToDelete(userId);
    setShowDeleteConfirm(true);
    setOpenActionMenu(null);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsLoading(true);
    setShowDeleteConfirm(false);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `http://localhost:5000/api/users/${userToDelete}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showAlert("User deleted successfully!");
      fetchUsers();
    } catch (err) {
      showAlert(err.message || "Failed to delete user", "error");
    } finally {
      setIsLoading(false);
      setUserToDelete(null);
    }
  };

  // ===== RENDER =====
  return (
    <div>
      {/* Alert */}
      {alert && (
        <div
          className={`fixed top-4 right-4 z-50 bg-white px-6 py-3 rounded-lg shadow-lg border-l-4 ${alertType === "error" ? "border-red-600" : "border-green-600"} max-w-md`}
        >
          <p className="text-gray-900 font-medium">{alert}</p>
          <button
            onClick={() => setAlert("")}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
        <button
          onClick={handleOpenCreateModal}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          + Create User
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, email or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-lg shadow overflow-hidden"
        style={{ minHeight: "320px" }}
      >
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Email", "First Name", "Last Name", "Role", "Action"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getFirstName(user.name)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getLastName(user.name)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.role === "admin" ? "Admin" : "Barangay"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setOpenActionMenu(
                          openActionMenu === user._id ? null : user._id,
                        )
                      }
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <UserCog size={18} />
                    </button>
                    {openActionMenu === user._id && (
                      <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          onClick={() => openDeleteConfirmation(user._id)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500">No users found</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {isEditMode ? "Edit User" : "Create New User"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={isEditMode ? handleUpdateUser : handleCreateUser}
              className="p-6"
            >
              <div className="space-y-5">
                {/* Email - create only */}
                {!isEditMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="text-sm w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 "
                      required
                      disabled={isLoading}
                      placeholder="user@example.com"
                    />
                  </div>
                )}

                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="text-sm w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 "
                    required
                    disabled={isLoading}
                    placeholder="Juan"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="text-sm w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 "
                    required
                    disabled={isLoading}
                    placeholder="Dela Cruz"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="text-sm w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2  cursor-pointer"
                    disabled={isLoading}
                  >
                    <option value="barangay_official">Barangay</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Password - create only */}
                {!isEditMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2  font-mono text-sm"
                        required
                        minLength={6}
                        disabled={isLoading}
                        placeholder="Min 6 characters"
                      />
                      <button
                        type="button"
                        onClick={copyPassword}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                        title="Copy password"
                      >
                        <Copy size={18} className="text-gray-600" />
                      </button>
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="px-2 py-1 text-xs text-gray-700 font-medium bg-white hover:bg-gray-200 rounded-lg border border-gray-400"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  disabled={isLoading}
                >
                  {isLoading
                    ? "Saving..."
                    : isEditMode
                      ? "Update User"
                      : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this user? This action cannot be
              undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
