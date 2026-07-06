import { createSignal, Show } from 'solid-js';
import { apiCall } from '../utils/api';
import NoAuthAuctionBasicInfo from './auction-creation/NoAuthAuctionBasicInfo';
import TeamSelection from './auction-creation/TeamSelection';
import PlayerSelection from './auction-creation/PlayerSelection';
import NoAuthAuctionSettings from './auction-creation/NoAuthAuctionSettings';
import NoAuthReviewAuction from './auction-creation/NoAuthReviewAuction';

export default function CreateAuction(props) {
  const [step, setStep] = createSignal(1);
  const [error, setError] = createSignal(null);
  
  const [auctionData, setAuctionData] = createSignal({
    name: '',
    description: '',
    visibility: 'public',
    accessCode: '',
    budget: 100,
    timerDuration: 10,
    playersLimit: 25,
    overseasLimit: 8,
    selectedTeams: [],
    selectedPlayers: []
  });

  const totalSteps = 5;

  const updateAuctionData = (key, value) => {
    setAuctionData(prev => ({ ...prev, [key]: value }));
    setError(null);
  };

  const nextStep = () => {
    if (step() < totalSteps) {
      setStep(step() + 1);
    }
  };

  const prevStep = () => {
    if (step() > 1) {
      setStep(step() - 1);
    }
  };

  const getOrCreateDeviceUUID = () => {
    let uuid = localStorage.getItem('deviceUUID');
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem('deviceUUID', uuid);
    }
    return uuid;
  };

  const handleCreate = async () => {
    try {
      setError(null);
      const uuid = getOrCreateDeviceUUID();
      const data = auctionData();

      // Validate required fields
      if (!data.name?.trim()) {
        throw new Error('Auction name is required');
      }
      if (data.selectedTeams.length === 0) {
        throw new Error('At least one team must be selected');
      }
      if (data.selectedPlayers.length === 0) {
        throw new Error('At least one player must be selected');
      }

      const payload = {
        name: data.name,
        description: data.description || '',
        visibility: data.visibility,
        selectedTeams: data.selectedTeams.map(id => String(id)),
        selectedPlayers: data.selectedPlayers.map(id => String(id)),
        budget: data.budget,
        timerDuration: data.timerDuration,
        playersLimit: data.playersLimit,
        overseasLimit: data.overseasLimit
      };

      const res = await apiCall('/api/auctions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Device-UUID': uuid
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const created = await res.json();
        // Store display name in localStorage for this auction
        localStorage.setItem(`auction_${created.id}`, JSON.stringify({
          displayName: uuid,
          joinedAt: new Date().toISOString()
        }));
        props.onNavigate?.('auction', created);
      } else {
        let errorMessage = 'Failed to create auction';
        const contentType = res.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const err = await res.json();
            errorMessage = err.error || err.message || errorMessage;
          } catch (e) {
            // JSON parsing failed
          }
        }
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      setError(error.message || 'An error occurred');
      console.error('Error creating auction:', error);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header with Back Button */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1200px] mx-auto px-4 py-3 flex items-center gap-3">
          <button 
            onClick={props.onBack}
            class="flex items-center gap-1 px-2 py-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span class="text-sm">Back</span>
          </button>
          <h1 class="text-lg font-bold">
            Create Auction
          </h1>
          <div class="ml-auto text-xs text-gray-400">
            Step {step()} of {totalSteps}
          </div>
        </div>
      </div>
      
      {/* Error Display */}
      <Show when={error()}>
        <div class="max-w-[1200px] mx-auto px-4 py-3">
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-2">
            <svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <p class="text-sm text-red-400">{error()}</p>
          </div>
        </div>
      </Show>
      
      {/* Content */}
      <div class="max-w-[1200px] mx-auto px-4 py-3">
        <Show when={step() === 1}>
          <NoAuthAuctionBasicInfo 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
          />
        </Show>

        <Show when={step() === 2}>
          <TeamSelection 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Show>

        <Show when={step() === 3}>
          <PlayerSelection 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Show>

        <Show when={step() === 4}>
          <NoAuthAuctionSettings
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Show>

        <Show when={step() === 5}>
          <NoAuthReviewAuction 
            data={auctionData()} 
            onCreate={handleCreate}
            onBack={prevStep}
          />
        </Show>
      </div>
    </div>
  );
}
