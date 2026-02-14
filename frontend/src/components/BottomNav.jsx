import { createSignal } from 'solid-js';

export default function BottomNav(props) {
  return (
    <nav class="fixed bottom-0 left-0 right-0 glass border-t border-gray-200/50 dark:border-gray-700/50 backdrop-blur-xl z-40 pb-safe">
      <div class="max-w-7xl mx-auto px-2 py-2">
        <div class="grid grid-cols-4 gap-1">
          {/* Auction Room */}
          <button
            onClick={() => props.setActiveSection('auction')}
            class={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${
              props.activeSection() === 'auction'
                ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span class="text-xs font-semibold">Auction</span>
          </button>

          {/* Teams */}
          <button
            onClick={() => props.setActiveSection('teams')}
            class={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${
              props.activeSection() === 'teams'
                ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span class="text-xs font-semibold">Teams</span>
          </button>

          {/* Upcoming */}
          <button
            onClick={() => props.setActiveSection('upcoming')}
            class={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${
              props.activeSection() === 'upcoming'
                ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span class="text-xs font-semibold">Upcoming</span>
          </button>

          {/* Unsold */}
          <button
            onClick={() => props.setActiveSection('unsold')}
            class={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${
              props.activeSection() === 'unsold'
                ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span class="text-xs font-semibold">Unsold</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
