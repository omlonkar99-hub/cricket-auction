import { createSignal, Show } from 'solid-js';

export default function UsernamePrompt(props) {
  const [username, setUsername] = createSignal(
    localStorage.getItem('userDisplayName') || ''
  );
  const [isOpen, setIsOpen] = createSignal(!localStorage.getItem('userDisplayName'));
  const [error, setError] = createSignal('');

  const handleSave = () => {
    const name = username().trim();
    if (!name) {
      setError('Please enter a username');
      return;
    }
    if (name.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    if (name.length > 50) {
      setError('Username must be less than 50 characters');
      return;
    }
    
    localStorage.setItem('userDisplayName', name);
    setIsOpen(false);
    props.onSave?.(name);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <Show when={isOpen()}>
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] px-4">
        <div class="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl">
          <h2 class="text-xl font-bold text-white mb-2">Welcome to Cricketive</h2>
          <p class="text-sm text-gray-400 mb-6">
            Enter your display name. You can change it anytime.
          </p>

          <div class="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Your display name"
                value={username()}
                onInput={(e) => {
                  setUsername(e.currentTarget.value);
                  setError('');
                }}
                onKeyPress={handleKeyPress}
                maxLength="50"
                class="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                autofocus
              />
              <p class="text-xs text-gray-500 mt-1">{username().length}/50</p>
            </div>

            <Show when={error()}>
              <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p class="text-xs text-red-400">{error()}</p>
              </div>
            </Show>

            <button
              onClick={handleSave}
              class="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
