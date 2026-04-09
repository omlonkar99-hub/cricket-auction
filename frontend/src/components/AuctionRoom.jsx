import { createSignal, onMount, onCleanup, Show, For, createEffect, createMemo } from 'solid-js';
import SkeletonLoader from './SkeletonLoader';
import { useAuctionWebSocketSolid } from '../hooks/useAuctionWebSocketSolid';
import { soundManager } from '../utils/soundManager';
import { shortenRole } from '../utils/roleShortener';
import { imagePreloader } from '../utils/imagePreloader';

export default function AuctionRoom(props) {
  const auctionId = () => props.auctionId;
  const teamId = () => typeof props.teamId === 'function' ? props.teamId() : props.teamId;
  const teamName = () => typeof props.teamName === 'function' ? props.teamName() : props.teamName;
  const shortName = () => typeof props.shortName === 'function' ? props.shortName() : props.shortName;
  const isAdmin = () => typeof props.isAdmin === 'function' ? props.isAdmin() : props.isAdmin;

  // Admin can optionally "play as" a team to bid; team-code users already have teamId from login
  const [adminPlayingAsTeamId, setAdminPlayingAsTeamId] = createSignal(null);
  const [adminPlayingAsShortName, setAdminPlayingAsShortName] = createSignal(null);

  // Load admin's selected team from localStorage on mount
  onMount(() => {
    // Start smart keepalive when entering auction room
    enterAuctionRoom();
    
    // Preload sound files
    soundManager.preload('bid', '/sounds/bid.mp3');
    soundManager.preload('sold', '/sounds/sold.mp3');
    soundManager.preload('unsold', '/sounds/unsold.mp3');
    
    // Load marked players from localStorage
    const markedStorageKey = `marked_players_${auctionId()}`;
    const savedMarked = localStorage.getItem(markedStorageKey);
    if (savedMarked) {
      try {
        const markedArray = JSON.parse(savedMarked);
        // Convert all IDs to strings for consistency
        setMarkedPlayers(new Set(markedArray.map(id => String(id))));
      } catch (e) {
        // Silent error - failed to load marked players
      }
    }
    
    // Load admin team selection
    if (isAdmin()) {
      const storageKey = `admin_selected_team_${auctionId()}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const { teamId, shortName } = JSON.parse(saved);
          setAdminPlayingAsTeamId(teamId);
          setAdminPlayingAsShortName(shortName);
        } catch (e) {
          // Silent error - failed to load admin team selection
        }
      }
    }
    
    // Loading animation
    const startTime = Date.now();
    setTimeout(() => {
      const loadTime = Date.now() - startTime;
      if (loadTime < 300) setLoading(false);
      else setTimeout(() => setLoading(false), 500);
    }, 100);
  });

  const selectAdminTeam = (teamId, shortName) => {
    // Store as string to handle int64 IDs properly
    const teamIdStr = teamId ? String(teamId) : null;
    setAdminPlayingAsTeamId(teamIdStr);
    setAdminPlayingAsShortName(shortName);
    if (isAdmin()) {
      const storageKey = `admin_selected_team_${auctionId()}`;
      localStorage.setItem(storageKey, JSON.stringify({ teamId: teamIdStr, shortName }));
    }
  };

  const { auctionState: liveState, isConnected, placeBid: sendBid, getNextBidAmount, sendControl, lastMessageTime, bidHistory, unsoldPlayers, soldPlayers, playersByTeam, ping, enterAuctionRoom, leaveAuctionRoom } = useAuctionWebSocketSolid(auctionId);

  // Who is bidding: team-code user's team OR admin's chosen team (admin does not get team from login)
  const effectiveTeamId = () => {
    const regularTeamId = teamId();
    const adminTeamId = isAdmin() ? adminPlayingAsTeamId() : null;
    
    // For regular team users, return their team ID as-is
    if (regularTeamId) return regularTeamId;
    
    // For admin, convert string back to number if needed for WebSocket compatibility
    if (adminTeamId) {
      // Try to convert to number if it looks like a number, otherwise keep as string
      const numericId = Number(adminTeamId);
      return !isNaN(numericId) ? numericId : adminTeamId;
    }
    
    return null;
  };
  const effectiveShortName = () => shortName() ?? (isAdmin() ? adminPlayingAsShortName() : null);
  const auctionTeams = () => liveState()?.teams ?? [];

  const [loading, setLoading] = createSignal(true);
  const [activeTab, setActiveTab] = createSignal('balance');
  const [expandedTeam, setExpandedTeam] = createSignal(null);
  const [activitySubTab, setActivitySubTab] = createSignal('bids');
  const [chatMessages, setChatMessages] = createSignal([]);
  const [chatInput, setChatInput] = createSignal('');
  const [touchStart, setTouchStart] = createSignal(0);
  const [touchEnd, setTouchEnd] = createSignal(0);
  const [bidSuccess, setBidSuccess] = createSignal(false);
  const [shouldAutoScroll, setShouldAutoScroll] = createSignal(true);
  const [markedPlayers, setMarkedPlayers] = createSignal(new Set()); // Track marked/starred players
  const [showMarkedNotification, setShowMarkedNotification] = createSignal(false); // Toast notification
  const [markedNotificationTimer, setMarkedNotificationTimer] = createSignal(null);
  const [bidWarning, setBidWarning] = createSignal(null);
  const [bidWarningTimer, setBidWarningTimer] = createSignal(null);
  const [soundEnabled, setSoundEnabled] = createSignal(soundManager.isEnabled());

  // Image preloading
  const preloadedImages = new Set();
  
  const preloadImage = (url) => {
    if (!url || preloadedImages.has(url)) return;
    const img = new Image();
    img.src = url;
    preloadedImages.add(url);
  };

  const preloadNextPlayers = () => {
    const state = liveState();
    if (!state?.allPlayers) return;
    
    const currentIndex = state.currentPlayerIndex || 0;
    // Preload next 3 players
    for (let i = 1; i <= 3; i++) {
      const nextPlayer = state.allPlayers[currentIndex + i];
      if (nextPlayer?.image) {
        preloadImage(nextPlayer.image);
      }
    }
  };

  // Preload images when WebSocket state updates
  createEffect(() => {
    const state = liveState();
    if (state?.currentPlayer?.image) {
      preloadImage(state.currentPlayer.image);
    }
    preloadNextPlayers();
  });

  let chatContainerRef;
  let bidsContainerRef;

  // Load marked players from localStorage on mount (per auction)
  onMount(() => {
    const storageKey = `marked_players_${auctionId()}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const playerIds = JSON.parse(saved);
        setMarkedPlayers(new Set(playerIds));
      } catch (e) {
        // Silent error - failed to load marked players
      }
    }
  });

  // Watch for marked player becoming current and show notification
  let lastNotifiedPlayerId = null;
  createEffect(() => {
    try {
      const currentPlayer = liveState()?.currentPlayer;
      const markedSet = markedPlayers();
      
      // Only trigger if we have a current player and they are marked
      if (currentPlayer && markedSet.has(currentPlayer.id)) {
        // Only show notification if this is a new player (prevent spam)
        if (lastNotifiedPlayerId !== currentPlayer.id) {
          lastNotifiedPlayerId = currentPlayer.id;
          
          // Clear any existing timer
          const existingTimer = markedNotificationTimer();
          if (existingTimer) {
            clearTimeout(existingTimer);
            setMarkedNotificationTimer(null);
          }
          
          // Show notification
          setShowMarkedNotification(true);
          
          // Hide after 5 seconds
          const timer = setTimeout(() => {
            setShowMarkedNotification(false);
            setMarkedNotificationTimer(null);
          }, 5000);
          
          setMarkedNotificationTimer(timer);
        }
      } else {
        // Hide notification if current player is not marked
        if (showMarkedNotification()) {
          setShowMarkedNotification(false);
        }
        // Reset last notified player when switching to unmarked player
        if (currentPlayer && lastNotifiedPlayerId !== currentPlayer.id) {
          lastNotifiedPlayerId = null;
        }
      }
    } catch (e) {
      setShowMarkedNotification(false);
    }
  });

  // Cleanup timer on unmount
  onCleanup(() => {
    // Stop keepalive when leaving auction room
    leaveAuctionRoom();
    
    // Clear any existing timers
    const warningTimer = bidWarningTimer();
    if (warningTimer) {
      clearTimeout(warningTimer);
    }
    
    const notificationTimer = markedNotificationTimer();
    if (notificationTimer) {
      clearTimeout(notificationTimer);
    }
  });

  // Toggle player mark/star
  const togglePlayerMark = (playerId) => {
    // Convert to string for consistency
    const playerIdStr = String(playerId);
    
    setMarkedPlayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerIdStr)) {
        newSet.delete(playerIdStr);
      } else {
        newSet.add(playerIdStr);
      }
      // Save to localStorage
      const storageKey = `marked_players_${auctionId()}`;
      localStorage.setItem(storageKey, JSON.stringify([...newSet]));
      return newSet;
    });
  };

  // Check if current player is marked
  const isCurrentPlayerMarked = () => {
    const currentPlayer = liveState()?.currentPlayer;
    return currentPlayer && markedPlayers().has(String(currentPlayer.id));
  };

  // Check if next player is marked (look ahead in upcoming players)
  const isNextPlayerMarked = () => {
    const allPlayers = liveState()?.allPlayers || [];
    const currentPlayer = liveState()?.currentPlayer;
    if (!currentPlayer || allPlayers.length === 0) return false;
    
    const currentIndex = allPlayers.findIndex(p => p.id === currentPlayer.id);
    if (currentIndex === -1 || currentIndex >= allPlayers.length - 1) return false;
    
    const nextPlayer = allPlayers[currentIndex + 1];
    return nextPlayer && markedPlayers().has(String(nextPlayer.id));
  };

  // Get the next marked player for early alert (only immediate next player)
  const getNextMarkedPlayer = () => {
    const allPlayers = liveState()?.allPlayers || [];
    const currentPlayer = liveState()?.currentPlayer;
    if (!currentPlayer || allPlayers.length === 0) return null;
    
    // Don't show "coming up" if current player is marked (already showing current notification)
    if (markedPlayers().has(String(currentPlayer.id))) return null;
    
    const currentIndex = allPlayers.findIndex(p => p.id === currentPlayer.id);
    if (currentIndex === -1 || currentIndex >= allPlayers.length - 1) return null;
    
    // Only check the immediate next player (index + 1)
    const nextPlayer = allPlayers[currentIndex + 1];
    if (nextPlayer && markedPlayers().has(String(nextPlayer.id))) {
      return nextPlayer;
    }
    
    return null;
  };

  // Auto-scroll to latest message/bid (Discord style - scroll to bottom)
  const scrollToLatest = (container) => {
    if (container && shouldAutoScroll()) {
      // Scroll to bottom for Discord-style chat
      container.scrollTop = container.scrollHeight;
    }
  };

  // Watch for new bids and auto-scroll - use createEffect to react to bidHistory changes
  createEffect(() => {
    const currentBids = bidHistory();
    if (currentBids.length > 0 && bidsContainerRef && shouldAutoScroll()) {
      setTimeout(() => scrollToLatest(bidsContainerRef), 50);
    }
  });

  // Watch for new messages and auto-scroll - use createEffect to react to chatMessages changes
  createEffect(() => {
    const currentMessages = chatMessages();
    if (currentMessages.length > 0 && chatContainerRef && shouldAutoScroll()) {
      setTimeout(() => scrollToLatest(chatContainerRef), 50);
    }
  });

  // Auto-redirect to summary when auction ends
  createEffect(() => {
    const state = liveState();
    if (state && !state.isRunning && state.status === 'completed') {
      // Show a brief message then redirect
      setTimeout(() => {
        if (props.onAuctionEnd) {
          props.onAuctionEnd();
        } else {
          // Fallback: go back
          props.onBack();
        }
      }, 3000); // 3 second delay to show "ENDED" message
    }
  });

  // Computed values from live state (granular updates)
  const myTeam = () => {
    const myId = effectiveTeamId();
    if (!myId || !liveState()) return null;
    // Compare as strings to handle int64 IDs properly
    return auctionTeams().find(t => String(t.id) === String(myId));
  };

  const myBudget = () => myTeam()?.remainingBudget ?? 0;
  const mySquadSize = () => myTeam()?.playersCount ?? 0;
  const myOverseasCount = () => {
    const team = myTeam();
    if (!team) return 0;
    
    // Use overseas count from team snapshot (sent by backend)
    return team.overseasCount || 0;
  };

  // Client-side 60fps timer interpolation for smooth animation
  const [preciseTimer, setPreciseTimer] = createSignal(0);
  const [lastServerUpdate, setLastServerUpdate] = createSignal(0);
  const [serverTimer, setServerTimer] = createSignal(0);
  const [isTimerRunning, setIsTimerRunning] = createSignal(false);
  const [lastPauseState, setLastPauseState] = createSignal(undefined);

  // 60fps timer update for smooth ring animation
  let animationFrame;
  let lastUpdateTime = 0;
  const updatePreciseTimer = () => {
    if (!isTimerRunning() || liveState()?.isPaused) {
      animationFrame = null;
      return;
    }
    
    const now = Date.now();
    
    // Throttle to 40fps (~25ms) for better performance
    if (now - lastUpdateTime < 25) {
      animationFrame = requestAnimationFrame(updatePreciseTimer);
      return;
    }
    lastUpdateTime = now;
    
    const timeSinceUpdate = (now - lastServerUpdate()) / 1000;
    const interpolatedTimer = Math.max(0, serverTimer() - timeSinceUpdate);
    setPreciseTimer(interpolatedTimer);
    
    if (interpolatedTimer > 0 && isTimerRunning() && !liveState()?.isPaused) {
      animationFrame = requestAnimationFrame(updatePreciseTimer);
    } else {
      setIsTimerRunning(false);
      animationFrame = null;
    }
  };

  // Sync with server timer updates
  createEffect(() => {
    const timer = liveState()?.timer;
    const isPaused = liveState()?.isPaused;
    
    if (timer !== undefined && timer !== serverTimer()) {
      setServerTimer(timer);
      setLastServerUpdate(Date.now());
      setPreciseTimer(timer);
      
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      
      if (timer > 0 && !isPaused) {
        setIsTimerRunning(true);
        animationFrame = requestAnimationFrame(updatePreciseTimer);
      } else {
        setIsTimerRunning(false);
      }
    }
    
    // Handle pause/resume - only when state actually changes
    if (isPaused !== undefined && isPaused !== lastPauseState()) {
      setLastPauseState(isPaused);
      
      if (isPaused) {
        // Paused
        setIsTimerRunning(false);
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
      } else if (!isPaused && serverTimer() > 0) {
        // Resumed
        setLastServerUpdate(Date.now());
        setPreciseTimer(serverTimer());
        setIsTimerRunning(true);
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(updatePreciseTimer);
      }
    }
  });

  // Cleanup
  onCleanup(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });

  // Use precise timer for smooth display and ring animation
  const effectiveTimer = () => preciseTimer() || liveState()?.timer || 0;
  const effectiveBid = () => liveState()?.currentBid ?? 0;

  // Show bid warning for 5 seconds without flickering
  const showBidWarning = (reason) => {
    // Clear existing timer
    const existingTimer = bidWarningTimer();
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set the warning
    setBidWarning(reason);
    
    // Set timer to clear warning after 5 seconds
    const timer = setTimeout(() => {
      setBidWarning(null);
      setBidWarningTimer(null);
    }, 5000);
    
    setBidWarningTimer(timer);
  };

  const placeBid = (increment) => {
    const myTeamId = effectiveTeamId();
    
    // Check if bid is allowed first
    if (!canBid(increment)) {
      const reason = getBidBlockReason(increment);
      if (reason) {
        showBidWarning(reason);
      }
      return;
    }
    
    // Clear any existing warning since bid is valid
    setBidWarning(null);
    const existingTimer = bidWarningTimer();
    if (existingTimer) {
      clearTimeout(existingTimer);
      setBidWarningTimer(null);
    }
    
    if (myTeamId != null && isConnected()) {
      const amount = getNextBidAmount(increment);
      sendBid(myTeamId, amount);
      
      // Trigger success feedback
      setBidSuccess(true);
      setTimeout(() => setBidSuccess(false), 400);
    }
  };

  // Check if team can bid (frontend validation to disable button)
  const canBid = (increment = 0.5) => {
    const myTeamId = effectiveTeamId();
    if (!myTeamId || !isConnected() || !liveState()) {
      return false;
    }

    const state = liveState();
    const teams = auctionTeams();
    
    // Compare as strings to handle int64 IDs properly
    const myTeam = teams.find(t => String(t.id) === String(myTeamId));
    if (!myTeam) {
      return false;
    }

    // Cannot bid consecutively - compare as strings
    if (state.currentBidder && String(state.currentBidder.id) === String(myTeamId)) {
      return false;
    }

    // Check budget
    const nextBid = getNextBidAmount(increment);
    if (nextBid > myTeam.remainingBudget) {
      return false;
    }

    // Check squad limit
    if (myTeam.playersCount >= (state.playersLimit || 25)) {
      return false;
    }

    // Check overseas limit (if current player is overseas)
    if (state.currentPlayer?.isOverseas) {
      // Use overseas count from team snapshot
      const myOverseasCount = myTeam.overseasCount || 0;
      if (myOverseasCount >= (state.overseasLimit || 8)) {
        return false;
      }
    }

    return true;
  };

  // Get reason why can't bid (for display)
  const getBidBlockReason = (increment = 0.5) => {
    const myTeamId = effectiveTeamId();
    if (!myTeamId || !isConnected() || !liveState()) return null;

    const state = liveState();
    // Compare as strings to handle int64 IDs properly
    const myTeam = auctionTeams().find(t => String(t.id) === String(myTeamId));
    if (!myTeam) return null;

    // Don't show reason for consecutive bid - just disable silently
    if (state.currentBidder && String(state.currentBidder.id) === String(myTeamId)) {
      return null;
    }

    // Check budget
    const nextBid = getNextBidAmount(increment);
    if (nextBid > myTeam.remainingBudget) {
      return { 
        iconSvg: <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        text: `Insufficient budget (need ₹${(nextBid - myTeam.remainingBudget).toFixed(1)}Cr more)`, 
        color: 'text-red-400' 
      };
    }

    // Check squad limit
    if (myTeam.playersCount >= (state.playersLimit || 25)) {
      return { 
        iconSvg: <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
        text: `Squad full (${myTeam.playersCount}/${state.playersLimit || 25})`, 
        color: 'text-orange-400' 
      };
    }

    // Check overseas limit (if current player is overseas)
    if (state.currentPlayer?.isOverseas) {
      const myOverseasCount = myTeam.overseasCount || 0;
      if (myOverseasCount >= (state.overseasLimit || 8)) {
        return { 
          iconSvg: <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
          text: `Overseas slots full (${myOverseasCount}/${state.overseasLimit || 8})`, 
          color: 'text-blue-400' 
        };
      }
    }

    return null;
  };

  const onAdminSelectTeam = (team) => {
    if (!team) {
      selectAdminTeam(null, null);
      return;
    }
    // Use string ID and pass the team object to get the correct ID
    selectAdminTeam(String(team.id), team.shortName || team.name);
  };

  const timerDuration = () => liveState()?.timerDuration || 10;
  const timerProgress = () => {
    const duration = timerDuration();
    const current = effectiveTimer();
    // Progress goes from 0% (full timer) to 100% (timer at 0)
    const progress = Math.max(0, Math.min(100, ((duration - current) / duration) * 100));
    return progress;
  };

  const getTimerColor = () => {
    const t = effectiveTimer();
    const duration = timerDuration();
    const percentage = (t / duration) * 100;
    
    if (percentage > 70) return '#10b981'; // Green
    if (percentage > 40) return '#f59e0b'; // Yellow/Orange
    if (percentage > 20) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  const getTimerPulse = () => {
    const t = effectiveTimer();
    const duration = timerDuration();
    const percentage = (t / duration) * 100;
    
    // Add pulsing animation when timer is low
    if (percentage <= 20) {
      return 'animate-pulse';
    }
    return '';
  };

  const getBudgetColor = (budget) => {
    if (budget > 40) return 'text-green-400';
    if (budget > 20) return 'text-yellow-400';
    if (budget > 10) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSquadColor = (squad) => {
    const limit = liveState()?.playersLimit ?? 25;
    if (squad >= limit - 2) return 'text-red-400'; // Almost full
    if (squad >= limit - 5) return 'text-orange-400';
    if (squad >= limit - 10) return 'text-yellow-400';
    return 'text-blue-400'; // Plenty of space
  };

  const getTeamBudgetColor = (budget) => {
    if (budget > 40) return 'text-green-400';
    if (budget > 20) return 'text-yellow-400';
    if (budget > 10) return 'text-orange-400';
    return 'text-red-400';
  };

  const getTeamSquadColor = (squad) => {
    if (squad >= 20) return 'text-red-400';
    if (squad >= 15) return 'text-orange-400';
    if (squad >= 10) return 'text-yellow-400';
    return 'text-blue-400';
  };

  const sendMessage = () => {
    const message = chatInput().trim();
    if (message) {
      // Get current team data
      const currentTeam = auctionTeams().find(t => String(t.id) === String(effectiveTeamId()));
      
      const newMessage = {
        id: chatMessages().length + 1,
        user: currentTeam?.name || effectiveShortName() || 'You',
        message: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        team: currentTeam?.shortName || effectiveShortName() || 'YOU',
        teamLogo: currentTeam?.logo,
        isOwn: true
      };
      setChatMessages([...chatMessages(), newMessage]);
      setChatInput('');
    }
  };

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart() || !touchEnd()) return;
    
    const distance = touchStart() - touchEnd();
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    // Only handle swipes if they're intentional (not accidental scrolling)
    if (Math.abs(distance) < 100) return; // Require more deliberate swipe
    
    const tabs = ['balance', 'teams', 'upcoming', 'unsold'];
    const currentIndex = tabs.indexOf(activeTab());
    
    // Only change tabs on very deliberate horizontal swipes
    if (isLeftSwipe && currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
    
    if (isRightSwipe && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
    
    setTouchStart(0);
    setTouchEnd(0);
  };

  const getPingColor = () => {
    if (ping() < 30) return 'bg-green-500';
    if (ping() < 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const toggleSound = () => {
    const newState = soundManager.toggle();
    setSoundEnabled(newState);
  };

  return (
    <Show when={!loading()} fallback={<SkeletonLoader />}>
      {/* Auction Completed Overlay */}
      <Show when={liveState() && !liveState()?.isRunning && liveState()?.status === 'completed'}>
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div class="bg-gradient-to-br from-gray-900 to-black border-2 border-emerald-500/50 rounded-3xl p-8 max-w-sm mx-4 text-center shadow-2xl animate-scale-in">
            <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg class="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6L10 2L14 6M10 2V14M4 14L2 16V18H18V16L16 14H4Z"/>
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-white mb-2">Auction Completed!</h2>
            <p class="text-gray-400 text-sm mb-4">Redirecting to summary...</p>
            <div class="flex items-center justify-center gap-2">
              <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse animation-delay-200"></div>
              <div class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse animation-delay-500"></div>
            </div>
          </div>
        </div>
      </Show>

      {/* Desktop Background */}
      <div class="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white flex items-center justify-center">
        {/* Mobile App Container - Responsive width */}
        <div class="w-full max-w-[390px] md:max-w-[480px] lg:max-w-[600px] h-screen bg-black overflow-hidden relative shadow-2xl md:rounded-3xl md:h-[90vh] lg:h-[95vh]">
          
          {/* Status Bar with Back Button */}
          <div class="absolute top-0 left-0 right-0 h-[44px] md:h-[50px] flex items-center justify-between px-3 text-white text-xs md:text-sm font-semibold z-40 md:rounded-t-3xl bg-black/50 backdrop-blur-sm">
            {/* Left: Back Button + Ping + Team */}
            <div class="flex items-center gap-2">
              <button 
                onClick={props.onBack}
                class="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div class="flex items-center gap-1.5 bg-gray-900/50 backdrop-blur-sm px-2 py-1 rounded-full">
                <div class={`w-1.5 h-1.5 rounded-full ${getPingColor()} animate-pulse`}></div>
                <span class="text-[10px]">{ping()}ms</span>
              </div>
              <Show when={effectiveShortName()}>
                <div class="bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-sm px-2 py-1 rounded-full">
                  <span class="text-[10px] font-bold text-emerald-400">{effectiveShortName()}</span>
                </div>
              </Show>
            </div>
            
            {/* Right: Sound Toggle + Budget & Squad Stats */}
            <div class="flex items-center gap-1.5">
              {/* Sound Toggle Button */}
              <button
                onClick={toggleSound}
                class="w-7 h-7 rounded-full bg-gray-900/50 backdrop-blur-sm hover:bg-gray-800 flex items-center justify-center transition-colors border border-gray-700/30"
                title={soundEnabled() ? 'Sound On' : 'Sound Off'}
              >
                <Show when={soundEnabled()} fallback={
                  <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                }>
                  <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </Show>
              </button>
              
              {/* Auction Status Indicator for all users */}
              <Show when={liveState()?.isPaused}>
                <div class="bg-yellow-500/20 border border-yellow-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-400 flex items-center justify-center min-w-[50px]">
                  PAUSED
                </div>
              </Show>
              <Show when={liveState()?.isUnsoldRound && liveState()?.isRunning}>
                <div class="bg-orange-500/20 border border-orange-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold text-orange-400 flex items-center justify-center min-w-[50px]">
                  UNSOLD
                </div>
              </Show>
              <Show when={!liveState()?.isRunning && liveState()?.status === 'completed'}>
                <div class="bg-red-500/20 border border-red-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold text-red-400 flex items-center justify-center min-w-[50px]">
                  ENDED
                </div>
              </Show>
              
              <div class="bg-gray-900/50 backdrop-blur-sm px-2 py-1 rounded-full">
                <span class={`text-[10px] font-bold ${getBudgetColor(myBudget())}`}>₹{myBudget().toFixed(1)}</span>
              </div>
              <div class="bg-gray-900/50 backdrop-blur-sm px-1.5 py-1 rounded-full flex items-center gap-0.5 border border-gray-700/30">
                <svg class="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span class={`text-[10px] font-bold ${getSquadColor(mySquadSize())}`}>{mySquadSize()}/{liveState()?.playersLimit || 25}</span>
              </div>
              <div class="bg-gray-900/50 backdrop-blur-sm px-1.5 py-1 rounded-full flex items-center gap-0.5 border border-gray-700/30">
                <span class="text-[10px] filter drop-shadow-sm">✈️</span>
                <span class={`text-[10px] font-bold ${myOverseasCount() >= (liveState()?.overseasLimit || 8) - 1 ? 'text-red-400' : 'text-blue-400'}`}>
                  {myOverseasCount()}/{liveState()?.overseasLimit || 8}
                </span>
              </div>
            </div>
          </div>

          {/* Admin: compact strip with status indicator */}
          <Show when={isAdmin()}>
            <div class="absolute top-[44px] left-0 right-0 z-30 md:top-[50px] px-2 py-1 flex items-center gap-1.5 bg-[#111]/90 border-b border-gray-800/80">
              {/* Auction Status Indicator */}
              <Show when={liveState()?.isPaused}>
                <div class="bg-yellow-500/20 border border-yellow-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-400 flex items-center justify-center min-w-[50px]">
                  PAUSED
                </div>
              </Show>
              <Show when={!liveState()?.isRunning && liveState()?.status === 'completed'}>
                <div class="bg-red-500/20 border border-red-500/40 px-1.5 py-0.5 rounded text-[10px] font-bold text-red-400 flex items-center justify-center min-w-[50px]">
                  ENDED
                </div>
              </Show>
              
              <select
                value={adminPlayingAsTeamId() ?? ''}
                onChange={(e) => {
                  const idStr = e.target.value;
                  if (!idStr) {
                    selectAdminTeam(null, null);
                    return;
                  }
                  
                  // Find team by string comparison to handle int64 IDs properly
                  const team = auctionTeams().find(t => String(t.id) === idStr);
                  if (team) {
                    selectAdminTeam(idStr, team.shortName || team.name);
                  } else {
                    selectAdminTeam(null, null);
                  }
                }}
                class="bg-gray-800/80 border border-gray-700/80 rounded px-1.5 py-0.5 text-[10px] text-gray-300 focus:outline-none focus:border-gray-600 min-w-0 max-w-[72px]"
                title="Bid as team"
              >
                <option value="">Spectate</option>
                <For each={auctionTeams()}>
                  {(t) => (
                    <option value={String(t.id)}>{t.shortName || t.name}</option>
                  )}
                </For>
              </select>
              <button onClick={() => sendControl('skip')} class="px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:text-white hover:bg-gray-700/80" title="Skip player">Skip</button>
              
              {/* Show Pause OR Resume based on state */}
              <Show when={!liveState()?.isPaused} fallback={
                <button onClick={() => sendControl('resume')} class="px-1.5 py-0.5 rounded text-[10px] bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/40" title="Resume">Resume</button>
              }>
                <button onClick={() => sendControl('pause')} class="px-1.5 py-0.5 rounded text-[10px] bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/40" title="Pause">Pause</button>
              </Show>
              
              <button onClick={() => {
                if (confirm('Are you sure you want to end the auction? This cannot be undone.')) {
                  sendControl('stop');
                }
              }} class="px-1.5 py-0.5 rounded text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40" title="End auction">End</button>
            </div>
          </Show>

          {/* Non-Admin: Show status if paused or ended */}
          <Show when={!isAdmin() && (liveState()?.isPaused || liveState()?.status === 'completed' || liveState()?.isUnsoldRound)}>
            <div class="absolute top-[44px] left-0 right-0 z-30 md:top-[50px] px-3 py-1.5 flex items-center justify-center bg-[#111]/90 border-b border-gray-800/80">
              <Show when={liveState()?.isPaused}>
                <div class="bg-yellow-500/20 border border-yellow-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                  <span class="text-xs font-bold text-yellow-400">AUCTION PAUSED</span>
                </div>
              </Show>
              <Show when={!liveState()?.isRunning && liveState()?.status === 'completed'}>
                <div class="bg-red-500/20 border border-red-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                  </svg>
                  <span class="text-xs font-bold text-red-400">AUCTION ENDED</span>
                </div>
              </Show>
              <Show when={liveState()?.isUnsoldRound && liveState()?.isRunning}>
                <div class="bg-orange-500/20 border border-orange-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                  <span class="text-xs font-bold text-orange-400">UNSOLD ROUND</span>
                </div>
              </Show>
            </div>
          </Show>

          {/* Simple Marked Player Notifications - Bottom right, non-interfering */}
          <div class="fixed bottom-20 right-4 z-40 space-y-1 pointer-events-none">
            {/* Current marked player notification */}
            <Show when={showMarkedNotification()}>
              <div class="animate-fade-in">
                <div class="px-1.5 py-0.5 rounded text-[10px] bg-yellow-600/20 text-yellow-400 border border-yellow-600/40">
                  {liveState()?.currentPlayer?.name} is LIVE!
                </div>
              </div>
            </Show>
            
            {/* Next marked player alert */}
            <Show when={getNextMarkedPlayer()}>
              <div class="animate-fade-in">
                <div class="px-1.5 py-0.5 rounded text-[10px] bg-blue-600/20 text-blue-400 border border-blue-600/40">
                  {getNextMarkedPlayer()?.name} coming up
                </div>
              </div>
            </Show>
          </div>

          {/* Main Content - adjust padding based on admin strip and status */}
          <div class={`h-full pb-[34px] flex flex-col ${isAdmin() ? 'pt-[72px] md:pt-[76px]' : (liveState()?.isPaused || liveState()?.status === 'completed') ? 'pt-[72px] md:pt-[76px]' : 'pt-[44px]'}`}>
            
            {/* Compact Header with Player Info, Timer Ring & Bid */}
            <div class="px-4 py-3">
              <div class="flex items-center gap-3">
                {/* Player Avatar with Timer Ring - BIGGER */}
                <div class="relative flex-shrink-0 w-[88px] h-[88px]">
                  {/* Timer Ring - Smooth 60fps animation via JS interpolation */}
                  <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 88 88" style="overflow: visible;">
                    <circle cx="44" cy="44" r="40" fill="none" stroke="currentColor" class="text-gray-800" stroke-width="4" />
                    <circle 
                      cx="44" 
                      cy="44" 
                      r="40" 
                      fill="none" 
                      stroke={getTimerColor()} 
                      stroke-width="5" 
                      stroke-linecap="round" 
                      stroke-dasharray={`${2 * Math.PI * 40}`} 
                      stroke-dashoffset={`${2 * Math.PI * 40 * (1 - timerProgress() / 100)}`} 
                      class="drop-shadow-lg"
                      style="transition: stroke 0.3s ease;"
                    />
                  </svg>
                  
                  {/* Player Image - BIGGER */}
                  <div class="absolute inset-0 flex items-center justify-center">
                    <Show when={liveState()?.currentPlayer?.image} fallback={
                      <div class="w-[80px] h-[80px] rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 flex items-center justify-center text-2xl font-bold shadow-lg">
                        {liveState()?.currentPlayer?.name?.split(' ').map(n => n[0]).join('') || 'P'}
                      </div>
                    }>
                      <img 
                        src={liveState()?.currentPlayer?.image} 
                        alt={liveState()?.currentPlayer?.name}
                        class="w-[80px] h-[80px] rounded-full object-cover shadow-lg"
                      />
                    </Show>
                  </div>
                  
                  {/* Timer Number Overlay with milliseconds */}
                  <div class={`absolute -bottom-1 -right-1 w-14 h-7 rounded-full flex items-center justify-center shadow-lg border border-black/50 backdrop-blur-sm z-20 ${getTimerPulse()}`} style={`background-color: ${getTimerColor()}CC;`}>
                    <span class="text-xs font-bold text-white font-mono tracking-tighter drop-shadow-sm" style="font-family: 'Courier New', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; min-width: 48px; display: inline-block; text-align: center;">{effectiveTimer().toFixed(2)}s</span>
                  </div>
                </div>
                
                {/* Player Info & Bid - BIGGER FONTS */}
                <div class="flex-1 min-w-0">
                  <h2 class="text-base font-bold truncate">{liveState()?.currentPlayer?.name || 'Loading...'}</h2>
                  <p class="text-xs text-gray-400 mb-1.5">{liveState()?.currentPlayer?.role || ''}{liveState()?.currentPlayer?.isOverseas ? ' • Overseas' : ' • India'}</p>
                  
                  {/* Bid Amount - Inline - BIGGER */}
                  <div class="flex items-baseline gap-2">
                    <span class="text-xs font-semibold text-gray-400">
                      {!liveState()?.currentBidder ? 'Base' : 'Bid'}:
                    </span>
                    <span 
                      class="text-2xl font-bold transition-all duration-300 ease-out tracking-tight"
                      style={{
                        animation: bidSuccess() ? 'bidPulse 0.4s ease-out' : 'none',
                        color: getTimerColor(),
                        fontFamily: "'Courier New', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace"
                      }}
                    >
                      ₹{(liveState()?.currentBidder ? effectiveBid() : liveState()?.currentPlayer?.basePrice || 0).toFixed(2)}
                    </span>
                    <span class="text-xs font-semibold text-gray-400">Cr</span>
                    
                    {/* Current Bidder - Right side with team logo/color and smooth transition */}
                    <Show when={liveState()?.currentBidder}>
                      <div class="flex items-center gap-1.5 ml-2 animate-fade-in">
                        <Show when={liveState()?.currentBidder?.logo} fallback={
                          <div 
                            class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-md transition-all duration-300 ease-out"
                            style={`background: ${liveState()?.currentBidder?.color || '#8B5CF6'}; transform: scale(${bidSuccess() ? '1.1' : '1'});`}
                          >
                            {liveState()?.currentBidder?.shortName || liveState()?.currentBidder?.name?.substring(0, 2)}
                          </div>
                        }>
                          <img 
                            src={liveState()?.currentBidder?.logo} 
                            alt={liveState()?.currentBidder?.name}
                            class="w-5 h-5 rounded-full object-cover shadow-md transition-all duration-300 ease-out"
                            style={`transform: scale(${bidSuccess() ? '1.1' : '1'});`}
                          />
                        </Show>
                        <span 
                          class="text-xs font-bold transition-all duration-300 ease-out"
                          style={{
                            color: liveState()?.currentBidder?.color || '#8B5CF6',
                            fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
                            transform: bidSuccess() ? 'scale(1.05)' : 'scale(1)'
                          }}
                        >
                          {liveState()?.currentBidder?.shortName || liveState()?.currentBidder?.name}
                        </span>
                      </div>
                    </Show>
                  </div>
                  
                  {/* Player Progress - Compact */}
                  <Show when={liveState()?.currentPlayerIndex && liveState()?.totalPlayers}>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class="text-[9px] font-bold text-gray-400 bg-gray-800/30 px-1.5 py-0.5 rounded border border-gray-700/50" style="font-family: 'Courier New', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;">
                        {liveState()?.currentPlayerIndex}/{liveState()?.totalPlayers}
                      </span>
                      <div class="flex-1 bg-gray-800/30 rounded-full h-1 max-w-[50px] border border-gray-700/30">
                        <div 
                          class="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1 rounded-full transition-all duration-500 ease-out shadow-sm"
                          style={`width: ${((liveState()?.currentPlayerIndex || 0) / (liveState()?.totalPlayers || 1)) * 100}%`}
                        ></div>
                      </div>
                      <span class="text-[8px] font-bold text-gray-500" style="font-family: 'Courier New', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;">
                        {Math.round(((liveState()?.currentPlayerIndex || 0) / (liveState()?.totalPlayers || 1)) * 100)}%
                      </span>
                    </div>
                  </Show>
                </div>
              </div>
            </div>

            {/* Tabs - More Compact */}
            <div class="px-4 mb-2">
              <div class="flex gap-1.5 bg-gray-900 rounded-xl p-1 border border-gray-800">
                <button 
                  type="button"
                  onClick={() => setActiveTab('balance')}
                  class={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${activeTab() === 'balance' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  Activity
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('teams')}
                  class={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${activeTab() === 'teams' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  Teams
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('upcoming')}
                  class={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${activeTab() === 'upcoming' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  Upcoming
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('unsold')}
                  class={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${activeTab() === 'unsold' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                >
                  Unsold
                </button>
              </div>
            </div>

            {/* Scrollable Content Area with Swipe Support - HIDDEN SCROLLBAR */}
            <div 
              class="flex-1 overflow-y-auto px-4 pb-[100px] scrollbar-hide"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              
              {/* Activity Section - With Sub-tabs */}
              <Show when={activeTab() === 'balance'}>
                {/* Sub-tabs for Bids and Chat - STICKY */}
                <div class="sticky top-0 bg-black z-10 pb-2 mb-2">
                  <div class="flex gap-1.5 bg-gray-900 rounded-xl p-1 border border-gray-800">
                    <button 
                      onClick={() => setActivitySubTab('bids')}
                      class={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activitySubTab() === 'bids' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                      Bids
                    </button>
                    <button 
                      onClick={() => setActivitySubTab('chat')}
                      class={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${activitySubTab() === 'chat' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                      Chat
                    </button>
                  </div>
                </div>

                {/* Bids Sub-tab - Real-time with team colors and sold/unsold messages */}
                <Show when={activitySubTab() === 'bids'}>
                  <div class="pb-2">
                    <Show when={bidHistory().length === 0} fallback={
                      <div 
                        ref={(el) => bidsContainerRef = el}
                        class="space-y-2.5 overflow-y-auto pb-2 scroll-smooth scrollbar-hide" 
                        style="will-change: scroll-position; transform: translateZ(0); max-height: calc(100vh - 380px);"
                        onScroll={(e) => {
                          const isAtBottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 50;
                          setShouldAutoScroll(isAtBottom);
                        }}
                      >
                        <For each={bidHistory()}>
                          {(item, index) => (
                            <div class="flex justify-start animate-slide-in" style="will-change: transform; transform: translateZ(0);">
                              <Show when={item.type === 'bid'}>
                                <div class="flex items-center gap-2 py-1">
                                  <Show when={item.teamLogo} fallback={
                                    <div 
                                      class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shadow-md flex-shrink-0"
                                      style={`background: ${item.teamColor}`}
                                    >
                                      {item.teamShort}
                                    </div>
                                  }>
                                    <img 
                                      src={item.teamLogo} 
                                      alt={item.team}
                                      class="w-6 h-6 rounded-full object-cover shadow-md flex-shrink-0"
                                    />
                                  </Show>
                                  <div class="flex items-baseline gap-1.5">
                                    <p class="text-xs font-semibold text-gray-300">{item.team}</p>
                                    <p class="text-base font-bold text-emerald-400">₹{item.amount.toFixed(2)}</p>
                                    <Show when={index() === bidHistory().length - 1}>
                                      <span class="text-[8px] text-emerald-400 font-bold animate-pulse">NEW</span>
                                    </Show>
                                  </div>
                                </div>
                              </Show>
                              <Show when={item.type === 'sold'}>
                                <div class="flex items-center gap-2 py-3 px-3 w-full bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                                  <svg class="w-6 h-6 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                  </svg>
                                  <div class="flex-1 min-w-0">
                                    <p class="text-base font-bold text-emerald-400 mb-1">{item.playerName} SOLD</p>
                                    <div class="flex items-center gap-1 text-xs text-gray-300">
                                      <Show when={item.teamLogo} fallback={
                                        <span class="font-semibold" style={`color: ${item.teamColor}`}>{item.team}</span>
                                      }>
                                        <img src={item.teamLogo} alt={item.team} class="w-4 h-4 rounded-full object-cover" />
                                        <span class="font-semibold" style={`color: ${item.teamColor}`}>{item.team}</span>
                                      </Show>
                                      <span class="font-bold text-emerald-400"> • ₹{item.price.toFixed(2)} Cr</span>
                                    </div>
                                  </div>
                                </div>
                              </Show>
                              <Show when={item.type === 'unsold'}>
                                <div class="flex items-center gap-2 py-2 px-3 w-full">
                                  <svg class="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                  </svg>
                                  <p class="text-xs font-semibold text-gray-400">{item.playerName} UNSOLD</p>
                                </div>
                              </Show>
                              <Show when={item.type === 'unsold_round_start'}>
                                <div class="flex items-center gap-2 py-2 px-3 rounded-lg bg-orange-500/10 border border-orange-500/30 w-full">
                                  <svg class="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                  </svg>
                                  <p class="text-xs font-semibold text-orange-400">UNSOLD ROUND STARTED</p>
                                </div>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    }>
                      <div class="flex flex-col items-center justify-center py-16 text-gray-600">
                        <svg class="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        <p class="text-sm font-semibold mb-1 text-gray-500">No bids yet</p>
                        <p class="text-xs text-gray-600">Be the first to bid!</p>
                      </div>
                    </Show>
                  </div>
                </Show>

                {/* Chat Sub-tab - Discord style - PROPER HEIGHT TO SHOW ABOVE INPUT */}
                <Show when={activitySubTab() === 'chat'}>
                  <div class="pb-2">
                    <div 
                      ref={(el) => chatContainerRef = el}
                      class="space-y-2.5 overflow-y-auto pb-2 scroll-smooth scrollbar-hide"
                      style="will-change: scroll-position; transform: translateZ(0); max-height: calc(100vh - 440px);"
                      onScroll={(e) => {
                        // Disable auto-scroll if user manually scrolls away from bottom
                        const isAtBottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 50;
                        setShouldAutoScroll(isAtBottom);
                      }}
                    >
                      <For each={chatMessages()}>
                        {(msg) => (
                          <div class={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'} animate-slide-in`}>
                            <div class="flex items-start gap-2 py-1">
                              <Show when={msg.teamLogo} fallback={
                                <div class={`w-5 h-5 rounded-full ${msg.isOwn ? 'bg-blue-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'} flex items-center justify-center text-[8px] font-bold flex-shrink-0`}>
                                  {msg.team}
                                </div>
                              }>
                                <img 
                                  src={msg.teamLogo} 
                                  alt={msg.team}
                                  class="w-5 h-5 rounded-full object-cover flex-shrink-0"
                                />
                              </Show>
                              <div class="flex-1 min-w-0">
                                <p class="text-[10px] font-semibold text-gray-400 mb-0.5">{msg.user}</p>
                                <p class="text-xs text-gray-200 leading-relaxed">{msg.message}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </Show>

              {/* Teams Section - CONSISTENT SIZING */}
              <Show when={activeTab() === 'teams'}>
                <div class="space-y-2">
                  <For each={auctionTeams()}>
                    {(team) => {
                      const teamPlayers = () => {
                        // Get players for this team from playersByTeam (built incrementally)
                        const teamId = String(team.id);
                        return playersByTeam()[teamId] || [];
                      };
                      
                      return (
                        <div class="bg-gray-900 rounded-xl p-3 hover:bg-gray-800 transition-colors border border-gray-800">
                          <div 
                            class="flex items-center gap-3 mb-2 cursor-pointer"
                            onClick={() => setExpandedTeam(expandedTeam() === team.shortName ? null : team.shortName)}
                          >
                            <Show when={team.logo} fallback={
                              <div class="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 flex items-center justify-center text-xs font-bold shadow-lg flex-shrink-0">
                                {team.shortName || team.name.substring(0, 3).toUpperCase()}
                              </div>
                            }>
                              <img 
                                src={team.logo} 
                                alt={team.name}
                                class="w-11 h-11 rounded-full object-cover shadow-lg flex-shrink-0"
                              />
                            </Show>
                            <div class="flex-1 min-w-0">
                              <p class="text-sm font-bold truncate">{team.name}</p>
                              <div class="flex items-center gap-2 mt-0.5">
                                {/* Budget */}
                                <div class="flex items-center gap-1">
                                  <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span class={`text-xs font-semibold ${getTeamBudgetColor(team.remainingBudget)}`}>₹{team.remainingBudget.toFixed(1)}</span>
                                </div>
                                
                                <span class="text-gray-600">•</span>
                                
                                {/* Squad Count */}
                                <div class="flex items-center gap-1">
                                  <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  <span class={`text-xs font-semibold ${getTeamSquadColor(team.playersCount)}`}>{team.playersCount}/{liveState()?.playersLimit || 25}</span>
                                </div>
                                
                                <span class="text-gray-600">•</span>
                                
                                {/* Overseas Count */}
                                <div class="flex items-center gap-1">
                                  <span class="text-xs">✈️</span>
                                  <span class={`text-xs font-semibold ${team.overseasCount >= (liveState()?.overseasLimit || 8) ? 'text-red-400' : 'text-orange-400'}`}>
                                    {team.overseasCount}/{liveState()?.overseasLimit || 8}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button class="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-all flex-shrink-0">
                              <svg 
                                class={`w-3.5 h-3.5 transition-transform ${expandedTeam() === team.shortName ? 'rotate-90' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                stroke-width="2" 
                                viewBox="0 0 24 24"
                              >
                                <path d="M9 5l7 7-7 7"/>
                              </svg>
                            </button>
                          </div>
                          
                          {/* Show players when expanded - CONSISTENT SIZING */}
                          <Show when={expandedTeam() === team.shortName}>
                            <div class="mt-2 pt-2 border-t border-gray-800 space-y-1.5">
                              <Show when={teamPlayers().length === 0}>
                                <p class="text-xs text-gray-500 text-center py-2">No players yet</p>
                              </Show>
                              <For each={teamPlayers()}>
                                {(player) => (
                                  <div class="flex items-center justify-between text-xs bg-gray-800/50 rounded-lg p-2">
                                    <div class="flex items-center gap-2 min-w-0 flex-1">
                                      <Show when={player.image} fallback={
                                        <div class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                          {player.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                      }>
                                        <img src={player.image} alt={player.name} class="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                                      </Show>
                                      <span class="font-medium truncate">{player.name}</span>
                                    </div>
                                    <div class="flex items-center gap-2 flex-shrink-0">
                                      <span class="text-gray-400 text-[10px]">{shortenRole(player.role)}</span>
                                      <span class="text-emerald-400 font-semibold">₹{player.soldPrice?.toFixed(1) || player.basePrice?.toFixed(1)}Cr</span>
                                    </div>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>

              {/* Upcoming Section - Shows next players in auction order */}
              <Show when={activeTab() === 'upcoming'}>
                {(() => {
                  // Memoize upcoming players list to prevent flickering
                  const upcomingPlayersList = createMemo(() => {
                    const allPlayersList = liveState()?.allPlayers || [];
                    const currentPlayer = liveState()?.currentPlayer;
                    const isUnsoldRound = liveState()?.isUnsoldRound;
                    
                    if (!currentPlayer) return allPlayersList;
                    
                    // Find current player index
                    const currentIndex = allPlayersList.findIndex(p => p.id === currentPlayer.id);
                    if (currentIndex === -1) return [];
                    
                    // Get players after current player
                    const upcomingPlayers = allPlayersList.slice(currentIndex + 1);
                    
                    // Filter based on round
                    return upcomingPlayers.filter(p => {
                      const isSold = soldPlayers().some(sp => sp.id === p.id);
                      const isUnsold = unsoldPlayers().some(up => up.id === p.id);
                      
                      if (!isUnsoldRound) {
                        // Main round: show players not yet processed
                        return !isSold && !isUnsold;
                      } else {
                        // Unsold round: show unsold players not yet re-auctioned
                        return isUnsold && !isSold;
                      }
                    });
                  });

                  // Preload upcoming players images when tab is opened
                  createEffect(() => {
                    const upcomingUrls = upcomingPlayersList().slice(0, 10).map(p => p.image).filter(Boolean);
                    if (upcomingUrls.length > 0) {
                      imagePreloader.preloadBatch(upcomingUrls, 'auto');
                    }
                  });

                  return (
                    <div class="space-y-2">
                      <For each={upcomingPlayersList()}>
                        {(player, index) => (
                      <div class="bg-gray-900 rounded-xl p-3 flex items-center justify-between hover:bg-gray-800 transition-colors border border-gray-800">
                        <div class="flex items-center gap-3">
                          <div class="relative">
                            <Show when={player.image} fallback={
                              <div class="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 flex items-center justify-center text-xs font-bold shadow-lg flex-shrink-0">
                                {player.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            }>
                              <img 
                                src={player.image} 
                                alt={player.name} 
                                class="w-11 h-11 rounded-full object-cover shadow-lg border-2 border-purple-500/50 flex-shrink-0"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                              <div class="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 flex items-center justify-center text-xs font-bold shadow-lg flex-shrink-0" style="display: none;">
                                {player.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            </Show>
                            <div class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center border border-black">
                              <span class="text-[8px] font-bold text-yellow-400">#{index() + 1}</span>
                            </div>
                          </div>
                          <div>
                            <p class="text-sm font-semibold">{player.name}</p>
                            <p class="text-[10px] text-gray-400">{shortenRole(player.role)}</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <div class="text-right">
                            <p class="text-[10px] text-gray-400 mb-0.5">Base</p>
                            <p class="text-sm font-bold">₹{player.basePrice.toFixed(2)}</p>
                          </div>
                          {/* Star/Mark Button */}
                          <button
                            onClick={() => togglePlayerMark(player.id)}
                            class={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              markedPlayers().has(String(player.id)) 
                                ? 'bg-yellow-500/20 border border-yellow-500/40' 
                                : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
                            }`}
                            title={markedPlayers().has(String(player.id)) ? 'Unmark player' : 'Mark player for strategy'}
                          >
                            <svg 
                              class={`w-4 h-4 ${markedPlayers().has(String(player.id)) ? 'text-yellow-400' : 'text-gray-500'}`}
                              fill={markedPlayers().has(String(player.id)) ? 'currentColor' : 'none'}
                              stroke="currentColor" 
                              stroke-width="2" 
                              viewBox="0 0 24 24"
                            >
                              <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
                  );
                })()}
              </Show>

              {/* Unsold Section - CONSISTENT SIZING */}
              <Show when={activeTab() === 'unsold'}>
                {(() => {
                  // Memoize unsold players list to prevent flickering
                  const unsoldPlayersList = createMemo(() => unsoldPlayers());
                  
                  // Preload unsold players images when tab is opened (not just during unsold round)
                  createEffect(() => {
                    const unsoldUrls = unsoldPlayersList().slice(0, 15).map(p => p.image).filter(Boolean);
                    if (unsoldUrls.length > 0) {
                      imagePreloader.preloadBatch(unsoldUrls, 'auto');
                    }
                  });

                  return (
                    <div class="space-y-2">
                      <Show when={unsoldPlayersList().length === 0} fallback={
                        <For each={unsoldPlayersList()}>
                      {(player) => (
                        <div class="bg-gray-900 rounded-xl p-3 hover:bg-gray-800 transition-colors border border-gray-800">
                          <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                              <Show when={player.image} fallback={
                                <div class="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 shadow-lg border-2 border-gray-700 flex-shrink-0">
                                  {player.name.split(' ').map(n => n[0]).join('')}
                                </div>
                              }>
                                <img 
                                  src={player.image} 
                                  alt={player.name} 
                                  class="w-11 h-11 rounded-full object-cover shadow-lg border-2 border-gray-700 flex-shrink-0"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextElementSibling.style.display = 'flex';
                                  }}
                                />
                                <div class="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 shadow-lg border-2 border-gray-700 flex-shrink-0" style="display: none;">
                                  {player.name.split(' ').map(n => n[0]).join('')}
                                </div>
                              </Show>
                              <div>
                                <p class="text-sm font-semibold">{player.name}</p>
                                <p class="text-[10px] text-gray-400">{shortenRole(player.role)}</p>
                              </div>
                            </div>
                            <div class="flex items-center gap-2">
                              <div class="text-right">
                                <p class="text-[10px] text-gray-400 mb-0.5">Base</p>
                                <p class="text-sm font-bold text-gray-500">₹{player.basePrice.toFixed(2)}</p>
                              </div>
                              {/* Star/Mark Button */}
                              <button
                                onClick={() => togglePlayerMark(player.id)}
                                class={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                  markedPlayers().has(String(player.id)) 
                                    ? 'bg-yellow-500/20 border border-yellow-500/40' 
                                    : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
                                }`}
                                title={markedPlayers().has(String(player.id)) ? 'Unmark player' : 'Mark player for strategy'}
                              >
                                <svg 
                                  class={`w-4 h-4 ${markedPlayers().has(String(player.id)) ? 'text-yellow-400' : 'text-gray-500'}`}
                                  fill={markedPlayers().has(String(player.id)) ? 'currentColor' : 'none'}
                                  stroke="currentColor" 
                                  stroke-width="2" 
                                  viewBox="0 0 24 24"
                                >
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  }>
                    <div class="flex flex-col items-center justify-center py-16 text-gray-600">
                      <svg class="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <p class="text-sm font-semibold mb-1 text-gray-500">No unsold players yet</p>
                      <p class="text-xs text-gray-600">All players have been sold!</p>
                    </div>
                  </Show>
                </div>
                  );
                })()}
              </Show>

            </div>

            {/* Chat Input - Only visible in Chat sub-tab */}
            <Show when={activeTab() === 'balance' && activitySubTab() === 'chat'}>
              <div class="absolute bottom-[70px] left-0 right-0 px-4 py-2 bg-black/80 backdrop-blur-sm z-40">
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={chatInput()}
                    onInput={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    class="flex-1 bg-gray-900/60 text-white rounded-full px-4 py-2.5 text-xs border border-gray-700/50 focus:outline-none focus:border-blue-500/50 focus:bg-gray-900/80 placeholder:text-gray-500 transition-all"
                  />
                  <button
                    onClick={sendMessage}
                    class="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors flex-shrink-0 shadow-lg active:scale-95"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </Show>



            {/* Bottom Safe Area */}
            <div class="h-[34px] bg-black"></div>

            {/* Floating Bid Buttons: team-code user OR admin who selected a team; else spectator */}
            <div class="absolute bottom-[10px] left-1/2 transform -translate-x-1/2 w-[calc(100%-40px)] z-50">
              <Show when={effectiveTeamId() != null} fallback={
                <div class="w-full rounded-full py-4 text-sm font-medium text-center text-gray-500 bg-gray-800/50 border border-gray-700">
                  {isAdmin() ? 'Select a team above to bid, or spectate' : 'Log in with your team code to bid'}
                </div>
              }>
                <div class="space-y-2">
                  {/* Stable bid warning - shows for 5 seconds without flickering */}
                  <Show when={bidWarning()}>
                    {(() => {
                      const reason = bidWarning();
                      const bgColor = reason.color === 'text-red-400' ? 'bg-red-500/15 border-red-500/40' :
                                     reason.color === 'text-orange-400' ? 'bg-orange-500/15 border-orange-500/40' :
                                     'bg-blue-500/15 border-blue-500/40';
                      return (
                        <div class={`flex items-center justify-center gap-1.5 px-3 py-1.5 ${bgColor} backdrop-blur-md rounded-lg border`}>
                          <span class={`${reason.color} flex-shrink-0`}>{reason.iconSvg}</span>
                          <span class={`text-[11px] font-semibold ${reason.color} leading-tight`}>
                            {reason.text}
                          </span>
                        </div>
                      );
                    })()}
                  </Show>
                  
                  {/* Three Bid Buttons - Compact Layout */}
                  <div class="flex items-stretch gap-2">
                    {/* Left: +0.25 Cr Button */}
                    <button 
                      onClick={() => placeBid(0.25)} 
                      disabled={!canBid(0.25)}
                      class={`flex-1 backdrop-blur-md rounded-md py-1.5 text-xs font-bold flex flex-col items-center justify-center transition-all shadow-md border ${
                        canBid(0.25)
                          ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 border-emerald-400/50 cursor-pointer active:scale-95' 
                          : 'bg-gray-700/40 border-gray-600/30 cursor-not-allowed opacity-50'
                      }`}
                      style="touch-action: manipulation; -webkit-tap-highlight-color: transparent; min-height: 36px;"
                    >
                      <span class="text-sm font-bold">+0.25</span>
                      <span class="text-[8px] opacity-70">Cr</span>
                    </button>

                    {/* Center: +0.50 Cr Button (Slightly Wider) */}
                    <button 
                      onClick={() => placeBid(0.5)} 
                      disabled={!canBid(0.5)}
                      class={`flex-[1.2] backdrop-blur-md rounded-md py-1.5 text-xs font-bold flex flex-col items-center justify-center transition-all shadow-md border ${
                        canBid(0.5)
                          ? 'bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 border-blue-400/50 cursor-pointer active:scale-95' 
                          : 'bg-gray-700/40 border-gray-600/30 cursor-not-allowed opacity-50'
                      } ${bidSuccess() ? 'bid-success' : ''}`}
                      style="touch-action: manipulation; -webkit-tap-highlight-color: transparent; min-height: 36px;"
                    >
                      <span class="text-base font-bold">+0.50</span>
                      <span class="text-[8px] opacity-70">Cr</span>
                    </button>

                    {/* Right: +1.00 Cr Button */}
                    <button 
                      onClick={() => placeBid(1.0)} 
                      disabled={!canBid(1.0)}
                      class={`flex-1 backdrop-blur-md rounded-md py-1.5 text-xs font-bold flex flex-col items-center justify-center transition-all shadow-md border ${
                        canBid(1.0)
                          ? 'bg-gradient-to-br from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 border-purple-400/50 cursor-pointer active:scale-95' 
                          : 'bg-gray-700/40 border-gray-600/30 cursor-not-allowed opacity-50'
                      }`}
                      style="touch-action: manipulation; -webkit-tap-highlight-color: transparent; min-height: 36px;"
                    >
                      <span class="text-sm font-bold">+1.00</span>
                      <span class="text-[8px] opacity-70">Cr</span>
                    </button>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

