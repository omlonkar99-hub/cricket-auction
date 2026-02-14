import { createSignal, onMount, For, Show } from 'solid-js';
import { apiCall } from '../../utils/api';

export default function RoleOrder(props) {
  const [roleOrder, setRoleOrder] = createSignal(props.data.roleOrder || ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']);
  const [draggedIndex, setDraggedIndex] = createSignal(null);
  const [overIndex, setOverIndex] = createSignal(null);
  const [allPlayers, setAllPlayers] = createSignal([]);
  const [playerOrder, setPlayerOrder] = createSignal(props.data.playerOrder || {});
  const [expandedRole, setExpandedRole] = createSignal(null);
  const [draggedPlayer, setDraggedPlayer] = createSignal(null);

  onMount(async () => {
    try {
      const res = await apiCall('/api/players');
      const data = await res.json();
      const players = data || [];
      setAllPlayers(players);
      const selected = props.data.selectedPlayers || [];
      const initialOrder = {};
      (props.data.roleOrder || roleOrder()).forEach(role => {
        const rolePlayers = players.filter(p => selected.includes(p.id) && p.role === role);
        const existing = (playerOrder()[role] || []).filter(id => rolePlayers.some(p => p.id === id));
        const missing = rolePlayers.map(p => p.id).filter(id => !existing.includes(id));
        initialOrder[role] = existing.concat(missing);
      });
      setPlayerOrder(initialOrder);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  });

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

    const newOrder = [...roleOrder()];
    const draggedItem = newOrder[dragIdx];
    newOrder.splice(dragIdx, 1);
    newOrder.splice(index, 0, draggedItem);

    setRoleOrder(newOrder);
    setDraggedIndex(index);
    setOverIndex(null);
  };

  const rolePlayers = (role) => {
    const selected = props.data.selectedPlayers || [];
    return allPlayers().filter(p => selected.includes(p.id) && p.role === role);
  };

  const rolePlayersInOrder = (role) => {
    const ids = playerOrder()[role] || [];
    return ids.map(id => allPlayers().find(p => p.id === id)).filter(Boolean);
  };

  const reorderPlayers = (role, from, to) => {
    if (from === null || to === null || from === to) return;
    const newOrder = [...(playerOrder()[role] || [])];
    const draggedItem = newOrder[from];
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, draggedItem);
    setPlayerOrder(prev => ({ ...prev, [role]: newOrder }));
  };

  const reorderRoles = (from, to) => {
    if (from === null || to === null || from === to) return;
    const newOrder = [...roleOrder()];
    const draggedItem = newOrder[from];
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, draggedItem);
    setRoleOrder(newOrder);
  };

  const handlePointerDown = (e, index) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedIndex(index);
  };

  const handlePointerMove = (e) => {
    if (draggedIndex() === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest('[data-role-index]');
    if (!target) return;
    const idx = Number(target.getAttribute('data-role-index'));
    if (Number.isNaN(idx) || idx === overIndex()) return;
    setOverIndex(idx);
    reorderRoles(draggedIndex(), idx);
    setDraggedIndex(idx);
  };

  const handlePointerUp = () => {
    setDraggedIndex(null);
    setOverIndex(null);
  };

  const handlePlayerDragStart = (e, role, index) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedPlayer({ role, index });
  };

  const handlePlayerDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handlePlayerDrop = (e, role, index) => {
    e.preventDefault();
    const dragIdxRaw = e.dataTransfer.getData('text/plain');
    const dragIdx = dragIdxRaw === '' ? draggedPlayer()?.index : Number(dragIdxRaw);
    if (dragIdx === null || Number.isNaN(dragIdx) || dragIdx === index) return;
    const dragRole = draggedPlayer()?.role || role;
    if (dragRole !== role) return;
    reorderPlayers(role, dragIdx, index);
    setDraggedPlayer(null);
  };

  const handlePlayerPointerDown = (e, role, index) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedPlayer({ role, index });
  };

  const handlePlayerPointerMove = (e) => {
    if (!draggedPlayer()) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest('[data-player-index]');
    if (!target) return;
    const idx = Number(target.getAttribute('data-player-index'));
    const role = target.getAttribute('data-player-role');
    if (Number.isNaN(idx) || role !== draggedPlayer().role) return;
    reorderPlayers(role, draggedPlayer().index, idx);
    setDraggedPlayer({ role, index: idx });
  };

  const handlePlayerPointerUp = () => {
    setDraggedPlayer(null);
  };

  const handleNext = () => {
    props.onUpdate('roleOrder', roleOrder());
    props.onUpdate('playerOrder', playerOrder());
    props.onNext();
  };

  return (
    <div class="bg-[#1a1a1a] rounded-lg p-3 sm:p-6 max-w-2xl mx-auto">
      <h2 class="text-lg sm:text-xl font-bold mb-1 sm:mb-2">Role Order</h2>
      <p class="text-xs sm:text-sm text-gray-400 mb-4 sm:mb-6">
        Drag to reorder. Players will be auctioned in this role order.
      </p>

      <div class="space-y-2 sm:space-y-3 mb-4 sm:mb-6 select-none">
        <For each={roleOrder()}>
          {(role, index) => (
            <div class="border border-gray-700 rounded-lg">
              <div
                data-role-index={index()}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index())}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index())}
                onDragEnd={handleDragEnd}
                onPointerDown={(e) => handlePointerDown(e, index())}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                class={`flex items-center justify-between p-2.5 sm:p-4 rounded-lg transition-all cursor-move select-none touch-none ${
                  draggedIndex() === index()
                    ? 'border-2 border-purple-500 bg-purple-500/10 opacity-50'
                    : 'border-2 border-transparent hover:border-gray-600'
                }`}
              >
                <div class="flex items-center space-x-2 sm:space-x-4">
                  <div class="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-800 text-xs sm:text-sm font-bold">
                    {index() + 1}
                  </div>
                  <div>
                    <button
                      class="font-medium text-left text-sm sm:text-base"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedRole(expandedRole() === role ? null : role);
                      }}
                    >
                      {role}
                    </button>
                    <p class="text-[10px] sm:text-xs text-gray-400">
                      {rolePlayers(role).length} players
                    </p>
                    <Show when={rolePlayers(role).length > 0}>
                      <p class="text-[10px] sm:text-[11px] text-gray-500 truncate max-w-[120px] sm:max-w-[180px]">
                        {rolePlayers(role).map(p => p.name).join(', ')}
                      </p>
                    </Show>
                  </div>
                </div>

                <div class="p-1.5 sm:p-2 cursor-move text-gray-500">
                  <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              </div>

              <Show when={expandedRole() === role}>
                <div class="border-t border-gray-700 px-2.5 sm:px-4 pb-2.5 sm:pb-4 pt-2 sm:pt-3 select-none">
                  <div class="space-y-1.5 sm:space-y-2">
                    <For each={rolePlayersInOrder(role)}>
                      {(player, pIndex) => (
                        <div
                          data-player-index={pIndex()}
                          data-player-role={role}
                          draggable={true}
                          onDragStart={(e) => handlePlayerDragStart(e, role, pIndex())}
                          onDragOver={handlePlayerDragOver}
                          onDrop={(e) => handlePlayerDrop(e, role, pIndex())}
                          onDragEnd={handleDragEnd}
                          onPointerDown={(e) => handlePlayerPointerDown(e, role, pIndex())}
                          onPointerMove={handlePlayerPointerMove}
                          onPointerUp={handlePlayerPointerUp}
                          class={`flex items-center justify-between p-2 sm:p-3 rounded-lg border-2 transition-all cursor-move select-none touch-none ${
                            draggedPlayer()?.index === pIndex() && draggedPlayer()?.role === role
                              ? 'border-purple-500 bg-purple-500/10 opacity-50'
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div class="flex items-center space-x-2 sm:space-x-3">
                            <div class="flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gray-800 text-[10px] sm:text-xs font-bold">
                              {pIndex() + 1}
                            </div>
                            <div>
                              <p class="text-xs sm:text-sm font-medium">{player.name}</p>
                              <p class="text-[10px] sm:text-xs text-gray-400">₹{player.basePrice} Cr</p>
                            </div>
                          </div>
                          <div class="p-1 sm:p-1.5 cursor-move text-gray-500">
                            <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </For>
                    <Show when={rolePlayersInOrder(role).length === 0}>
                      <div class="text-center py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                        No players in this role
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <h3 class="text-xs sm:text-sm font-medium text-purple-300 mb-1 sm:mb-2">Preview Order</h3>
        <p class="text-xs sm:text-sm text-gray-400">
          {roleOrder().join(' → ')}
        </p>
      </div>

      <div class="flex gap-2">
        <button
          onClick={props.onBack}
          class="flex-1 px-3 py-2.5 md:px-6 bg-gray-800 hover:bg-gray-700 text-white text-sm md:text-base font-medium rounded-lg transition-all"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          class="flex-[2] px-3 py-2.5 md:px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm md:text-base font-medium rounded-lg transition-all"
        >
          Continue to Player Order
        </button>
      </div>
    </div>
  );
}
