import { createSignal, createEffect, Show, For } from 'solid-js';
import ManageTeams from './ManageTeams';
import ManagePlayers from './ManagePlayers';
import CreateAuction from './CreateAuction';

import AdminSettings from './AdminSettings';

import { apiCall } from '../utils/api';

export default function DashboardHome(props) {
  const [currentView, setCurrentView] = createSignal('dashboard');
  const [teams, setTeams] = createSignal([]);
  const [players, setPlayers] = createSignal([]);
  const [auctions, setAuctions] = createSignal([]);
  const [editingAuction, setEditingAuction] = createSignal(null);
  const [auctionTab, setAuctionTab] = createSignal('upcoming');

  const fetchData = async () => {
    try {
      const [teamsRes, playersRes, auctionsRes, retentionRes] = await Promise.all([
        apiCall('/api/teams'),
        apiCall('/api/players'),
        apiCall('/api/auctions'),
        apiCall('/api/retention-auctions')
      ]);
      setTeams(await teamsRes.json() || []);
      setPlayers(await playersRes.json() || []);
      
      const regularAuctions = await auctionsRes.json();
      const retentionAuctions = retentionRes.ok ? await retentionRes.json() : [];
      
      // Combine both types and mark retention auctions
      const allAuctions = [
        ...(Array.isArray(regularAuctions) ? regularAuctions : []),
        ...(Array.isArray(retentionAuctions) ? retentionAuctions.map(r => ({ ...r, isRetention: true })) : [])
      ].map(x => ({
        ...x,
        id: x?.id != null ? String(x.id) : x?.id
      }));
      
      setAuctions(allAuctions);
    } catch (e) {
      console.error(e);
    }
  };

  createEffect(() => {
    if (currentView() === 'dashboard') {
      fetchData();
    }
  });

  createEffect(() => {
    if (currentView() !== 'dashboard') return;
    const editId = sessionStorage.getItem('edit_auction_id');
    if (!editId) return;
    sessionStorage.removeItem('edit_auction_id');
    apiCall(`/api/auctions/${editId}`)
      .then(res => res.json())
      .then(data => {
        if (!data || !data.id) return;
        setEditingAuction(data);
        setCurrentView('edit');
      })
      .catch(() => {});
  });

  const upcoming = () => auctions()
    .filter(a => !a.isLive && a.status !== 'completed')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first
  
  const live = () => auctions()
    .filter(a => a.isLive)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first
  
  const completed = () => auctions()
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

  const handleDeleteAuction = async (id, name, isRetention) => {
    // Check if auction is live and show appropriate confirmation
    const auction = auctions().find(a => a.id === id);
    const isLive = auction?.status === 'live' || auction?.isLive;
    
    const confirmMessage = isLive 
      ? `⚠️ WARNING: "${name}" is currently LIVE!\n\nDeleting will immediately stop the auction and disconnect all participants.\n\nAre you sure you want to delete this live auction?`
      : `Delete auction "${name}"?`;
    
    if (!confirm(confirmMessage)) return;

    try {
      const auctionId = String(id);
      const endpoint = isRetention 
        ? `/api/retention-auctions/${auctionId}` 
        : `/api/auctions/${auctionId}`;
      const res = await apiCall(endpoint, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
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
    } catch (e) {
      alert('Failed to delete');
    }
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white flex">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside class="hidden md:flex md:flex-col w-64 bg-[#1a1a1a] border-r border-gray-800 fixed top-0 left-0 h-screen z-40 overflow-hidden">
        <div class="p-4 border-b border-gray-800">
          <button onClick={() => props.onNavigate('home')} class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" /></svg>
            <span class="text-sm">Back to Home</span>
          </button>
        </div>
        
        <nav class="flex-1 p-3 space-y-1">
          <button
            onClick={() => setCurrentView('dashboard')}
            class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentView() === 'dashboard' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span class="font-medium">Dashboard</span>
          </button>
          
          <button
            onClick={() => setCurrentView('teams')}
            class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentView() === 'teams' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span class="font-medium">Teams</span>
            <span class="ml-auto text-xs bg-gray-800 px-2 py-0.5 rounded">{teams().length}</span>
          </button>
          
          <button
            onClick={() => setCurrentView('players')}
            class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentView() === 'players' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span class="font-medium">Players</span>
            <span class="ml-auto text-xs bg-gray-800 px-2 py-0.5 rounded">{players().length}</span>
          </button>
          
          <button
            onClick={() => props.onNavigate('auctions')}
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
            <span class="font-medium">Auctions</span>
          </button>
          
          <div class="pt-2 mt-2 border-t border-gray-800">
            <button
              onClick={() => setCurrentView('create')}
              class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                currentView() === 'create' 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 4v16m8-8H4" /></svg>
              <span class="font-medium">Create Auction</span>
            </button>
          </div>
        </nav>
        
        <div class="p-3 border-t border-gray-800">
          <button
            onClick={() => setCurrentView('settings')}
            class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentView() === 'settings' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span class="font-medium">Settings</span>
          </button>
          <button
            onClick={props.onLogout}
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors mt-1"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span class="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div class="flex-1 md:ml-64 h-screen overflow-y-auto">{/* Mobile Header - shown only on mobile */}
        <div class="md:hidden sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
          <div class="px-4 py-2 flex items-center">
            <button onClick={() => props.onNavigate('home')} class="mr-2 p-1 hover:bg-gray-800 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 class="text-base font-bold">Dashboard</h1>
              <p class="text-[10px] text-gray-400">Auctions, teams & players</p>
            </div>
          </div>
        </div>

        {/* Content Views */}
        <Show when={currentView() === 'dashboard'} fallback={
          <Show when={currentView() === 'teams'} fallback={
            <Show when={currentView() === 'players'} fallback={
              <Show when={currentView() === 'create'} fallback={
                <Show when={currentView() === 'retention'} fallback={
                  <Show when={currentView() === 'edit'} fallback={
                    <Show when={currentView() === 'audit'} fallback={
                      <AdminSettings 
                        onBack={() => setCurrentView('dashboard')} 
                        currentUser={props.currentUser}
                        onViewAuditLogs={() => setCurrentView('audit')}
                      />
                    }>
                      <AuditLogs onBack={() => setCurrentView('settings')} />
                    </Show>
                  }>
                    <CreateAuction
                      mode="edit"
                      initialData={editingAuction() || {}}
                      onBack={() => { setCurrentView('dashboard'); fetchData(); }}
                    />
                  </Show>
                }>
                  <CreateRetentionAuction onBack={() => { setCurrentView('dashboard'); fetchData(); }} />
                </Show>
              }>
                <CreateAuction onBack={() => { setCurrentView('dashboard'); fetchData(); }} />
              </Show>
            }>
              <ManagePlayers onBack={() => setCurrentView('dashboard')} />
            </Show>
          }>
            <ManageTeams onBack={() => setCurrentView('dashboard')} />
          </Show>
        }>
          <div class="min-h-screen bg-[#0f0f0f] text-white pb-20 md:pb-4">
            <div class="max-w-[1280px] mx-auto p-4 space-y-4">
          <div class="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCurrentView('create')}
              class="py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium"
            >
              + Create Auction
            </button>
            <button
              onClick={() => setCurrentView('retention')}
              class="py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium"
            >
              + Retention Auction
            </button>
          </div>

          {/* Quick stats */}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button onClick={() => setCurrentView('teams')} class="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800 text-left hover:border-emerald-500 transition-colors">
              <div class="text-xl font-bold text-white">{teams().length}</div>
              <div class="text-xs text-gray-400">Teams</div>
            </button>
            <button onClick={() => setCurrentView('players')} class="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800 text-left hover:border-blue-500 transition-colors">
              <div class="text-xl font-bold text-white">{players().length}</div>
              <div class="text-xs text-gray-400">Players</div>
            </button>
            <div class="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800">
              <div class="text-xl font-bold text-emerald-400">{upcoming().length}</div>
              <div class="text-xs text-gray-400">Upcoming</div>
            </div>
            <div class="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800">
              <div class="text-xl font-bold text-red-400">{live().length}</div>
              <div class="text-xs text-gray-400">Live</div>
            </div>
          </div>

          {/* Auctions list with tabs */}
          <div class="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
            <div class="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
              <h2 class="text-sm font-semibold">Auctions</h2>
              <button class="text-xs text-emerald-400 hover:underline" onClick={fetchData}>Refresh</button>
            </div>
            
            {/* Auction Tabs */}
            <div class="flex border-b border-gray-800">
              <button
                onClick={() => setAuctionTab('upcoming')}
                class={`flex-1 px-4 py-2 text-xs font-semibold transition-colors ${
                  auctionTab() === 'upcoming'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Upcoming ({upcoming().length})
              </button>
              <button
                onClick={() => setAuctionTab('live')}
                class={`flex-1 px-4 py-2 text-xs font-semibold transition-colors ${
                  auctionTab() === 'live'
                    ? 'text-red-400 border-b-2 border-red-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Live ({live().length})
              </button>
              <button
                onClick={() => setAuctionTab('completed')}
                class={`flex-1 px-4 py-2 text-xs font-semibold transition-colors ${
                  auctionTab() === 'completed'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Completed ({completed().length})
              </button>
            </div>

            <div class="divide-y divide-gray-800">
              <Show when={
                (auctionTab() === 'upcoming' && upcoming().length === 0) ||
                (auctionTab() === 'live' && live().length === 0) ||
                (auctionTab() === 'completed' && completed().length === 0)
              } fallback={
                <For each={
                  auctionTab() === 'upcoming' ? upcoming() :
                  auctionTab() === 'live' ? live() :
                  completed()
                }>
                  {(auction) => (
                    <div 
                      class="px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-800/50 cursor-pointer transition-colors"
                      onClick={() => {
                        const auctionData = { ...auction, id: String(auction.id) };
                        if (auction.isRetention) {
                          props.onNavigate('retentionAuction', auctionData);
                        } else {
                          props.onNavigate('auction', auctionData);
                        }
                      }}
                    >
                      <div class="min-w-0 flex-1">
                        <div class="font-medium truncate">{auction.name}</div>
                        <div class="text-xs text-gray-500">
                          {auction.teams?.length || 0} teams · {auction.players?.length || 0} players · ₹{auction.budget}Cr
                        </div>
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <span class={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          auction.isLive ? 'bg-red-500/20 text-red-400' :
                          auction.status === 'completed' ? 'bg-gray-700 text-gray-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {auction.isLive ? 'LIVE' : auction.status === 'completed' ? 'DONE' : 'UPCOMING'}
                        </span>
                        <Show when={!auction.isLive && auction.status !== 'completed'}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingAuction({ ...auction, id: String(auction.id) }); setCurrentView('edit'); }}
                            class="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                            title="Edit"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteAuction(auction.id, auction.name, auction.isRetention); }}
                            class="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
                            title="Delete"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </Show>
                        <Show when={auction.status === 'completed'}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteAuction(auction.id, auction.name, auction.isRetention); }}
                            class="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
                            title="Delete"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              }>
                <div class="px-4 py-8 text-center text-sm text-gray-500">
                  No {auctionTab()} auctions
                </div>
              </Show>
            </div>
          </div>

          <button onClick={() => setCurrentView('settings')} class="w-full py-2.5 bg-[#1a1a1a] border border-gray-800 rounded-xl text-sm text-gray-400 hover:text-white hover:border-gray-700 transition-colors md:hidden">
            Settings
          </button>
        </div>

        {/* Mobile Bottom Nav - hidden on desktop */}
        <div class="md:hidden fixed bottom-0 left-0 right-0 z-50">
          <div class="flex items-center justify-center gap-1 px-4 py-3 max-w-[700px] mx-auto">
            <button 
              onClick={() => setCurrentView('dashboard')} 
              class="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors"
            >
              <svg 
                class={`w-5 h-5 ${currentView() === 'dashboard' ? 'text-emerald-400' : 'text-gray-400'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span class={`text-[9px] font-medium ${currentView() === 'dashboard' ? 'text-emerald-400' : 'text-gray-400'}`}>
                Dashboard
              </span>
            </button>
            
            <button 
              onClick={() => props.onNavigate('auctions')} 
              class="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors"
            >
              <svg 
                class="w-5 h-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <span class="text-[9px] font-medium text-gray-400">
                Auctions
              </span>
            </button>
            
            <button 
              onClick={() => setCurrentView('settings')} 
              class="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors"
            >
              <svg 
                class={`w-5 h-5 ${currentView() === 'settings' ? 'text-emerald-400' : 'text-gray-400'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span class={`text-[9px] font-medium ${currentView() === 'settings' ? 'text-emerald-400' : 'text-gray-400'}`}>
                Settings
              </span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  </div>
</div>
  );
}
