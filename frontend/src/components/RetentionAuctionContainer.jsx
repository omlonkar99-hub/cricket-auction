import { createSignal, onMount, Show } from 'solid-js';
import RetentionWaitingRoom from './RetentionWaitingRoom';
import RetentionWindow from './RetentionWindow';
import RetentionReview from './RetentionReview';

export default function RetentionAuctionContainer(props) {
  const [auction, setAuction] = createSignal(null);
  const [currentView, setCurrentView] = createSignal('loading');
  const [isInitialLoad, setIsInitialLoad] = createSignal(true);

  onMount(() => {
    fetchAuction();
    const interval = setInterval(fetchAuction, 5000);
    return () => clearInterval(interval);
  });

  const fetchAuction = async () => {
    try {
      const res = await fetch(`/api/retention-auctions/${props.auctionId}`);
      
      if (!res.ok) {
        console.error('Failed to fetch retention auction:', res.status, res.statusText);
        setCurrentView('error');
        setIsInitialLoad(false);
        return;
      }
      
      const data = await res.json();
      setAuction(data);
      determineView(data);
      setIsInitialLoad(false);
    } catch (err) {
      console.error('Error fetching auction:', err);
      setCurrentView('error');
      setIsInitialLoad(false);
    }
  };

  const determineView = (auctionData) => {
    if (!auctionData) return;

    const { status, windowStartTime } = auctionData;
    const isAdmin = props.currentUser?.role === 'admin' || props.currentUser?.role === 'superadmin';

    // Admin views
    if (isAdmin) {
      if (status === 'upcoming' || status === 'draft') {
        setCurrentView('waiting');
      } else if (status === 'retention_active' || status === 'retention_closed') {
        setCurrentView('review');
      } else if (status === 'auction_live') {
        // Redirect to live auction
        if (auctionData.liveAuctionId) {
          props.onNavigateToAuction?.(auctionData.liveAuctionId);
        }
      }
      return;
    }

    // Team views
    if (status === 'upcoming' || status === 'draft' || !windowStartTime) {
      setCurrentView('waiting');
    } else if (status === 'retention_active') {
      const now = new Date();
      const start = new Date(windowStartTime);
      
      if (now >= start) {
        setCurrentView('window');
      } else {
        setCurrentView('waiting');
      }
    } else if (status === 'retention_closed') {
      setCurrentView('closed');
    } else if (status === 'auction_live') {
      // Redirect to live auction
      if (auctionData.liveAuctionId) {
        props.onNavigateToAuction?.(auctionData.liveAuctionId);
      }
    }
  };

  const handleWindowStart = () => {
    fetchAuction();
  };

  const handleAuctionStarted = (liveAuctionId) => {
    props.onNavigateToAuction?.(liveAuctionId);
  };

  return (
    <Show when={!isInitialLoad()} fallback={
      <div class="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div class="text-center">
          <div class="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-400">Loading retention auction...</p>
        </div>
      </div>
    }>
      <Show when={currentView() === 'waiting'}>
        <RetentionWaitingRoom
          auctionId={props.auctionId}
          currentUser={props.currentUser}
          isAdmin={props.isAdmin}
          onWindowStart={handleWindowStart}
          onBack={props.onBack}
        />
      </Show>

      <Show when={currentView() === 'window'}>
        <RetentionWindow
          auctionId={props.auctionId}
          teamId={props.currentUser?.teamId}
          onBack={props.onBack}
        />
      </Show>

      <Show when={currentView() === 'review'}>
        <RetentionReview
          auctionId={props.auctionId}
          onBack={props.onBack}
          onAuctionStarted={handleAuctionStarted}
        />
      </Show>

      <Show when={currentView() === 'closed'}>
        <div class="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-4">
          <div class="max-w-md w-full text-center space-y-4">
            <div class="w-20 h-20 mx-auto bg-gray-800 rounded-full flex items-center justify-center">
              <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 class="text-2xl font-bold mb-2">Retention Window Closed</h1>
              <p class="text-gray-400">
                The retention window has ended. Waiting for admin to start the live auction.
              </p>
            </div>
            <button
              onClick={props.onBack}
              class="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </Show>
    </Show>
  );
}
