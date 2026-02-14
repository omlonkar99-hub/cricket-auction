import { createSignal, Show, For, onMount } from 'solid-js';

export default function AuditLogs(props) {
  const [logs, setLogs] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [filterAdmin, setFilterAdmin] = createSignal('');
  const [filterAction, setFilterAction] = createSignal('');
  const [stats, setStats] = createSignal(null);

  onMount(() => {
    fetchLogs();
    fetchStats();
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (filterAdmin()) params.append('adminUser', filterAdmin());
      if (filterAction()) params.append('action', filterAction());

      const res = await fetch(`/api/audit/logs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      } else {
        setError('Failed to fetch audit logs');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/audit/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const getActionConfig = (action) => {
    const configs = {
      'CREATE_TEAM': { 
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 
        icon: '👥', 
        label: 'Team Created',
        category: 'Teams'
      },
      'UPDATE_TEAM': { 
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', 
        icon: '✏️', 
        label: 'Team Updated',
        category: 'Teams'
      },
      'DELETE_TEAM': { 
        color: 'text-red-400 bg-red-500/10 border-red-500/20', 
        icon: '🗑️', 
        label: 'Team Deleted',
        category: 'Teams'
      },
      'CREATE_PLAYER': { 
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 
        icon: '🏏', 
        label: 'Player Added',
        category: 'Players'
      },
      'UPDATE_PLAYER': { 
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', 
        icon: '✏️', 
        label: 'Player Updated',
        category: 'Players'
      },
      'DELETE_PLAYER': { 
        color: 'text-red-400 bg-red-500/10 border-red-500/20', 
        icon: '🗑️', 
        label: 'Player Deleted',
        category: 'Players'
      },
      'CREATE_AUCTION': { 
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', 
        icon: '🏆', 
        label: 'Auction Created',
        category: 'Auctions'
      },
      'DELETE_AUCTION': { 
        color: 'text-red-400 bg-red-500/10 border-red-500/20', 
        icon: '🗑️', 
        label: 'Auction Deleted',
        category: 'Auctions'
      },
      'START_AUCTION': { 
        color: 'text-green-400 bg-green-500/10 border-green-500/20', 
        icon: '▶️', 
        label: 'Auction Started',
        category: 'Auctions'
      },
      'END_AUCTION': { 
        color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', 
        icon: '🏁', 
        label: 'Auction Completed',
        category: 'Auctions'
      },
      'STOP_AUCTION': { 
        color: 'text-red-400 bg-red-500/10 border-red-500/20', 
        icon: '⏹️', 
        label: 'Auction Stopped',
        category: 'Auctions'
      },
      'CREATE_ADMIN': { 
        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', 
        icon: '👤', 
        label: 'Admin Created',
        category: 'Admin'
      },
      'DELETE_ADMIN': { 
        color: 'text-red-400 bg-red-500/10 border-red-500/20', 
        icon: '👤', 
        label: 'Admin Deleted',
        category: 'Admin'
      },
      'CHANGE_ADMIN_PASSWORD': { 
        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', 
        icon: '🔑', 
        label: 'Password Changed',
        category: 'Admin'
      }
    };
    
    return configs[action] || { 
      color: 'text-gray-400 bg-gray-500/10 border-gray-500/20', 
      icon: '📝', 
      label: action.replace(/_/g, ' '),
      category: 'Other'
    };
  };

  const getCategoryStats = () => {
    const categories = {};
    logs().forEach(log => {
      const config = getActionConfig(log.action);
      categories[config.category] = (categories[config.category] || 0) + 1;
    });
    return categories;
  };

  const handleDeleteAllLogs = async () => {
    if (!confirm('Are you sure you want to delete ALL audit logs? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/audit/logs', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setLogs([]);
        setStats({ totalLogs: 0, actionCounts: [] });
        // Show success message briefly
        setError('');
        alert(`Successfully deleted ${data.deleted} audit logs`);
      } else {
        setError('Failed to delete audit logs');
      }
    } catch (err) {
      setError('An error occurred while deleting logs');
    }
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white pb-20">
      {/* Header */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1280px] mx-auto px-4 py-3 flex items-center">
          <button onClick={props.onBack} class="mr-3 p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="flex-1">
            <h1 class="text-lg font-bold">System Activity</h1>
            <p class="text-sm text-gray-400">Track all administrative actions</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              class="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={handleDeleteAllLogs}
              class="px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold transition-colors"
              title="Delete All Logs"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-[1280px] mx-auto p-4">
        {/* Quick Stats */}
        <Show when={!loading() && logs().length > 0}>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <For each={Object.entries(getCategoryStats())}>
              {([category, count]) => (
                <div class="bg-[#1a1a1a] rounded-xl p-4 border border-gray-800">
                  <p class="text-xs text-gray-400 mb-1">{category}</p>
                  <p class="text-xl font-bold">{count}</p>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Filters */}
        <div class="bg-[#1a1a1a] rounded-xl p-4 border border-gray-800 mb-6">
          <div class="flex items-center gap-2 mb-4">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h2 class="text-sm font-semibold">Filter Activities</h2>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs text-gray-400 mb-2">Admin User</label>
              <input
                type="text"
                value={filterAdmin()}
                onInput={(e) => setFilterAdmin(e.target.value)}
                placeholder="Enter admin username"
                class="w-full px-3 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label class="block text-xs text-gray-400 mb-2">Action Type</label>
              <select
                value={filterAction()}
                onChange={(e) => setFilterAction(e.target.value)}
                class="w-full px-3 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">All Actions</option>
                <optgroup label="Teams">
                  <option value="CREATE_TEAM">Team Created</option>
                  <option value="UPDATE_TEAM">Team Updated</option>
                  <option value="DELETE_TEAM">Team Deleted</option>
                </optgroup>
                <optgroup label="Players">
                  <option value="CREATE_PLAYER">Player Added</option>
                  <option value="UPDATE_PLAYER">Player Updated</option>
                  <option value="DELETE_PLAYER">Player Deleted</option>
                </optgroup>
                <optgroup label="Auctions">
                  <option value="CREATE_AUCTION">Auction Created</option>
                  <option value="START_AUCTION">Auction Started</option>
                  <option value="END_AUCTION">Auction Completed</option>
                  <option value="STOP_AUCTION">Auction Stopped</option>
                  <option value="DELETE_AUCTION">Auction Deleted</option>
                </optgroup>
                <optgroup label="Admin">
                  <option value="CREATE_ADMIN">Admin Created</option>
                  <option value="DELETE_ADMIN">Admin Deleted</option>
                  <option value="CHANGE_ADMIN_PASSWORD">Password Changed</option>
                </optgroup>
              </select>
            </div>
            
            <div class="flex items-end">
              <button
                onClick={fetchLogs}
                class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        <Show when={error()}>
          <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm text-red-400">{error()}</p>
            </div>
          </div>
        </Show>

        {/* Activity Timeline */}
        <div class="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
          <div class="p-4 border-b border-gray-800">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 class="text-sm font-semibold">Activity Timeline</h2>
              <Show when={!loading() && logs().length > 0}>
                <span class="text-xs text-gray-500">({logs().length} activities)</span>
              </Show>
            </div>
          </div>

          <Show when={loading()}>
            <div class="p-12 text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
              <p class="text-sm text-gray-400">Loading activity logs...</p>
            </div>
          </Show>

          <Show when={!loading() && logs().length === 0}>
            <div class="p-12 text-center">
              <div class="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p class="text-sm text-gray-400 mb-2">No activities found</p>
              <p class="text-xs text-gray-500">Activities will appear here when admins perform actions</p>
            </div>
          </Show>

          <Show when={!loading() && logs().length > 0}>
            <div class="divide-y divide-gray-800">
              <For each={logs()}>
                {(log) => {
                  const config = getActionConfig(log.action);
                  return (
                    <div class="p-4 hover:bg-[#0f0f0f] transition-colors">
                      <div class="flex items-start gap-4">
                        {/* Icon */}
                        <div class={`flex-shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center text-lg ${config.color}`}>
                          {config.icon}
                        </div>
                        
                        {/* Content */}
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-2">
                            <span class="text-sm font-semibold">{log.adminUser}</span>
                            <span class={`text-xs px-2 py-1 rounded-full border ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          
                          <Show when={log.targetName}>
                            <p class="text-sm text-gray-300 mb-2">{config.label}: {log.targetName}</p>
                          </Show>
                          
                          <div class="flex items-center gap-4 text-xs text-gray-500">
                            <div class="flex items-center gap-1">
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{log.indianTime}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>

        <Show when={!loading() && logs().length > 0}>
          <div class="mt-4 text-center">
            <p class="text-xs text-gray-500">
              Showing the most recent 100 activities • Times are in Indian Standard Time (IST)
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}
