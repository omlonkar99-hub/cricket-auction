import { createSignal, Show } from 'solid-js';

export default function NoAuthAuctionSettings(props) {
  const [formData, setFormData] = createSignal({
    budget: props.data.budget || 100,
    timerDuration: props.data.timerDuration || 10,
    playersLimit: props.data.playersLimit || 25,
    overseasLimit: props.data.overseasLimit || 8
  });
  const [errors, setErrors] = createSignal({});

  const validate = () => {
    const newErrors = {};
    const data = formData();
    
    if (data.budget < 10 || data.budget > 1000) {
      newErrors.budget = 'Budget must be between 10 and 1000 Cr';
    }
    if (data.timerDuration < 5 || data.timerDuration > 120) {
      newErrors.timerDuration = 'Timer must be between 5 and 120 seconds';
    }
    if (data.playersLimit < 11 || data.playersLimit > 50) {
      newErrors.playersLimit = 'Players limit must be between 11 and 50';
    }
    if (data.overseasLimit < 2 || data.overseasLimit > 20) {
      newErrors.overseasLimit = 'Overseas limit must be between 2 and 20';
    }
    if (data.overseasLimit > data.playersLimit) {
      newErrors.overseasLimit = 'Overseas limit cannot exceed total players limit';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      const data = formData();
      props.onUpdate('budget', data.budget);
      props.onUpdate('timerDuration', data.timerDuration);
      props.onUpdate('playersLimit', data.playersLimit);
      props.onUpdate('overseasLimit', data.overseasLimit);
      props.onNext();
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <h2 class="text-xl font-bold mb-1">Auction Settings</h2>
        <p class="text-sm text-gray-400">Configure budget, timer, and player limits</p>
      </div>
      
      <div class="space-y-4">
        {/* Budget */}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Budget per Team (Crores) <span class="text-red-400">*</span>
          </label>
          <div class="flex items-center gap-2">
            <input
              type="number"
              value={formData().budget}
              onInput={(e) => updateField('budget', parseInt(e.target.value) || 100)}
              min="10"
              max="1000"
              class={`flex-1 px-3 py-2.5 bg-[#1a1a1a] border ${
                errors().budget ? 'border-red-500' : 'border-gray-700'
              } rounded-lg text-white text-sm focus:border-purple-400 transition-colors outline-none`}
            />
            <span class="text-sm text-gray-400">₹ Cr</span>
          </div>
          <Show when={errors().budget}>
            <p class="mt-1 text-xs text-red-400">{errors().budget}</p>
          </Show>
        </div>

        {/* Timer Duration */}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Timer Duration (Seconds) <span class="text-red-400">*</span>
          </label>
          <div class="flex items-center gap-2">
            <input
              type="number"
              value={formData().timerDuration}
              onInput={(e) => updateField('timerDuration', parseInt(e.target.value) || 10)}
              min="5"
              max="120"
              class={`flex-1 px-3 py-2.5 bg-[#1a1a1a] border ${
                errors().timerDuration ? 'border-red-500' : 'border-gray-700'
              } rounded-lg text-white text-sm focus:border-purple-400 transition-colors outline-none`}
            />
            <span class="text-sm text-gray-400">sec</span>
          </div>
          <Show when={errors().timerDuration}>
            <p class="mt-1 text-xs text-red-400">{errors().timerDuration}</p>
          </Show>
          <p class="mt-1 text-xs text-gray-500">
            How long each player has for bidding
          </p>
        </div>

        {/* Players Limit */}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Total Players in Squad <span class="text-red-400">*</span>
          </label>
          <input
            type="number"
            value={formData().playersLimit}
            onInput={(e) => updateField('playersLimit', parseInt(e.target.value) || 25)}
            min="11"
            max="50"
            class={`w-full px-3 py-2.5 bg-[#1a1a1a] border ${
              errors().playersLimit ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white text-sm focus:border-purple-400 transition-colors outline-none`}
          />
          <Show when={errors().playersLimit}>
            <p class="mt-1 text-xs text-red-400">{errors().playersLimit}</p>
          </Show>
        </div>

        {/* Overseas Limit */}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Overseas Players Limit <span class="text-red-400">*</span>
          </label>
          <input
            type="number"
            value={formData().overseasLimit}
            onInput={(e) => updateField('overseasLimit', parseInt(e.target.value) || 8)}
            min="2"
            max="20"
            class={`w-full px-3 py-2.5 bg-[#1a1a1a] border ${
              errors().overseasLimit ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white text-sm focus:border-purple-400 transition-colors outline-none`}
          />
          <Show when={errors().overseasLimit}>
            <p class="mt-1 text-xs text-red-400">{errors().overseasLimit}</p>
          </Show>
        </div>

        {/* Summary */}
        <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mt-6">
          <p class="text-xs text-gray-400 mb-2">Summary</p>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Squad Size:</span>
              <span class="font-medium">{formData().playersLimit} players</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Max Overseas:</span>
              <span class="font-medium">{formData().overseasLimit} players</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Team Budget:</span>
              <span class="font-medium">₹{formData().budget} Crores</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Timer per Player:</span>
              <span class="font-medium">{formData().timerDuration} seconds</span>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div class="mt-6 pt-4 border-t border-gray-800 flex gap-3">
        <button
          onClick={props.onBack}
          class="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-all"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          class="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-all"
        >
          Review Auction
        </button>
      </div>
    </div>
  );
}
