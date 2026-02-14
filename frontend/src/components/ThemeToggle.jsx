import { createSignal, onMount } from 'solid-js';

export default function ThemeToggle() {
  const [isDark, setIsDark] = createSignal(false);

  onMount(() => {
    const theme = localStorage.getItem('theme') || 'light';
    setIsDark(theme === 'dark');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  });

  const toggleTheme = () => {
    const newTheme = isDark() ? 'light' : 'dark';
    setIsDark(!isDark());
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      class="p-2 rounded-full glass border border-gray-200 dark:border-gray-700 transition-all hover:scale-110"
      aria-label="Toggle theme"
    >
      <svg
        class="w-5 h-5 transition-transform"
        classList={{ 'rotate-180': isDark() }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        {isDark() ? (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </>
        )}
      </svg>
    </button>
  );
}
