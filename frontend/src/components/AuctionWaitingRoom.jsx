import { createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { apiCall } from '../utils/api';
import { shortenRole } from '../utils/roleShortener';
import { imagePreloader } from '../utils/imagePreloader';

export default function AuctionWaitingRoom(props) {
  const [onlineTeams, setOnlineTeams] = createSignal([]);
  const [expandedSection, setExpandedSection] = createSignal('teams');
  const [resolvedTeams, setResolvedTeams] = createSignal([]);
  const [resolvedPlayers, setResolvedPlayers] = createSignal([]);
  const [onlineTeamIds, setOnlineTeamIds] = createSignal([]);

  let interval;
  let presenceInterval;

  onMount(() => {
    // Send presence immediately on mount
    sendPresence();
    fetchPresence();
    
    interval = setInterval(() => {
      fetchPresence();
    }, 5000);

    presenceInterval = setInterval(() => {
      sendPresence();
    }, 5000);
  });

  onCleanup(() => {
    if (interval) clearInterval(interval);
    if (presenceInterval) clearInterval(presenceInterval);
  });

  createEffect(() => {
    const data = props.auctionData;
    if (!data) return;

    if (data.teams && data.teams.length > 0) {
      setResolvedTeams(data.teams);
      // Preload team logos
      imagePreloader.preloadTeamLogos(data.teams);
    } else if (data.selectedTeams && data.selectedTeams.length > 0) {
      apiCall('/api/teams')
        .then(res => res.json())
        .then(all => {
          const filtered = (all || []).filter(t => data.selectedTeams.includes(t.id));
          setResolvedTeams(filtered);
          // Preload team logos
          imagePreloader.preloadTeamLogos(filtered);
        })
        .catch(() => {});
    } else {
      setResolvedTeams([]);
    }

    if (data.players && data.players.length > 0) {
      setResolvedPlayers(data.players);
      // Preload first 10 player images immediately (high priority)
      const firstPlayers = data.players.slice(0, 10).map(p => p.image).filter(Boolean);
      if (firstPlayers.length > 0) {
        imagePreloader.preloadBatch(firstPlayers, 'high');
      }
      // Preload remaining players in background (low priority)
      setTimeout(() => {
        imagePreloader.preloadAllPlayers(data.players);
      }, 1000);
    } else if (data.selectedPlayers && data.selectedPlayers.length > 0) {
      apiCall('/api/players')
        .then(res => res.json())
        .then(all => {
          const filtered = (all || []).filter(p => data.selectedPlayers.includes(p.id));
          setResolvedPlayers(filtered);
          // Preload first 10 player images immediately (high priority)
          const firstPlayers = filtered.slice(0, 10).map(p => p.image).filter(Boolean);
          if (firstPlayers.length > 0) {
            imagePreloader.preloadBatch(firstPlayers, 'high');
          }
          // Preload remaining players in background (low priority)
          setTimeout(() => {
            imagePreloader.preloadAllPlayers(filtered);
          }, 1000);
        })
        .catch(() => {});
    } else {
      setResolvedPlayers([]);
    }
  });

  const teams = () => {
    const base = resolvedTeams();
    const onlineSet = new Set(onlineTeamIds().map(id => String(id)));
    return base.map(t => ({ ...t, isOnline: onlineSet.has(String(t.id)) }));
  };
  const players = () => resolvedPlayers();
  const onlineCount = () => teams().filter(t => t.isOnline).length;
  const totalTeams = () => teams().length;

  const sendPresence = () => {
    if (!props.currentUser || props.currentUser.role !== 'team' || !props.currentUser.teamId) return;
    const id = props.auctionData?.id;
    if (!id) return;
    apiCall(`/api/auctions/${id}/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: String(props.currentUser.teamId) })
    }).catch(() => {});
  };

  const fetchPresence = () => {
    const id = props.auctionData?.id;
    if (!id) return;
    apiCall(`/api/auctions/${id}/presence`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.onlineTeamIds) setOnlineTeamIds(data.onlineTeamIds);
      })
      .catch(() => {});
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1280px] mx-auto px-4 py-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <Show when={props.onBack}>
                <button onClick={props.onBack} class="p-1 hover:bg-gray-800 rounded transition-colors">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </Show>
              <div>
                <h1 class="text-lg font-bold">{props.auctionData?.name || 'Auction'}</h1>
                <p class="text-xs text-gray-400">Waiting for auction to start...</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1.5 bg-gray-900 px-3 py-1.5 rounded-full">
                <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span class="text-xs font-semibold text-green-400">{onlineCount()}/{totalTeams()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-[1280px] mx-auto p-4 pb-24">
        {/* Auction Info Card */}
        <div class="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <div class="flex-1">
              <h2 class="text-base font-bold">{props.auctionData?.name}</h2>
              <p class="text-xs text-gray-400">{props.auctionData?.description || 'No description'}</p>
            </div>
          </div>
          
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-[#0f0f0f]/50 rounded-lg p-2 text-center">
              <p class="text-lg font-bold text-emerald-400">{totalTeams()}</p>
              <p class="text-xs text-gray-400">Teams</p>
            </div>
            <div class="bg-[#0f0f0f]/50 rounded-lg p-2 text-center">
              <p class="text-lg font-bold text-blue-400">{players().length}</p>
              <p class="text-xs text-gray-400">Players</p>
            </div>
            <div class="bg-[#0f0f0f]/50 rounded-lg p-2 text-center">
              <p class="text-lg font-bold text-purple-400">₹{props.auctionData?.budget || 100}</p>
              <p class="text-xs text-gray-400">Budget</p>
            </div>
          </div>
        </div>

        {/* Toggle Sections */}
        <div class="flex gap-2 mb-3">
          <button
            onClick={() => setExpandedSection('teams')}
            class={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              expandedSection() === 'teams'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#1a1a1a] text-gray-400 border border-gray-800'
            }`}
          >
            Teams ({totalTeams()})
          </button>
          <button
            onClick={() => setExpandedSection('players')}
            class={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              expandedSection() === 'players'
                ? 'bg-blue-600 text-white'
                : 'bg-[#1a1a1a] text-gray-400 border border-gray-800'
            }`}
          >
            Players ({players().length})
          </button>
        </div>

        {/* Teams Section */}
        <Show when={expandedSection() === 'teams'}>
          <div class="space-y-2">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-400">PARTICIPATING TEAMS</h3>
              <span class="text-xs text-green-400">{onlineCount()} online</span>
            </div>
            <For each={teams()}>
              {(team) => (
                <div class="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <Show when={team.logo} fallback={
                      <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-bold">
                        {team.shortName || 'T'}
                      </div>
                    }>
                      <img src={team.logo} alt={team.name} class="w-10 h-10 rounded-full object-cover" />
                    </Show>
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="text-sm font-semibold">{team.name}</h4>
                      </div>
                      <p class="text-xs text-gray-500">{team.shortName}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <div class={`w-2 h-2 rounded-full ${team.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                    <span class={`text-xs font-medium ${team.isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                      {team.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Players Section */}
        <Show when={expandedSection() === 'players'}>
          <div class="space-y-2">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-400">AUCTION POOL</h3>
              <span class="text-xs text-blue-400">{players().length} players</span>
            </div>
            <div class="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto">
              <For each={players()}>
                {(player) => (
                  <div class="bg-[#1a1a1a] rounded-lg p-2.5 border border-gray-800 flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                      <Show when={player.image} fallback={
                        <div class="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center">
                          <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      }>
                        <img src={player.image} alt={player.name} class="w-9 h-9 rounded-full object-cover" />
                      </Show>
                      <div>
                        <div class="flex items-center gap-1.5">
                          <span class="text-sm font-medium">{player.name}</span>
                          <Show when={player.isOverseas}>
                            <svg class="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                          </Show>
                        </div>
                        <span class="text-xs text-gray-500">{shortenRole(player.role)}</span>
                      </div>
                    </div>
                    <span class="text-xs font-semibold text-emerald-400">₹{player.basePrice}Cr</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      {/* Bottom Action Bar */}
      <div class="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-gray-800 p-4">
        <div class="max-w-[1280px] mx-auto">
          <Show when={props.isAdmin} fallback={
            <div class="text-center">
              <div class="flex items-center justify-center gap-2 mb-2">
                <div class="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                <span class="text-sm font-semibold text-yellow-400">Waiting for admin to start...</span>
              </div>
              <p class="text-xs text-gray-500">The auction will begin shortly</p>
            </div>
          }>
            <div class="space-y-2">
              <Show when={onlineCount() === 0}>
                <div class="text-center">
                  <p class="text-xs text-yellow-400">⚠️ No teams are online yet</p>
                </div>
              </Show>
              <button
                onClick={() => {
                  if (onlineCount() === 0) {
                    if (!confirm('No teams are online. Start auction anyway?')) return;
                  }
                  props.onStartAuction();
                }}
                class="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-sm font-bold transition-all shadow-lg"
              >
                Start Auction {onlineCount() > 0 ? `(${onlineCount()} teams ready)` : ''}
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
