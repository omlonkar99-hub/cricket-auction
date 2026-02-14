import { createSignal, onMount, Show, For } from 'solid-js';
import { apiCall } from '../utils/api';

export default function ManagePlayers(props) {
  const [players, setPlayers] = createSignal([]);
  const [showModal, setShowModal] = createSignal(false);
  const [editingPlayer, setEditingPlayer] = createSignal(null);
  const [playerName, setPlayerName] = createSignal('');
  const [role, setRole] = createSignal('Batsman');
  const [basePrice, setBasePrice] = createSignal(1);
  const [isOverseas, setIsOverseas] = createSignal(false);
  const [imageFile, setImageFile] = createSignal(null);
  const [imagePreview, setImagePreview] = createSignal('');
  const [uploadError, setUploadError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  
  // Filters and search
  const [searchQuery, setSearchQuery] = createSignal('');
  const [roleFilter, setRoleFilter] = createSignal('All');

  const roles = ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'];
  const roleOrder = { 'Batsman': 1, 'Bowler': 2, 'Wicket-keeper': 3, 'All-rounder': 4 };
  const roleShortNames = { 
    'Batsman': 'Bat', 
    'Bowler': 'Bowl', 
    'All-rounder': 'AR', 
    'Wicket-keeper': 'WK' 
  };

  onMount(() => {
    fetchPlayers();
  });

  const fetchPlayers = async () => {
    try {
      const res = await apiCall('/api/players');
      const data = await res.json();
      setPlayers(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Sort players by role order
  const sortedPlayers = () => {
    return [...players()].sort((a, b) => {
      const orderA = roleOrder[a.role] || 999;
      const orderB = roleOrder[b.role] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.id - b.id;
    });
  };

  // Filter and search
  const filteredPlayers = () => {
    let result = sortedPlayers();
    
    if (roleFilter() !== 'All') {
      result = result.filter(p => p.role === roleFilter());
    }
    
    if (searchQuery().trim()) {
      const query = searchQuery().toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.role.toLowerCase().includes(query)
      );
    }
    
    return result;
  };

  const openModal = (player = null) => {
    if (player) {
      setEditingPlayer(player);
      setPlayerName(player.name);
      setRole(player.role);
      setBasePrice(player.basePrice);
      setIsOverseas(player.isOverseas || false);
      setImagePreview(player.image || '');
      setImageFile(null);
    } else {
      setEditingPlayer(null);
      setPlayerName('');
      setRole('Batsman');
      setBasePrice(1);
      setIsOverseas(false);
      setImagePreview('');
      setImageFile(null);
    }
    setUploadError('');
    setShowModal(true);
    
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlayer(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Only image files allowed');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be less than 2MB');
      return;
    }

    setUploadError('');
    setImageFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
        if (!validTypes.includes(file.type)) {
          setUploadError('Only image files allowed');
          return;
        }

        if (file.size > 2 * 1024 * 1024) {
          setUploadError('Image must be less than 2MB');
          return;
        }

        setUploadError('');
        setImageFile(file);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setUploadError('');
    try {
      let imageUrl = editingPlayer()?.image || '';

      // Only upload image if a new file is selected
      if (imageFile()) {
        const formData = new FormData();
        formData.append('image', imageFile());
        formData.append('folder', 'players');

        const uploadRes = await apiCall('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json().catch(() => ({}));
          throw new Error(uploadData.error || 'Image upload failed');
        }
        
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url;
      }

      const method = editingPlayer() ? 'PUT' : 'POST';
      const url = editingPlayer() ? `/api/players/${editingPlayer().id}` : '/api/players';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playerName(),
          role: role(),
          basePrice: basePrice(),
          isOverseas: isOverseas(),
          image: imageUrl
        })
      });

      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(errorData || 'Save failed');
      }

      await fetchPlayers();
      closeModal();
    } catch (error) {
      console.error('Error:', error);
      setUploadError(error.message || 'Failed to save player');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete player "${name}"?`)) return;
    
    try {
      const res = await apiCall(`/api/players/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchPlayers();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f0f0f] text-white pb-20 relative">
      {/* Header */}
      <div class="sticky top-0 z-50 bg-[#1a1a1a] border-b border-gray-800">
        <div class="max-w-[1280px] mx-auto px-4 py-2 flex items-center justify-between">
          <div class="flex items-center">
            <button onClick={props.onBack} class="mr-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 class="text-base font-bold">Manage Players</h1>
              <p class="text-[10px] text-gray-400">{filteredPlayers().length} of {players().length} players</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div class="max-w-[1280px] mx-auto px-4 pt-4 space-y-3">
        {/* Search */}
        <div class="relative">
          <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.target.value)}
            class="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Role filters */}
        <div class="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setRoleFilter('All')}
            class={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold whitespace-nowrap transition-colors ${
              roleFilter() === 'All' ? 'bg-emerald-600 text-white' : 'bg-[#1a1a1a] text-gray-400 border border-gray-800'
            }`}
          >
            All ({players().length})
          </button>
          <For each={roles}>
            {(r) => {
              const count = players().filter(p => p.role === r).length;
              return (
                <button
                  onClick={() => setRoleFilter(r)}
                  class={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-semibold whitespace-nowrap transition-colors ${
                    roleFilter() === r ? 'bg-emerald-600 text-white' : 'bg-[#1a1a1a] text-gray-400 border border-gray-800'
                  }`}
                >
                  <span class="md:hidden">{roleShortNames[r]} ({count})</span>
                  <span class="hidden md:inline">{r} ({count})</span>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-[1280px] mx-auto p-4">
        <Show when={filteredPlayers().length === 0} fallback={
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            <For each={filteredPlayers()}>
              {(player) => (
                <div 
                  class="bg-[#1a1a1a] rounded-xl p-2 md:p-3 border border-gray-800 hover:border-emerald-500/50 transition-colors"
                >
                  <div class="flex items-center gap-1.5 md:gap-3">
                    <Show when={player.image} fallback={
                      <div class="w-8 h-8 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] md:text-xs font-bold flex-shrink-0">
                        {player.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    }>
                      <img src={player.image} alt={player.name} class="w-8 h-8 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0" />
                    </Show>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1 mb-0.5">
                        <h3 class="text-[11px] md:text-sm font-bold truncate">{player.name}</h3>
                        <Show when={player.isOverseas}>
                          <span class="text-sm md:text-base flex-shrink-0">✈️</span>
                        </Show>
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-[9px] md:text-xs text-gray-500">{player.role}</span>
                        <span class="text-[9px] md:text-xs text-gray-600">•</span>
                        <span class="text-[9px] md:text-xs font-semibold text-emerald-400">₹{player.basePrice}Cr</span>
                      </div>
                    </div>
                    <div class="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => openModal(player)}
                        class="p-1.5 md:p-2 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <svg class="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(player.id, player.name)}
                        class="p-1.5 md:p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                      >
                        <svg class="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        }>
          <div class="text-center py-12">
            <div class="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 class="text-lg font-bold mb-2">No players yet</h3>
            <p class="text-sm text-gray-400 mb-4">Add your first player to get started</p>
            <button
              onClick={() => openModal()}
              class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold transition-colors"
            >
              Add Player
            </button>
          </div>
        </Show>
      </div>

      {/* Modal */}
      <Show when={showModal()}>
        <div 
          class="fixed inset-0 bg-black/90 flex justify-center p-4 overflow-y-auto"
          style="z-index: 999999; position: fixed; align-items: flex-start; padding-top: 2rem;"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
          onPaste={handlePaste}
        >
          <div 
            class="bg-[#2a2a2a] rounded-xl border-2 border-emerald-500/30 w-full max-w-md relative shadow-2xl flex flex-col" 
            onClick={(e) => e.stopPropagation()}
            style="max-height: calc(100vh - 4rem);"
          >
            <div class="p-2.5 border-b border-gray-700 bg-[#2a2a2a]">
              <h2 class="text-sm font-bold text-white">{editingPlayer() ? 'Edit Player' : 'Add Player'}</h2>
              <p class="text-[9px] text-gray-400 mt-0.5">Press Ctrl+V to paste image</p>
            </div>
            
            <div class="p-2.5 space-y-2.5 overflow-y-auto flex-1">
              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Player Name</label>
                <input
                  ref={el => el && el.focus()}
                  type="text"
                  value={playerName()}
                  onInput={(e) => setPlayerName(e.target.value)}
                  class="w-full px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-xs focus:border-emerald-500 focus:outline-none"
                  placeholder="Virat Kohli"
                  required
                />
              </div>

              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Role</label>
                <select
                  value={role()}
                  onInput={(e) => setRole(e.target.value)}
                  class="w-full px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-xs focus:border-emerald-500 focus:outline-none"
                >
                  <For each={roles}>
                    {(r) => <option value={r}>{r}</option>}
                  </For>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Base Price (Cr)</label>
                <select
                  value={basePrice()}
                  onInput={(e) => setBasePrice(parseFloat(e.target.value))}
                  class="w-full px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-xs focus:border-emerald-500 focus:outline-none"
                >
                  <option value={0.5}>₹0.5 Cr</option>
                  <option value={1}>₹1 Cr</option>
                  <option value={2}>₹2 Cr</option>
                </select>
              </div>

              <div>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOverseas()}
                    onChange={(e) => setIsOverseas(e.target.checked)}
                    class="w-4 h-4 rounded border-gray-800 bg-[#0f0f0f] text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span class="text-[11px] font-medium text-gray-400">Overseas Player ✈️</span>
                </label>
              </div>

              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Player Image</label>
                <div class="space-y-1.5">
                  <Show when={imagePreview()}>
                    <div class="flex items-center gap-2">
                      <img src={imagePreview()} alt="Preview" class="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      <button
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview('');
                        }}
                        class="text-[9px] text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </Show>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp,image/tiff"
                    onChange={handleImageChange}
                    class="w-full px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-[10px] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:cursor-pointer"
                  />
                  <p class="text-[9px] text-gray-500">Max 2MB • JPEG, PNG, WebP</p>
                  <Show when={uploadError()}>
                    <p class="text-[9px] text-red-400">{uploadError()}</p>
                  </Show>
                </div>
              </div>
            </div>

            <div class="p-2.5 border-t border-gray-700 flex gap-1.5 bg-[#2a2a2a]">
              <button
                onClick={closeModal}
                class="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading() || !playerName()}
                class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-xs font-semibold transition-colors"
              >
                {loading() ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
