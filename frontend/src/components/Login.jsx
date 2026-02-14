import { createSignal, Show } from 'solid-js';

export default function Login(props) {
  const [activeTab, setActiveTab] = createSignal('team');
  const [teamCode, setTeamCode] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleTeamLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/team-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: teamCode().toUpperCase().trim() })
      });

      if (!res.ok) {
        // Always show user-friendly message for team login
        setError('Invalid team code. Please check your 5-letter team code.');
        setLoading(false);
        return;
      }

      const data = await res.json();

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('username', data.teamName);
      localStorage.setItem('role', 'team');
      localStorage.setItem('teamId', String(data.teamId));

      props.onLogin({
        username: data.teamName,
        role: 'team',
        token: data.token,
        teamId: data.teamId,
        shortName: data.shortName
      });
    } catch (err) {
      setError('Invalid team code. Please check your 5-letter team code.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username().trim(), 
          password: password()
        })
      });

      if (!res.ok) {
        // Always show user-friendly message for admin login
        setError('Invalid username or password. Please try again.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('username', data.username);
      localStorage.setItem('role', data.role);

      props.onLogin(data);
    } catch (err) {
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center p-4 z-50 overflow-hidden animate-fade-in">
      {/* Background matching HomePage */}
      <div class="absolute inset-0">
        <div class="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent"></div>
        <div class="absolute inset-0" style={{
          "background-image": 'radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.15), transparent 50%)',
        }}></div>
      </div>

      <div class="relative z-10 w-full max-w-md">
        {/* Header */}
        <div class="text-center mb-6 animate-slide-down">
          <div class="flex items-center justify-center mb-2 relative">
            <h1 class="text-4xl font-bold">
              <span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Cricketive
              </span>
            </h1>
            {/* Close button with back arrow icon */}
            <Show when={props.onClose}>
              <button
                onClick={props.onClose}
                class="absolute -right-2 top-0 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-gray-700/50 hover:border-gray-600 transition-all"
              >
                <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            </Show>
          </div>
          <p class="text-gray-400 text-base">Welcome back</p>
        </div>

        {/* Tabs */}
        <div class="flex gap-3 mb-6">
          <button
            onClick={() => {
              setActiveTab('team');
              setError('');
            }}
            class={`flex-1 py-2.5 text-sm font-medium transition-all relative ${
              activeTab() === 'team'
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Team Manager
            <Show when={activeTab() === 'team'}>
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400"></div>
            </Show>
          </button>
          <button
            onClick={() => {
              setActiveTab('admin');
              setError('');
            }}
            class={`flex-1 py-2.5 text-sm font-medium transition-all relative ${
              activeTab() === 'admin'
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Admin
            <Show when={activeTab() === 'admin'}>
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 to-pink-400"></div>
            </Show>
          </button>
        </div>

        {/* Team Manager Form */}
        <Show when={activeTab() === 'team'}>
          <form onSubmit={handleTeamLogin} class="space-y-4 min-h-[240px] flex flex-col">
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-400 mb-1.5">Team Code</label>
              <input
                type="text"
                placeholder="ABCDE"
                value={teamCode()}
                onInput={(e) => setTeamCode(e.target.value)}
                class="w-full px-4 py-3 bg-white/5 border border-gray-800 text-white text-base placeholder-gray-600 rounded-lg focus:outline-none focus:border-purple-500 transition uppercase tracking-widest"
                maxLength={5}
                required
              />
              <p class="text-xs text-gray-500 mt-1.5">Enter your 5-letter team code</p>
            </div>

            <Show when={error()}>
              <div class="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2.5 rounded-lg text-xs">
                {error()}
              </div>
            </Show>

            <button
              type="submit"
              disabled={loading()}
              class="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-semibold text-base transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
            >
              <Show when={loading()} fallback="Join Auction">
                <span class="flex items-center justify-center gap-2">
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining...
                </span>
              </Show>
            </button>
          </form>
        </Show>

        {/* Admin Form */}
        <Show when={activeTab() === 'admin'}>
          <form onSubmit={handleAdminLogin} class="space-y-4 min-h-[240px] flex flex-col">
            <div class="space-y-4 flex-1">
              <div>
                <label class="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username()}
                  onInput={(e) => setUsername(e.target.value)}
                  class="w-full px-4 py-3 bg-white/5 border border-gray-800 text-white placeholder-gray-600 rounded-lg focus:outline-none focus:border-purple-500 transition"
                  required
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password()}
                  onInput={(e) => setPassword(e.target.value)}
                  class="w-full px-4 py-3 bg-white/5 border border-gray-800 text-white placeholder-gray-600 rounded-lg focus:outline-none focus:border-purple-500 transition"
                  required
                />
              </div>
            </div>

            <Show when={error()}>
              <div class="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2.5 rounded-lg text-xs">
                {error()}
              </div>
            </Show>

            <button
              type="submit"
              disabled={loading()}
              class="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-semibold text-base transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
            >
              <Show when={loading()} fallback="Login">
                <span class="flex items-center justify-center gap-2">
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Logging in...
                </span>
              </Show>
            </button>
          </form>
        </Show>
      </div>
    </div>
  );
}
