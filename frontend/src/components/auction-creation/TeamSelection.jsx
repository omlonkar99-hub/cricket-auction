import { createSignal, onMount, For, Show } from 'solid-js';
import { apiCall } from '../utils/api';

export default function TeamSelection(props) {
  const [allTeams, setAllTeams] = createSignal([]);
  const [selectedTeams, setSelectedTeams] = createSignal(props.data.selectedTeams || []);
  const [loading, setLoading] = createSignal(true);
  const [errors, setErrors] = createSignal({});

  onMount(async () => {
    try {
      const res = await apiCall('/api/teams');
      const data = await res.json();
      setAllTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  });

  const toggleTeam = (teamId) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
    setErrors({});
  };

  const selectAll = () => {
    setSelectedTeams(allTeams().map(t => t.id));
  };

  const deselectAll = () => {
    setSelectedTeams([]);
  };

  const handleNext = () => {
    if (selectedTeams().length < 2) {
      setErrors({ teams: 'Select at least 2 teams' });
      return;
    }
    props.onUpdate('selectedTeams', selectedTeams());
    props.onNext();
  };

  return (
    <div class="max-w-3xl mx-auto">
      <div class="mb-6">
        <h2 class="text-xl font-bold mb-1">Select Teams</h2>
        <p class="text-sm text-gray-400">Choose participating teams</p>
      </div>

      <Show when={loading()}>
        <div class="text-center py-8">
          <div class="inline-block w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Show>

      <Show when={!loading() && allTeams().length === 0}>
        <div class="text-center py-12 border border-gray-700 rounded-lg bg-[#1a1a1a]">
          <p class="text-gray-400 mb-3">No teams available</p>
          <a href="/dashboard" class="text-sm text-purple-400 hover:text-purple-300">
            Create teams first
          </a>
        </div>
      </Show>

      <Show when={!loading() && allTeams().length > 0}>
        {/* Actions */}
        <div class="mb-4 flex items-center justify-between">
          <span class="text-sm text-gray-400">
            <span class="text-white font-medium">{selectedTeams().length}</span> selected
          </span>
          <div class="flex gap-2">
            <button
              onClick={selectAll}
              class="px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:border-gray-600 text-xs rounded-lg transition-all"
            >
              All
            </button>
            <button
              onClick={deselectAll}
              class="px-3 py-1.5 bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:border-gray-600 text-xs rounded-lg transition-all"
            >
              Clear
            </button>
          </div>
        </div>

        <Show when={errors().teams}>
          <p class="text-xs text-red-400 mb-3">{errors().teams}</p>
        </Show>

        {/* Teams Grid */}
        <div class="grid grid-cols-3 md:grid-cols-4 gap-3 mb-6">
          <For each={allTeams()}>
            {(team) => {
              const isSelected = () => selectedTeams().includes(team.id);
              return (
                <button
                  onClick={() => toggleTeam(team.id)}
                  class={`relative p-3 border rounded-lg transition-all ${
                    isSelected()
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 bg-[#1a1a1a] hover:border-gray-600'
                  }`}
                >
                  <Show when={isSelected()}>
                    <div class="absolute top-2 right-2 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                  </Show>
                  <div class="flex flex-col items-center text-center">
                    <Show when={team.logo} fallback={
                      <div class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold mb-2">
                        {team.shortName}
                      </div>
                    }>
                      <img src={team.logo} alt={team.name} class="w-10 h-10 rounded-full object-cover mb-2" />
                    </Show>
                    <h3 class="font-medium text-xs text-white truncate w-full">{team.name}</h3>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Navigation */}
      <div class="mt-6 pt-4 border-t border-gray-800">
        <div class="flex gap-2">
          <button
            onClick={props.onBack}
            class="px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:border-gray-600 text-sm rounded-lg transition-all"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            class="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-all"
          >
            Continue to Players
          </button>
        </div>
      </div>
    </div>
  );
}
