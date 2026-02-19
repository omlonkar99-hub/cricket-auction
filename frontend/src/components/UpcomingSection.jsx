import { shortenRole } from '../utils/roleShortener';
import { Show, For } from 'solid-js';

export default function UpcomingSection(props) {
  const upcomingPlayers = () => props.upcomingPlayers || [];

  return (
    <div class="p-4 pb-24">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-3xl font-bold mb-6 tracking-tight">Upcoming Players</h2>
        
        <Show when={upcomingPlayers().length > 0} fallback={
          <div class="text-center py-12">
            <p class="text-gray-400">No upcoming players</p>
          </div>
        }>
          <div class="space-y-3">
            <For each={upcomingPlayers()}>
              {(player, index) => (
                <div class="glass rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
                  <div class="flex items-center gap-4">
                    <Show when={player.image} fallback={
                      <div class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                        {player.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    }>
                      <img 
                        src={player.image} 
                        alt={player.name} 
                        class="w-12 h-12 rounded-full object-cover shadow-lg border-2 border-purple-500/50"
                      />
                    </Show>
                    <div class="flex-1 min-w-0">
                      <h3 class="text-lg font-bold truncate">{player.name}</h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400">{shortenRole(player.role)}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-xs text-gray-500 dark:text-gray-400">Base Price</p>
                      <p class="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
