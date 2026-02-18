import { createSignal, onMount, Show, For } from 'solid-js';
import { apiCall } from '../utils/api';
import { smartCompress, getFileSizeInfo } from '../utils/imageCompressor';

export default function ManageTeams(props) {
  const [teams, setTeams] = createSignal([]);
  const [showModal, setShowModal] = createSignal(false);
  const [editingTeam, setEditingTeam] = createSignal(null);
  const [teamName, setTeamName] = createSignal('');
  const [shortName, setShortName] = createSignal('');
  const [teamCode, setTeamCode] = createSignal('');
  const [teamColor, setTeamColor] = createSignal('#3B82F6'); // Default blue
  const [logoFile, setLogoFile] = createSignal(null);
  const [logoPreview, setLogoPreview] = createSignal('');
  const [uploadError, setUploadError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  
  // Search
  const [searchQuery, setSearchQuery] = createSignal('');

  onMount(() => {
    fetchTeams();
  });

  const fetchTeams = async () => {
    try {
      const res = await apiCall('/api/teams');
      const data = await res.json();
      // Teams are stored in newly added order (reverse chronological by ID)
      setTeams((data || []).sort((a, b) => b.id - a.id));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Search filter
  const filteredTeams = () => {
    if (!searchQuery().trim()) return teams();
    
    const query = searchQuery().toLowerCase();
    return teams().filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.shortName.toLowerCase().includes(query) ||
      (t.code && t.code.toLowerCase().includes(query))
    );
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTeamCode(code);
  };

  const regenerateTeamCode = async (team) => {
    if (!confirm(`Generate a new code for ${team.name}? The old code will no longer work.`)) {
      return;
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let newCode = '';
    for (let i = 0; i < 5; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      const res = await apiCall(`/api/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: team.name,
          shortName: team.shortName,
          code: newCode,
          color: team.color,
          logo: team.logo
        })
      });

      if (res.ok) {
        await fetchTeams();
        alert(`New code generated: ${newCode}`);
      } else {
        throw new Error('Failed to update code');
      }
    } catch (error) {
      console.error('Error regenerating code:', error);
      alert('Failed to generate new code. Please try again.');
    }
  };

  const openModal = (team = null) => {
    if (team) {
      setEditingTeam(team);
      setTeamName(team.name);
      setShortName(team.shortName);
      setTeamCode(team.code || '');
      setTeamColor(team.color || '#3B82F6');
      setLogoPreview(team.logo || '');
      setLogoFile(null);
    } else {
      setEditingTeam(null);
      setTeamName('');
      setShortName('');
      setTeamColor('#3B82F6');
      setLogoPreview('');
      setLogoFile(null);
      generateCode();
    }
    setUploadError('');
    setShowModal(true);
    
    // Scroll to top when modal opens
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTeam(null);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type (images only, no GIF)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Only image files are allowed (JPEG, PNG, WebP, BMP, TIFF)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size must be less than 5MB');
      return;
    }

    setUploadError('');
    
    try {
      // Show original file size
      const originalSize = getFileSizeInfo(file);
      setUploadError(`Compressing... (${originalSize.formatted})`);
      
      // Compress image
      const compressedFile = await smartCompress(file);
      const compressedSize = getFileSizeInfo(compressedFile);
      
      setLogoFile(compressedFile);
      
      // Show compression result
      if (compressedFile.size < file.size) {
        setUploadError(`Compressed: ${originalSize.formatted} → ${compressedSize.formatted}`);
        setTimeout(() => setUploadError(''), 2000);
      } else {
        setUploadError('');
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      setUploadError('Image compression failed');
      console.error('Compression error:', error);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
        if (!validTypes.includes(file.type)) {
          setUploadError('Only image files are allowed (JPEG, PNG, WebP, BMP, TIFF)');
          return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setUploadError('Image size must be less than 5MB');
          return;
        }

        setUploadError('');
        
        try {
          // Show original file size
          const originalSize = getFileSizeInfo(file);
          setUploadError(`Compressing... (${originalSize.formatted})`);
          
          // Compress image
          const compressedFile = await smartCompress(file);
          const compressedSize = getFileSizeInfo(compressedFile);
          
          setLogoFile(compressedFile);
          
          // Show compression result
          if (compressedFile.size < file.size) {
            setUploadError(`Compressed: ${originalSize.formatted} → ${compressedSize.formatted}`);
            setTimeout(() => setUploadError(''), 2000);
          } else {
            setUploadError('');
          }
          
          // Create preview
          const reader = new FileReader();
          reader.onloadend = () => {
            setLogoPreview(reader.result);
          };
          reader.readAsDataURL(compressedFile);
        } catch (error) {
          setUploadError('Image compression failed');
          console.error('Compression error:', error);
        }
        break;
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let logoUrl = editingTeam()?.logo || '';

      // Upload logo if new file selected
      if (logoFile()) {
        const formData = new FormData();
        formData.append('image', logoFile());
        formData.append('folder', 'teams');

        const uploadRes = await apiCall('/api/upload', {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Logo upload failed');
        }
        if (!uploadData.url || typeof uploadData.url !== 'string') {
          throw new Error('Upload did not return an image URL. Check Cloudinary config in backend .env');
        }
        logoUrl = uploadData.url;
      }

      const method = editingTeam() ? 'PUT' : 'POST';
      const url = editingTeam() ? `/api/teams/${editingTeam().id}` : '/api/teams';

      const res = await apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName(),
          shortName: shortName(),
          code: teamCode(),
          color: teamColor(),
          logo: logoUrl
        })
      });

      const responseText = await res.text();
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { error: responseText || `Save failed (${res.status})` };
      }
      if (res.ok) {
        await fetchTeams();
        closeModal();
      } else {
        throw new Error(data.error || data.message || `Save failed (${res.status})`);
      }
    } catch (error) {
      console.error('Error:', error);
      setUploadError(error.message || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this team?')) return;
    
    try {
      const res = await apiCall(`/api/teams/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchTeams();
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
              <h1 class="text-base font-bold">Manage Teams</h1>
              <p class="text-[10px] text-gray-400">{filteredTeams().length} of {teams().length} teams</p>
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

      {/* Search */}
      <div class="max-w-[1280px] mx-auto px-4 pt-4">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.target.value)}
            class="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div class="max-w-[1280px] mx-auto p-4">
        <Show when={filteredTeams().length === 0} fallback={
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            <For each={filteredTeams()}>
              {(team) => (
                <div 
                  class="bg-[#1a1a1a] rounded-xl p-2.5 md:p-3 border border-gray-800 hover:border-emerald-500/50 transition-colors"
                >
                  <div class="flex gap-2">
                    {/* Left side: Team image and info */}
                    <div class="flex-1 flex flex-col items-center text-center min-w-0">
                      <Show when={team.logo} fallback={
                        <div 
                          class="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-sm md:text-base font-bold flex-shrink-0 mb-2"
                          style={{ "background-color": team.color || '#3B82F6' }}
                        >
                          {team.shortName || 'T'}
                        </div>
                      }>
                        <img src={team.logo} alt={team.name} class="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover flex-shrink-0 mb-2" />
                      </Show>
                      <h3 class="text-xs md:text-sm font-bold mb-2 w-full px-1 line-clamp-2" style="word-break: break-word; line-height: 1.2;">{team.name}</h3>
                      <Show when={team.code}>
                        <div class="flex items-baseline gap-1.5 px-2 py-1.5 bg-gray-800/50 rounded border border-gray-700/50">
                          <span class="font-bold text-sm text-gray-200">{team.shortName}</span>
                          <span class="text-gray-600 text-sm">•</span>
                          <span class="font-mono font-bold text-sm text-emerald-400 tracking-wider">{team.code}</span>
                        </div>
                      </Show>
                    </div>
                    
                    {/* Right side: Action buttons */}
                    <div class="flex flex-col gap-1 flex-shrink-0">
                      <Show when={team.code}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(team.code);
                            // Show brief feedback
                            const btn = e.currentTarget;
                            const originalHTML = btn.innerHTML;
                            btn.innerHTML = '<svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
                            setTimeout(() => {
                              btn.innerHTML = originalHTML;
                            }, 1000);
                          }}
                          class="p-1.5 hover:bg-gray-700 rounded-md transition-colors"
                          title="Copy code"
                        >
                          <svg class="w-3.5 h-3.5 text-gray-400 hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                          </svg>
                        </button>
                      </Show>
                      <Show when={team.code}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            regenerateTeamCode(team);
                          }}
                          class="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded-md transition-colors"
                          title="Change code"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      </Show>
                      <button
                        onClick={() => openModal(team)}
                        class="p-1.5 hover:bg-gray-800 rounded-md transition-colors"
                        title="Edit team"
                      >
                        <svg class="w-3.5 h-3.5 text-gray-400 hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(team.id)}
                        class="p-1.5 hover:bg-red-500/10 text-red-400 rounded-md transition-colors"
                        title="Delete team"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-bold mb-2">No teams yet</h3>
            <p class="text-sm text-gray-400 mb-4">Add your first team to get started</p>
            <button
              onClick={() => openModal()}
              class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold transition-colors"
            >
              Add Team
            </button>
          </div>
        </Show>
      </div>

      {/* Modal - Portal to body level */}
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
              <h2 class="text-sm font-bold text-white">{editingTeam() ? 'Edit Team' : 'Add Team'}</h2>
              <p class="text-[9px] text-gray-400 mt-0.5">Press Ctrl+V to paste logo</p>
            </div>
            
            <div class="p-2.5 space-y-2.5 overflow-y-auto flex-1">
              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Team Name</label>
                <input
                  ref={el => el && el.focus()}
                  type="text"
                  value={teamName()}
                  onInput={(e) => setTeamName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.querySelector('input[placeholder="MI"]')?.focus();
                    }
                  }}
                  class="w-full px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-xs focus:border-emerald-500 focus:outline-none"
                  placeholder="Mumbai Indians"
                  required
                />
              </div>

              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Short Name</label>
                <input
                  type="text"
                  value={shortName()}
                  onInput={(e) => setShortName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.querySelector('input[placeholder="ABCDE"]')?.focus();
                    }
                  }}
                  class="w-full px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-xs focus:border-emerald-500 focus:outline-none"
                  placeholder="MI"
                  maxLength="3"
                  required
                />
              </div>

              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Team Code</label>
                <div class="flex gap-1.5">
                  <input
                    type="text"
                    value={teamCode()}
                    onInput={(e) => setTeamCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.querySelector('input[type="color"]')?.focus();
                      }
                    }}
                    class="flex-1 px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                    placeholder="ABCDE"
                    maxLength="5"
                    required
                  />
                  <button
                    onClick={generateCode}
                    class="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Team Color</label>
                <div class="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={teamColor()}
                    onInput={(e) => setTeamColor(e.target.value)}
                    class="flex-1 min-w-0 px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                    placeholder="#3B82F6"
                    maxLength="7"
                  />
                  <label class="relative cursor-pointer">
                    <input
                      type="color"
                      value={teamColor()}
                      onInput={(e) => setTeamColor(e.target.value)}
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div 
                      class="w-10 h-10 rounded-lg border-2 border-gray-800 flex-shrink-0"
                      style={{ "background-color": teamColor() }}
                    ></div>
                  </label>
                </div>
                <p class="text-[9px] text-gray-500 mt-0.5">Enter hex or click color box</p>
              </div>

              <div>
                <label class="block text-[11px] font-medium text-gray-400 mb-1">Team Logo</label>
                <div class="space-y-1.5">
                  <Show when={logoPreview()}>
                    <div class="flex items-center gap-2">
                      <img src={logoPreview()} alt="Preview" class="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      <button
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview('');
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
                    onChange={handleLogoChange}
                    class="w-full px-2.5 py-1.5 bg-[#0f0f0f] border border-gray-800 rounded-lg text-white text-[10px] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 file:cursor-pointer"
                  />
                  <p class="text-[9px] text-gray-500">Max 5MB • Auto-compressed • JPEG, PNG, WebP</p>
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
                disabled={loading() || !teamName() || !shortName()}
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
