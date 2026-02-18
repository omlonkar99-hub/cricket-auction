import { createSignal, onMount, Show, For } from 'solid-js';
import { apiCall } from '../utils/api';
import { shortenRole } from '../utils/roleShortener';

export default function RetentionReview(props) {
  const [reviewData, setReviewData] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [timeRemaining, setTimeRemaining] = createSignal('');

  onMount(() => {
    fetchReviewData();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  });

  const updateTimer = () => {
    const data = reviewData();
    if (!data?.auction?.windowEndTime) {
      setTimeRemaining('');
      return;
    }

    const end = new Date(data.auction.windowEndTime);
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

  const fetchReviewData = async () => {
    try {
      const res = await apiCall(`/api/retention-auctions/${props.auctionId}/review`);
      const data = await res.json();
      setReviewData(data);
    } catch (err) {
      console.error('Error fetching review data:', err);
      setError('Failed to load review data');
    }
  };

  const getTeamSubmission = (teamId) => {
    return reviewData()?.submissions?.find(s => String(s.teamId) === String(teamId));
  };

  const getRetainedPlayers = (submission) => {
    if (!submission) return [];
    return submission.choices.filter(c => c.action === 'retain');
  };

  const getReleasedPlayers = (submission) => {
    if (!submission) return [];
    return submission.choices.filter(c => c.action === 'release');
  };

  const getPlayerById = (playerId) => {
    return reviewData()?.auction?.players?.find(p => p.id === playerId);
  };

  const handleStartLiveAuction = async () => {
    if (!confirm('Start live auction? This will transition all teams to the auction room.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiCall(`/api/retention-auctions/${props.auctionId}/start-auction`, {
        method: 'POST'
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to start auction');
      }

      const data = await res.json();
      alert('Live auction started successfully!');
      props.onAuctionStarted?.(data.liveAuction.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseWindow = async () => {
    if (!confirm('Close retention window? Teams will no longer be able to submit.')) {
      return;
    }

    try {
      const res = await apiCall(`/api/retention-auctions/${props.auctionId}/close`, {
        method: 'POST'
      });

      if (!res.ok) throw new Error('Failed to close window');

      alert('Retention window closed');
      fetchReviewData();
    } catch (err) {
      setError(err.message);
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
              <h1 class="text-base font-bold truncate">Retention Review</h1>
              <Show when={reviewData()?.auction}>
                <p class="text-xs text-gray-400 truncate">{reviewData().auction.name}</p>
              </Show>
            </div>
            <Show when={timeRemaining()} fallback={<div class="w-20"></div>}>
              <div class="text-center px-3 border-l border-gray-700">
                <p class="text-xs text-gray-400">Time Left</p>
                <p class="text-sm font-bold text-emerald-400">{timeRemaining()}</p>
              </div>
            </Show>
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

        {/* Status Summary */}
        <Show when={reviewData()}>
          <div class="bg-[#1a1a1a] rounded-xl p-6 border border-gray-800">
            <h2 class="text-lg font-bold mb-4">Submission Status</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="space-y-1">
                <p class="text-sm text-gray-400">Total Teams</p>
                <p class="text-2xl font-bold">{reviewData().teams?.length || 0}</p>
              </div>
              <div class="space-y-1">
                <p class="text-sm text-gray-400">Submitted</p>
                <p class="text-2xl font-bold text-emerald-400">
                  {reviewData().submissions?.filter(s => s.isSubmitted).length || 0}
                </p>
              </div>
              <div class="space-y-1">
                <p class="text-sm text-gray-400">Pending</p>
                <p class="text-2xl font-bold text-yellow-400">
                  {(reviewData().teams?.length || 0) - (reviewData().submissions?.filter(s => s.isSubmitted).length || 0)}
                </p>
              </div>
              <div class="space-y-1">
                <p class="text-sm text-gray-400">Status</p>
                <p class={`text-lg font-bold ${
                  reviewData().auction?.status === 'retention_active' ? 'text-emerald-400' : 'text-gray-400'
                }`}>
                  {reviewData().auction?.status === 'retention_active' ? 'Active' : 'Closed'}
                </p>
              </div>
            </div>
          </div>
        </Show>

        {/* Team Submissions */}
        <Show when={reviewData()}>
          <div class="space-y-4">
            <h2 class="text-xl font-bold">Team Submissions</h2>
            
            <For each={reviewData().teams}>
              {(team) => {
                const submission = getTeamSubmission(team.id);
                const retained = getRetainedPlayers(submission);
                const released = getReleasedPlayers(submission);

                return (
                  <div class="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
                    <div class="p-4 border-b border-gray-800">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                          <Show when={team.logo}>
                            <img src={team.logo} alt={team.name} class="w-12 h-12 rounded-lg object-cover" />
                          </Show>
                          <div>
                            <h3 class="font-bold text-lg">{team.name}</h3>
                            <Show when={submission?.isSubmitted} fallback={
                              <p class="text-sm text-yellow-400">Pending Submission</p>
                            }>
                              <p class="text-sm text-emerald-400">Submitted</p>
                            </Show>
                          </div>
                        </div>
                        <Show when={submission}>
                          <div class="text-right">
                            <p class="text-sm text-gray-400">Remaining Budget</p>
                            <p class="text-lg font-bold text-emerald-400">
                              ₹{submission.remainingBudget?.toFixed(1)} Cr
                            </p>
                          </div>
                        </Show>
                      </div>
                    </div>

                    <Show when={submission?.isSubmitted}>
                      <div class="p-4 space-y-4">
                        {/* Retained Players */}
                        <div>
                          <h4 class="font-medium text-emerald-400 mb-2">
                            Retained ({retained.length})
                          </h4>
                          <div class="space-y-2">
                            <For each={retained}>
                              {(choice) => {
                                const player = getPlayerById(choice.playerId);
                                return (
                                  <Show when={player}>
                                    <div class="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                                      <div class="flex items-center gap-3">
                                        <Show when={player.image}>
                                          <img src={player.image} alt={player.name} class="w-10 h-10 rounded-full object-cover" />
                                        </Show>
                                        <div>
                                          <p class="font-medium">{player.name}</p>
                                          <p class="text-sm text-gray-400">
                                            {shortenRole(player.role)} • {player.isOverseas ? 'Overseas' : 'Local'}
                                          </p>
                                        </div>
                                      </div>
                                      <div class="text-right">
                                        <p class="text-sm text-gray-400">Slot {choice.slot}</p>
                                        <p class="font-bold text-emerald-400">₹{choice.price} Cr</p>
                                      </div>
                                    </div>
                                  </Show>
                                );
                              }}
                            </For>
                          </div>
                        </div>

                        {/* Released Players */}
                        <div>
                          <h4 class="font-medium text-red-400 mb-2">
                            Released ({released.length})
                          </h4>
                          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <For each={released}>
                              {(choice) => {
                                const player = getPlayerById(choice.playerId);
                                return (
                                  <Show when={player}>
                                    <div class="p-2 bg-red-500/10 rounded-lg border border-red-500/30">
                                      <p class="text-sm font-medium">{player.name}</p>
                                      <p class="text-xs text-gray-400">{shortenRole(player.role)}</p>
                                    </div>
                                  </Show>
                                );
                              }}
                            </For>
                          </div>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Action Buttons */}
        <Show when={reviewData()}>
          <div class="flex gap-3">
            <Show when={reviewData().auction?.status === 'retention_active'}>
              <button
                onClick={handleCloseWindow}
                class="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-semibold transition-colors"
              >
                Close Retention Window
              </button>
            </Show>

            <Show when={reviewData().auction?.status === 'retention_closed'}>
              <button
                onClick={handleStartLiveAuction}
                disabled={loading()}
                class="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg font-semibold transition-colors"
              >
                {loading() ? 'Starting...' : 'Start Live Auction'}
              </button>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
