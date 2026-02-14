import { createSignal } from 'solid-js';

export default function TradeSettings(props) {
  const [formData, setFormData] = createSignal({
    enableTradeWindow: props.data.enableTradeWindow || false,
    tradeWindowDuration: props.data.tradeWindowDuration || 7
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    const data = formData();
    props.onUpdate('enableTradeWindow', data.enableTradeWindow);
    props.onUpdate('tradeWindowDuration', data.tradeWindowDuration);
    props.onNext();
  };

  return (
    <div class="bg-[#1a1a1a] rounded-lg p-6 max-w-2xl mx-auto">
      <h2 class="text-xl font-bold mb-6">Trade Window Settings</h2>
      
      <div class="space-y-5">
        <div class="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
          <div>
            <h3 class="text-sm font-medium text-gray-300">Enable Trade Window</h3>
            <p class="text-xs text-gray-400">Allow teams to trade players after auction</p>
          </div>
          <button
            onClick={() => updateField('enableTradeWindow', !formData().enableTradeWindow)}
            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData().enableTradeWindow ? 'bg-purple-500' : 'bg-gray-700'
            }`}
          >
            <span
              class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData().enableTradeWindow ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {formData().enableTradeWindow && (
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Trade Window Duration (days)
            </label>
            <input
              type="number"
              value={formData().tradeWindowDuration}
              onInput={(e) => updateField('tradeWindowDuration', parseInt(e.target.value) || 7)}
              min="1"
              max="30"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-700 bg-[#0f0f0f] text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p class="mt-1 text-xs text-gray-400">Number of days teams can trade players</p>
          </div>
        )}

        <div class="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <h3 class="text-sm font-medium text-purple-300 mb-2">About Trade Window</h3>
          <p class="text-xs text-gray-400">
            During the trade window, teams can exchange players with each other. This happens after the auction is completed.
          </p>
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
          class="flex-[2] px-3 py-2.5 md:px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm md:text-base font-medium rounded-lg transition-all"
        >
          Review & Create
        </button>
      </div>
    </div>
  );
}
