import { createSignal, onMount, Show, For, createEffect } from 'solid-js';

// Auction Summary Component
export default function AuctionSummary(props) {
  const [auction, setAuction] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [selectedTeam, setSelectedTeam] = createSignal(null);
  const [activeTab, setActiveTab] = createSignal('overview'); // overview, teams, trades

  onMount(() => {
    fetchAuctionData();
    // Don't fetch trade window on mount - only when trades tab is clicked
  });

  const fetchAuctionData = async () => {
    try {
      const res = await fetch(`/api/auctions/${props.auctionId}/results`);
      const data = await res.json();
      
      // Build complete player list with status from teamSquads
      const playersWithStatus = [];
      const soldPlayerIds = new Set();
      
      // Add sold players from teamSquads
      if (data.teamSquads && typeof data.teamSquads === 'object') {
        Object.entries(data.teamSquads).forEach(([teamIdKey, squad]) => {
          if (squad.players && squad.players.length > 0) {
            // Use squad.teamId (the actual team ID), not teamIdKey (which is just the map key)
            const actualTeamId = squad.teamId;
            
            squad.players.forEach(player => {
              playersWithStatus.push({
                ...player,
                status: 'sold',
                teamId: actualTeamId, // Use the actual team ID from squad object
                soldPrice: player.soldPrice || player.SoldPrice || 0
              });
              soldPlayerIds.add(player.id);
            });
          }
        });
      }
      
      // Add unsold players
      if (data.players) {
        data.players.forEach(player => {
          if (!soldPlayerIds.has(player.id)) {
            playersWithStatus.push({
              ...player,
              status: 'unsold',
              teamId: 0,
              soldPrice: 0
            });
          }
        });
      }
      
      setAuction({
        ...data,
        players: playersWithStatus
      });
    } catch (error) {
      // Silent error - failed to fetch auction summary
    } finally {
      setLoading(false);
    }
  };

  // Computed values
  const soldPlayers = () => auction()?.players?.filter(p => p.status === 'sold') || [];
  const unsoldPlayers = () => auction()?.players?.filter(p => p.status === 'unsold') || [];
  
  const teamStats = () => {
    if (!auction()) return [];
    const teams = auction().teams || [];
    
    return teams.map(team => {
      const teamPlayers = soldPlayers().filter(p => String(p.teamId) === String(team.id));
      
      const totalSpent = teamPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
      const overseasCount = teamPlayers.filter(p => p.isOverseas).length;
      const domesticCount = teamPlayers.length - overseasCount;
      const avgPrice = teamPlayers.length > 0 ? totalSpent / teamPlayers.length : 0;
      const mostExpensive = teamPlayers.length > 0 ? Math.max(...teamPlayers.map(p => p.soldPrice)) : 0;
      
      return {
        ...team,
        playersCount: teamPlayers.length,
        totalSpent,
        remaining: (auction().budget || 100) - totalSpent,
        overseasCount,
        domesticCount,
        avgPrice,
        mostExpensive,
        players: teamPlayers.sort((a, b) => b.soldPrice - a.soldPrice)
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  };

  const auctionStats = () => {
    const sold = soldPlayers();
    const unsold = unsoldPlayers();
    const totalSpent = sold.reduce((sum, p) => sum + p.soldPrice, 0);
    const avgPrice = sold.length > 0 ? totalSpent / sold.length : 0;
    const mostExpensive = sold.length > 0 ? Math.max(...sold.map(p => p.soldPrice)) : 0;
    const cheapest = sold.length > 0 ? Math.min(...sold.map(p => p.soldPrice)) : 0;
    
    return {
      totalPlayers: auction()?.players?.length || 0,
      soldCount: sold.length,
      unsoldCount: unsold.length,
      totalSpent,
      avgPrice,
      mostExpensive,
      cheapest,
      soldPercentage: auction()?.players?.length > 0 ? (sold.length / auction().players.length) * 100 : 0
    };
  };

  const downloadSquadPDF = (team) => {
    const teamData = teamStats().find(t => String(t.id) === String(team.id));
    if (!teamData) return;

    // Create a print-friendly window
    const printWindow = window.open('', '_blank');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${team.name} Squad - ${auction().name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            max-width: 800px; 
            margin: 0 auto;
          }
          h1 { 
            color: #10b981; 
            margin-bottom: 10px;
            font-size: 28px;
          }
          h2 { 
            color: #666; 
            margin-top: 0;
            margin-bottom: 30px;
            font-size: 18px;
            font-weight: normal;
          }
          .stats { 
            background-color: #f3f4f6; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 30px 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .stat-item { 
            margin: 0;
            font-size: 14px;
          }
          .stat-item strong {
            color: #333;
          }
          h3 {
            color: #333;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 20px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 12px 8px; 
            text-align: left; 
          }
          th { 
            background-color: #10b981; 
            color: white; 
            font-weight: 600;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
          .print-btn {
            background-color: #10b981;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-bottom: 20px;
          }
          .print-btn:hover {
            background-color: #059669;
          }
        </style>
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
        
        <h1>${team.name}${team.shortName ? ` (${team.shortName})` : ''}</h1>
        <h2>${auction().name}</h2>
        
        <div class="stats">
          <div class="stat-item"><strong>Total Players:</strong> ${teamData.playersCount}</div>
          <div class="stat-item"><strong>Overseas Players:</strong> ${teamData.overseasCount}</div>
          <div class="stat-item"><strong>Domestic Players:</strong> ${teamData.domesticCount}</div>
          <div class="stat-item"><strong>Total Spent:</strong> ₹${teamData.totalSpent.toFixed(2)} Cr</div>
          <div class="stat-item"><strong>Budget Remaining:</strong> ₹${teamData.remaining.toFixed(2)} Cr</div>
          <div class="stat-item"><strong>Average Price:</strong> ₹${teamData.avgPrice.toFixed(2)} Cr</div>
          <div class="stat-item"><strong>Most Expensive:</strong> ₹${teamData.mostExpensive.toFixed(2)} Cr</div>
        </div>

        <h3>Squad (${teamData.playersCount} Players)</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 40%">Player Name</th>
              <th style="width: 25%">Role</th>
              <th style="width: 20%">Type</th>
              <th style="width: 15%">Price (Cr)</th>
            </tr>
          </thead>
          <tbody>
            ${teamData.players.map(p => `
              <tr>
                <td>${p.name}</td>
                <td>${p.role}</td>
                <td>${p.isOverseas ? 'Overseas' : 'Domestic'}</td>
                <td>₹${p.soldPrice.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Trade window state - moved from TradeSection to parent
  const [tradeWindow, setTradeWindow] = createSignal(null);
  
  const fetchTradeWindow = async () => {
    try {
      const res = await fetch(`/api/auctions/${props.auctionId}/trade-window`);
      if (res.ok) {
        const data = await res.json();
        setTradeWindow(data);
      } else if (res.status === 404) {
        // Trade window endpoint not available (old backend version)
        setTradeWindow(null);
      }
    } catch (error) {
      // Silently fail - trade feature not available
      setTradeWindow(null);
    }
  };


  return (
    <div class="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white">
      {/* Header */}
      <div class="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-gray-800/50">
        <div class="max-w-7xl mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <button
                onClick={props.onBack}
                class="w-9 h-9 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 flex items-center justify-center transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
              </button>
              <div>
                <h1 class="text-xl font-bold">{auction()?.name || 'Auction Summary'}</h1>
                <p class="text-xs text-gray-400">Complete Results & Analytics</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <span class="text-xs font-bold text-emerald-400">COMPLETED</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Show when={loading()}>
        <div class="flex items-center justify-center min-h-[60vh]">
          <div class="text-center">
            <div class="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-sm text-gray-400">Loading results...</p>
          </div>
        </div>
      </Show>

      <Show when={!loading() && auction()}>
        <div class={`${activeTab() === 'trades' ? 'flex flex-col h-[calc(100vh-73px)]' : 'max-w-7xl mx-auto px-4 py-6'} ${activeTab() === 'trades' ? '' : 'space-y-6'}`}>

          {/* Tab Navigation */}
          <div class={`flex gap-1 border-b border-gray-800/50 ${activeTab() === 'trades' ? 'px-4 flex-shrink-0' : ''}`}>
            <button
              onClick={() => setActiveTab('overview')}
              class={`px-4 sm:px-6 py-2 rounded-t-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab() === 'overview'
                  ? 'bg-gray-800 text-white border-b-2 border-emerald-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              class={`px-4 sm:px-6 py-2 rounded-t-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab() === 'teams'
                  ? 'bg-gray-800 text-white border-b-2 border-emerald-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              Teams
            </button>
            <button
              onClick={() => {
                setActiveTab('trades');
                // Only fetch trade window when trades tab is clicked
                if (activeTab() !== 'trades') {
                  fetchTradeWindow();
                }
              }}
              class={`px-4 sm:px-6 py-2 rounded-t-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab() === 'trades'
                  ? 'bg-gray-800 text-white border-b-2 border-emerald-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              Trades
            </button>
          </div>

          {/* Overview Tab */}
          <Show when={activeTab() === 'overview'}>
            {/* Quick Stats Cards */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <span class="text-xs text-gray-400">Players</span>
              </div>
              <div class="text-2xl font-bold text-purple-400">{auctionStats().totalPlayers}</div>
              <div class="text-xs text-gray-500 mt-1">{auctionStats().soldCount} sold • {auctionStats().unsoldCount} unsold</div>
            </div>

            <div class="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="text-xs text-gray-400">Total Spent</span>
              </div>
              <div class="text-2xl font-bold text-emerald-400">₹{auctionStats().totalSpent.toFixed(1)}Cr</div>
              <div class="text-xs text-gray-500 mt-1">Avg ₹{auctionStats().avgPrice.toFixed(2)}Cr</div>
            </div>

            <div class="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
                <span class="text-xs text-gray-400">Highest Bid</span>
              </div>
              <div class="text-2xl font-bold text-blue-400">₹{auctionStats().mostExpensive.toFixed(1)}Cr</div>
              <div class="text-xs text-gray-500 mt-1">Lowest ₹{auctionStats().cheapest.toFixed(2)}Cr</div>
            </div>

            <div class="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="text-xs text-gray-400">Success Rate</span>
              </div>
              <div class="text-2xl font-bold text-orange-400">{auctionStats().soldPercentage.toFixed(0)}%</div>
              <div class="text-xs text-gray-500 mt-1">{auctionStats().soldCount}/{auctionStats().totalPlayers} sold</div>
            </div>
          </div>

          {/* Unsold Players in Overview */}
          <Show when={unsoldPlayers().length > 0}>
            <div class="bg-gray-900/50 border border-gray-800/50 rounded-xl p-3 sm:p-5">
              <h2 class="text-sm sm:text-lg font-bold flex items-center gap-2 mb-3 sm:mb-4">
                <svg class="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Unsold Players ({unsoldPlayers().length})
              </h2>
              <div class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                <For each={unsoldPlayers()}>
                  {(player) => (
                    <div class="bg-gray-800/30 border border-gray-700/30 rounded-lg p-2 sm:p-3 flex items-center gap-2 sm:gap-3">
                      <Show when={player.image} fallback={
                        <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-700 flex items-center justify-center text-[9px] sm:text-xs font-bold flex-shrink-0">
                          {player.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      }>
                        <img src={player.image} alt={player.name} class="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover flex-shrink-0"/>
                      </Show>
                      <div class="flex-1 min-w-0">
                        <div class="text-[11px] sm:text-sm font-medium truncate">{player.name}</div>
                        <div class="text-[10px] sm:text-xs text-gray-500">{player.role} • ₹{player.basePrice}</div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          </Show>

          {/* Teams Tab */}
          <Show when={activeTab() === 'teams'}>
          <div class="bg-gray-900/50 border border-gray-800/50 rounded-xl p-3 sm:p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-1.5">
                <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <h2 class="text-sm font-bold">Team Rankings</h2>
              </div>
              <span class="text-[10px] text-gray-500">By spend</span>
            </div>
            
            <div class="space-y-2">
              <For each={teamStats()}>
                {(team, index) => (
                  <div 
                    class="bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 rounded-lg transition-all"
                  >
                    {/* Team Header - Compact */}
                    <div 
                      class="p-2.5 cursor-pointer"
                      onClick={() => setSelectedTeam(selectedTeam()?.id === team.id ? null : team)}
                    >
                      <div class="flex items-center gap-2">
                        {/* Rank Badge - Small */}
                        <div class={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          index() === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          index() === 1 ? 'bg-gray-400/20 text-gray-300' :
                          index() === 2 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-700/30 text-gray-500'
                        }`}>
                          {index() + 1}
                        </div>

                        {/* Team Info - Compact */}
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                          <Show when={team.logo} fallback={
                            <div class="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                              {team.shortName || team.name.substring(0, 2)}
                            </div>
                          }>
                            <img src={team.logo} alt={team.name} class="w-7 h-7 rounded-full object-cover flex-shrink-0"/>
                          </Show>
                          <div class="flex-1 min-w-0">
                            <h3 class="font-semibold text-xs truncate">{team.name}</h3>
                            <div class="flex items-center gap-2 text-[10px] text-gray-400">
                              <span>{team.playersCount}p</span>
                              <span class="text-blue-400">✈️{team.overseasCount}</span>
                            </div>
                          </div>
                        </div>

                        {/* Spend Info - Compact */}
                        <div class="text-right mr-1">
                          <div class="text-sm font-bold text-emerald-400">₹{team.totalSpent.toFixed(1)}</div>
                          <div class="text-[9px] text-gray-500">₹{team.remaining.toFixed(1)} left</div>
                        </div>

                        {/* Expand Icon - Small */}
                        <svg class={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${selectedTeam()?.id === team.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Squad Details - Compact */}
                    <Show when={selectedTeam()?.id === team.id}>
                      <div class="px-2.5 pb-2.5 border-t border-gray-700/30">
                        {/* Quick Stats + PDF Button - Compact */}
                        <div class="flex items-center justify-between gap-2 py-2">
                          <div class="flex gap-2 flex-1 text-[10px]">
                            <span class="text-gray-500">Avg: <span class="text-blue-400 font-semibold">₹{team.avgPrice.toFixed(1)}</span></span>
                            <span class="text-gray-500">Max: <span class="text-purple-400 font-semibold">₹{team.mostExpensive.toFixed(1)}</span></span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadSquadPDF(team);
                            }}
                            class="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-semibold transition-colors flex items-center gap-1 flex-shrink-0"
                          >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            PDF
                          </button>
                        </div>

                        {/* Squad List - Compact */}
                        <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          <For each={team.players}>
                            {(player) => (
                              <div class="flex items-center justify-between bg-gray-900/50 hover:bg-gray-900/70 rounded-lg p-2 transition-colors">
                                <div class="flex items-center gap-2 flex-1 min-w-0">
                                  <Show when={player.image} fallback={
                                    <div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                      {player.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                  }>
                                    <img src={player.image} alt={player.name} class="w-6 h-6 rounded-full object-cover flex-shrink-0"/>
                                  </Show>
                                  <div class="flex-1 min-w-0">
                                    <div class="text-xs font-medium truncate">{player.name}</div>
                                    <div class="text-[10px] text-gray-500">{player.role} • {player.isOverseas ? '✈️' : '🇮🇳'}</div>
                                  </div>
                                </div>
                                <div class="text-xs font-bold text-emerald-400 flex-shrink-0">₹{player.soldPrice.toFixed(1)}</div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
          </Show>

          {/* Trades Tab */}
          <Show when={activeTab() === 'trades'}>
            <TradeSection 
              auctionId={props.auctionId}
              auction={auction()} 
              onTradeComplete={fetchAuctionData} 
              isAdmin={props.isAdmin} 
              userTeamId={props.userTeamId}
              tradeWindow={tradeWindow()}
              fetchTradeWindow={fetchTradeWindow}
              onTabActivated={fetchTradeWindow}
            />
          </Show>

        </div>
      </Show>
    </div>
  );
}


// Trade Section Component
function TradeSection(props) {
  const [showTradeModal, setShowTradeModal] = createSignal(false);
  const [team1, setTeam1] = createSignal(null);
  const [team2, setTeam2] = createSignal(null);
  const [team1Selected, setTeam1Selected] = createSignal([]);
  const [team2Selected, setTeam2Selected] = createSignal([]);
  const [trades, setTrades] = createSignal([]);
  const [executing, setExecuting] = createSignal(false);
  const [message, setMessage] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal('all');

  onMount(() => {
    // Fetch trades when component mounts
    fetchTrades();
    // Fetch trade window status on mount
    if (props.onTabActivated) {
      props.onTabActivated();
    }
  });

  // Auto-set team1 for non-admin users when modal opens
  createEffect(() => {
    if (showTradeModal() && !props.isAdmin && props.userTeamId && props.auction?.teams) {
      const myTeam = props.auction.teams.find(t => String(t.id) === String(props.userTeamId));
      if (myTeam && !team1()) {
        setTeam1(myTeam);
      }
    }
  });

  const fetchTrades = async () => {
    try {
      const res = await fetch(`/api/auctions/${props.auctionId}/trades`);
      const data = await res.json();
      setTrades(data || []);
    } catch (error) {
      // Silent error - failed to fetch trades
    }
  };

  const startTradeWindow = async () => {
    try {
      const res = await fetch(`/api/auctions/${props.auctionId}/trade-window/start`, {
        method: 'POST'
      });
      if (res.ok) {
        await props.fetchTradeWindow();
        alert('Trade window started!');
      } else if (res.status === 404) {
        alert('Trade feature not available. Please restart the backend server with the latest code.');
      } else if (res.status === 400) {
        const text = await res.text();
        if (text.includes('already active')) {
          // Trade window is already active, just refresh the data
          await props.fetchTradeWindow();
          alert('Trade window is already active!');
        } else {
          alert('Failed to start trade window: ' + text);
        }
      } else {
        const text = await res.text();
        alert('Failed to start trade window: ' + text);
      }
    } catch (error) {
      alert('Trade feature not available. Please restart the backend server.');
    }
  };

  const endTradeWindow = async () => {
    if (!confirm('Are you sure you want to end the trade window? No more trades can be made.')) {
      return;
    }
    try {
      const res = await fetch(`/api/auctions/${props.auctionId}/trade-window/end`, {
        method: 'POST'
      });
      if (res.ok) {
        await props.fetchTradeWindow();
        alert('Trade window ended!');
      } else {
        const text = await res.text();
        alert('Failed to end trade window: ' + text);
      }
    } catch (error) {
      alert('Failed to end trade window: ' + error.message);
    }
  };

  const getTeamPlayers = (teamId) => {
    return props.auction?.players?.filter(p => p.status === 'sold' && String(p.teamId) === String(teamId)) || [];
  };

  const togglePlayerSelection = (teamNum, playerId) => {
    if (teamNum === 1) {
      setTeam1Selected(prev => 
        prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
      );
    } else {
      setTeam2Selected(prev => 
        prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
      );
    }
  };

  const validateTrade = () => {
    if (!team1() || !team2()) return 'Please select a team to trade with';
    if (team1().id === team2().id) return 'Cannot trade with the same team';
    if (team1Selected().length === 0 || team2Selected().length === 0) {
      return 'Both teams must select at least one player';
    }

    // Check overseas limits
    const overseasLimit = props.auction.maxOverseasPlayers || 8;
    
    // Calculate Team 1 overseas count after trade
    const team1Players = getTeamPlayers(team1().id);
    const team1OverseasAfter = team1Players.filter(p => 
      !team1Selected().includes(p.id) && p.isOverseas
    ).length + team2Selected().filter(id => {
      const player = getTeamPlayers(team2().id).find(p => p.id === id);
      return player?.isOverseas;
    }).length;

    if (team1OverseasAfter > overseasLimit) {
      return `${team1().name} would exceed overseas limit (${team1OverseasAfter}/${overseasLimit})`;
    }

    // Calculate Team 2 overseas count after trade
    const team2Players = getTeamPlayers(team2().id);
    const team2OverseasAfter = team2Players.filter(p => 
      !team2Selected().includes(p.id) && p.isOverseas
    ).length + team1Selected().filter(id => {
      const player = getTeamPlayers(team1().id).find(p => p.id === id);
      return player?.isOverseas;
    }).length;

    if (team2OverseasAfter > overseasLimit) {
      return `${team2().name} would exceed overseas limit (${team2OverseasAfter}/${overseasLimit})`;
    }

    return null;
  };

  const executeTrade = async () => {
    const error = validateTrade();
    if (error) {
      alert(error);
      return;
    }

    setExecuting(true);
    try {
      // Convert all IDs to strings for int64 compatibility
      const payload = {
        auctionId: String(props.auctionId),
        team1Id: String(team1().id),
        team2Id: String(team2().id),
        team1Players: team1Selected().map(id => String(id)),
        team2Players: team2Selected().map(id => String(id)),
        message: message()
      };
      
      const res = await fetch('/api/auctions/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Trade request failed');
      }

      // Reset and refresh
      setShowTradeModal(false);
      setTeam1(null);
      setTeam2(null);
      setTeam1Selected([]);
      setTeam2Selected([]);
      setMessage('');
      await fetchTrades();
      
      // Refresh auction data
      if (props.onTradeComplete) {
        props.onTradeComplete();
      }
      
      alert('Trade request sent successfully!');
    } catch (error) {
      alert('Trade request failed: ' + error.message);
    } finally {
      setExecuting(false);
    }
  };

  const acceptTrade = async (tradeId) => {
    if (!confirm('Accept this trade request? Players will be swapped immediately.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/auctions/trade/${tradeId}/accept`, {
        method: 'POST'
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to accept trade');
      }

      await fetchTrades();
      if (props.onTradeComplete) {
        props.onTradeComplete();
      }
      alert('Trade accepted successfully!');
    } catch (error) {
      alert('Failed to accept trade: ' + error.message);
    }
  };

  const rejectTrade = async (tradeId) => {
    if (!confirm('Reject this trade request?')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/auctions/trade/${tradeId}/reject`, {
        method: 'POST'
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to reject trade');
      }

      await fetchTrades();
      alert('Trade rejected.');
    } catch (error) {
      alert('Failed to reject trade: ' + error.message);
    }
  };

  const cancelTrade = async (tradeId) => {
    if (!confirm('Cancel this trade request?')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/auctions/trade/${tradeId}/cancel`, {
        method: 'POST'
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to cancel trade');
      }

      await fetchTrades();
      alert('Trade cancelled.');
    } catch (error) {
      alert('Failed to cancel trade: ' + error.message);
    }
  };

  const filteredTrades = () => {
    const allTrades = trades();
    const filtered = statusFilter() === 'all' ? allTrades : allTrades.filter(t => t.status === statusFilter());
    // Sort by createdAt descending (newest first)
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const pendingIncoming = () => {
    return trades()
      .filter(t => t.status === 'pending' && String(t.team2Id) === String(props.userTeamId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const pendingOutgoing = () => {
    return trades()
      .filter(t => t.status === 'pending' && String(t.team1Id) === String(props.userTeamId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  return (
    <div class="bg-gray-900/50 border-0 sm:border sm:border-gray-800/50 rounded-none sm:rounded-xl p-0 sm:p-5 flex-1 flex flex-col min-h-0">
      {/* Header - Mobile Responsive */}
      <div class="flex flex-col gap-3 mb-4 p-3 sm:p-0 flex-shrink-0">
        <div class="flex items-center justify-between">
          <h2 class="text-base sm:text-lg font-bold flex items-center gap-2">
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
            Player Trades
          </h2>
          
          {/* New Trade Button - Top Right on Mobile */}
          <Show when={props.tradeWindow?.isActive || props.tradeWindow?.canTrade}>
            <button
              onClick={() => setShowTradeModal(true)}
              class="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95 whitespace-nowrap shadow-lg"
            >
              <span class="hidden sm:inline">New Trade</span>
              <span class="sm:hidden">+ Trade</span>
            </button>
          </Show>
        </div>
        
        {/* Status and Controls - Full Width on Mobile */}
        <div class="flex flex-wrap items-center gap-2">
          {/* Trade Window Status */}
          <Show when={props.tradeWindow?.isActive}>
            <div class="flex items-center gap-2">
              <div class="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-md text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                ACTIVE
              </div>
              <Show when={props.tradeWindow?.window?.endsAt}>
                {(() => {
                  const endTime = new Date(props.tradeWindow.window.endsAt);
                  const now = new Date();
                  const diffMs = endTime - now;
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                  
                  return (
                    <div class="px-2.5 py-1 bg-gray-800/80 border border-gray-700 rounded-md">
                      <div class="flex items-center gap-1.5">
                        <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span class="text-xs font-medium text-gray-300">
                          <Show when={diffHours > 0} fallback={
                            <span>{diffMins}m left</span>
                          }>
                            <span>{diffHours}h {diffMins}m left</span>
                          </Show>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </Show>
            </div>
          </Show>
          <Show when={!props.tradeWindow?.isActive && props.tradeWindow?.hasTradeWindow === false}>
            <div class="px-2.5 py-1 bg-gray-500/20 border border-gray-500/30 rounded-md text-xs font-bold text-gray-400">
              NOT STARTED
            </div>
          </Show>
          
          {/* Admin Controls */}
          <Show when={props.isAdmin}>
            <Show when={!props.tradeWindow?.isActive} fallback={
              <button
                onClick={endTradeWindow}
                class="px-3 py-1.5 bg-red-600/90 hover:bg-red-600 rounded-md text-xs font-semibold transition-all hover:scale-105 active:scale-95 whitespace-nowrap shadow-md"
              >
                End Window
              </button>
            }>
              <button
                onClick={startTradeWindow}
                class="px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 rounded-md text-xs font-semibold transition-all hover:scale-105 active:scale-95 whitespace-nowrap shadow-md"
              >
                Start Window
              </button>
            </Show>
          </Show>
        </div>
      </div>

      {/* Trade Window Info Banner */}
      <Show when={!props.tradeWindow}>
        <div class="mb-4 mx-3 sm:mx-0 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div class="flex items-center gap-2 text-blue-400 text-sm">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Loading trade window status...</span>
          </div>
        </div>
      </Show>
      
      <Show when={props.tradeWindow && !props.tradeWindow.isActive && !props.isAdmin}>
        <div class="mb-4 mx-3 sm:mx-0 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div class="flex items-center gap-2 text-yellow-400 text-sm">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Trade window is not active. Wait for admin to start it.</span>
          </div>
        </div>
      </Show>

      <Show when={trades().length === 0}>
        <div class="text-center py-12 px-3 text-gray-500 flex-1 flex flex-col items-center justify-center">
          <div class="w-16 h-16 mx-auto mb-4 bg-gray-800/50 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
          </div>
          <p class="text-sm font-medium">No trades yet</p>
          <p class="text-xs text-gray-600 mt-1">Trades will appear here once created</p>
        </div>
      </Show>

      <Show when={trades().length > 0}>
        <div class="flex-1 flex flex-col min-h-0">
        {/* Status Filter */}
        <div class="flex gap-2 mb-4 px-3 sm:px-0 flex-wrap flex-shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter() === 'all'
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
            }`}
          >
            All ({trades().length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter() === 'pending' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
            }`}
          >
            Pending ({trades().filter(t => t.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('accepted')}
            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter() === 'accepted' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
            }`}
          >
            Accepted ({trades().filter(t => t.status === 'accepted').length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter() === 'rejected' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
            }`}
          >
            Rejected ({trades().filter(t => t.status === 'rejected').length})
          </button>
        </div>

        {/* Pending Incoming Requests (for team users) */}
        <Show when={!props.isAdmin && pendingIncoming().length > 0}>
          <div class="mb-4 px-3 sm:px-0 flex-shrink-0">
            <h3 class="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Incoming Requests ({pendingIncoming().length})
            </h3>
            <div class="space-y-2">
              <For each={pendingIncoming()}>
                {(trade) => <TradeCard trade={trade} auction={props.auction} type="incoming" onAccept={acceptTrade} onReject={rejectTrade} />}
              </For>
            </div>
          </div>
        </Show>

        {/* Pending Outgoing Requests (for team users) */}
        <Show when={!props.isAdmin && pendingOutgoing().length > 0}>
          <div class="mb-4 px-3 sm:px-0 flex-shrink-0">
            <h3 class="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
              Outgoing Requests ({pendingOutgoing().length})
            </h3>
            <div class="space-y-2">
              <For each={pendingOutgoing()}>
                {(trade) => <TradeCard trade={trade} auction={props.auction} type="outgoing" onCancel={cancelTrade} />}
              </For>
            </div>
          </div>
        </Show>

        {/* All Trades - Scrollable */}
        <div class="flex-1 overflow-y-auto px-3 sm:px-0">
          <h3 class="text-sm font-bold text-gray-400 mb-2 sticky top-0 bg-gray-900/95 py-2 z-10">Trade History</h3>
          <div class="space-y-3 pb-4">
            <For each={filteredTrades()}>
              {(trade) => <TradeCard trade={trade} auction={props.auction} type="history" />}
            </For>
          </div>
        </div>
        </div>
      </Show>


      {/* Trade Modal */}
      <Show when={showTradeModal()}>
        <div class="fixed inset-0 bg-gray-900 sm:bg-black/80 sm:backdrop-blur-sm z-50 flex flex-col sm:items-start sm:justify-center sm:p-4 sm:overflow-y-auto" onClick={(e) => {
          // Only close on backdrop click for desktop
          if (e.target === e.currentTarget && window.innerWidth >= 640) {
            setShowTradeModal(false);
          }
        }}>
          <div class="bg-gray-900 w-full h-full sm:h-auto sm:max-w-4xl sm:border sm:border-gray-800 sm:rounded-xl sm:my-8 flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header - Fixed at top */}
            <div class="flex-shrink-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
              <h3 class="text-lg font-bold">Propose Trade</h3>
              <button onClick={() => setShowTradeModal(false)} class="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Content - Scrollable */}
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Team Selection - Only show if admin, otherwise auto-set user's team */}
              <Show when={props.isAdmin}>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium mb-2">Your Team</label>
                    <select
                      value={team1()?.id || ''}
                      onChange={(e) => {
                        const teamId = e.target.value;
                        const team = props.auction.teams.find(t => String(t.id) === teamId);
                        setTeam1(team || null);
                        setTeam1Selected([]);
                      }}
                      class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select Your Team</option>
                      <For each={props.auction.teams}>
                        {(t) => <option value={String(t.id)}>{t.name}</option>}
                      </For>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm font-medium mb-2">Trade With</label>
                    <select
                      value={team2()?.id || ''}
                      onChange={(e) => {
                        const teamId = e.target.value;
                        const team = props.auction.teams.find(t => String(t.id) === teamId);
                        setTeam2(team || null);
                        setTeam2Selected([]);
                      }}
                      class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select Team</option>
                      <For each={props.auction.teams}>
                        {(t) => <option value={String(t.id)}>{t.name}</option>}
                      </For>
                    </select>
                  </div>
                </div>
              </Show>

              {/* Non-admin: Show user's team and let them select trade partner */}
              <Show when={!props.isAdmin}>
                <div class="space-y-3">
                  {/* User's Team - Display only */}
                  <div class="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div class="text-xs text-blue-400 mb-1">Your Team</div>
                    <div class="text-sm font-bold">
                      {team1()?.name || 'Loading...'}
                    </div>
                  </div>

                  {/* Trade Partner Selection */}
                  <div>
                    <label class="block text-sm font-medium mb-2">Select Team to Trade With</label>
                    <select
                      value={team2()?.id || ''}
                      onChange={(e) => {
                        const teamId = e.target.value;
                        const team = props.auction.teams.find(t => String(t.id) === teamId);
                        setTeam2(team || null);
                        setTeam2Selected([]);
                      }}
                      class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Choose a team...</option>
                      <For each={props.auction.teams.filter(t => String(t.id) !== String(props.userTeamId))}>
                        {(t) => <option value={String(t.id)}>{t.name}</option>}
                      </For>
                    </select>
                  </div>
                </div>
              </Show>

              {/* Player Selection */}
              <Show when={team1() && team2()}>
                <div class="space-y-4 flex-1 flex flex-col min-h-0">
                  <div class="text-center py-2 border-y border-gray-800 flex-shrink-0">
                    <p class="text-xs text-gray-400">Select players from each team to trade</p>
                  </div>
                  
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-h-0">
                    {/* Team 1 Players */}
                    <div class="bg-gray-800/30 rounded-lg p-3 flex flex-col min-h-0">
                      <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-700 flex-shrink-0">
                        <h4 class="text-sm font-bold text-blue-400">Your Players</h4>
                        <span class="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-medium">
                          {team1Selected().length} selected
                        </span>
                      </div>
                      <div class="space-y-2 overflow-y-auto pr-1 flex-1">
                        <For each={getTeamPlayers(team1().id)}>
                          {(player) => (
                            <div
                              onClick={() => togglePlayerSelection(1, player.id)}
                              class={`p-2.5 rounded-lg cursor-pointer transition-all ${
                                team1Selected().includes(player.id)
                                  ? 'bg-blue-600/30 border border-blue-500 shadow-md'
                                  : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 active:scale-98'
                              }`}
                            >
                              <div class="flex items-center gap-2.5">
                                <Show when={player.image} fallback={
                                  <div class="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {player.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                }>
                                  <img src={player.image} alt={player.name} class="w-9 h-9 rounded-full object-cover flex-shrink-0"/>
                                </Show>
                                <div class="flex-1 min-w-0">
                                  <div class="text-sm font-medium truncate">{player.name}</div>
                                  <div class="text-xs text-gray-400 flex items-center gap-1.5">
                                    <span>{player.role}</span>
                                    <span>•</span>
                                    <span>{player.isOverseas ? 'Overseas' : 'Indian'}</span>
                                  </div>
                                </div>
                                <Show when={team1Selected().includes(player.id)}>
                                  <svg class="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                  </svg>
                                </Show>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>

                    {/* Team 2 Players */}
                    <div class="bg-gray-800/30 rounded-lg p-3 flex flex-col min-h-0">
                      <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-700 flex-shrink-0">
                        <h4 class="text-sm font-bold text-emerald-400">{team2().name}</h4>
                        <span class="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                          {team2Selected().length} selected
                        </span>
                      </div>
                      <div class="space-y-2 overflow-y-auto pr-1 flex-1">
                        <For each={getTeamPlayers(team2().id)}>
                          {(player) => (
                            <div
                              onClick={() => togglePlayerSelection(2, player.id)}
                              class={`p-2.5 rounded-lg cursor-pointer transition-all ${
                                team2Selected().includes(player.id)
                                  ? 'bg-emerald-600/30 border border-emerald-500 shadow-md'
                                  : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 active:scale-98'
                              }`}
                            >
                              <div class="flex items-center gap-2.5">
                                <Show when={player.image} fallback={
                                  <div class="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {player.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                }>
                                  <img src={player.image} alt={player.name} class="w-9 h-9 rounded-full object-cover flex-shrink-0"/>
                                </Show>
                                <div class="flex-1 min-w-0">
                                  <div class="text-sm font-medium truncate">{player.name}</div>
                                  <div class="text-xs text-gray-400 flex items-center gap-1.5">
                                    <span>{player.role}</span>
                                    <span>•</span>
                                    <span>{player.isOverseas ? 'Overseas' : 'Indian'}</span>
                                  </div>
                                </div>
                                <Show when={team2Selected().includes(player.id)}>
                                  <svg class="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                  </svg>
                                </Show>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>

                {/* Optional Message */}
                <div>
                  <label class="block text-sm font-medium mb-2">Message (Optional)</label>
                  <textarea
                    value={message()}
                    onInput={(e) => setMessage(e.target.value)}
                    placeholder="Add a message to your trade request..."
                    class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
                    rows="2"
                  />
                </div>

                {/* Validation Warning */}
                <Show when={validateTrade()}>
                  <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div class="flex items-center gap-2 text-red-400 text-sm">
                      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                      </svg>
                      <span>{validateTrade()}</span>
                    </div>
                  </div>
                </Show>

                {/* Execute Button */}
                <div class="flex gap-3">
                  <button
                    onClick={() => setShowTradeModal(false)}
                    class="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeTrade}
                    disabled={!!validateTrade() || executing()}
                    class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {executing() ? 'Sending Request...' : 'Send Trade Request'}
                  </button>
                </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}


// TradeCard Component
function TradeCard(props) {
  const team1Data = () => props.auction.teams.find(t => String(t.id) === String(props.trade.team1Id));
  const team2Data = () => props.auction.teams.find(t => String(t.id) === String(props.trade.team2Id));
  const team1Players = () => props.trade.team1Players.map(id => 
    props.auction.players.find(p => String(p.id) === String(id))
  ).filter(Boolean);
  const team2Players = () => props.trade.team2Players.map(id => 
    props.auction.players.find(p => String(p.id) === String(id))
  ).filter(Boolean);

  const statusColors = {
    pending: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
    accepted: 'bg-green-500/20 border-green-500/30 text-green-400',
    rejected: 'bg-red-500/20 border-red-500/30 text-red-400',
    cancelled: 'bg-gray-500/20 border-gray-500/30 text-gray-400'
  };

  return (
    <div class="bg-gray-800/30 border border-gray-700/30 rounded-lg p-3">
      <div class="flex items-start justify-between mb-2">
        <div class={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColors[props.trade.status] || statusColors.pending}`}>
          {props.trade.status.toUpperCase()}
        </div>
        <div class="text-[10px] text-gray-500">
          {new Date(props.trade.createdAt).toLocaleDateString()} {new Date(props.trade.createdAt).toLocaleTimeString()}
        </div>
      </div>
      
      <Show when={props.trade.message}>
        <div class="mb-2 p-2 bg-gray-900/50 rounded text-[10px] text-gray-400 italic">
          "{props.trade.message}"
        </div>
      </Show>

      <div class="flex items-start gap-2">
        {/* Team 1 */}
        <div class="flex-1 min-w-0">
          <div class="space-y-1.5">
            <For each={team1Players()}>
              {(player) => (
                <div>
                  <div class="text-sm font-medium text-white truncate">→ {player?.name}</div>
                  <div class="flex items-center gap-1 ml-3 mt-0.5">
                    <Show when={team1Data()?.logo} fallback={
                      <div class="w-3.5 h-3.5 rounded-full bg-purple-500 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                        {team1Data()?.shortName}
                      </div>
                    }>
                      <img src={team1Data().logo} alt={team1Data().name} class="w-3.5 h-3.5 rounded-full flex-shrink-0"/>
                    </Show>
                    <span class="text-[10px] text-gray-400 truncate">{team1Data()?.name}</span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Swap Icon */}
        <div class="flex-shrink-0 pt-1">
          <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
          </svg>
        </div>

        {/* Team 2 */}
        <div class="flex-1 min-w-0">
          <div class="space-y-1.5">
            <For each={team2Players()}>
              {(player) => (
                <div>
                  <div class="text-sm font-medium text-white truncate">→ {player?.name}</div>
                  <div class="flex items-center gap-1 ml-3 mt-0.5">
                    <Show when={team2Data()?.logo} fallback={
                      <div class="w-3.5 h-3.5 rounded-full bg-pink-500 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                        {team2Data()?.shortName}
                      </div>
                    }>
                      <img src={team2Data().logo} alt={team2Data().name} class="w-3.5 h-3.5 rounded-full flex-shrink-0"/>
                    </Show>
                    <span class="text-[10px] text-gray-400 truncate">{team2Data()?.name}</span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <Show when={props.type === 'incoming'}>
        <div class="flex gap-2 mt-3">
          <button
            onClick={() => props.onAccept(props.trade.id)}
            class="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => props.onReject(props.trade.id)}
            class="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-medium transition-colors"
          >
            Reject
          </button>
        </div>
      </Show>

      <Show when={props.type === 'outgoing'}>
        <div class="mt-3">
          <button
            onClick={() => props.onCancel(props.trade.id)}
            class="w-full px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
          >
            Cancel Request
          </button>
        </div>
      </Show>
    </div>
  );
}
