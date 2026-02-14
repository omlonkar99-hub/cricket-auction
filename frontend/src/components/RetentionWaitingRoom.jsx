import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { apiCall } from '../utils/api';

export default function RetentionWaitingRoom(props) {
  const [timeRemaining, setTimeRemaining] = createSignal('');
  const [auction, setAuction] = createSignal(null);
  const [isStarting, setIsStarting] = createSignal(false);

  const isAdmin = props.isAdmin || props.currentUser?.role === 'admin' || props.currentUser?.role === 'superadmin';

  onMount(() => {
    fetchAuctionDetails();
    const interval = setInterval(updateTimer, 1000);
    onCleanup(() => clearInterval(interval));
  });

  const fetchAuctionDetails = async () => {
    try {
      const res = await apiCall(`/api/retention-auctions/${props.auctionId}`);
      const data = await res.json();
      setAuction(data);
    } catch (err) {
      console.error('Error fetching auction:', err);
    }
  };

  const handleStartRetentionWindow = async () => {
    if (!confirm('Start the retention window now? All teams will be able to make their retention choices.')) {
      return;
    }

    setIsStarting(true);
    try {
      const res = await apiCall(`/api/retention-auctions/${props.auctionId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${props.currentUser?.token || localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          windowDuration: auction().windowDuration || 24
        })
      });

      if (res.ok) {
        fetchAuctionDetails();
        props.onWindowStart?.();
      } else {
        const error = await res.text();
        alert(`Failed to start retention window: ${error}`);
      }
    } catch (err) {
      console.error('Error starting retention window:', err);
      alert('Failed to start retention window');
    } finally {
      setIsStarting(false);
    }
  };

  const updateTimer = () => {
    const auc = auction();
    if (!auc || !auc.windowStartTime) {
      setTimeRemaining('Waiting for admin to start...');
      return;
    }

    const start = new Date(auc.windowStartTime);
    const now = new Date();
    const diff = start - now;

    if (diff <= 0) {
      props.onWindowStart?.();
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

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4">
      <div class="max-w-2xl w-full space-y-6">
        <div class="text-center space-y-4">
          <div class="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-500 to-blue-500 rounded-full flex items-center justify-center">
            <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div>
            <h1 class="text-3xl font-bold mb-2">Retention Window</h1>
            <Show when={auction()}>
              <p class="text-xl text-gray-400">{auction().name}</p>
            </Show>
          </div>

          <div class="text-5xl font-bold text-emerald-400">
            {timeRemaining()}
          </div>

          <p class="text-gray-400">
            The retention window will open soon. Get ready to make your choices!
          </p>
        </div>

        <Show when={auction()}>
          <div class="bg-[#1a1a1a] rounded-xl p-6 border border-gray-800 space-y-4">
            <h2 class="text-lg font-bold flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              Retention Rules
            </h2>

            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="space-y-1">
                <p class="text-gray-400">Total Budget</p>
                <p class="text-lg font-bold">₹{auction().budget} Cr</p>
              </div>
              <div class="space-y-1">
                <p class="text-gray-400">Max Retentions</p>
                <p class="text-lg font-bold">{auction().maxRetentions} players</p>
              </div>
              <div class="space-y-1">
                <p class="text-gray-400">Max Overseas</p>
                <p class="text-lg font-bold">{auction().maxOverseas} players</p>
              </div>
              <div class="space-y-1">
                <p class="text-gray-400">Window Duration</p>
                <p class="text-lg font-bold">{auction().windowDuration} hours</p>
              </div>
            </div>

            <div class="pt-4 border-t border-gray-800">
              <h3 class="font-medium mb-3">Retention Price Slabs</h3>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Show when={auction().retentionSlots}>
                  {auction().retentionSlots.map(slot => (
                    <div class="p-3 bg-[#0f0f0f] rounded-lg border border-gray-800">
                      <p class="text-xs text-gray-400">Slot {slot.slot}</p>
                      <p class="text-lg font-bold text-emerald-400">₹{slot.price} Cr</p>
                    </div>
                  ))}
                </Show>
              </div>
            </div>
          </div>

          <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div class="flex gap-3">
              <svg class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div class="space-y-1 text-sm">
                <p class="font-medium text-yellow-400">Important Notes</p>
                <ul class="text-gray-300 space-y-1 list-disc list-inside">
                  <li>You can retain up to {auction().maxRetentions} players</li>
                  <li>Overseas players in retentions cannot exceed {auction().maxOverseas}</li>
                  <li>Total retention cost must not exceed your budget</li>
                  <li>Once submitted, choices cannot be changed</li>
                </ul>
              </div>
            </div>
          </div>
        </Show>

        <Show when={isAdmin}>
          <button
            onClick={handleStartRetentionWindow}
            disabled={isStarting()}
            class="w-full py-4 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-600 rounded-lg font-bold text-lg transition-all disabled:cursor-not-allowed"
          >
            {isStarting() ? 'Starting...' : 'Start Retention Window'}
          </button>
        </Show>

        <button
          onClick={props.onBack}
          class="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
