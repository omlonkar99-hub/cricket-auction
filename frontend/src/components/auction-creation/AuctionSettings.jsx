import { createSignal, Show } from 'solid-js';

export default function AuctionSettings(props) {
  const [formData, setFormData] = createSignal({
    timerDuration: props.data.timerDuration || 10,
    tradeWindowDuration: props.data.tradeWindowDuration || 24
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    const data = formData();
    props.onUpdate('timerDuration', data.timerDuration);
    props.onUpdate('tradeWindowDuration', data.tradeWindowDuration);
    props.onNext();
  };

  return (
    <div class="bg-[#1a1a1a] rounded-lg p-6 max-w-2xl mx-auto">
      <h2 class="text-xl font-bold mb-6">Auction Settings</h2>
      
      <div class="space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Timer Duration (seconds)
          </label>
          <input
            type="number"
            value={formData().timerDuration}
            onInput={(e) => updateField('timerDuration', parseInt(e.target.value) || 10)}
            min="5"
            max="120"
            class="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-[#0f0f0f] text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <p class="mt-1 text-xs text-gray-400">Time allowed for each bid (resets on every bid)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Trade Window Duration (hours)
          </label>
          <input
            type="number"
            value={formData().tradeWindowDuration}
            onInput={(e) => updateField('tradeWindowDuration', parseInt(e.target.value) || 24)}
            min="1"
            max="168"
            class="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-[#0f0f0f] text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <p class="mt-1 text-xs text-gray-400">Time window for post-auction trades (1-168 hours)</p>
        </div>
      </div>

      <div class="flex gap-2 mt-8">
        <button
          onClick={props.onBack}
          class="flex-1 px-3 py-2.5 md:px-6 bg-gray-800 hover:bg-gray-700 text-white text-sm md:text-base font-medium rounded-lg transition-all"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          class="flex-[2] px-3 py-2.5 md:px-6 bg-emerald-600 hover:bg-emerald-500 text-white text-sm md:text-base font-medium rounded-lg transition-all"
        >
          Continue to Team Selection
        </button>
      </div>
    </div>
  );
}
