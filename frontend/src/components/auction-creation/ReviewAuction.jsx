import { createSignal, onMount, For, Show } from 'solid-js';
import { apiCall } from '../utils/api';

export default function ReviewAuction(props) {
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

  const createAuction = async () => {
    setIsCreating(true);
    try {
      await props.onCreate?.();
      alert(props.isEditing ? 'Auction updated successfully!' : 'Auction created successfully!');
    } catch (error) {
      console.error('Error creating auction:', error);
      alert(props.isEditing ? 'Error updating auction' : 'Error creating auction');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div class="bg-[#1a1a1a] rounded-lg p-4 md:p-6">
      <h2 class="text-lg md:text-xl font-bold mb-4">{props.isEditing ? 'Review & Update' : 'Review & Create'}</h2>

      <div class="space-y-4">
        {/* Basic Info */}
        <div class="border-b border-gray-800 pb-3">
          <h3 class="text-sm md:text-base font-semibold mb-2">Basic Information</h3>
          <div class="space-y-1.5 text-xs md:text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Type:</span>
              <span class="font-medium capitalize">{props.data.type}</span>
            </div>
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
          </div>
        </div>

        {/* Teams */}
        <div class="border-b border-gray-800 pb-3">
          <h3 class="text-sm md:text-base font-semibold mb-2">
            Teams ({selectedTeams().length})
          </h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            <For each={selectedTeams()}>
              {(team) => (
                <div class="flex items-center gap-1.5 p-1.5 bg-gray-800/50 rounded-lg">
                  <Show when={team.logo} fallback={
                    <div class="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-700 flex items-center justify-center text-[10px] md:text-xs font-bold flex-shrink-0">
                      {team.shortName}
                    </div>
                  }>
                    <img src={team.logo} alt={team.name} class="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover flex-shrink-0" />
                  </Show>
                  <span class="text-xs md:text-sm font-medium truncate min-w-0">{team.name}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Players */}
        <div class="border-b border-gray-800 pb-3">
          <h3 class="text-sm md:text-base font-semibold mb-2">
            Players ({selectedPlayers().length})
          </h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <For each={props.data.roleOrder || []}>
              {(role) => (
                <div class="bg-gray-800/50 rounded-lg p-2">
                  <p class="text-[10px] md:text-xs text-gray-400">{role}</p>
                  <p class="text-xl md:text-2xl font-bold">{getPlayerCountByRole(role)}</p>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Settings */}
        <div class="border-b border-gray-800 pb-3">
          <h3 class="text-sm md:text-base font-semibold mb-2">Auction Settings</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
            <div class="bg-gray-800/30 rounded-lg p-2">
              <p class="text-[10px] md:text-xs text-gray-400">Team Budget</p>
              <p class="text-base md:text-lg font-semibold">₹{props.data.budget} <span class="text-green-400">Cr</span></p>
            </div>
            <div class="bg-gray-800/30 rounded-lg p-2">
              <p class="text-[10px] md:text-xs text-gray-400">Squad Size</p>
              <p class="text-base md:text-lg font-semibold">{props.data.squadSize}</p>
            </div>
            <div class="bg-gray-800/30 rounded-lg p-2">
              <p class="text-[10px] md:text-xs text-gray-400">Overseas Limit</p>
              <p class="text-base md:text-lg font-semibold">{props.data.overseasLimit}</p>
            </div>
          </div>
        </div>

        {/* Role Order */}
        <div>
          <h3 class="text-sm md:text-base font-semibold mb-2">Role Order</h3>
          <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2">
            <p class="text-xs md:text-sm text-purple-300">
              {props.data.roleOrder?.join(' → ') || 'Not set'}
            </p>
          </div>
        </div>
      </div>

      <div class="flex gap-2 mt-6">
        <button
          onClick={props.onBack}
          class="flex-1 px-3 py-2.5 md:px-6 bg-gray-800 hover:bg-gray-700 text-white text-sm md:text-base font-medium rounded-lg transition-all"
        >
          Back
        </button>
        <button
          onClick={createAuction}
          disabled={isCreating()}
          class="flex-[2] px-3 py-2.5 md:px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm md:text-base font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating() ? (props.isEditing ? 'Updating...' : 'Creating...') : (props.isEditing ? 'Update Auction' : 'Create Auction')}
        </button>
      </div>
    </div>
  );
}
