import { createSignal, Show } from 'solid-js';
import { apiCall } from '../utils/api.js';

export default function AdminLogin(props) {
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    if (!username().trim() || !password().trim()) {
      setError('Please enter username and password');
      return;
    }

    try {
      setLoading(true);
      const res = await apiCall('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username().trim(),
          password: password().trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || 'Login failed');
        return;
      }

      // Store token and redirect to dashboard
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUsername', username());
      
      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        {/* Header */}
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold mb-2">Cricketive</h1>
          <p class="text-gray-400">Admin Dashboard</p>
        </div>

        {/* Login Form */}
        <div class="bg-[#1a1a1a] border border-gray-800 rounded-lg p-8">
          <form onSubmit={handleLogin} class="space-y-4">
            {/* Error Message */}
            <Show when={error()}>
              <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p class="text-sm text-red-400">{error()}</p>
              </div>
            </Show>

            {/* Username */}
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                placeholder="superadmin"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                disabled={loading()}
              />
            </div>

            {/* Password */}
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                disabled={loading()}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading()}
              class="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors mt-6"
            >
              <Show when={loading()} fallback="Login">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Logging in...
                </div>
              </Show>
            </button>
          </form>
        </div>

        {/* Back Link */}
        <div class="text-center mt-6">
          <a
            href="/"
            class="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
