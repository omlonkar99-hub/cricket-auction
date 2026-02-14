import { createSignal, onMount, onCleanup } from 'solid-js';

export default function AuctionHeader() {
  const [ping, setPing] = createSignal(0);

  let pingInterval;

  onMount(() => {
    // Simulate ping check
    pingInterval = setInterval(() => {
      const randomPing = Math.floor(Math.random() * 50) + 10;
      setPing(randomPing);
    }, 2000);
  });

  onCleanup(() => clearInterval(pingInterval));

  const getPingColor = () => {
    if (ping() < 30) return 'bg-green-500';
    if (ping() < 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <header class="glass border-b border-gray-200/50 dark:border-gray-700/50 px-4 py-2 sticky top-0 z-50 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left - Team Info (Compact) */}
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-lg">
            MI
          </div>
          <div class="hidden sm:block">
            <h2 class="text-xs font-semibold tracking-tight">Mumbai Indians</h2>
          </div>
        </div>
        
        {/* Right - Ping Status */}
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-gray-200 dark:border-gray-700">
          <div class={`w-2 h-2 rounded-full ${getPingColor()} animate-pulse`}></div>
          <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{ping()}ms</span>
        </div>
      </div>
    </header>
  );
}
