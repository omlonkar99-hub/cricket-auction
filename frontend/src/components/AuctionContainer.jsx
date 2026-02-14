import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { apiCall } from '../utils/api';
import AuctionWaitingRoom from './AuctionWaitingRoom';
import AuctionRoom from './AuctionRoom';
import AuctionSummary from './AuctionSummary';

export default function AuctionContainer(props) {
  const [auctionState, setAuctionState] = createSignal('loading'); // loading, waiting, live, completed
  const [auctionData, setAuctionData] = createSignal(null);
  const [loadError, setLoadError] = createSignal('');

  let statusInterval;

  onMount(() => {
    fetchAuctionData();
    
    // Poll for auction status updates (lightweight)
    statusInterval = setInterval(() => {
      checkAuctionStatus();
    }, 2000);
  });

  onCleanup(() => {
    if (statusInterval) clearInterval(statusInterval);
  });

  const fetchAuctionData = async () => {
    try {
      const res = await apiCall(`/api/auctions/${props.auctionId}`);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setLoadError(text || 'Auction not found');
        setAuctionState('waiting');
        return;
      }
      const data = await res.json();
      setAuctionData(data);
      setLoadError('');

      if (data.status === 'completed') {
        // Auction is completed - show summary
        setAuctionState('completed');
      } else if (data.status === 'live' && data.isLive === true) {

        setAuctionState('live');
      } else {
       
        setAuctionState('waiting');
      }
    } catch (error) {
      console.error('Error:', error);
      setLoadError('Failed to load auction');
      setAuctionState('waiting');
    }
  };

  const checkAuctionStatus = async () => {
    try {
      const res = await apiCall(`/api/auctions/${props.auctionId}/status`);
      if (!res.ok) return;
      const data = await res.json();
      
      const currentState = auctionState();

      if (data.status === 'completed') {
        // Auction completed - switch to summary
        if (currentState !== 'completed') {
          setAuctionState('completed');
          fetchAuctionData(); // Refresh to get final results
        }
      } else if (data.status === 'live' && data.isLive === true) {

        if (currentState !== 'live') {
          setAuctionState('live');
        }
      } else {
 
        if (currentState === 'live' || currentState === 'completed') {
          // State changed from live/completed back to waiting (shouldn't happen normally)
          setAuctionState('waiting');
          fetchAuctionData();
        }
      }
    } catch (error) {
    }
  };

  const handleStartAuction = async () => {
    try {
      const res = await apiCall(`/api/auctions/${props.auctionId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        setAuctionState('live');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleAuctionEnd = () => {
    setAuctionState('completed');
    fetchAuctionData(); // Refresh to get final results
  };

  return (
    <Show when={auctionState() !== 'loading'} fallback={
      <div class="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-sm text-gray-400">Loading auction...</p>
        </div>
      </div>
    }>
      {/* Show completed auction summary */}
      <Show when={auctionState() === 'completed'}>
        <AuctionSummary
          auctionId={props.auctionId}
          currentUser={props.currentUser}
          isAdmin={props.isAdmin}
          userTeamId={props.currentUser?.role === 'team' ? props.currentUser.teamId : null}
          onBack={props.onBack}
        />
      </Show>

      {/* Show live auction room */}
      <Show when={auctionState() === 'live'}>
        <AuctionRoom
          auctionId={props.auctionId}
          teamId={() => props.currentUser?.role === 'team' ? props.currentUser.teamId : null}
          teamName={() => props.currentUser?.role === 'team' ? props.currentUser.username : null}
          shortName={() => props.currentUser?.shortName ?? null}
          isAdmin={() => props.isAdmin}
          onBack={props.onBack}
          onAuctionEnd={handleAuctionEnd}
        />
      </Show>

      {/* Show waiting room */}
      <Show when={auctionState() === 'waiting'}>
        <Show when={!loadError()} fallback={
          <div class="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
            <div class="text-center">
              <p class="text-sm text-gray-400 mb-3">{loadError()}</p>
              <button onClick={props.onBack} class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm">Back to Auctions</button>
            </div>
          </div>
        }>
          <AuctionWaitingRoom
            auctionData={auctionData()}
            isAdmin={props.isAdmin}
            currentUser={props.currentUser}
            onStartAuction={handleStartAuction}
            onBack={props.onBack}
          />
        </Show>
      </Show>
    </Show>
  );
}
