import { createSignal, Show } from 'solid-js';
import { apiCall } from '../utils/api';
import AuctionBasicInfo from './auction-creation/AuctionBasicInfo';
import AuctionSettings from './auction-creation/AuctionSettings';
import TeamSelection from './auction-creation/TeamSelection';
import PlayerSelection from './auction-creation/PlayerSelection';
import RoleOrder from './auction-creation/RoleOrder';
import PlayerOrder from './auction-creation/PlayerOrder';
import ReviewAuction from './auction-creation/ReviewAuction';

export default function CreateAuction(props) {
  const [step, setStep] = createSignal(1);
  const initial = props.initialData || {};
  const normalizedType = initial.type === 'ipl' ? 'regular' : initial.type;
  const [auctionData, setAuctionData] = createSignal({
    id: initial.id,
    name: initial.name || '',
    description: initial.description || '',
    type: normalizedType || 'regular',
    budget: initial.budget || 100,
    squadSize: initial.squadSize || initial.playersLimit || 25,
    overseasLimit: initial.overseasLimit || 8,
    timerDuration: initial.timerDuration || 10,
    selectedTeams: initial.selectedTeams || [],
    selectedPlayers: initial.selectedPlayers || [],
    roleOrder: initial.roleOrder || ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'],
    playerOrder: initial.playerOrder || {}
  });

  const totalSteps = 7;

  const updateAuctionData = (key, value) => {
    setAuctionData(prev => ({ ...prev, [key]: value }));
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

  const handleCreate = async () => {
    try {
      const payload = { ...auctionData() };
      if (!payload.type) payload.type = 'regular';

      const isEdit = props.mode === 'edit' && payload.id;
      const url = isEdit ? `/api/auctions/${payload.id}` : '/api/auctions';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const created = await res.json();
        props.onBack();
      } else {
        // Handle different response types
        let errorMessage = 'Failed to save auction';
        const contentType = res.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const err = await res.json();
            errorMessage = err.error || err.message || errorMessage;
          } catch (e) {
            // JSON parsing failed, use default message
          }
        } else {
          // Non-JSON response (likely HTML error page)
          errorMessage = `Server error (${res.status}): ${res.statusText}`;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      throw error;
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
            {props.mode === 'edit' ? 'Edit Auction' : 'Create Auction'}
          </h1>
          <div class="ml-auto text-xs text-gray-400">
            Step {step()} of 7
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div class="max-w-[1200px] mx-auto px-4 py-3">
        <Show when={step() === 1}>
          <AuctionBasicInfo 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
          />
        </Show>

        <Show when={step() === 2}>
          <AuctionSettings 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Show>

        <Show when={step() === 3}>
          <TeamSelection 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Show>

        <Show when={step() === 4}>
          <PlayerSelection 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Show>

        <Show when={step() === 5}>
          <RoleOrder 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
            onBack={prevStep}
          />
        </Show>

        <Show when={step() === 6}>
          <PlayerOrder 
            data={auctionData()} 
            onUpdate={updateAuctionData}
            onNext={nextStep}
            isEditing={props.mode === 'edit'}
            onBack={prevStep}
          />
        </Show>

        <Show when={step() === 7}>
          <ReviewAuction 
            data={auctionData()} 
            onCreate={handleCreate}
            isEditing={props.mode === 'edit'}
            onBack={prevStep}
          />
        </Show>
      </div>
    </div>
  );
}
