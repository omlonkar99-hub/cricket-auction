export default function UnsoldSection() {
  const unsoldPlayers = [
    { name: 'Player One', role: 'Batsman', basePrice: 8.00 },
    { name: 'Player Two', role: 'Bowler', basePrice: 7.50 },
    { name: 'Player Three', role: 'All Rounder', basePrice: 9.00 },
    { name: 'Player Four', role: 'Wicket Keeper', basePrice: 6.50 },
  ];

  return (
    <div class="p-4 pb-24">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-3xl font-bold mb-6 tracking-tight">Unsold Players</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          {unsoldPlayers.map((player) => (
            <div class="glass rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 opacity-60">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 text-xl font-bold">
                  <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-base font-bold truncate">{player.name}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{player.role}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Base</p>
                  <p class="text-base font-bold text-gray-600 dark:text-gray-400">
                    ₹{player.basePrice.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
