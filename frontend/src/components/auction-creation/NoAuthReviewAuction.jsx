import { createSignal, onMount, For, Show } from 'solid-js';
import { apiCall } from '../../utils/api';

export default function NoAuthReviewAuction(props) {
  const [isCreating, setIsCreating] = createSignal(false);
  const [allTeams, setAllTeams] = createSignal([]);
  const [allPlayers, setAllPlayers] = createSignal([]);

  onMount(async () => {
    try {
      const [teamsRes, playersRes] = await Promise.all([
        apiCall('/api/teams'),
        apiCall('/api/players')
      ]);
      setAllTeams(await teamsRes.json() || []);
      setAllPlayers(await playersRes.json() || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  });

  const selectedTeams = () => {
    return allTeams().filter(t => props.data.selectedTeams?.includes(t.id));
  };

  const selectedPlayers = () => {
    return allPlayers().filter(p => props.data.selectedPlayers?.includes(p.id));
  };

  const getPlayerCountByRole = (role) => {
    return selectedPlayers().filter(p => p.role === role).length;
  };

  const getRoles = () => {
    const roles = new Set(selectedPlayers().map(p => p.role));
    return Array.from(roles).sort();
  };

  const createAuction = async () => {
    setIsCreating(true);
    try {
      await props.onCreate?.();
    } catch (error) {
      console.error('Error creating auction:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <h2 class="text-xl font-bold mb-1">Review & Create Auction</h2>
        <p class="text-sm text-gray-400">Verify all details before creating</p>
      </div>

      <div class="bg-[#1a1a1a] rounded-lg p-4 space-y-4">
        {/* Basic Info */}
        <div class="border-b border-gray-800 pb-4">
          <h3 class="text-sm font-semibold mb-3">Basic Information</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Name:</span>
              <span class="font-medium">{props.data.name}</span>
            </div>
            <Show when={props.data.description}>
              <div class="flex justify-between">
                <span class="text-gray-400">Description:</span>
                <span class="font-medium">{props.data.description}</span>
              </div>
            </Show>
            <div class="flex justify-between">
              <span class="text-gray-400">Visibility:</span>
              <span class={`font-medium ${props.data.visibility === 'private' ? 'text-yellow-400' : 'text-blue-400'}`}>
                {props.data.visibility === 'private' ? '🔒 Private' : '🌐 Public'}
              </span>
            </div>
            <Show when={props.data.visibility === 'private' && props.data.accessCode}>
              <div class="flex justify-between">
                <span class="text-gray-400">Access Code:</span>
                <span class="font-medium text-purple-400">{props.data.accessCode}</span>
              </div>
            </Show>
          </div>
        </div>

        {/* Teams */}
        <div class="border-b border-gray-800 pb-4">
          <h3 class="text-sm font-semibold mb-3">
            Selected Teams ({selectedTeams().length})
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <For each={selectedTeams()}>
              {(team) => (
                <div class="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
                  <Show when={team.logo} fallback={
                    <div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {team.shortName}
                    </div>
                  }>
                    <img src={team.logo} alt={team.name} class="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  </Show>
                  <span class="text-xs font-medium truncate">{team.name}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Players by Role */}
        <div class="border-b border-gray-800 pb-4">
          <h3 class="text-sm font-semibold mb-3">
            Players by Role ({selectedPlayers().length} total)
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <For each={getRoles()}>
              {(role) => (
                <div class="bg-gray-800/30 rounded-lg p-3 text-center">
                  <p class="text-[10px] text-gray-400 mb-1">{role}</p>
                  <p class="text-2xl font-bold text-purple-400">{getPlayerCountByRole(role)}</p>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Settings */}
        <div class="pb-4">
          <h3 class="text-sm font-semibold mb-3">Auction Settings</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <p class="text-[10px] text-gray-400 mb-1">Team Budget</p>
              <p class="text-lg font-semibold">₹{props.data.budget} <span class="text-green-400 text-sm">Cr</span></p>
            </div>
            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <p class="text-[10px] text-gray-400 mb-1">Squad Size</p>
              <p class="text-lg font-semibold">{props.data.playersLimit}</p>
            </div>
            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <p class="text-[10px] text-gray-400 mb-1">Overseas</p>
              <p class="text-lg font-semibold">{props.data.overseasLimit}</p>
            </div>
            <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <p class="text-[10px] text-gray-400 mb-1">Timer</p>
              <p class="text-lg font-semibold">{props.data.timerDuration}<span class="text-sm">s</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div class="mt-6 pt-4 border-t border-gray-800 flex gap-3">
        <button
          onClick={props.onBack}
          disabled={isCreating()}
          class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={createAuction}
          disabled={isCreating()}
          class="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Show when={isCreating()} fallback={<span>Create Auction</span>}>
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Creating...</span>
          </Show>
        </button>
      </div>
    </div>
  );
}
