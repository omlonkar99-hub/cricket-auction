import { createSignal, onMount, For, Show } from 'solid-js';
import { apiCall } from '../../utils/api';

export default function PlayerSelection(props) {
  const [allPlayers, setAllPlayers] = createSignal([]);
  const [selectedPlayers, setSelectedPlayers] = createSignal(props.data.selectedPlayers || []);
  const [filterRole, setFilterRole] = createSignal('all');
  const [loading, setLoading] = createSignal(true);
  const [errors, setErrors] = createSignal({});

  const roles = [
    { key: 'Batsman', label: 'Bat' },
    { key: 'Bowler', label: 'Bowl' },
    { key: 'All-rounder', label: 'AR' },
    { key: 'Wicket-keeper', label: 'WK' },
  ];

  onMount(async () => {
    try {
      const res = await apiCall('/api/players');
      const data = await res.json();
      setAllPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  });

  const filteredPlayers = () => {
    if (filterRole() === 'all') return allPlayers();
    return allPlayers().filter(p => p.role === filterRole());
  };

  const togglePlayer = (playerId) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
    setErrors({});
  };

  const selectAll = () => {
    const filtered = filteredPlayers();
    const allIds = filtered.map(p => p.id);
    setSelectedPlayers(prev => {
      const newSet = new Set([...prev, ...allIds]);
      return Array.from(newSet);
    });
  };

  const deselectAll = () => {
    const filtered = filteredPlayers();
    const filterIds = new Set(filtered.map(p => p.id));
    setSelectedPlayers(prev => prev.filter(id => !filterIds.has(id)));
  };

  const handleNext = () => {
    if (selectedPlayers().length === 0) {
      setErrors({ players: 'Select at least 1 player' });
      return;
    }
    props.onUpdate('selectedPlayers', selectedPlayers());
    props.onNext();
  };

  return (
    <div class="bg-[#1a1a1a] rounded-lg p-6">
      <h2 class="text-xl font-bold mb-6">Select Players</h2>

      <Show when={loading()}>
        <div class="text-center py-8 text-gray-400">Loading players...</div>
      </Show>

      <Show when={!loading() && allPlayers().length === 0}>
        <div class="text-center py-8">
          <p class="text-gray-400 mb-4">No players available. Create players first.</p>
          <a href="/dashboard" class="text-purple-400 hover:text-purple-300">
            Go to Dashboard
          </a>
        </div>
      </Show>

      <Show when={!loading() && allPlayers().length > 0}>
        {/* Filter Tabs */}
        <div class="mb-4">
          <div class="mb-2">
            <button
              onClick={() => setFilterRole('all')}
              class={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                filterRole() === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              All ({allPlayers().length})
            </button>
          </div>
          <div class="grid grid-cols-4 gap-1.5">
            <For each={roles}>
              {(role) => {
                const count = () => allPlayers().filter(p => p.role === role.key).length;
                return (
                  <button
                    onClick={() => setFilterRole(role.key)}
                    class={`px-2 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                      filterRole() === role.key
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
        </div>

        {/* Bulk Actions */}
        <div class="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={selectAll}
            class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-all"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            class="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-all"
          >
            Deselect All
          </button>
        </div>

        {/* Responsive Players List: full-width cards on mobile, grid on larger screens */}
        <div class="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
          <For each={filteredPlayers()}>
            {(player) => {
              const isSelected = () => selectedPlayers().includes(player.id);
              return (
                <button
                  onClick={() => togglePlayer(player.id)}
                  class={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected()
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div class="flex items-start space-x-2">
                    <Show when={player.image} fallback={
                      <div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    }>
                      <img src={player.image} alt={player.name} class="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    </Show>
                    <div class="flex-1 min-w-0">
                      <h3 class="font-medium text-sm truncate">{player.name}</h3>
                      <p class="text-xs text-gray-400">{player.role}</p>
                      <p class="text-xs text-green-400">₹{player.basePrice} Cr</p>
                    </div>
                    <Show when={isSelected()}>
                      <svg class="w-4 h-4 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </Show>
                  </div>
                </button>
              );
            }}
          </For>
        </div>

        <Show when={errors().players}>
          <p class="text-sm text-red-500 mb-4">{errors().players}</p>
        </Show>

        <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-6">
          <p class="text-sm text-purple-300">
            {selectedPlayers().length} player{selectedPlayers().length !== 1 ? 's' : ''} selected
          </p>
        </div>
      </Show>

      <div class="flex flex-col gap-3 mt-6 sm:flex-row sm:justify-between">
        <button
          onClick={props.onBack}
          class="w-full sm:w-auto px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          class="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-lg transition-all"
        >
          Continue to Role Order
        </button>
      </div>
    </div>
  );
}
