import { createSignal, onMount, Show, For } from 'solid-js';
import { apiCall } from '../utils/api.js';

export default function JoinAuction(props) {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);
  const [auctionData, setAuctionData] = createSignal(null);
  const [displayName, setDisplayName] = createSignal(
    localStorage.getItem('userDisplayName') || ''
  );
  const [showNameEdit, setShowNameEdit] = createSignal(false);
  const [selectedTeamId, setSelectedTeamId] = createSignal(null);
  const [accessCode, setAccessCode] = createSignal('');
  const [showAccessCodeField, setShowAccessCodeField] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [success, setSuccess] = createSignal(false);

  onMount(async () => {
    await fetchAuctionDetails();
  });

  const fetchAuctionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = props.auctionId ? `/api/auctions/${props.auctionId}` : '';
      if (!endpoint) {
        setError('Auction ID not provided');
        return;
      }

      const res = await apiCall(endpoint);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setError(text || 'Failed to load auction details');
        return;
      }

      const data = await res.json();
      setAuctionData(data);

      // Check if it's a private auction
      if (data.visibility === 'private') {
        setShowAccessCodeField(true);
      }

      // Set first available team as default
      if (data.teams && data.teams.length > 0) {
        setSelectedTeamId(data.teams[0].id);
      }
    } catch (err) {
      console.error('Error fetching auction:', err);
      setError('Failed to load auction details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAuction = async (e) => {
    e.preventDefault();

    if (!displayName().trim()) {
      setError('Please enter your display name');
      return;
    }

    if (!selectedTeamId()) {
      setError('Please select a team');
      return;
    }

    if (showAccessCodeField() && !accessCode().trim()) {
      setError('Please enter the access code');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const body = {
        displayName: displayName().trim(),
        teamId: String(selectedTeamId())
      };

      let url = `/api/auctions/${props.auctionId}/join`;
      if (showAccessCodeField() && accessCode().trim()) {
        url += `?access-code=${encodeURIComponent(accessCode().trim())}`;
      }

      const res = await apiCall(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const responseData = await res.json();

      if (!res.ok) {
        const errorMsg = responseData.error || responseData.message || 'Failed to join auction';
        setError(errorMsg);
        return;
      }

      // Success - store display name for this auction
      localStorage.setItem(`auction_${props.auctionId}_displayName`, displayName().trim());
      localStorage.setItem('userDisplayName', displayName().trim());
      setSuccess(true);

      // Redirect after short delay
      setTimeout(() => {
        props.onJoinSuccess?.();
      }, 1500);
    } catch (err) {
      console.error('Error joining auction:', err);
      setError('Failed to join auction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const availableTeams = () => {
    const auction = auctionData();
    if (!auction?.teams) return [];
    return auction.teams;
  };

  const participantCount = () => {
    const auction = auctionData();
    return auction?.participants?.length || 0;
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[600px] mx-auto px-4 py-3">
          <div class="flex items-center gap-3">
            <Show when={props.onBack}>
              <button
                onClick={props.onBack}
                class="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </Show>
            <h1 class="text-lg font-bold">Join Auction</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-[600px] mx-auto p-4 pb-24">
        <Show when={!loading()} fallback={
          <div class="flex items-center justify-center py-16">
            <div class="text-center">
              <div class="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-sm text-gray-400">Loading auction details...</p>
            </div>
          </div>
        }>
          <Show when={auctionData()} fallback={
            <div class="text-center py-16">
              <p class="text-sm text-gray-400 mb-3">Auction not found</p>
              <Show when={props.onBack}>
                <button
                  onClick={props.onBack}
                  class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Back to Auctions
                </button>
              </Show>
            </div>
          }>
            <div class="space-y-4">
              {/* Auction Info Card */}
              <div class="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
                <div class="flex items-start gap-3 mb-3">
                  <div class="flex-1">
                    <h2 class="text-lg font-bold mb-1">{auctionData()?.name}</h2>
                    <p class="text-sm text-gray-400">{auctionData()?.description || 'No description'}</p>
                    <p class="text-xs text-gray-500 mt-2">
                      Created by {auctionData()?.creatorName || 'Anonymous'}
                    </p>
                  </div>
                  <Show when={auctionData()?.visibility === 'private'}>
                    <span class="text-[10px] bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-full font-semibold flex-shrink-0">
                      PRIVATE
                    </span>
                  </Show>
                </div>

                {/* Auction Stats */}
                <div class="grid grid-cols-3 gap-2">
                  <div class="bg-[#0f0f0f] rounded-lg p-2 text-center">
                    <p class="text-sm font-bold text-purple-400">{auctionData()?.teams?.length || 0}</p>
                    <p class="text-xs text-gray-400">Teams</p>
                  </div>
                  <div class="bg-[#0f0f0f] rounded-lg p-2 text-center">
                    <p class="text-sm font-bold text-blue-400">{participantCount()}</p>
                    <p class="text-xs text-gray-400">Participants</p>
                  </div>
                  <div class="bg-[#0f0f0f] rounded-lg p-2 text-center">
                    <p class="text-sm font-bold text-emerald-400">₹{auctionData()?.budget || 100}</p>
                    <p class="text-xs text-gray-400">Budget</p>
                  </div>
                </div>
              </div>

              {/* Join Form */}
              <form onSubmit={handleJoinAuction} class="space-y-4">
                {/* Error Message */}
                <Show when={error()}>
                  <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p class="text-sm text-red-400">{error()}</p>
                  </div>
                </Show>

                {/* Success Message */}
                <Show when={success()}>
                  <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <p class="text-sm text-emerald-400">✓ Successfully joined! Redirecting...</p>
                  </div>
                </Show>

                {/* Private Auction Access Code */}
                <Show when={showAccessCodeField()}>
                  <div>
                    <label class="block text-sm font-semibold text-gray-300 mb-2">
                      Access Code
                    </label>
                    <p class="text-xs text-gray-400 mb-2">
                      This auction is private. Enter the access code provided by the creator.
                    </p>
                    <input
                      type="text"
                      placeholder="Enter access code"
                      value={accessCode()}
                      onInput={(e) => setAccessCode(e.currentTarget.value)}
                      class="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                      disabled={submitting()}
                    />
                  </div>
                </Show>

                {/* Display Name */}
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <label class="block text-sm font-semibold text-gray-300">
                      Your Display Name
                    </label>
                    <button
                      onClick={() => setShowNameEdit(!showNameEdit())}
                      class="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {showNameEdit() ? 'Done' : 'Change'}
                    </button>
                  </div>

                  <Show when={showNameEdit()} fallback={
                    <div class="px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white text-sm">
                      {displayName()}
                    </div>
                  }>
                    <input
                      type="text"
                      value={displayName()}
                      onInput={(e) => setDisplayName(e.currentTarget.value)}
                      maxLength="50"
                      class="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                      disabled={submitting()}
                    />
                    <p class="text-xs text-gray-500 mt-1">{displayName().length}/50</p>
                  </Show>
                </div>

                {/* Team Selection */}
                <div>
                  <label class="block text-sm font-semibold text-gray-300 mb-3">
                    Select Your Team
                  </label>

                  <Show when={availableTeams().length > 0} fallback={
                    <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                      <p class="text-xs text-yellow-400">No teams available to join</p>
                    </div>
                  }>
                    <select
                      value={selectedTeamId() || ''}
                      onChange={(e) => setSelectedTeamId(Number(e.currentTarget.value))}
                      class="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                      disabled={submitting()}
                    >
                      <option value="">-- Select a team --</option>
                      <For each={availableTeams()}>
                        {(team) => (
                          <option value={team.id}>
                            {team.name} ({team.shortName})
                          </option>
                        )}
                      </For>
                    </select>
                  </Show>
                </div>

                {/* Team Info Cards */}
                <Show when={availableTeams().length > 0}>
                  <div>
                    <p class="text-xs font-semibold text-gray-400 mb-2">AVAILABLE TEAMS:</p>
                    <div class="space-y-2">
                      <For each={availableTeams()}>
                        {(team) => (
                          <div class="bg-[#1a1a1a] border border-gray-800 rounded-lg p-2.5 flex items-center gap-3">
                            <Show when={team.logo} fallback={
                              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                {team.shortName || 'T'}
                              </div>
                            }>
                              <img
                                src={team.logo}
                                alt={team.name}
                                class="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            </Show>
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-semibold">{team.name}</p>
                              <p class="text-xs text-gray-500">{team.shortName}</p>
                            </div>
                            <div class="text-right flex-shrink-0">
                              <p class="text-xs text-emerald-400 font-semibold">Budget</p>
                              <p class="text-xs text-gray-400">₹{team.budget || 100}Cr</p>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting() || success()}
                  class="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors"
                >
                  <Show when={submitting()} fallback="Join Auction">
                    <div class="flex items-center justify-center gap-2">
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Joining...
                    </div>
                  </Show>
                </button>

                {/* Info Message */}
                <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p class="text-xs text-blue-400">
                    💡 Once you join, you can start bidding when the auction goes live. The creator controls all participant assignments.
                  </p>
                </div>
              </form>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
