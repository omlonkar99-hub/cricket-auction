import { Show, createSignal, onMount } from 'solid-js';

export default function HomePage(props) {
  const [currentBid, setCurrentBid] = createSignal(null);

  const iplTeams = [
    { name: 'Mumbai Indians', color: '#004B9B' },
    { name: 'Chennai Super Kings', color: '#FDB913' },
    { name: 'Royal Challengers Bangalore', color: '#EC1C24' },
    { name: 'Kolkata Knight Riders', color: '#3D0066' },
    { name: 'Delhi Capitals', color: '#004C97' },
    { name: 'Rajasthan Royals', color: '#D4317B' },
    { name: 'Punjab Kings', color: '#E74C3C' },
    { name: 'Sunrisers Hyderabad', color: '#FF7A00' },
    { name: 'Lucknow Super Giants', color: '#4A90E2' },
    { name: 'Gujarat Titans', color: '#00A8E1' }
  ];

  const isAdmin = () => props.currentUser?.role === 'superadmin' || props.currentUser?.role === 'admin';

  onMount(() => {
    // Show one bid at a time
    const interval = setInterval(() => {
      const randomTeam = iplTeams[Math.floor(Math.random() * iplTeams.length)];
      const randomAmount = (Math.floor(Math.random() * 20) + 5);
      
      setCurrentBid({ team: randomTeam, amount: randomAmount, id: Date.now() });
    }, 2000);

    return () => clearInterval(interval);
  });

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <div class="fixed top-0 left-0 right-0 z-50 bg-[#0f0f0f] border-b border-gray-800">
        <div class="px-4 sm:px-6 h-14 flex items-center justify-between max-w-[1400px] mx-auto w-full">
          <button
            onClick={() => props.onNavigate('adminLogin')}
            class="text-lg font-bold text-white hover:text-gray-300 transition-colors"
          >
            Cricketive
          </button>
          <Show when={isAdmin()}>
            <button
              onClick={() => props.onNavigate('dashboard')}
              class="px-4 py-1.5 text-white text-sm font-semibold transition-all bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 hover:border-gray-600"
            >
              Dashboard
            </button>
          </Show>
        </div>
      </div>

      {/* Main Content */}
      <div class="min-h-screen flex flex-col items-center justify-center px-4 pt-20">
        <div class="text-center max-w-4xl">
          {/* Branding */}
          <div class="mb-12 space-y-6">
            <h1 class="text-7xl sm:text-8xl font-black tracking-tighter leading-none text-white">
              <span class="block">Cricketive</span>
              <span class="block text-white">
                Reimagined
              </span>
            </h1>
          </div>

          {/* CTA Buttons */}
          <div class="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => props.onNavigate('auctionBrowser')}
              class="px-8 py-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-white font-bold transition-all duration-200 border border-gray-700 hover:border-gray-600 hover:shadow-lg"
            >
              Browse
            </button>
            <button
              onClick={() => props.onNavigate('createAuction')}
              class="px-8 py-4 border-2 border-gray-700 hover:border-gray-600 rounded-lg text-white font-bold transition-all duration-200 bg-[#0f0f0f] hover:bg-gray-900 hover:shadow-lg"
            >
              Create
            </button>
          </div>

          {/* Live Bidding Animation - One Bid at a Time */}
          <div class="mt-16 max-w-2xl mx-auto">
            <Show when={currentBid()} fallback={
              <div class="text-center text-gray-500">
                Waiting for bids...
              </div>
            }>
              <div 
                class="animate-in fade-in slide-in-from-right-4 duration-500 flex items-center justify-between border-l-4 pl-6"
                style={{
                  'border-left-color': currentBid().team.color,
                }}
              >
                <span 
                  class="font-bold text-4xl"
                  style={{ color: currentBid().team.color }}
                >
                  {currentBid().team.name}
                </span>
                <span class="text-green-400 font-bold text-4xl">
                  ₹{currentBid().amount} Cr
                </span>
              </div>
            </Show>
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-in {
          animation: slideIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
