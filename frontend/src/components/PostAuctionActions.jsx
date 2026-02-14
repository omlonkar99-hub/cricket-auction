import { createSignal, Show } from 'solid-js';
import { apiCall } from '../utils/api';

export default function PostAuctionActions(props) {
  const [selectedAction, setSelectedAction] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  
  // Duplicate Auction - use current auction's budget as default
  const [newName, setNewName] = createSignal('');
  const [newBudget, setNewBudget] = createSignal(props.auction?.budget || 100);
  
  // Retention Phase
  const [retentionName, setRetentionName] = createSignal('');
  const [retentionBudget, setRetentionBudget] = createSignal(props.auction?.budget ? props.auction.budget / 2 : 50);
  const [maxRetentions, setMaxRetentions] = createSignal(5);
  
  // Trade Window
  const [tradeName, setTradeName] = createSignal('');
  const [durationHours, setDurationHours] = createSignal(props.auction?.tradeWindowDuration || 24);

  const handleDuplicate = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/auctions/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: props.auctionId,
          newName: newName(),
          newBudget: newBudget()
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`New auction created: ${data.name}`);
        props.onClose();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetention = async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/auctions/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: props.auctionId,
          retentionName: retentionName(),
          retentionBudget: retentionBudget(),
          maxRetentions: maxRetentions()
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Retention phase created: ${data.name}`);
        props.onClose();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTradeWindow = async () => {
    setLoading(true);
    try {
      const res = await apiCall(`/api/auctions/${props.auctionId}/trade-window/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: durationHours()
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Trade window started successfully`);
        props.onClose();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to start trade window');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to start trade window');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div class="bg-[#1a1a1a] rounded-2xl border border-gray-800 w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <div class="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-[#1a1a1a] z-10">
          <h2 class="text-lg font-bold">Post-Auction Actions</h2>
          <button onClick={props.onClose} class="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <Show when={!selectedAction()} fallback={
          <div class="p-4">
            <Show when={selectedAction() === 'duplicate'}>
              <div class="space-y-4">
                <h3 class="text-base font-bold mb-4">Duplicate Auction for New Season</h3>
                <p class="text-sm text-gray-400 mb-4">
                  Creates a new auction with the same teams and players but fresh budgets and reset statuses.
                </p>
                
                <div>
                  <label class="block text-sm font-medium text-gray-400 mb-2">New Auction Name</label>
                  <input
                    type="text"
                    value={newName()}
                    onInput={(e) => setNewName(e.target.value)}
                    class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="IPL"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-400 mb-2">New Budget (₹ Crores)</label>
                  <input
                    type="number"
                    value={newBudget()}
                    onInput={(e) => setNewBudget(parseInt(e.target.value))}
                    class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    min="50"
                  />
                </div>

                <div class="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedAction(null)}
                    class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleDuplicate}
                    disabled={loading() || !newName()}
                    class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {loading() ? 'Creating...' : 'Create Duplicate'}
                  </button>
                </div>
              </div>
            </Show>

            <Show when={selectedAction() === 'retention'}>
              <div class="space-y-4">
                <h3 class="text-base font-bold mb-4">Create Retention Phase</h3>
                <p class="text-sm text-gray-400 mb-4">
                  Teams can retain their existing players before the main auction. Only sold players from the previous auction will be available.
                </p>
                
                <div>
                  <label class="block text-sm font-medium text-gray-400 mb-2">Retention Phase Name</label>
                  <input
                    type="text"
                    value={retentionName()}
                    onInput={(e) => setRetentionName(e.target.value)}
                    class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="IPL Retention"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-400 mb-2">Retention Budget (₹ Crores)</label>
                  <input
                    type="number"
                    value={retentionBudget()}
                    onInput={(e) => setRetentionBudget(parseInt(e.target.value))}
                    class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    min="20"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-400 mb-2">Max Retentions per Team</label>
                  <input
                    type="number"
                    value={maxRetentions()}
                    onInput={(e) => setMaxRetentions(parseInt(e.target.value))}
                    class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    min="1"
                    max="10"
                  />
                </div>

                <div class="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedAction(null)}
                    class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleRetention}
                    disabled={loading() || !retentionName()}
                    class="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {loading() ? 'Creating...' : 'Create Retention Phase'}
                  </button>
                </div>
              </div>
            </Show>

            <Show when={selectedAction() === 'trade'}>
              <div class="space-y-4">
                <h3 class="text-base font-bold mb-4">Start Trade Window</h3>
                <p class="text-sm text-gray-400 mb-4">
                  Opens a trading period where teams can exchange players with each other.
                </p>

                <div>
                  <label class="block text-sm font-medium text-gray-400 mb-2">Duration (Hours)</label>
                  <input
                    type="number"
                    value={durationHours()}
                    onInput={(e) => setDurationHours(parseInt(e.target.value) || 24)}
                    class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                    min="1"
                    max="720"
                    placeholder="24"
                  />
                  <p class="mt-1 text-xs text-gray-400">Number of hours teams can trade players (1-720 hours)</p>
                </div>

                <div class="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedAction(null)}
                    class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleTradeWindow}
                    disabled={loading()}
                    class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {loading() ? 'Starting...' : 'Start Trade Window'}
                  </button>
                </div>
              </div>
            </Show>
          </div>
        }>
          <div class="p-4 space-y-3">
            <p class="text-sm text-gray-400 mb-4">
              Choose what to do after the auction ends:
            </p>

            <button
              onClick={() => setSelectedAction('duplicate')}
              class="w-full p-4 bg-[#0f0f0f] hover:bg-gray-900 border border-gray-800 hover:border-emerald-500 rounded-xl text-left transition-all"
            >
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <h3 class="text-sm font-bold mb-1">Duplicate for New Season</h3>
                  <p class="text-xs text-gray-400">Copy auction setup with new budget and reset all player statuses</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedAction('retention')}
              class="w-full p-4 bg-[#0f0f0f] hover:bg-gray-900 border border-gray-800 hover:border-purple-500 rounded-xl text-left transition-all"
            >
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div class="flex-1">
                  <h3 class="text-sm font-bold mb-1">Create Retention Phase</h3>
                  <p class="text-xs text-gray-400">Let teams retain their existing players before new auction</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setSelectedAction('trade')}
              class="w-full p-4 bg-[#0f0f0f] hover:bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl text-left transition-all"
            >
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div class="flex-1">
                  <h3 class="text-sm font-bold mb-1">Open Trade Window</h3>
                  <p class="text-xs text-gray-400">Allow teams to trade players with each other</p>
                </div>
              </div>
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
