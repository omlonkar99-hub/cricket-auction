import { createSignal, Show, For, onMount } from 'solid-js';
import { apiCall } from '../utils/api';
import { shortenRole } from '../utils/roleShortener';

export default function CreateRetentionAuction(props) {
  const [currentStep, setCurrentStep] = createSignal(1);
  const [creationPath, setCreationPath] = createSignal(null); // 'past' or 'fresh'
  
  // Form data
  const [formData, setFormData] = createSignal({
    name: '',
    description: '',
    sourceAuctionId: null,
    budget: 100,
    maxPlayers: 25,
    maxOverseas: 8,
    timerDuration: 10,
    maxRetentions: 6,
    maxOverseasRetention: 4,
    retentionSlots: [
      { slot: 1, price: 18 },
      { slot: 2, price: 14 },
      { slot: 3, price: 11 },
      { slot: 4, price: 8 },
      { slot: 5, price: 6 },
      { slot: 6, price: 4 }
    ],
    preAssignedSquads: [],
    generalPoolPlayers: [],
    windowDuration: 24,
    selectedTeams: []
  });

  // Data
  const [completedAuctions, setCompletedAuctions] = createSignal([]);
  const [allTeams, setAllTeams] = createSignal([]);
  const [allPlayers, setAllPlayers] = createSignal([]);
  const [selectedAuctionData, setSelectedAuctionData] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(() => {
    fetchData();
  });

  const fetchData = async () => {
    try {
      const [auctionsRes, teamsRes, playersRes] = await Promise.all([
        apiCall('/api/auctions?status=completed'),
        apiCall('/api/teams'),
        apiCall('/api/players')
      ]);

      const auctions = await auctionsRes.json();
      setCompletedAuctions(auctions.filter(a => a.status === 'completed') || []);
      setAllTeams(await teamsRes.json() || []);
      setAllPlayers(await playersRes.json() || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    }
  };

  const updateFormData = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => prev + 1);
      setError('');
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
    setError('');
  };

  const validateCurrentStep = () => {
    const data = formData();
    
    switch (currentStep()) {
      case 1:
        if (!creationPath()) {
          setError('Please select a creation path');
          return false;
        }
        return true;
      
      case 2:
        if (creationPath() === 'past') {
          if (!data.sourceAuctionId) {
            setError('Please select a past auction');
            return false;
          }
        } else {
          if (!data.name.trim()) {
            setError('Please enter auction name');
            return false;
          }
          if (data.selectedTeams.length === 0) {
            setError('Please select at least one team');
            return false;
          }
        }
        return true;
      
      case 3:
        if (!data.name.trim()) {
          setError('Please enter auction name');
          return false;
        }
        if (data.maxRetentions <= 0 || data.maxRetentions > 10) {
          setError('Max retentions must be between 1 and 10');
          return false;
        }
        return true;
      
      case 4:
        if (creationPath() === 'fresh') {
          // Validate squad assignments
          const totalAssigned = data.preAssignedSquads.reduce((sum, squad) => sum + squad.playerIds.length, 0);
          if (totalAssigned === 0) {
            setError('Please assign at least one player to teams');
            return false;
          }
        }
        return true;
      
      case 5:
        if (data.windowDuration <= 0) {
          setError('Window duration must be greater than 0');
          return false;
        }
        return true;
      
      default:
        return true;
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData(),
        sourceAuctionId: creationPath() === 'past' ? formData().sourceAuctionId : null
      };

      const res = await apiCall('/api/retention-auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create retention auction');
      }

      const created = await res.json();
      alert('Retention auction created successfully!');
      props.onBack();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTotalSteps = () => {
    return creationPath() === 'past' ? 5 : 6;
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white pb-20">
      {/* Header */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1280px] mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button onClick={props.onBack} class="p-2 hover:bg-gray-800 rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 class="text-lg font-bold">Create Retention Auction</h1>
              <p class="text-xs text-gray-400">
                Step {currentStep()} of {getTotalSteps()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div class="bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1280px] mx-auto px-4 py-2">
          <div class="flex items-center gap-2">
            <For each={Array.from({ length: getTotalSteps() }, (_, i) => i + 1)}>
              {(step) => (
                <>
                  <div class={`flex-1 h-1 rounded-full transition-colors ${
                    step <= currentStep() ? 'bg-emerald-500' : 'bg-gray-700'
                  }`} />
                  {step < getTotalSteps() && <div class="w-1" />}
                </>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-[1280px] mx-auto p-4">
        <Show when={error()}>
          <div class="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p class="text-sm text-red-400">{error()}</p>
          </div>
        </Show>

        {/* Step 1: Choose Path */}
        <Show when={currentStep() === 1}>
          <Step1ChoosePath
            creationPath={creationPath}
            setCreationPath={setCreationPath}
          />
        </Show>

        {/* Step 2: Past Auction Selection OR Team Creation */}
        <Show when={currentStep() === 2}>
          <Show when={creationPath() === 'past'} fallback={
            <Step2bTeamCreation
              formData={formData}
              updateFormData={updateFormData}
              allTeams={allTeams}
            />
          }>
            <Step2aPastAuctionSelection
              formData={formData}
              updateFormData={updateFormData}
              completedAuctions={completedAuctions}
              setSelectedAuctionData={setSelectedAuctionData}
            />
          </Show>
        </Show>

        {/* Step 3: Define Rules */}
        <Show when={currentStep() === 3}>
          <Step3DefineRules
            formData={formData}
            updateFormData={updateFormData}
            creationPath={creationPath}
          />
        </Show>

        {/* Step 4: Squad Assignment (Fresh) OR Player Pool (Past) */}
        <Show when={currentStep() === 4}>
          <Show when={creationPath() === 'fresh'} fallback={
            <Step4aPlayerPool
              formData={formData}
              updateFormData={updateFormData}
              allPlayers={allPlayers}
              selectedAuctionData={selectedAuctionData}
            />
          }>
            <Step4bSquadAssignment
              formData={formData}
              updateFormData={updateFormData}
              allPlayers={allPlayers}
              allTeams={allTeams}
            />
          </Show>
        </Show>

        {/* Step 5: Window Settings (Past) OR General Pool (Fresh) */}
        <Show when={currentStep() === 5}>
          <Show when={creationPath() === 'past'} fallback={
            <Step5bGeneralPool
              formData={formData}
              updateFormData={updateFormData}
              allPlayers={allPlayers}
            />
          }>
            <Step5aWindowSettings
              formData={formData}
              updateFormData={updateFormData}
            />
          </Show>
        </Show>

        {/* Step 6: Window Settings (Fresh only) */}
        <Show when={currentStep() === 6 && creationPath() === 'fresh'}>
          <Step5aWindowSettings
            formData={formData}
            updateFormData={updateFormData}
          />
        </Show>

        {/* Navigation Buttons */}
        <div class="mt-6 flex gap-3">
          <Show when={currentStep() > 1}>
            <button
              onClick={handleBack}
              class="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
          </Show>
          
          <Show when={currentStep() < getTotalSteps()} fallback={
            <button
              onClick={handleCreate}
              disabled={loading()}
              class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg font-semibold transition-colors"
            >
              {loading() ? 'Creating...' : 'Create Retention Auction'}
            </button>
          }>
            <button
              onClick={handleNext}
              class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors"
            >
              Next
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}

// Step Components
function Step1ChoosePath(props) {
  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold mb-2">Choose Creation Path</h2>
        <p class="text-sm text-gray-400">How would you like to create the retention auction?</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => props.setCreationPath('past')}
          class={`p-6 rounded-xl border-2 transition-all text-left ${
            props.creationPath() === 'past'
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-gray-800 bg-[#1a1a1a] hover:border-gray-700'
          }`}
        >
          <div class="flex items-start gap-3">
            <div class={`p-3 rounded-lg ${
              props.creationPath() === 'past' ? 'bg-emerald-500/20' : 'bg-gray-800'
            }`}>
              <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="font-bold mb-1">Use Past Auction</h3>
              <p class="text-sm text-gray-400">
                Import teams and squads from a completed auction automatically
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => props.setCreationPath('fresh')}
          class={`p-6 rounded-xl border-2 transition-all text-left ${
            props.creationPath() === 'fresh'
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-gray-800 bg-[#1a1a1a] hover:border-gray-700'
          }`}
        >
          <div class="flex items-start gap-3">
            <div class={`p-3 rounded-lg ${
              props.creationPath() === 'fresh' ? 'bg-emerald-500/20' : 'bg-gray-800'
            }`}>
              <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="font-bold mb-1">Fresh Start</h3>
              <p class="text-sm text-gray-400">
                Manually create teams and assign players for retention
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function Step2aPastAuctionSelection(props) {
  const handleSelectAuction = async (auctionId) => {
    props.updateFormData('sourceAuctionId', auctionId);
    
    // Fetch auction details
    try {
      const res = await apiCall(`/api/auctions/${auctionId}/results`);
      const data = await res.json();
      props.setSelectedAuctionData(data);
      
      // Auto-fill form data
      props.updateFormData('name', data.name + ' - Retention');
      props.updateFormData('selectedTeams', data.teams.map(t => t.id));
      props.updateFormData('budget', data.budget || 100);
      props.updateFormData('maxPlayers', data.playersLimit || 25);
      props.updateFormData('maxOverseas', data.overseasLimit || 8);
    } catch (err) {
      console.error('Error fetching auction:', err);
    }
  };

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold mb-2">Select Past Auction</h2>
        <p class="text-sm text-gray-400">Choose a completed auction to use as base</p>
      </div>

      <div class="space-y-3">
        <Show when={props.completedAuctions().length === 0}>
          <div class="text-center py-8 text-gray-500">
            No completed auctions found
          </div>
        </Show>

        <For each={props.completedAuctions()}>
          {(auction) => (
            <button
              onClick={() => handleSelectAuction(auction.id)}
              class={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                props.formData().sourceAuctionId === auction.id
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-gray-800 bg-[#1a1a1a] hover:border-gray-700'
              }`}
            >
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-bold">{auction.name}</h3>
                  <p class="text-sm text-gray-400">
                    {auction.teams?.length || 0} teams • {auction.players?.length || 0} players
                  </p>
                </div>
                <Show when={props.formData().sourceAuctionId === auction.id}>
                  <svg class="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                </Show>
              </div>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

// Due to length, I'll create the remaining step components in separate messages
// This establishes the structure and first two steps

function Step2bTeamCreation(props) {
  const toggleTeam = (teamId) => {
    const current = props.formData().selectedTeams;
    const updated = current.includes(teamId)
      ? current.filter(id => id !== teamId)
      : [...current, teamId];
    props.updateFormData('selectedTeams', updated);
  };

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold mb-2">Select Teams</h2>
        <p class="text-sm text-gray-400">Choose teams for the retention auction</p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium mb-1">Auction Name</label>
        <input
          type="text"
          value={props.formData().name}
          onInput={(e) => props.updateFormData('name', e.target.value)}
          placeholder="Enter auction name"
          class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div class="space-y-3">
        <label class="block text-sm font-medium">Teams</label>
        <For each={props.allTeams()}>
          {(team) => (
            <button
              onClick={() => toggleTeam(team.id)}
              class={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                props.formData().selectedTeams.includes(team.id)
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-gray-800 bg-[#1a1a1a] hover:border-gray-700'
              }`}
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Show when={team.logo}>
                    <img src={team.logo} alt={team.name} class="w-10 h-10 rounded-lg object-cover" />
                  </Show>
                  <div>
                    <h3 class="font-bold">{team.name}</h3>
                    <p class="text-sm text-gray-400">{team.shortName}</p>
                  </div>
                </div>
                <Show when={props.formData().selectedTeams.includes(team.id)}>
                  <svg class="w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                </Show>
              </div>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

function Step3DefineRules(props) {
  const updateSlot = (index, field, value) => {
    const slots = [...props.formData().retentionSlots];
    slots[index][field] = parseFloat(value) || 0;
    props.updateFormData('retentionSlots', slots);
  };

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold mb-2">Define Rules</h2>
        <p class="text-sm text-gray-400">Set budget, limits, and retention settings</p>
      </div>

      <Show when={props.creationPath() === 'fresh'}>
        <div class="space-y-2">
          <label class="block text-sm font-medium mb-1">Auction Name</label>
          <input
            type="text"
            value={props.formData().name}
            onInput={(e) => props.updateFormData('name', e.target.value)}
            placeholder="Enter auction name"
            class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>
      </Show>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium">Total Budget (Cr)</label>
          <input
            type="number"
            value={props.formData().budget}
            onInput={(e) => props.updateFormData('budget', parseFloat(e.target.value) || 0)}
            class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium">Timer Duration (sec)</label>
          <input
            type="number"
            value={props.formData().timerDuration}
            onInput={(e) => props.updateFormData('timerDuration', parseInt(e.target.value) || 0)}
            class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium">Max Players</label>
          <input
            type="number"
            value={props.formData().maxPlayers}
            onInput={(e) => props.updateFormData('maxPlayers', parseInt(e.target.value) || 0)}
            class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium">Max Overseas</label>
          <input
            type="number"
            value={props.formData().maxOverseas}
            onInput={(e) => props.updateFormData('maxOverseas', parseInt(e.target.value) || 0)}
            class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="space-y-2 col-span-2">
          <label class="block text-sm font-medium">Max Retentions</label>
          <input
            type="number"
            value={props.formData().maxRetentions}
            onInput={(e) => props.updateFormData('maxRetentions', parseInt(e.target.value) || 0)}
            class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div class="space-y-2 col-span-2">
          <label class="block text-sm font-medium">Max Overseas in Retention</label>
          <input
            type="number"
            value={props.formData().maxOverseasRetention}
            onInput={(e) => props.updateFormData('maxOverseasRetention', parseInt(e.target.value) || 0)}
            placeholder="Maximum overseas players that can be retained"
            class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
          />
          <p class="text-xs text-gray-500">Teams cannot retain more than this many overseas players</p>
        </div>
      </div>

      <div class="space-y-3">
        <label class="block text-sm font-medium">Retention Price Slabs</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <For each={props.formData().retentionSlots}>
            {(slot, index) => (
              <div class="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-gray-800">
                <span class="text-sm font-medium w-16">Slot {slot.slot}</span>
                <input
                  type="number"
                  value={slot.price}
                  onInput={(e) => updateSlot(index(), 'price', e.target.value)}
                  placeholder="Price"
                  class="flex-1 px-3 py-2 bg-[#0f0f0f] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
                />
                <span class="text-sm text-gray-400">Cr</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function Step4aPlayerPool(props) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedNewPlayers, setSelectedNewPlayers] = createSignal([]);

  const existingPlayerIds = () => {
    if (!props.selectedAuctionData()) return [];
    return props.selectedAuctionData().players?.map(p => p.id) || [];
  };

  const availablePlayers = () => {
    const existing = existingPlayerIds();
    return props.allPlayers().filter(p => !existing.includes(p.id));
  };

  const filteredPlayers = () => {
    const query = searchQuery().toLowerCase();
    return availablePlayers().filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.role.toLowerCase().includes(query)
    );
  };

  const togglePlayer = (playerId) => {
    const current = selectedNewPlayers();
    const updated = current.includes(playerId)
      ? current.filter(id => id !== playerId)
      : [...current, playerId];
    setSelectedNewPlayers(updated);
    props.updateFormData('generalPoolPlayers', updated);
  };

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold mb-2">Manage Player Pool</h2>
        <p class="text-sm text-gray-400">Add new players to the auction pool</p>
      </div>

      <Show when={props.selectedAuctionData()}>
        <div class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p class="text-sm text-blue-400">
            <svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            {existingPlayerIds().length} players from past auction will be included
          </p>
        </div>
      </Show>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Add New Players</label>
        <input
          type="text"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.target.value)}
          placeholder="Search players..."
          class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div class="space-y-2 max-h-96 overflow-y-auto">
        <For each={filteredPlayers()}>
          {(player) => (
            <button
              onClick={() => togglePlayer(player.id)}
              class={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                selectedNewPlayers().includes(player.id)
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-gray-800 bg-[#1a1a1a] hover:border-gray-700'
              }`}
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Show when={player.image}>
                    <img src={player.image} alt={player.name} class="w-10 h-10 rounded-full object-cover" />
                  </Show>
                  <div>
                    <h3 class="font-medium">{player.name}</h3>
                    <p class="text-sm text-gray-400">{shortenRole(player.role)} • {player.isOverseas ? 'Overseas' : 'Local'}</p>
                  </div>
                </div>
                <Show when={selectedNewPlayers().includes(player.id)}>
                  <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                </Show>
              </div>
            </button>
          )}
        </For>
      </div>

      <div class="p-3 bg-[#1a1a1a] rounded-lg border border-gray-800">
        <p class="text-sm text-gray-400">
          Selected: {selectedNewPlayers().length} new players
        </p>
      </div>
    </div>
  );
}

function Step4bSquadAssignment(props) {
  const [selectedTeamId, setSelectedTeamId] = createSignal(null);
  const [searchQuery, setSearchQuery] = createSignal('');

  const selectedTeams = () => {
    return props.allTeams().filter(t => props.formData().selectedTeams.includes(t.id));
  };

  const getTeamSquad = (teamId) => {
    const squad = props.formData().preAssignedSquads.find(s => String(s.teamId) === String(teamId));
    return squad ? squad.playerIds : [];
  };

  const getTeamPlayers = (teamId) => {
    const playerIds = getTeamSquad(teamId);
    return props.allPlayers().filter(p => playerIds.includes(p.id));
  };

  const availablePlayers = () => {
    const assignedIds = props.formData().preAssignedSquads.flatMap(s => s.playerIds);
    const query = searchQuery().toLowerCase();
    return props.allPlayers().filter(p => 
      !assignedIds.includes(p.id) &&
      (p.name.toLowerCase().includes(query) || p.role.toLowerCase().includes(query))
    );
  };

  const assignPlayer = (playerId) => {
    if (!selectedTeamId()) return;
    
    const squads = [...props.formData().preAssignedSquads];
    const squadIndex = squads.findIndex(s => String(s.teamId) === String(selectedTeamId()));
    
    if (squadIndex >= 0) {
      squads[squadIndex].playerIds.push(playerId);
    } else {
      squads.push({ teamId: selectedTeamId(), playerIds: [playerId] });
    }
    
    props.updateFormData('preAssignedSquads', squads);
  };

  const removePlayer = (teamId, playerId) => {
    const squads = [...props.formData().preAssignedSquads];
    const squadIndex = squads.findIndex(s => String(s.teamId) === String(teamId));
    
    if (squadIndex >= 0) {
      squads[squadIndex].playerIds = squads[squadIndex].playerIds.filter(id => id !== playerId);
      props.updateFormData('preAssignedSquads', squads);
    }
  };

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold mb-2">Assign Players to Teams</h2>
        <p class="text-sm text-gray-400">Manually assign players to each team's squad</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-3">
          <label class="block text-sm font-medium">Teams</label>
          <For each={selectedTeams()}>
            {(team) => (
              <button
                onClick={() => setSelectedTeamId(team.id)}
                class={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                  selectedTeamId() === team.id
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-800 bg-[#1a1a1a] hover:border-gray-700'
                }`}
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Show when={team.logo}>
                      <img src={team.logo} alt={team.name} class="w-8 h-8 rounded object-cover" />
                    </Show>
                    <span class="font-medium">{team.name}</span>
                  </div>
                  <span class="text-sm text-gray-400">{getTeamSquad(team.id).length} players</span>
                </div>
              </button>
            )}
          </For>
        </div>

        <div class="space-y-3">
          <Show when={selectedTeamId()} fallback={
            <div class="text-center py-8 text-gray-500">
              Select a team to assign players
            </div>
          }>
            <div class="space-y-2">
              <label class="block text-sm font-medium">
                {selectedTeams().find(t => t.id === selectedTeamId())?.name} Squad
              </label>
              
              <div class="space-y-2 max-h-48 overflow-y-auto">
                <For each={getTeamPlayers(selectedTeamId())}>
                  {(player) => (
                    <div class="flex items-center justify-between p-2 bg-[#1a1a1a] rounded-lg border border-gray-800">
                      <div class="flex items-center gap-2">
                        <Show when={player.image}>
                          <img src={player.image} alt={player.name} class="w-8 h-8 rounded-full object-cover" />
                        </Show>
                        <div>
                          <p class="text-sm font-medium">{player.name}</p>
                          <p class="text-xs text-gray-400">{shortenRole(player.role)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removePlayer(selectedTeamId(), player.id)}
                        class="p-1 hover:bg-red-500/20 rounded text-red-400"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
              </div>

              <div class="space-y-2">
                <input
                  type="text"
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search available players..."
                  class="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
                />
                
                <div class="space-y-1 max-h-64 overflow-y-auto">
                  <For each={availablePlayers()}>
                    {(player) => (
                      <button
                        onClick={() => assignPlayer(player.id)}
                        class="w-full p-2 rounded-lg border border-gray-800 bg-[#1a1a1a] hover:border-emerald-500 transition-all text-left"
                      >
                        <div class="flex items-center gap-2">
                          <Show when={player.image}>
                            <img src={player.image} alt={player.name} class="w-8 h-8 rounded-full object-cover" />
                          </Show>
                          <div>
                            <p class="text-sm font-medium">{player.name}</p>
                            <p class="text-xs text-gray-400">{shortenRole(player.role)} • {player.isOverseas ? 'Overseas' : 'Local'}</p>
                          </div>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

function Step5aWindowSettings(props) {
  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold mb-2">Retention Window Settings</h2>
        <p class="text-sm text-gray-400">Set how long teams have to make retention decisions</p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium">Window Duration (hours)</label>
        <input
          type="number"
          value={props.formData().windowDuration}
          onInput={(e) => props.updateFormData('windowDuration', parseInt(e.target.value) || 0)}
          class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
        />
        <p class="text-xs text-gray-400">
          Teams will have {props.formData().windowDuration} hours to submit their retention choices
        </p>
      </div>

      <div class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-2">
        <h3 class="font-medium text-blue-400">Summary</h3>
        <div class="space-y-1 text-sm text-gray-300">
          <p>• Budget: ₹{props.formData().budget} Cr per team</p>
          <p>• Max Retentions: {props.formData().maxRetentions} players</p>
          <p>• Max Overseas: {props.formData().maxOverseas} players</p>
          <p>• Window Duration: {props.formData().windowDuration} hours</p>
        </div>
      </div>
    </div>
  );
}

function Step5bGeneralPool(props) {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [filterRole, setFilterRole] = createSignal('all');

  const roles = [
    { key: 'Batsman', label: 'Bat' },
    { key: 'Bowler', label: 'Bowl' },
    { key: 'All-rounder', label: 'AR' },
    { key: 'Wicket-keeper', label: 'WK' },
  ];

  const assignedPlayerIds = () => {
    return props.formData().preAssignedSquads.flatMap(s => s.playerIds);
  };

  const availablePlayers = () => {
    const assigned = assignedPlayerIds();
    const query = searchQuery().toLowerCase();
    let filtered = props.allPlayers().filter(p => 
      !assigned.includes(p.id) &&
      (p.name.toLowerCase().includes(query) || p.role.toLowerCase().includes(query))
    );
    
    if (filterRole() !== 'all') {
      filtered = filtered.filter(p => p.role === filterRole());
    }
    
    return filtered;
  };

  const togglePlayer = (playerId) => {
    const current = props.formData().generalPoolPlayers;
    const updated = current.includes(playerId)
      ? current.filter(id => id !== playerId)
      : [...current, playerId];
    props.updateFormData('generalPoolPlayers', updated);
  };

  const selectAll = () => {
    const filtered = availablePlayers();
    const allIds = filtered.map(p => p.id);
    const current = props.formData().generalPoolPlayers;
    const newSet = new Set([...current, ...allIds]);
    props.updateFormData('generalPoolPlayers', Array.from(newSet));
  };

  const deselectAll = () => {
    const filtered = availablePlayers();
    const filterIds = new Set(filtered.map(p => p.id));
    const current = props.formData().generalPoolPlayers;
    const updated = current.filter(id => !filterIds.has(id));
    props.updateFormData('generalPoolPlayers', updated);
  };

  return (
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold mb-2">General Pool Players</h2>
        <p class="text-sm text-gray-400">Select players for the general pool (not assigned to any team)</p>
      </div>

      <div class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p class="text-sm text-blue-400">
          <svg class="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          These players will only appear in the live auction phase
        </p>
      </div>

      {/* Role Filter Tabs */}
      <div class="mb-4">
        <div class="mb-2">
          <button
            onClick={() => setFilterRole('all')}
            class={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
              filterRole() === 'all'
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All ({props.allPlayers().filter(p => !assignedPlayerIds().includes(p.id)).length})
          </button>
        </div>
        <div class="grid grid-cols-4 gap-1.5">
          <For each={roles}>
            {(role) => {
              const count = () => props.allPlayers().filter(p => p.role === role.key && !assignedPlayerIds().includes(p.id)).length;
              return (
                <button
                  onClick={() => setFilterRole(role.key)}
                  class={`px-2 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                    filterRole() === role.key
                      ? 'bg-emerald-500 text-white'
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

      <div class="space-y-2">
        <input
          type="text"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.target.value)}
          placeholder="Search players..."
          class="w-full px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div class="space-y-2 max-h-96 overflow-y-auto">
        <For each={availablePlayers()}>
          {(player) => (
            <button
              onClick={() => togglePlayer(player.id)}
              class={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                props.formData().generalPoolPlayers.includes(player.id)
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-gray-800 bg-[#1a1a1a] hover:border-gray-700'
              }`}
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <Show when={player.image}>
                    <img src={player.image} alt={player.name} class="w-10 h-10 rounded-full object-cover" />
                  </Show>
                  <div>
                    <h3 class="font-medium">{player.name}</h3>
                    <p class="text-sm text-gray-400">{shortenRole(player.role)} • {player.isOverseas ? 'Overseas' : 'Local'}</p>
                  </div>
                </div>
                <Show when={props.formData().generalPoolPlayers.includes(player.id)}>
                  <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                </Show>
              </div>
            </button>
          )}
        </For>
      </div>

      <div class="p-3 bg-[#1a1a1a] rounded-lg border border-gray-800">
        <p class="text-sm text-gray-400">
          Selected: {props.formData().generalPoolPlayers.length} players in general pool
        </p>
      </div>
    </div>
  );
}
