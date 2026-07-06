import { createSignal, Show } from 'solid-js';

export default function NoAuthAuctionBasicInfo(props) {
  const [formData, setFormData] = createSignal({
    name: props.data.name || '',
    description: props.data.description || '',
    visibility: props.data.visibility || 'public'
  });
  const [errors, setErrors] = createSignal({});

  const validate = () => {
    const newErrors = {};
    const data = formData();
    
    if (!data.name.trim()) {
      newErrors.name = 'Auction name is required';
    }
    
    if (data.visibility === 'private' && !data.accessCode?.trim()) {
      newErrors.accessCode = 'Access code is required for private auctions';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      const data = formData();
      props.onUpdate('name', data.name);
      props.onUpdate('description', data.description);
      props.onUpdate('visibility', data.visibility);
      props.onUpdate('accessCode', data.accessCode || '');
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
            placeholder="e.g., IPL 2024 Auction"
            class={`w-full px-3 py-2.5 bg-[#1a1a1a] border ${
              errors().name ? 'border-red-500' : 'border-gray-700'
            } rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-400 transition-colors outline-none`}
          />
          <Show when={errors().name}>
            <p class="mt-1 text-xs text-red-400">{errors().name}</p>
          </Show>
        </div>

        {/* Description */}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Description <span class="text-gray-600">(Optional)</span>
          </label>
          <textarea
            value={formData().description}
            onInput={(e) => updateField('description', e.target.value)}
            placeholder="Add details about your auction..."
            rows="3"
            class="w-full px-3 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-400 transition-colors outline-none resize-none"
          />
        </div>

        {/* Visibility */}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">
            Auction Visibility <span class="text-red-400">*</span>
          </label>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors" 
              classList={{"border-purple-400 bg-purple-400/10": formData().visibility === 'public'}}>
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={formData().visibility === 'public'}
                onChange={() => updateField('visibility', 'public')}
                class="w-4 h-4"
              />
              <div class="flex-1">
                <p class="text-sm font-medium">Public</p>
                <p class="text-xs text-gray-400">Anyone can discover and join this auction</p>
              </div>
            </label>
            
            <label class="flex items-center gap-3 p-3 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors"
              classList={{"border-purple-400 bg-purple-400/10": formData().visibility === 'private'}}>
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={formData().visibility === 'private'}
                onChange={() => updateField('visibility', 'private')}
                class="w-4 h-4"
              />
              <div class="flex-1">
                <p class="text-sm font-medium">Private</p>
                <p class="text-xs text-gray-400">Only invited users with access code can join</p>
              </div>
            </label>
          </div>
        </div>

        {/* Access Code for Private Auctions */}
        <Show when={formData().visibility === 'private'}>
          <div>
            <label class="block text-xs font-medium text-gray-400 mb-2">
              Access Code <span class="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData().accessCode || ''}
              onInput={(e) => updateField('accessCode', e.target.value)}
              placeholder="Enter access code (5-10 characters)"
              maxLength="10"
              class={`w-full px-3 py-2.5 bg-[#1a1a1a] border ${
                errors().accessCode ? 'border-red-500' : 'border-gray-700'
              } rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-400 transition-colors outline-none`}
            />
            <Show when={errors().accessCode}>
              <p class="mt-1 text-xs text-red-400">{errors().accessCode}</p>
            </Show>
            <p class="mt-1 text-xs text-gray-500">
              Share this code with people you want to invite to the auction
            </p>
          </div>
        </Show>
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
