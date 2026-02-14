import { createSignal, onMount, Show, For } from 'solid-js';
import { apiCall } from '../utils/api.js';

export default function AuctionsPage(props) {
  const [activeTab, setActiveTab] = createSignal('active');
  const [liveAuctions, setLiveAuctions] = createSignal([]);
  const [scheduledAuctions, setScheduledAuctions] = createSignal([]);
  const [completedAuctions, setCompletedAuctions] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    fetchAuctions();
  });

  const fetchAuctions = async () => {
    try {
      const [regularRes, retentionRes] = await Promise.all([
        apiCall('/api/auctions'),
        apiCall('/api/retention-auctions')
      ]);
      
      const regularData = await regularRes.json();
      const retentionData = retentionRes.ok ? await retentionRes.json() : [];
      
      // Combine both types of auctions
      const allAuctions = [
        ...(Array.isArray(regularData) ? regularData : []),
        ...(Array.isArray(retentionData) ? retentionData.map(r => ({ ...r, isRetention: true })) : [])
      ].map(a => ({
        ...a,
        id: a?.id != null ? String(a.id) : a?.id
      }));
      
      // Sort by ID descending (most recent first, since IDs are timestamps)
      // Use BigInt to avoid precision loss with int64 values
      const sortByRecent = (a, b) => {
        const idA = typeof a.id === 'string' ? BigInt(a.id) : BigInt(a.id || 0);
        const idB = typeof b.id === 'string' ? BigInt(b.id) : BigInt(b.id || 0);
        return idB > idA ? 1 : idB < idA ? -1 : 0;
      };
      
      setLiveAuctions(allAuctions.filter(a => a.isLive).sort(sortByRecent));
      setScheduledAuctions(allAuctions.filter(a => {
        // Show upcoming auctions and active retention auctions
        if (a.isLive) return false;
        return a.status === 'upcoming' || a.status === 'retention_active' || a.status === 'retention_closed';
      }).sort(sortByRecent));
      setCompletedAuctions(allAuctions.filter(a => a.status === 'completed').sort(sortByRecent).slice(0, 5));
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLiveAuctions([]);
      setScheduledAuctions([]);
      setCompletedAuctions([]);
      setLoading(false);
    }
  };

  const handleJoinAuction = (auction) => {
    const auctionData = {
      ...auction,
      id: String(auction.id)
    };
    
    // Route to different page based on auction type
    if (auction.isRetention) {
      props.onNavigate('retentionAuction', auctionData);
    } else {
      props.onNavigate('auction', auctionData);
    }

  };

  const handleDeleteAuction = async (e, auction) => {
    e.stopPropagation();
    
    // Check if auction is live and show appropriate confirmation
    const isLive = auction?.status === 'live' || auction?.isLive;
    
    const confirmMessage = isLive 
      ? `⚠️ WARNING: "${auction.name}" is currently LIVE!\n\nDeleting will immediately stop the auction and disconnect all participants.\n\nAre you sure you want to delete this live auction?`
      : `Delete "${auction.name}"?`;
    
    if (!confirm(confirmMessage)) return;

    try {
      const auctionId = String(auction.id);
      const endpoint = auction.isRetention 
        ? `/api/retention-auctions/${auctionId}` 
        : `/api/auctions/${auctionId}`;
      const res = await apiCall(endpoint, { method: 'DELETE' });
      if (res.ok) {
        await fetchAuctions();
        if (isLive) {
          alert('Live auction stopped and deleted successfully');
        }
      } else {
        const contentType = res.headers.get('content-type');
        let errorMessage = 'Failed to delete auction';
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            // JSON parsing failed, use default message
          }
        } else {
          errorMessage = await res.text() || errorMessage;
        }
        
        alert(errorMessage);
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleEditAuction = (e, auction) => {
    e.stopPropagation();
    // Store auction ID in sessionStorage for dashboard to pick up
    sessionStorage.setItem('edit_auction_id', String(auction.id));
    props.onNavigate('dashboard');
  };

  const isAdmin = () => String(props.currentUser?.role || '').toLowerCase().includes('admin');

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1400px] mx-auto px-4 py-2 flex items-center">
          <button onClick={() => props.onNavigate('home')} class="mr-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 class="text-base font-bold">Auctions</h1>
            <p class="text-[10px] text-gray-400">Browse all auctions</p>
          </div>
        </div>
      </div>

      {/* Tabs - Active / Completed */}
      <div class="border-b border-gray-800">
        <div class="px-4 sm:px-6 max-w-[1400px] mx-auto">
          <div class="flex">
            <button
              onClick={() => setActiveTab('active')}
              class={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab() === 'active'
                  ? 'text-emerald-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Active
              <Show when={activeTab() === 'active'}>
                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></div>
              </Show>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              class={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab() === 'completed'
                  ? 'text-emerald-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Completed
              <Show when={activeTab() === 'completed'}>
                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></div>
              </Show>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">
        <Show when={loading()} fallback={
          <>
            {/* Active Tab Content */}
            <Show when={activeTab() === 'active'}>
              {/* Live Auctions */}
              <Show when={liveAuctions().length > 0}>
                <div class="mb-6">
                  <div class="flex items-center gap-2 mb-3">
                    <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <h2 class="text-base font-bold">Live Now</h2>
                    <span class="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">
                      {liveAuctions().length}
                    </span>
                  </div>
                  <div class="space-y-3">
                    <For each={liveAuctions()}>
                      {(auction) => (
                        <div 
                          class="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4 hover:border-red-500/50 transition-all cursor-pointer"
                          onClick={() => handleJoinAuction(auction)}
                        >
                          <div class="flex items-start justify-between mb-3">
                            <div class="flex-1">
                              <h3 class="text-base font-bold mb-1">{auction.name}</h3>
                              <p class="text-xs text-gray-400">{auction.description || 'No description'}</p>
                            </div>
                            <div class="flex items-center gap-1.5 bg-red-500/20 px-2 py-1 rounded-full">
                              <div class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                              <span class="text-xs font-semibold text-red-400">LIVE</span>
                            </div>
                          </div>
                          <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex gap-4 text-xs text-gray-400">
                              <span>{auction.teams?.length || 0} Teams</span>
                              <span>{auction.players?.length || 0} Players</span>
                              <span>₹{auction.budget}Cr</span>
                            </div>
                            {isAdmin() && (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteAuction(e, auction); }} class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Delete">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Scheduled Auctions */}
              <Show when={scheduledAuctions().length > 0}>
                <div class="mb-6">
                  <div class="flex items-center gap-2 mb-3">
                    <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h2 class="text-base font-bold">Scheduled</h2>
                    <span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-semibold">
                      {scheduledAuctions().length}
                    </span>
                  </div>
                  <div class="space-y-3">
                    <For each={scheduledAuctions()}>
                      {(auction) => (
                        <div 
                          class="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 hover:border-blue-500/50 transition-all cursor-pointer"
                          onClick={() => handleJoinAuction(auction)}
                        >
                          <div class="flex items-start justify-between mb-3">
                            <div class="flex-1">
                              <h3 class="text-base font-bold mb-1">{auction.name}</h3>
                              <p class="text-xs text-gray-400">{auction.description || 'No description'}</p>
                            </div>
                            <div class="flex items-center gap-1.5 bg-blue-500/20 px-2 py-1 rounded-full">
                              <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span class="text-xs font-semibold text-blue-400">UPCOMING</span>
                            </div>
                          </div>
                          <div class="flex items-center justify-between flex-wrap gap-2">
                            <div class="flex gap-4 text-xs text-gray-400">
                              <span>{auction.teams?.length || 0} Teams</span>
                              <span>{auction.players?.length || 0} Players</span>
                              <span>₹{auction.budget}Cr</span>
                            </div>
                            {isAdmin() && (
                              <div class="flex items-center gap-2">
                                <Show when={!auction.isRetention}>
                                  <button onClick={(e) => { e.stopPropagation(); handleEditAuction(e, auction); }} class="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-semibold transition-colors">Edit</button>
                                </Show>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteAuction(e, auction); }} class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Delete">
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Empty State for Active */}
              <Show when={liveAuctions().length === 0 && scheduledAuctions().length === 0}>
                <div class="text-center py-16">
                  <h3 class="text-xl font-bold mb-2">No Active Auctions</h3>
                  <p class="text-sm text-gray-400 mb-6">Check back later for upcoming auctions</p>
                  <Show when={isAdmin()}>
                    <button
                      onClick={() => props.onNavigate('dashboard')}
                      class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Create First Auction
                    </button>
                  </Show>
                </div>
              </Show>
            </Show>

            {/* Completed Tab Content */}
            <Show when={activeTab() === 'completed'}>
              <Show when={completedAuctions().length > 0} fallback={
                <div class="text-center py-16">
                  <div class="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 class="text-xl font-bold mb-2">No Completed Auctions</h3>
                  <p class="text-sm text-gray-400">Completed auctions will appear here</p>
                </div>
              }>
                <div class="space-y-3">
                  <For each={completedAuctions()}>
                    {(auction) => (
                      <div 
                        class="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 opacity-75 hover:opacity-100 transition-all cursor-pointer"
                        onClick={() => handleJoinAuction(auction)}
                      >
                        <div class="flex items-start justify-between mb-3">
                          <div class="flex-1">
                            <h3 class="text-sm font-bold mb-1">{auction.name}</h3>
                            <p class="text-xs text-gray-500">{auction.description || 'No description'}</p>
                          </div>
                          <div class="flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded-full">
                            <span class="text-xs font-semibold text-gray-400">COMPLETED</span>
                          </div>
                        </div>
                        <div class="flex items-center justify-between flex-wrap gap-2">
                          <div class="flex gap-4 text-xs text-gray-500">
                            <span>{auction.teams?.length || 0} Teams</span>
                            <span>{auction.players?.length || 0} Players</span>
                          </div>
                          {isAdmin() && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteAuction(e, auction); }} class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Delete">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </>
        }>
          <div class="flex items-center justify-center py-16">
            <div class="text-center">
              <div class="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-sm text-gray-400">Loading auctions...</p>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
