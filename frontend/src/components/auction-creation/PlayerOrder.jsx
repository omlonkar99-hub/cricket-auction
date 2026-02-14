import { createSignal, onMount, For, Show } from 'solid-js';
import { apiCall } from '../../utils/api';

export default function PlayerOrder(props) {
  const [allPlayers, setAllPlayers] = createSignal([]);
  const [playerOrder, setPlayerOrder] = createSignal(props.data.playerOrder || {});
  const roleList = (props.data.roleOrder?.length
    ? props.data.roleOrder
    : ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']
  ).map((role) => ({
    key: role,
    label: role === 'Batsman' ? 'Bat'
      : role === 'Bowler' ? 'Bowl'
      : role === 'All-rounder' ? 'AR'
      : role === 'Wicket-keeper' ? 'WK'
      : role
  }));
  const [activeRole, setActiveRole] = createSignal(roleList[0]);
  const [draggedIndex, setDraggedIndex] = createSignal(null);
  const [overIndex, setOverIndex] = createSignal(null);

  onMount(async () => {
    try {
      const res = await apiCall('/api/players');
      const data = await res.json();
      setAllPlayers(data || []);
      
      // Initialize player order for each role
      const initialOrder = {};
      roleList.forEach(role => {
        const rolePlayers = (data || [])
          .filter(p => p.role === role.key && props.data.selectedPlayers?.includes(p.id))
          .map(p => p.id);
        initialOrder[role.key] = playerOrder()[role.key] || rolePlayers;
      });
      setPlayerOrder(initialOrder);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  });

  const currentPlayers = () => {
    const role = activeRole().key;
    const playerIds = playerOrder()[role] || [];
    return playerIds.map(id => allPlayers().find(p => p.id === id)).filter(Boolean);
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setOverIndex(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    const dragIdxRaw = e.dataTransfer.getData('text/plain');
    const dragIdx = dragIdxRaw === '' ? draggedIndex() : Number(dragIdxRaw);
    if (dragIdx === null || Number.isNaN(dragIdx) || dragIdx === index) return;

    const role = activeRole().key;
    const newOrder = [...(playerOrder()[role] || [])];
    const draggedItem = newOrder[dragIdx];
    newOrder.splice(dragIdx, 1);
    newOrder.splice(index, 0, draggedItem);

    setPlayerOrder(prev => ({ ...prev, [role]: newOrder }));
    setDraggedIndex(index);
    setOverIndex(null);
  };

  const reorderPlayers = (from, to) => {
    if (from === null || to === null || from === to) return;
    const role = activeRole().key;
    const newOrder = [...(playerOrder()[role] || [])];
    const draggedItem = newOrder[from];
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, draggedItem);
    setPlayerOrder(prev => ({ ...prev, [role]: newOrder }));
  };

  const handlePointerDown = (e, index) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedIndex(index);
  };

  const handlePointerMove = (e) => {
    if (draggedIndex() === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest('[data-player-index]');
    if (!target) return;
    const idx = Number(target.getAttribute('data-player-index'));
    if (Number.isNaN(idx) || idx === overIndex()) return;
    setOverIndex(idx);
    reorderPlayers(draggedIndex(), idx);
    setDraggedIndex(idx);
  };

  const handlePointerUp = () => {
    setDraggedIndex(null);
    setOverIndex(null);
  };

  const handleNext = () => {
    props.onUpdate('playerOrder', playerOrder());
    props.onNext();
  };

  const shufflePlayers = () => {
    const role = activeRole().key;
    const currentOrder = [...(playerOrder()[role] || [])];
    
    // Fisher-Yates shuffle algorithm
    for (let i = currentOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentOrder[i], currentOrder[j]] = [currentOrder[j], currentOrder[i]];
    }
    
    setPlayerOrder(prev => ({ ...prev, [role]: currentOrder }));
  };

  return (
    <div class="bg-[#1a1a1a] rounded-lg p-3 sm:p-6 max-w-3xl mx-auto">
      <h2 class="text-lg sm:text-xl font-bold mb-1 sm:mb-2">Player Order</h2>
      <p class="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-6">
        Arrange players within each role. They will be auctioned in this order.
      </p>

      {/* Role Tabs */}
      <div class="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
        <div class="grid grid-cols-4 gap-1.5 sm:gap-2 flex-1">
          <For each={roleList}>
            {(role) => {
              const count = () => (playerOrder()[role.key] || []).length;
              return (
                <button
                  onClick={() => setActiveRole(role)}
                  class={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
                    activeRole().key === role.key
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {role.label} ({count()})
                </button>
              );
            }}
          </For>
        </div>
        <button
          onClick={shufflePlayers}
          disabled={currentPlayers().length === 0}
          class="p-1 sm:p-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-md transition-all"
          title="Shuffle players randomly"
        >
          <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Players List */}
      <div class="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6 max-h-[50vh] overflow-y-auto select-none">
        <Show when={currentPlayers().length === 0}>
          <div class="text-center py-6 sm:py-8 text-gray-400 text-sm">
            No players in this role
          </div>
        </Show>

        <For each={currentPlayers()}>
          {(player, index) => (
            <div
              data-player-index={index()}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, index())}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index())}
              onDragEnd={handleDragEnd}
              onPointerDown={(e) => handlePointerDown(e, index())}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              class={`flex items-center justify-between p-2 sm:p-3 rounded-lg border-2 transition-all cursor-move select-none touch-none ${
                draggedIndex() === index()
                  ? 'border-purple-500 bg-purple-500/10 opacity-50'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div class="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <div class="flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gray-800 text-[10px] sm:text-xs font-bold">
                  {index() + 1}
                </div>
                <Show when={player.image} fallback={
                  <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-700 flex items-center justify-center text-[10px] sm:text-xs font-bold">
                    {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                }>
                  <img src={player.image} alt={player.name} class="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover" />
                </Show>
                <div class="min-w-0">
                  <h3 class="font-medium text-xs sm:text-sm truncate">{player.name}</h3>
                  <p class="text-[10px] sm:text-xs text-gray-400 truncate">Base: ₹{player.basePrice} Cr</p>
                </div>
              </div>

              <div class="p-1 sm:p-1.5 cursor-move text-gray-500">
                <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:justify-between">
        <button
          onClick={props.onBack}
          class="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-all"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          class="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-lg transition-all"
        >
          {props.isEditing ? 'Review & Update' : 'Review & Create'}
        </button>
      </div>
    </div>
  );
}
