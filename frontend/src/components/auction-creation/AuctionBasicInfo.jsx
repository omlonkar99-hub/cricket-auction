import { createSignal, Show } from 'solid-js';

export default function AuctionBasicInfo(props) {
  const [formData, setFormData] = createSignal({
    name: props.data.name || '',
    description: props.data.description || '',
    budget: props.data.budget || 100,
    squadSize: props.data.squadSize || 25,
    overseasLimit: props.data.overseasLimit || 8
  });
  const [errors, setErrors] = createSignal({});

  const validate = () => {
    const newErrors = {};
    const data = formData();
    if (!data.name.trim()) {
      newErrors.name = 'Required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      const data = formData();
      props.onUpdate('type', 'regular');
      props.onUpdate('name', data.name);
      props.onUpdate('description', data.description);
      props.onUpdate('budget', data.budget);
      props.onUpdate('squadSize', data.squadSize);
      props.onUpdate('overseasLimit', data.overseasLimit);
      props.onNext();
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors({});
  };

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <h2 class="text-xl font-bold mb-1">Basic Information</h2>
        <p class="text-sm text-gray-400">Set up your auction details</p>
      </div>
      
      <div class="space-y-4">
        {/* Auction Name */}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Auction Name <span class="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData().name}
            onInput={(e) => updateField('name', e.target.value)}
            placeholder="IPL 2026 Auction"
            class={`w-full px-3 py-2.5 bg-[#1a1a1a] border ${
              errors().name ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-400 transition-colors outline-none`}
          />
          <Show when={errors().name}>
            <p class="mt-1 text-xs text-red-400">{errors().name}</p>
          </Show>
        </div>

        {/* Budget, Squad, Overseas */}
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-2">
              Budget (Cr) <span class="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={formData().budget}
              onInput={(e) => updateField('budget', parseInt(e.target.value) || 100)}
              min="50"
              max="500"
              class="w-full px-3 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-sm focus:border-purple-400 transition-colors outline-none"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-400 mb-2">
              Squad Size <span class="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={formData().squadSize}
              onInput={(e) => updateField('squadSize', parseInt(e.target.value) || 25)}
              min="15"
              max="30"
              class="w-full px-3 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-sm focus:border-purple-400 transition-colors outline-none"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-400 mb-2">
              Overseas <span class="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={formData().overseasLimit}
              onInput={(e) => updateField('overseasLimit', parseInt(e.target.value) || 8)}
              min="4"
              max="10"
              class="w-full px-3 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-sm focus:border-purple-400 transition-colors outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Description <span class="text-gray-600">(Optional)</span>
          </label>
          <textarea
            value={formData().description}
            onInput={(e) => updateField('description', e.target.value)}
            placeholder="Add details..."
            rows="2"
            class="w-full px-3 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-400 transition-colors outline-none resize-none"
          />
        </div>
      </div>

      {/* Bottom Button */}
      <div class="mt-6 pt-4 border-t border-gray-800">
        <button
          onClick={handleNext}
          class="w-full py-2.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-all"
        >
          Continue to Teams
        </button>
      </div>
    </div>
  );
}
