import { createSignal, onMount, Show, For } from 'solid-js';
import { apiCall } from '../utils/api.js';

export default function AuctionBrowser(props) {
  const [auctions, setAuctions] = createSignal([]);
  const [filteredAuctions, setFilteredAuctions] = createSignal([]);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);
  const [activeTab, setActiveTab] = createSignal('all');

  onMount(async () => {
    await fetchAuctions();
  });

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiCall('/api/auctions');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch auctions: ${response.statusText}`);
      }
      
      const data = await response.json();
      const auctionList = Array.isArray(data) ? data : [];
      
      // Ensure IDs are strings for consistency
      const normalized = auctionList.map(a => ({
        ...a,
        id: a?.id != null ? String(a.id) : a?.id
      }));
      
      setAuctions(normalized);
      applyFilters(normalized, searchQuery(), activeTab());
    } catch (err) {
      console.error('Error fetching auctions:', err);
      setError(err.message || 'Failed to load auctions. Please try again.');
      setAuctions([]);
      setFilteredAuctions([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (auctionList, query, tab) => {
    let filtered = auctionList;

    // Filter by tab
    if (tab === 'live') {
      filtered = filtered.filter(a => a.isLive);
    } else if (tab === 'upcoming') {
      filtered = filtered.filter(a => !a.isLive && a.status !== 'completed');
    } else if (tab === 'completed') {
      filtered = filtered.filter(a => a.status === 'completed');
    }

    // Filter by search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(a => 
        a.name?.toLowerCase().includes(lowerQuery) ||
        a.creatorName?.toLowerCase().includes(lowerQuery) ||
        a.description?.toLowerCase().includes(lowerQuery)
      );
    }

    setFilteredAuctions(filtered);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    applyFilters(auctions(), query, activeTab());
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    applyFilters(auctions(), searchQuery(), tab);
  };

  const handleJoinAuction = (auction) => {
    const auctionData = {
      ...auction,
      id: String(auction.id)
    };
    
    if (auction.isRetention) {
      props.onNavigate('retentionAuction', auctionData);
    } else {
      // Navigate to join flow first
      props.onNavigate('joinAuction', auctionData);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <div class="sticky top-0 z-40 bg-[#1a1a1a]/95 backdrop-blur-sm border-b border-gray-800">
        <div class="px-4 sm:px-6 h-14 flex items-center justify-between max-w-[1400px] mx-auto">
          <div class="flex items-center gap-3">
            <button
              onClick={() => props.onBack && props.onBack()}
              class="p-1 hover:bg-gray-800 rounded transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span class="text-lg font-bold">Browse Auctions</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div class="pb-6 px-4 sm:px-6 max-w-[1400px] mx-auto">
        {/* Header Section */}
        <div class="py-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold mb-1">Active Auctions</h1>
              <p class="text-sm text-gray-400">Find and join cricket auctions</p>
            </div>
            <button
              onClick={() => props.onNavigate('createAuction')}
              class="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-semibold transition-colors w-full sm:w-auto"
            >
              Create Auction +
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div class="mb-6">
          <div class="relative">
            <svg class="absolute left-3 top-3 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by auction name, creator..."
              value={searchQuery()}
              onInput={(e) => handleSearch(e.currentTarget.value)}
              class="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        {/* Tabs */}
        <div class="flex gap-2 mb-6 border-b border-gray-800 overflow-x-auto">
          <button
            onClick={() => handleTabChange('all')}
            class={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab() === 'all' ? 'text-purple-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            All Auctions
            <Show when={activeTab() === 'all'}>
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400"></div>
            </Show>
          </button>
          <button
            onClick={() => handleTabChange('live')}
            class={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative flex items-center gap-2 ${
              activeTab() === 'live' ? 'text-red-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Show when={auctions().some(a => a.isLive)}>
              <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            </Show>
            Live
            <Show when={activeTab() === 'live'}>
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400"></div>
            </Show>
          </button>
          <button
            onClick={() => handleTabChange('upcoming')}
            class={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab() === 'upcoming' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Upcoming
            <Show when={activeTab() === 'upcoming'}>
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
            </Show>
          </button>
          <button
            onClick={() => handleTabChange('completed')}
            class={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab() === 'completed' ? 'text-emerald-400' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Completed
            <Show when={activeTab() === 'completed'}>
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></div>
            </Show>
          </button>
        </div>

        {/* Content */}
        <Show when={!loading()} fallback={
          <div class="flex items-center justify-center py-20">
            <div class="text-center">
              <div class="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-sm text-gray-400">Loading auctions...</p>
            </div>
          </div>
        }>
          <Show when={error()} fallback={
            <Show when={filteredAuctions().length > 0} fallback={
              <div class="text-center py-16">
                <svg class="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 class="text-lg font-bold mb-2">No Auctions Found</h3>
                <p class="text-sm text-gray-400 mb-6">
                  {searchQuery() ? 'Try adjusting your search' : 'No auctions in this category yet'}
                </p>
                <Show when={searchQuery()}>
                  <button
                    onClick={() => { handleSearch(''); handleTabChange('all'); }}
                    class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Clear Search
                  </button>
                </Show>
              </div>
            }>
              <div class="space-y-3">
                <For each={filteredAuctions()}>
                  {(auction) => (
                    <div 
                      class="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 hover:border-purple-500/50 hover:bg-[#222222] transition-all cursor-pointer"
                      onClick={() => handleJoinAuction(auction)}
                    >
                      <div class="flex items-start justify-between gap-3 mb-3">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <h3 class="text-base font-bold truncate">{auction.name}</h3>
                            <Show when={auction.visibility === 'private'}>
                              <span class="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-semibold flex-shrink-0">
                                PRIVATE
                              </span>
                            </Show>
                          </div>
                          <p class="text-xs text-gray-400 truncate">{auction.description || 'No description'}</p>
                          <p class="text-xs text-gray-500 mt-1">Created by {auction.creatorName || 'Anonymous'}</p>
                        </div>
                        <div class="flex-shrink-0">
                          <Show
                            when={auction.isLive}
                            fallback={
                              <span class={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap ${
                                auction.status === 'completed'
                                  ? 'bg-gray-700 text-gray-300'
                                  : 'bg-blue-500/20 text-blue-400'
                              }`}>
                                {auction.status === 'completed' ? 'COMPLETED' : 'UPCOMING'}
                              </span>
                            }
                          >
                            <div class="flex items-center gap-1 bg-red-500/20 px-2.5 py-1 rounded-full">
                              <div class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                              <span class="text-[10px] font-semibold text-red-400">LIVE</span>
                            </div>
                          </Show>
                        </div>
                      </div>

                      <div class="flex items-center justify-between flex-wrap gap-3">
                        <div class="flex gap-4 text-xs text-gray-400">
                          <div class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {auction.participants?.length || 0} Participants
                          </div>
                          <div class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ₹{auction.budget}Cr
                          </div>
                          <div class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {auction.timerDuration}s timer
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleJoinAuction(auction); }}
                          class="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Join Now
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          }>
            <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div class="flex gap-2">
                <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div>
                  <p class="text-sm font-semibold text-red-400">Failed to Load Auctions</p>
                  <p class="text-xs text-red-400/80 mt-0.5">{error()}</p>
                  <button
                    onClick={fetchAuctions}
                    class="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
