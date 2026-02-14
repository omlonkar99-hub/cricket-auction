export default function UpcomingSection() {
  const upcomingPlayers = [
    { name: 'Virat Kohli', role: 'Batsman', basePrice: 15.00, order: 5 },
    { name: 'Jasprit Bumrah', role: 'Bowler', basePrice: 14.00, order: 6 },
    { name: 'KL Rahul', role: 'Wicket Keeper', basePrice: 13.50, order: 7 },
    { name: 'Rashid Khan', role: 'All Rounder', basePrice: 12.00, order: 8 },
    { name: 'David Warner', role: 'Batsman', basePrice: 11.50, order: 9 },
  ];

  return (
    <div class="p-4 pb-24">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-3xl font-bold mb-6 tracking-tight">Upcoming Players</h2>
        
        <div class="space-y-3">
          {upcomingPlayers.map((player, index) => (
            <div class="glass rounded-2xl p-4 border border-gray-200/50 dark:border-gray-700/50 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                  #{player.order}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-lg font-bold truncate">{player.name}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{player.role}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-500 dark:text-gray-400">Base Price</p>
                  <p class="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
