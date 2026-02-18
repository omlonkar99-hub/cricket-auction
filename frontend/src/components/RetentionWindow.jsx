import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { apiCall } from '../utils/api';
import { shortenRole } from '../utils/roleShortener';

export default function RetentionWindow(props) {
  const [auction, setAuction] = createSignal(null);
  const [assignedPlayers, setAssignedPlayers] = createSignal([]);
  const [choices, setChoices] = createSignal({});
  const [timeRemaining, setTimeRemaining] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);
  const [toast, setToast] = createSignal(null); // { message, type, playerName, slot, price }

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

      const [auctionRes, playersRes, retentionsRes] = await Promise.all([
        apiCall(`/api/retention-auctions/${props.auctionId}`),
        apiCall(`/api/retention-auctions/${props.auctionId}/team/${props.teamId}/players`),
        apiCall(`/api/retention-auctions/${props.auctionId}/retentions`)
      ]);

      if (!auctionRes.ok || !playersRes.ok) {
        console.error('Failed to fetch - auction:', auctionRes.status, 'players:', playersRes.status);
        throw new Error('Failed to fetch data');
      }

      const auctionData = await auctionRes.json();
      const playersData = await playersRes.json();
      const retentionsData = retentionsRes.ok ? await retentionsRes.json() : [];

      setAuction(auctionData);
      setAssignedPlayers(playersData || []);

      // Show helpful message if no players
      if (!playersData || playersData.length === 0) {
        setError('No players assigned to your team for this retention auction. Please contact the admin.');
      }

      // Check if team has already submitted choices
      const existingSubmission = retentionsData.find(r => 
        String(r.teamId) === String(props.teamId) || 
        Number(r.teamId) === Number(props.teamId)
      );

      // Initialize choices - either from existing submission or default to release
      const initialChoices = {};
      if (playersData && Array.isArray(playersData)) {
        playersData.forEach(player => {
          // Default to release
          initialChoices[player.id] = { action: 'release', slot: null, price: 0 };
          
          // If there's an existing submission, load those choices
          if (existingSubmission && existingSubmission.choices) {
            const existingChoice = existingSubmission.choices.find(c => 
              String(c.playerId) === String(player.id) || 
              Number(c.playerId) === Number(player.id)
            );
            if (existingChoice) {
              initialChoices[player.id] = {
                action: existingChoice.action,
                slot: existingChoice.slot,
                price: existingChoice.price
              };
            }
          }
        });
      }
      
      setChoices(initialChoices);
      
      // Set submitted status if found
      if (existingSubmission && existingSubmission.isSubmitted) {
        setSubmitted(true);
      }
      
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
    // Check total retention limit
    const retainedCount = getRetainedCount();
    if (retainedCount >= auction()?.maxRetentions) {
      setToast({ 
        message: 'Maximum retention limit reached', 
        type: 'error',
        subMessage: `You can only retain ${auction()?.maxRetentions} players`
      });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // Check overseas retention limit for overseas players
    if (player.isOverseas) {
      const overseasCount = getOverseasCount();
      const maxOverseas = auction()?.maxOverseasRetention || auction()?.maxOverseas;
      if (overseasCount >= maxOverseas) {
        setToast({ 
          message: 'Maximum overseas retention limit reached', 
          type: 'error',
          subMessage: `You can only retain ${maxOverseas} overseas players`
        });
        setTimeout(() => setToast(null), 3000);
        return;
      }
    }

    // Get the next available slot automatically
    const retainedChoices = Object.values(choices()).filter(c => c.action === 'retain');
    const usedSlots = retainedChoices.map(c => c.slot);
    const availableSlots = auction()?.retentionSlots?.filter(slot => !usedSlots.includes(slot.slot)) || [];
    
    if (availableSlots.length === 0) {
      setToast({ 
        message: 'All retention slots are filled', 
        type: 'error',
        subMessage: 'Please release a player first'
      });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    // Automatically assign to the first available slot (lowest slot number)
    const nextSlot = availableSlots.sort((a, b) => a.slot - b.slot)[0];
    
    setChoices(prev => ({
      ...prev,
      [player.id]: {
        action: 'retain',
        slot: nextSlot.slot,
        price: nextSlot.price
      }
    }));
    
    // Show success toast
    setToast({ 
      message: `${player.name} retained!`,
      type: 'success',
      slot: nextSlot.slot,
      price: nextSlot.price
    });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRelease = (playerId) => {
    const player = assignedPlayers().find(p => p.id === playerId);
    
    setChoices(prev => ({
      ...prev,
      [playerId]: { action: 'release', slot: null, price: 0 }
    }));
    
    // Show release toast
    if (player) {
      setToast({ 
        message: `${player.name} released`,
        type: 'success'
      });
      setTimeout(() => setToast(null), 2500);
    }
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

      const res = await apiCall('/api/retention-auctions/submit', {
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
      setToast({ 
        message: 'Retention choices submitted successfully!',
        type: 'success',
        subMessage: 'You can edit until the window closes'
      });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditChoices = () => {
    setSubmitted(false);
    setToast({ 
      message: 'Edit mode enabled',
      type: 'success',
      subMessage: 'Make changes and submit again'
    });
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white pb-20">
      {/* Toast Notification - Top Center */}
      <Show when={toast()}>
        <div class="fixed top-20 left-1/2 transform -translate-x-1/2 z-[60] animate-fade-in">
          <div class={`rounded-xl p-4 shadow-2xl border-2 min-w-[280px] max-w-[90vw] ${
            toast().type === 'success' 
              ? 'bg-emerald-500/95 border-emerald-400' 
              : 'bg-red-500/95 border-red-400'
          }`}>
            <div class="flex items-start gap-3">
              <Show when={toast().type === 'success'} fallback={
                <svg class="w-6 h-6 text-white flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              }>
                <svg class="w-6 h-6 text-white flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
              </Show>
              <div class="flex-1">
                <p class="font-bold text-white text-base">{toast().message}</p>
                <Show when={toast().slot}>
                  <p class="text-sm text-white/90 mt-1">
                    Slot {toast().slot} • ₹{toast().price} Cr
                  </p>
                </Show>
                <Show when={toast().subMessage}>
                  <p class="text-sm text-white/90 mt-1">{toast().subMessage}</p>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>

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
          <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg class="w-5 h-5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-emerald-400">Choices Submitted!</p>
                  <p class="text-xs text-gray-400">You can edit until window closes</p>
                </div>
              </div>
              <button
                onClick={handleEditChoices}
                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
              >
                Edit
              </button>
            </div>
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
                          <span>{shortenRole(player.role)}</span>
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
                            disabled={
                              getRetainedCount() >= auction()?.maxRetentions ||
                              (player.isOverseas && getOverseasCount() >= (auction()?.maxOverseasRetention || auction()?.maxOverseas))
                            }
                            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
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
    </div>
  );
}
