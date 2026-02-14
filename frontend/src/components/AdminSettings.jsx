import { createSignal, Show, For, onMount } from 'solid-js';

export default function AdminSettings(props) {
  const [oldPassword, setOldPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  
  // Collapsible sections
  const [showAccountInfo, setShowAccountInfo] = createSignal(false);
  const [showChangePassword, setShowChangePassword] = createSignal(false);
  const [showAdminManagement, setShowAdminManagement] = createSignal(false);
  
  // Admin management (superadmin only)
  const [admins, setAdmins] = createSignal([]);
  const [showAdminModal, setShowAdminModal] = createSignal(false);
  const [showPasswordModal, setShowPasswordModal] = createSignal(false);
  const [selectedAdmin, setSelectedAdmin] = createSignal(null);
  const [newAdminUsername, setNewAdminUsername] = createSignal('');
  const [newAdminPassword, setNewAdminPassword] = createSignal('');
  const [adminNewPassword, setAdminNewPassword] = createSignal('');
  const [adminConfirmPassword, setAdminConfirmPassword] = createSignal('');

  const isSuperAdmin = () => props.currentUser?.role === 'superadmin';

  onMount(() => {
    if (isSuperAdmin()) {
      fetchAdmins();
    }
  });

  const fetchAdmins = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/admins', {
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (newPassword() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          username: props.currentUser?.username,
          oldPassword: isSuperAdmin() ? undefined : oldPassword(),
          newPassword: newPassword()
        })
      });

      if (res.ok) {
        setSuccess('Password changed successfully');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!newAdminUsername() || !newAdminPassword()) {
      setError('Username and password are required');
      return;
    }

    if (newAdminPassword().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/admins', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          username: newAdminUsername(),
          password: newAdminPassword(),
          role: 'admin'
        })
      });

      if (res.ok) {
        setSuccess('Admin created successfully');
        setShowAdminModal(false);
        setNewAdminUsername('');
        setNewAdminPassword('');
        fetchAdmins();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create admin');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeAdminPassword = async () => {
    if (adminNewPassword() !== adminConfirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    if (adminNewPassword().length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          username: selectedAdmin().username,
          newPassword: adminNewPassword()
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Password changed for ${selectedAdmin().username}. They will be logged out automatically.`);
        setShowPasswordModal(false);
        setAdminNewPassword('');
        setAdminConfirmPassword('');
        setSelectedAdmin(null);
        
        // Refresh admin list after a short delay
        setTimeout(() => {
          setSuccess('');
          fetchAdmins();
        }, 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (username) => {
    if (!confirm(`Delete admin "${username}"?`)) return;

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/auth/admins', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ username })
      });

      if (res.ok) {
        setSuccess(`Admin ${username} deleted`);
        fetchAdmins();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete admin');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white pb-20">
      {/* Header */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1280px] mx-auto px-4 py-2 flex items-center">
          <button onClick={props.onBack} class="mr-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-base font-bold">Settings</h1>
            <p class="text-[10px] text-gray-400">Account & security</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-[1280px] mx-auto p-4 space-y-3">
        {/* User Info - Collapsible */}
        <div class="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
          <button
            onClick={() => setShowAccountInfo(!showAccountInfo())}
            class="w-full p-4 flex items-center justify-between hover:bg-[#252525] transition-colors"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-500/10 rounded-lg">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div class="text-left">
                <h2 class="text-sm font-semibold">Account Information</h2>
                <p class="text-xs text-gray-400">{props.currentUser?.username} • {props.currentUser?.role}</p>
              </div>
            </div>
            <svg class={`w-5 h-5 text-gray-400 transition-transform ${showAccountInfo() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <Show when={showAccountInfo()}>
            <div class="px-4 pb-4 border-t border-gray-800">
              <div class="space-y-2 mt-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-400">Username</span>
                  <span class="text-sm font-medium">{props.currentUser?.username}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-400">Role</span>
                  <span class={`text-sm font-medium ${isSuperAdmin() ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {props.currentUser?.role}
                  </span>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Change Password - Collapsible */}
        <div class="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
          <button
            onClick={() => setShowChangePassword(!showChangePassword())}
            class="w-full p-4 flex items-center justify-between hover:bg-[#252525] transition-colors"
          >
            <div class="flex items-center gap-3">
              <div class="p-2 bg-emerald-500/10 rounded-lg">
                <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div class="text-left">
                <h2 class="text-sm font-semibold">Change Password</h2>
                <p class="text-xs text-gray-400">Update your account password</p>
              </div>
            </div>
            <svg class={`w-5 h-5 text-gray-400 transition-transform ${showChangePassword() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <Show when={showChangePassword()}>
            <div class="px-4 pb-4 border-t border-gray-800">
              <div class="space-y-4 mt-4">
            <Show when={!isSuperAdmin()}>
              <div>
                <label class="block text-sm font-medium text-gray-400 mb-2">Current Password</label>
                <input
                  type="password"
                  value={oldPassword()}
                  onInput={(e) => setOldPassword(e.target.value)}
                  class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Enter current password"
                />
              </div>
            </Show>

            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">New Password</label>
              <input
                type="password"
                value={newPassword()}
                onInput={(e) => setNewPassword(e.target.value)}
                class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.target.value)}
                class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                placeholder="Confirm new password"
              />
            </div>

            <Show when={error()}>
              <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p class="text-sm text-red-400">{error()}</p>
              </div>
            </Show>

            <Show when={success()}>
              <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <p class="text-sm text-emerald-400">{success()}</p>
              </div>
            </Show>

            <button
              onClick={handleChangePassword}
              disabled={loading() || !newPassword() || !confirmPassword() || (!isSuperAdmin() && !oldPassword())}
              class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition-colors"
            >
              {loading() ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      </Show>
    </div>

    <Show when={isSuperAdmin()}>
      <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <p class="text-xs text-blue-400">
          <strong>SuperAdmin:</strong> You can change your password without entering the old one.
        </p>
      </div>
    </Show>
  </div>

        {/* Audit Logs Link (SuperAdmin Only) */}
        <Show when={isSuperAdmin()}>
          <button
            onClick={props.onViewAuditLogs}
            class="w-full bg-[#1a1a1a] hover:bg-[#252525] border border-gray-800 rounded-xl p-4 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-purple-500/10 rounded-lg">
                  <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div class="text-left">
                  <h3 class="text-sm font-semibold">Audit Logs</h3>
                  <p class="text-xs text-gray-400">View all admin activity</p>
                </div>
              </div>
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </Show>

        {/* Admin Management (SuperAdmin Only) - Collapsible */}
        <Show when={isSuperAdmin()}>
          <div class="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowAdminManagement(!showAdminManagement())}
              class="w-full p-4 flex items-center justify-between hover:bg-[#252525] transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-orange-500/10 rounded-lg">
                  <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div class="text-left">
                  <h2 class="text-sm font-semibold">Admin Management</h2>
                  <p class="text-xs text-gray-400">{admins().length} admin{admins().length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <svg class={`w-5 h-5 text-gray-400 transition-transform ${showAdminManagement() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <Show when={showAdminManagement()}>
              <div class="px-4 pb-4 border-t border-gray-800">
                <div class="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setError('');
                      setSuccess('');
                      setShowAdminModal(true);
                    }}
                    class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold transition-colors"
                  >
                    + Add Admin
                  </button>
                </div>

                <div class="space-y-2 mt-3">
              <For each={admins()}>
                {(admin) => (
                  <div class="bg-[#0f0f0f] rounded-lg p-3 border border-gray-800">
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-sm font-medium">{admin.username}</span>
                          <span class={`text-xs px-2 py-0.5 rounded ${
                            admin.role === 'superadmin' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {admin.role}
                          </span>
                        </div>
                        <p class="text-xs text-gray-500">
                          Created: {new Date(admin.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Show when={admin.role !== 'superadmin'}>
                        <div class="flex gap-2">
                          <button
                            onClick={() => {
                              setError('');
                              setSuccess('');
                              setSelectedAdmin(admin);
                              setShowPasswordModal(true);
                            }}
                            class="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                            title="Change Password"
                          >
                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteAdmin(admin.username)}
                            class="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                            title="Delete Admin"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>

      {/* Create Admin Modal */}
      <Show when={showAdminModal()}>
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div class="bg-[#1a1a1a] rounded-2xl border border-gray-800 w-full max-w-md">
            <div class="p-4 border-b border-gray-800">
              <h2 class="text-lg font-bold">Create New Admin</h2>
            </div>
            
            <div class="p-4 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-400 mb-2">Username</label>
                <input
                  type="text"
                  value={newAdminUsername()}
                  onInput={(e) => setNewAdminUsername(e.target.value)}
                  class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="admin1"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-400 mb-2">Password</label>
                <input
                  type="password"
                  value={newAdminPassword()}
                  onInput={(e) => setNewAdminPassword(e.target.value)}
                  class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Enter password"
                />
                <p class="text-xs text-gray-500 mt-1">Password will be hidden for security</p>
              </div>

              <Show when={error()}>
                <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p class="text-sm text-red-400">{error()}</p>
                </div>
              </Show>
            </div>

            <div class="p-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setNewAdminUsername('');
                  setNewAdminPassword('');
                  setError('');
                }}
                class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAdmin}
                disabled={loading() || !newAdminUsername() || !newAdminPassword()}
                class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition-colors"
              >
                {loading() ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Change Admin Password Modal */}
      <Show when={showPasswordModal() && selectedAdmin()}>
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div class="bg-[#1a1a1a] rounded-2xl border border-gray-800 w-full max-w-md">
            <div class="p-4 border-b border-gray-800">
              <h2 class="text-lg font-bold">Change Password for {selectedAdmin().username}</h2>
            </div>
            
            <div class="p-4 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-400 mb-2">New Password</label>
                <input
                  type="password"
                  value={adminNewPassword()}
                  onInput={(e) => setAdminNewPassword(e.target.value)}
                  class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-400 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={adminConfirmPassword()}
                  onInput={(e) => setAdminConfirmPassword(e.target.value)}
                  class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Confirm new password"
                />
                <p class="text-xs text-gray-500 mt-1">Password will be hidden for security</p>
              </div>

              <Show when={error()}>
                <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p class="text-sm text-red-400">{error()}</p>
                </div>
              </Show>
            </div>

            <div class="p-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setAdminNewPassword('');
                  setAdminConfirmPassword('');
                  setSelectedAdmin(null);
                  setError('');
                }}
                class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeAdminPassword}
                disabled={loading() || !adminNewPassword() || !adminConfirmPassword()}
                class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition-colors"
              >
                {loading() ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}