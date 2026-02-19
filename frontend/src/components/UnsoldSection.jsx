import { shortenRole } from '../utils/roleShortener';
import { Show, For } from 'solid-js';

export default function UnsoldSection(props) {
  const unsoldPlayers = () => props.unsoldPlayers || [];

  return (
    <div class="p-4 pb-24">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-3xl font-bold mb-6 tracking-tight">Unsold Players</h2>
        
        <Show when={unsoldPlayers().length > 0} fallback={
          <div class="text-center py-12">
            <p class="text-gray-400">No unsold players yet</p>
          </div>
        }>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <For each={unsoldPlayers()}>
              {(player) => (
                <div class="glass rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 opacity-60">
                  <div class="flex items-center gap-3">
                    <Show when={player.image} fallback={
                      <div class="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 text-xl font-bold">
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                      </div>
                    }>
                      <img 
                        src={player.image} 
                        alt={player.name} 
                        class="w-12 h-12 rounded-full object-cover shadow-lg border-2 border-gray-700"
                      />
                    </Show>
                    <div class="flex-1 min-w-0">
                      <h3 class="text-base font-bold truncate">{player.name}</h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400">{shortenRole(player.role)}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-xs text-gray-500 dark:text-gray-400">Base</p>
                      <p class="text-base font-bold text-gray-600 dark:text-gray-400">
                        ₹{player.basePrice.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
