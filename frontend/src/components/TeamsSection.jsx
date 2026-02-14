export default function TeamsSection() {
  const teams = [
    { name: 'Mumbai Indians', short: 'MI', budget: 45.50, squad: 12, oversea: 3 },
    { name: 'Chennai Super Kings', short: 'CSK', budget: 38.25, squad: 15, oversea: 4 },
    { name: 'Royal Challengers', short: 'RCB', budget: 52.00, squad: 10, oversea: 2 },
    { name: 'Kolkata Knight Riders', short: 'KKR', budget: 41.75, squad: 13, oversea: 3 },
  ];

  return (
    <div class="p-4 pb-24">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-3xl font-bold mb-6 tracking-tight">All Teams</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <div class="glass rounded-2xl p-5 border border-gray-200/50 dark:border-gray-700/50 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
              <div class="flex items-center gap-4 mb-4">
                <div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  {team.short}
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-bold">{team.name}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Team {team.short}</p>
                </div>
              </div>
              
              <div class="grid grid-cols-3 gap-3">
                <div class="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Budget</p>
                  <p class="text-lg font-bold text-green-600 dark:text-green-400">₹{team.budget}</p>
                </div>
                <div class="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Squad</p>
                  <p class="text-lg font-bold text-blue-600 dark:text-blue-400">{team.squad}/25</p>
                </div>
                <div class="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Oversea</p>
                  <p class="text-lg font-bold text-purple-600 dark:text-purple-400">{team.oversea}/8</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
