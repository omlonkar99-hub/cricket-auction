import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';

export default function RetentionWindow(props) {
  const [auction, setAuction] = createSignal(null);
  const [assignedPlayers, setAssignedPlayers] = createSignal([]);
  const [choices, setChoices] = createSignal({});
  const [showSlotModal, setShowSlotModal] = createSignal(false);
  const [selectedPlayer, setSelectedPlayer] = createSignal(null);
  const [timeRemaining, setTimeRemaining] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);

  onMount(() => {
    fetchData();
    const interval = setInterval(updateTimer, 1000);
    onCleanup(() => clearInterval(interval));
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!props.teamId) {
        setError('No team assigned. Please contact admin.');
        setLoading(false);
        return;
      }

      const [auctionRes, playersRes] = await Promise.all([
        fetch(`/api/retention-auctions/${props.auctionId}`),
        fetch(`/api/retention-auctions/${props.auctionId}/team/${props.teamId}/players`)
      ]);

      if (!auctionRes.ok || !playersRes.ok) {
        console.error('Failed to fetch - auction:', auctionRes.status, 'players:', playersRes.status);
        throw new Error('Failed to fetch data');
      }

      const auctionData = await auctionRes.json();
      const playersData = await playersRes.json();

      setAuction(auctionData);
      setAssignedPlayers(playersData || []);

      // Show helpful message if no players
      if (!playersData || playersData.length === 0) {
        setError('No players assigned to your team for this retention auction. Please contact the admin.');
      }

      // Initialize choices
      const initialChoices = {};
      if (playersData && Array.isArray(playersData)) {
        playersData.forEach(player => {
          initialChoices[player.id] = { action: 'release', slot: null, price: 0 };
        });
      }
      setChoices(initialChoices);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load team data. Please try again.');
      setLoading(false);
    }
  };

  const updateTimer = () => {
    const auc = auction();
    if (!auc || !auc.windowEndTime) return;

    const end = new Date(auc.windowEndTime);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) {
      setTimeRemaining('Window Closed');
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (hours > 0) {
      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    } else if (minutes > 0) {
      setTimeRemaining(`${minutes}m ${seconds}s`);
    } else {
      setTimeRemaining(`${seconds}s`);
    }
  };

  const handleRetain = (player) => {
    setSelectedPlayer(player);
    setShowSlotModal(true);
  };

  const handleRelease = (playerId) => {
    setChoices(prev => ({
      ...prev,
      [playerId]: { action: 'release', slot: null, price: 0 }
    }));
  };

  const selectSlot = (slot) => {
    const player = selectedPlayer();
    if (!player) return;

    setChoices(prev => ({
      ...prev,
      [player.id]: {
        action: 'retain',
        slot: slot.slot,
        price: slot.price
      }
    }));

    setShowSlotModal(false);
    setSelectedPlayer(null);
  };

  const getRetainedCount = () => {
    return Object.values(choices()).filter(c => c.action === 'retain').length;
  };

  const getOverseasCount = () => {
    const players = assignedPlayers();
    if (!players) return 0;
    return players.filter(p => 
      choices()[p.id]?.action === 'retain' && p.isOverseas
    ).length;
  };

  const getTotalCost = () => {
    return Object.values(choices()).reduce((sum, c) => sum + (c.price || 0), 0);
  };

  const getRemainingBudget = () => {
    const auc = auction();
    if (!auc) return 0;
    return auc.budget - getTotalCost();
  };

  const canSubmit = () => {
    const auc = auction();
    if (!auc) return false;

    const retainedCount = getRetainedCount();
    const overseasCount = getOverseasCount();
    const totalCost = getTotalCost();

    return (
      retainedCount <= auc.maxRetentions &&
      overseasCount <= (auc.maxOverseasRetention || auc.maxOverseas) &&
      totalCost <= auc.budget
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      setError('Invalid retention choices. Please check the limits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const choicesArray = Object.entries(choices()).map(([playerId, choice]) => ({
        playerId: parseInt(playerId),
        action: choice.action,
        slot: choice.slot || 0,
        price: choice.price || 0
      }));

      const res = await fetch('/api/retention-auctions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: props.auctionId,
          teamId: props.teamId,
          choices: choicesArray
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit');
      }

      setSubmitted(true);
      alert('Retention choices submitted successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white pb-20">
      {/* Header */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1280px] mx-auto px-4 py-2">
          <div class="flex items-center justify-between gap-4">
            <button
              onClick={props.onBack}
              class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
            >
              ← Back
            </button>
            <div class="flex-1 min-w-0 text-center">
              <h1 class="text-base font-bold truncate">Retention Window</h1>
              <Show when={auction()}>
                <p class="text-xs text-gray-400 truncate">{auction().name}</p>
              </Show>
            </div>
            <div class="text-center px-3 border-l border-gray-700">
              <p class="text-xs text-gray-400">Time Left</p>
              <p class="text-sm font-bold text-emerald-400">{timeRemaining()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Summary */}
      <div class="bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1280px] mx-auto px-4 py-3">
          <div class="grid grid-cols-4 gap-3">
            <div class="space-y-0.5">
              <p class="text-xs text-gray-400">Retained</p>
              <p class={`text-lg font-bold ${
                getRetainedCount() > auction()?.maxRetentions ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {getRetainedCount()} / {auction()?.maxRetentions}
              </p>
            </div>
            <div class="space-y-0.5">
              <p class="text-xs text-gray-400">Overseas</p>
              <p class={`text-lg font-bold ${
                getOverseasCount() > auction()?.maxOverseasRetention ? 'text-red-400' : 'text-blue-400'
              }`}>
                {getOverseasCount()} / {auction()?.maxOverseasRetention || auction()?.maxOverseas}
              </p>
            </div>
            <div class="space-y-0.5">
              <p class="text-xs text-gray-400">Cost</p>
              <p class="text-lg font-bold text-yellow-400">₹{getTotalCost().toFixed(1)}</p>
            </div>
            <div class="space-y-0.5">
              <p class="text-xs text-gray-400">Remaining</p>
              <p class={`text-lg font-bold ${
                getRemainingBudget() < 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                ₹{getRemainingBudget().toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-[1280px] mx-auto p-4 space-y-4">
        <Show when={error()}>
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p class="text-sm text-red-400">{error()}</p>
          </div>
        </Show>

        <Show when={submitted()}>
          <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
            <svg class="w-12 h-12 mx-auto mb-2 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <p class="text-lg font-bold text-emerald-400">Choices Submitted!</p>
            <p class="text-sm text-gray-400 mt-1">Your retention choices have been recorded</p>
          </div>
        </Show>

        {/* Players List */}
        <div class="space-y-2">
          <For each={assignedPlayers()}>
            {(player) => {
              const choice = () => choices()[player.id];
              const isRetained = () => choice()?.action === 'retain';

              return (
                <div class={`p-3 rounded-lg border transition-all ${
                  isRetained()
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-gray-800 bg-[#1a1a1a]'
                }`}>
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <Show when={player.image}>
                        <img src={player.image} alt={player.name} class="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      </Show>
                      <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-base truncate">{player.name}</h3>
                        <div class="flex items-center gap-2 text-xs text-gray-400">
                          <span>{player.role}</span>
                          <span>•</span>
                          <span class={player.isOverseas ? 'text-blue-400' : 'text-gray-400'}>
                            {player.isOverseas ? 'OS' : 'Local'}
                          </span>
                        </div>
                        <Show when={isRetained()}>
                          <p class="text-xs text-emerald-400 mt-0.5">
                            Slot {choice().slot} • ₹{choice().price} Cr
                          </p>
                        </Show>
                      </div>
                    </div>

                    <div class="flex gap-2 flex-shrink-0">
                      <Show when={!submitted()}>
                        <Show when={isRetained()} fallback={
                          <button
                            onClick={() => handleRetain(player)}
                            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold transition-colors"
                          >
                            Retain
                          </button>
                        }>
                          <button
                            onClick={() => handleRelease(player.id)}
                            class="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold transition-colors"
                          >
                            Release
                          </button>
                        </Show>
                      </Show>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        {/* Submit Button */}
        <Show when={!submitted()}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || loading()}
            class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg font-bold transition-colors"
          >
            {loading() ? 'Submitting...' : 'Submit Retention Choices'}
          </button>
        </Show>
      </div>

      {/* Slot Selection Modal */}
      <Show when={showSlotModal()}>
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div class="bg-[#1a1a1a] rounded-xl max-w-md w-full p-6 border border-gray-800">
            <h2 class="text-xl font-bold mb-4">Select Retention Slot</h2>
            <Show when={selectedPlayer()}>
              <div class="mb-4 p-3 bg-[#0f0f0f] rounded-lg border border-gray-800">
                <p class="font-medium">{selectedPlayer().name}</p>
                <p class="text-sm text-gray-400">{selectedPlayer().role}</p>
              </div>
            </Show>

            <div class="space-y-2 mb-4">
              <Show when={auction()?.retentionSlots}>
                <For each={auction().retentionSlots}>
                  {(slot) => (
                    <button
                      onClick={() => selectSlot(slot)}
                      class="w-full p-4 rounded-lg border-2 border-gray-800 bg-[#0f0f0f] hover:border-emerald-500 transition-all text-left"
                    >
                      <div class="flex items-center justify-between">
                        <span class="font-medium">Slot {slot.slot}</span>
                        <span class="text-lg font-bold text-emerald-400">₹{slot.price} Cr</span>
                      </div>
                    </button>
                  )}
                </For>
              </Show>
            </div>

            <button
              onClick={() => {
                setShowSlotModal(false);
                setSelectedPlayer(null);
              }}
              class="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
