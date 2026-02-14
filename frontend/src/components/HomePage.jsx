import { createSignal, onMount, Show, onCleanup } from 'solid-js';

const IPL_TEAMS = [
  { name: 'MI', color: '#004BA0' },
  { name: 'CSK', color: '#FDB913' },
  { name: 'RCB', color: '#EC1C24' },
  { name: 'KKR', color: '#3A225D' },
  { name: 'DC', color: '#0078BC' },
  { name: 'PBKS', color: '#ED1B24' },
  { name: 'RR', color: '#EC4899' }, // Pink
  { name: 'SRH', color: '#FF822A' },
  { name: 'GT', color: '#1C2A3A' },
  { name: 'LSG', color: '#4EAEE8' }
];

export default function HomePage(props) {
  const [showUserMenu, setShowUserMenu] = createSignal(false);
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [showHeader, setShowHeader] = createSignal(true);
  const [lastScrollY, setLastScrollY] = createSignal(0);
  const [currentBid, setCurrentBid] = createSignal({
    team: IPL_TEAMS[0].name,
    color: IPL_TEAMS[0].color,
    amount: 2.5
  });

  let bidInterval;

  onMount(() => {
    setIsLoaded(true);
    
    // Start bid animation
    bidInterval = setInterval(() => {
      const randomTeam = IPL_TEAMS[Math.floor(Math.random() * IPL_TEAMS.length)];
      const increment = 0.25; // 25 lakh = 0.25 crore
      setCurrentBid(prev => ({
        team: randomTeam.name,
        color: randomTeam.color,
        amount: parseFloat((prev.amount + increment).toFixed(2))
      }));
    }, 2500);
    
    // Scroll detection
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 10) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY()) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    onCleanup(() => {
      window.removeEventListener('scroll', handleScroll);
      if (bidInterval) clearInterval(bidInterval);
    });
  });

  const handleLogout = () => {
    if (confirm('Logout?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const isAdmin = () => props.currentUser?.role === 'superadmin' || props.currentUser?.role === 'admin';

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white">
      {/* Top Bar - Transparent with scroll hide */}
      <div class={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${showHeader() ? 'translate-y-0' : '-translate-y-full'}`}>
        <div class="px-4 sm:px-6 h-14 flex items-center justify-between max-w-[1400px] mx-auto">
          {/* Left: Brand */}
          <div class="flex items-center">
            <span class="text-lg font-bold">Cricketive</span>
          </div>

          {/* Right: User Menu or Login */}
          <div class="relative">
            <Show when={props.isAuthenticated} fallback={
              <button
                onClick={props.onLoginRequest}
                class="px-4 py-2 text-purple-400 hover:text-purple-300 text-sm font-semibold transition-colors"
              >
                Login
              </button>
            }>
              <button
                onClick={() => setShowUserMenu(!showUserMenu())}
                class="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
              >
                <Show
                  when={isAdmin()}
                  fallback={
                    <div class="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">
                      {props.currentUser?.username?.substring(0, 2).toUpperCase() || 'AD'}
                    </div>
                  }
                >
                  <div class="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center p-1.5 shrink-0">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      class="w-full h-full"
                      stroke="white"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M12.1207 15.5C10.3492 15.5 8.62069 15.9746 7.08569 16.8797C5.55069 17.7848 4.25779 19.0903 3.32689 20.6746C3.23659 20.8316 3.19144 20.9101 3.18214 21.0219C3.17404 21.1191 3.18839 21.2536 3.24149 21.3393C3.30149 21.4366 3.39979 21.5 3.59639 21.6269C6.54779 23.5 10.1395 24.5 12.1207 24.5C14.1019 24.5 17.6936 23.5 20.645 21.6269C20.8416 21.5 20.9399 21.4366 20.9999 21.3393C21.053 21.2536 21.0674 21.1191 21.0593 21.0219C21.05 20.9101 21.0048 20.8316 20.9145 20.6746C19.9836 19.0903 18.6907 17.7848 17.1557 16.8797C15.6207 15.9746 13.8922 15.5 12.1207 15.5Z" />
                      <path d="M12.1207 12.5C14.8821 12.5 17.1207 10.2614 17.1207 7.5C17.1207 4.73858 14.8821 2.5 12.1207 2.5C9.35928 2.5 7.1207 4.73858 7.1207 7.5C7.1207 10.2614 9.35928 12.5 12.1207 12.5Z" />
                      <path d="M19.1207 2.5C19.1207 2.5 20.1207 3.4 20.1207 5C20.1207 6.6 19.1207 7.5 19.1207 7.5" />
                      <path d="M5.1207 2.5C5.1207 2.5 4.1207 3.4 4.1207 5C4.1207 6.6 5.1207 7.5 5.1207 7.5" />
                    </svg>
                  </div>
                </Show>
                <span class="text-sm font-medium hidden sm:inline">{props.currentUser?.username}</span>
                <svg class={`w-4 h-4 transition-transform ${showUserMenu() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <Show when={showUserMenu()}>
                <div class="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-xl overflow-hidden animate-scale-in">
                  <div class="p-3 border-b border-gray-800">
                    <p class="text-xs text-gray-400">Signed in as</p>
                    <p class="text-sm font-semibold">{props.currentUser?.username}</p>
                    <p class="text-xs text-purple-400">{props.currentUser?.role}</p>
                  </div>
                  
                  <Show when={isAdmin()}>
                    <button
                      onClick={() => {
                        props.onNavigate('dashboard');
                        setShowUserMenu(false);
                      }}
                      class="w-full px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors flex items-center gap-2"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Dashboard
                    </button>
                  </Show>

                  <button
                    onClick={() => {
                      handleLogout();
                      setShowUserMenu(false);
                    }}
                    class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 border-t border-gray-800"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div class="relative overflow-hidden">
        <div class="relative max-w-6xl mx-auto px-6 pt-20 sm:pt-24 pb-12 text-center">
          <h1 class={`text-4xl sm:text-5xl md:text-6xl font-bold mb-4 tracking-tight leading-tight transition-all duration-1000 ${isLoaded() ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Cricket auctions<br />
            <span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">reimagined</span>
          </h1>
          <p class={`text-base sm:text-lg text-gray-400 mb-8 max-w-2xl mx-auto transition-all duration-1000 delay-150 ${isLoaded() ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Build your dream team with real-time bidding
          </p>

          {/* Live Bidding Animation */}
          <div class={`mb-10 transition-all duration-1000 delay-300 ${isLoaded() ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div class="space-y-5">
              {/* Live indicator */}
              <div class="flex items-center justify-center gap-2">
                <div class="relative">
                  <div class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <div class="absolute inset-0 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping"></div>
                </div>
                <span class="text-xs text-gray-500 font-medium uppercase tracking-widest">Live Bidding</span>
              </div>
              
              {/* Single Bid */}
              <div class="flex items-center justify-center gap-8 max-w-2xl mx-auto">
                {/* Team name */}
                <div 
                  class="text-4xl sm:text-5xl font-bold tracking-tight transition-all duration-500"
                  style={{ 
                    color: currentBid().color,
                    "font-family": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                    "text-shadow": `0 0 30px ${currentBid().color}40`
                  }}
                >
                  {currentBid().team}
                </div>
                
                {/* Bid amount */}
                <div class="flex items-baseline gap-2">
                  <span 
                    class="text-4xl sm:text-5xl font-bold transition-all duration-500"
                    style={{ 
                      color: currentBid().color,
                      "font-family": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                      "text-shadow": `0 0 30px ${currentBid().color}40`
                    }}
                  >
                    ₹{currentBid().amount}
                  </span>
                  <span class="text-lg text-green-400">Cr</span>
                </div>
              </div>
            </div>
          </div>

          <div class={`transition-all duration-1000 delay-500 ${isLoaded() ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              onClick={() => props.onNavigate('auctions')}
              class="px-8 py-4 bg-white/10 backdrop-blur-xl border border-white/20 hover:border-purple-400/50 hover:bg-white/15 text-white rounded-xl text-base font-semibold transition-all shadow-lg hover:shadow-purple-500/20 hover:scale-105"
            >
              Browse Auctions →
            </button>
          </div>
        </div>
      </div>

      <div class="h-8"></div>
    </div>
  );
}
