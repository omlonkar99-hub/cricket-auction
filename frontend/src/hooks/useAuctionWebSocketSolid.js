import { createSignal, onMount, onCleanup } from 'solid-js';
import { imagePreloader } from '../utils/imagePreloader';
import { soundManager } from '../utils/soundManager';

export function useAuctionWebSocketSolid(auctionId) {
  const [auctionState, setAuctionState] = createSignal(null);
  const [isConnected, setIsConnected] = createSignal(false);
  const [lastMessageTime, setLastMessageTime] = createSignal(Date.now());
  const [bidHistory, setBidHistory] = createSignal([]); // Track all bids and events
  const [unsoldPlayers, setUnsoldPlayers] = createSignal([]); // Track unsold players
  const [soldPlayers, setSoldPlayers] = createSignal([]); // Track sold players
  const [ping, setPing] = createSignal(0); // Real WebSocket latency
  let ws = null;
  let reconnectTimeout = null;
  let allPlayers = [];
  let pingInterval = null;
  let lastPingTime = 0;
  let keepaliveInterval = null;
  let isInAuctionRoom = false;

  onMount(() => {
    const currentAuctionId = auctionId();
    if (!currentAuctionId) return;

    // Ensure ID is a string to avoid precision loss
    const auctionIdStr = String(currentAuctionId);

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Use same logic as API utility
      const isProduction = typeof window !== 'undefined' && 
                          (window.location.hostname !== 'localhost' && 
                           window.location.hostname !== '127.0.0.1');
      
      let wsUrl;
      if (isProduction) {
        // Production: Use hardcoded backend URL
        wsUrl = `${protocol}//auction-backend-l24v.onrender.com/api/auctions/${auctionIdStr}/ws`;
      } else {
        // Development: Use localhost with port
        const backendPort = import.meta.env.VITE_BACKEND_PORT || '8080';
        wsUrl = `${protocol}//${window.location.hostname}:${backendPort}/api/auctions/${auctionIdStr}/ws`;
      }
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        
        // Start smart keepalive only if in auction room
        if (isInAuctionRoom) {
          startSmartKeepalive();
        }
      };

      ws.onerror = (error) => {
        // Check if user is still logged in
        const isLoggedIn = localStorage.getItem('authToken') !== null;
        if (!isLoggedIn) {
          if (ws) {
            ws.close();
            ws = null;
          }
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
          }
        }
      };

      ws.onmessage = (event) => {
        setLastMessageTime(Date.now()); // Track message time
        
        try {
          // Validate event data before parsing
          if (!event.data || typeof event.data !== 'string') {
            return
          }
          
          // Prevent parsing very large messages that could cause stack overflow
          if (event.data.length > 100000) {
            return
          }
          
          const update = JSON.parse(event.data);
          
          // Validate update object
          if (!update || typeof update !== 'object' || !update.type) {
            return
          }
          
          switch (update.type) {
            case 'waiting':
              // Auction not started yet, keep waiting
              break;
            case 'pong':
              // Calculate real ping from pong response
              if (lastPingTime > 0) {
                const roundTripTime = Date.now() - lastPingTime;
                setPing(prev => {
                  if (prev === 0) return roundTripTime;
                  // Smooth the ping value
                  return Math.round(prev * 0.7 + roundTripTime * 0.3);
                });
              }
              break;
            case 'initial_state':
            case 'state':
              setAuctionState(update);
              if (update.allPlayers) {
                allPlayers = update.allPlayers;
                // Smart preloading: only current + next 4 players + team logos
                if (update.currentPlayer) {
                  const currentIndex = update.currentPlayerIndex - 1; // Convert from 1-based to 0-based
                  imagePreloader.preloadNextPlayers(update.allPlayers, currentIndex, 4);
                }
                // Always preload team logos (small files, always visible)
                if (update.teams) {
                  imagePreloader.preloadTeamLogos(update.teams);
                }
              }
              if (update.currentPlayer?.image) imagePreloader.preload(update.currentPlayer.image, 'high');
              break;
            case 'bid':
              setAuctionState((prev) => prev && ({ 
                ...prev, 
                currentBid: update.currentBid, 
                currentBidder: update.currentBidder, 
                timer: update.timer,
                timerDuration: update.timerDuration !== undefined ? update.timerDuration : prev.timerDuration,
                isPaused: update.isPaused !== undefined ? update.isPaused : prev.isPaused,
                playersLimit: update.playersLimit !== undefined ? update.playersLimit : prev.playersLimit,
                overseasLimit: update.overseasLimit !== undefined ? update.overseasLimit : prev.overseasLimit,
                teams: update.teams 
              }));
              // Play bid sound
              soundManager.play('bid');
              // Add bid to history
              if (update.currentBidder) {
                setBidHistory((prev) => [...prev, {
                  type: 'bid',
                  team: update.currentBidder.name,
                  teamShort: update.currentBidder.shortName,
                  teamColor: update.currentBidder.color || '#8B5CF6',
                  teamLogo: update.currentBidder.logo, // Add team logo
                  amount: update.currentBid,
                  timestamp: Date.now()
                }]);
              }
              break;
            case 'timer':
              setAuctionState((prev) => {
                if (!prev) return prev;
                
                return { 
                  ...prev, 
                  timer: update.timer,
                  timerDuration: update.timerDuration !== undefined ? update.timerDuration : prev.timerDuration,
                  isPaused: update.isPaused !== undefined ? update.isPaused : prev.isPaused,
                  playersLimit: update.playersLimit !== undefined ? update.playersLimit : prev.playersLimit,
                  overseasLimit: update.overseasLimit !== undefined ? update.overseasLimit : prev.overseasLimit,
                  currentPlayer: update.currentPlayer || prev.currentPlayer,
                  currentBid: update.currentBid !== undefined ? update.currentBid : prev.currentBid,
                  currentBidder: update.currentBidder !== undefined ? update.currentBidder : prev.currentBidder,
                  teams: update.teams || prev.teams
                };
              });
              break;
            case 'control':
              setAuctionState((prev) => {
                if (!prev) return prev;
                
                // Create new state with immediate pause/resume handling
                const newState = { 
                  ...prev, 
                  isPaused: update.isPaused !== undefined ? update.isPaused : prev.isPaused,
                  playersLimit: update.playersLimit !== undefined ? update.playersLimit : prev.playersLimit,
                  overseasLimit: update.overseasLimit !== undefined ? update.overseasLimit : prev.overseasLimit,
                  currentPlayer: update.currentPlayer || prev.currentPlayer,
                  currentBid: update.currentBid !== undefined ? update.currentBid : prev.currentBid,
                  currentBidder: update.currentBidder !== undefined ? update.currentBidder : prev.currentBidder,
                  timer: update.timer !== undefined ? update.timer : prev.timer,
                  timerDuration: update.timerDuration !== undefined ? update.timerDuration : prev.timerDuration,
                  teams: update.teams || prev.teams
                };
                
                // Track pause/resume state
                if (update.isPaused !== undefined && update.isPaused !== prev.isPaused) {
                  // State changed
                }
                
                return newState;
              });
              break;
            case 'next_player':
              setAuctionState((prev) => prev && ({
                ...prev,
                currentPlayer: update.currentPlayer,
                currentBid: update.currentBid,
                currentBidder: null,
                timer: update.timer,
                timerDuration: update.timerDuration !== undefined ? update.timerDuration : prev.timerDuration,
                isPaused: update.isPaused !== undefined ? update.isPaused : prev.isPaused,
                playersLimit: update.playersLimit !== undefined ? update.playersLimit : prev.playersLimit,
                overseasLimit: update.overseasLimit !== undefined ? update.overseasLimit : prev.overseasLimit,
                teams: update.teams,
                allPlayers: update.allPlayers || prev.allPlayers // Update allPlayers if provided
              }));
              // Update local allPlayers reference
              if (update.allPlayers) {
                allPlayers = update.allPlayers;
              }
              // Smart preloading: preload current + next 4 players when moving to next player
              if (update.currentPlayer?.image) {
                imagePreloader.preload(update.currentPlayer.image, 'high');
                const currentIndex = update.currentPlayerIndex - 1; // Convert from 1-based to 0-based
                imagePreloader.preloadNextPlayers(allPlayers, currentIndex, 4);
              }
              break;
            case 'unsold_round_start':
              // Unsold round started - update state with first unsold player
              setAuctionState((prev) => prev && ({
                ...prev,
                currentPlayer: update.currentPlayer,
                currentBid: update.currentBid,
                currentBidder: null,
                timer: update.timer,
                playersLimit: update.playersLimit !== undefined ? update.playersLimit : prev.playersLimit,
                overseasLimit: update.overseasLimit !== undefined ? update.overseasLimit : prev.overseasLimit,
                teams: update.teams,
                isUnsoldRound: true, // Flag to show unsold round indicator
                allPlayers: update.allPlayers || prev.allPlayers // Update allPlayers if provided
              }));
              // Update local allPlayers reference
              if (update.allPlayers) {
                allPlayers = update.allPlayers;
              }
              // Preload current unsold player (others already loaded when unsold tab was opened)
              if (update.currentPlayer?.image) {
                imagePreloader.preload(update.currentPlayer.image, 'high');
              }
              // Add unsold round start message to bid history
              setBidHistory((prev) => [...prev, {
                type: 'unsold_round_start',
                message: update.message || 'Unsold round started!',
                timestamp: Date.now()
              }]);
              break;
            case 'player_sold':
              if (update.teams) setAuctionState((prev) => prev && ({ ...prev, teams: update.teams }));
              // Update allPlayers if provided (contains updated player status)
              if (update.allPlayers) {
                setAuctionState((prev) => prev && ({ ...prev, allPlayers: update.allPlayers }));
                allPlayers = update.allPlayers;
              }
              // Play sold sound
              soundManager.play('sold');
              // Add sold message to history
              const soldMsg = update.message || 'Player SOLD';
              const soldMatch = soldMsg.match(/(.+) SOLD to (.+) for ₹(.+)/);
              if (soldMatch) {
                const [, playerName, teamName, price] = soldMatch;
                // Find team color from teams
                const soldTeam = update.teams?.find(t => t.name === teamName);
                setBidHistory((prev) => [...prev, {
                  type: 'sold',
                  playerName,
                  team: teamName,
                  teamColor: soldTeam?.color || '#10B981',
                  teamLogo: soldTeam?.logo, // Add team logo
                  price: parseFloat(price),
                  timestamp: Date.now()
                }]);
                // Add to sold players list
                const player = allPlayers.find(p => p.name === playerName);
                if (player) {
                  setSoldPlayers((prev) => [...prev, player]);
                  // Remove from unsold list if present (sold during unsold round)
                  setUnsoldPlayers((prev) => prev.filter(p => p.id !== player.id));
                }
              }
              break;
            case 'player_unsold':
              if (update.teams) setAuctionState((prev) => prev && ({ ...prev, teams: update.teams }));
              // Update allPlayers if provided (contains updated player status)
              if (update.allPlayers) {
                setAuctionState((prev) => prev && ({ ...prev, allPlayers: update.allPlayers }));
                allPlayers = update.allPlayers;
              }
              // Play unsold sound
              soundManager.play('unsold');
              // Add unsold message to history
              const unsoldMsg = update.message || 'Player UNSOLD';
              const unsoldMatch = unsoldMsg.match(/(.+) is UNSOLD/);
              if (unsoldMatch) {
                const [, playerName] = unsoldMatch;
                setBidHistory((prev) => [...prev, {
                  type: 'unsold',
                  playerName,
                  timestamp: Date.now()
                }]);
                // Handle unsold player
                const player = allPlayers.find(p => p.name === playerName);
                if (player) {
                  const currentState = auctionState();
                  const isUnsoldRound = currentState?.isUnsoldRound;
                  
                  setUnsoldPlayers((prev) => {
                    const alreadyUnsold = prev.some(p => p.id === player.id);
                    
                    if (isUnsoldRound && alreadyUnsold) {
                      // During unsold round: player went unsold again, remove from list (processed)
                      return prev.filter(p => p.id !== player.id);
                    } else if (!alreadyUnsold) {
                      // Main round: add to unsold list
                      return [...prev, player];
                    }
                    
                    return prev;
                  });
                }
              }
              break;
            case 'auction_ended':
              // Auction has ended - update state and stop reconnecting
              setAuctionState((prev) => prev && ({ 
                ...prev, 
                isRunning: false,
                status: 'completed'
              }));
              // Close WebSocket and prevent reconnection
              if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
              }
              if (ws) {
                ws.close();
                ws = null;
              }
              break;
            case 'error':
              if (window.showToast) window.showToast(update.message, 'error');
              break;
            default:
              break;
          }
        } catch (e) {
          // Prevent stack overflow by limiting error logging
          if (!e.message?.includes('Maximum call stack size exceeded')) {
            // Silent error - WebSocket parse error
          }
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        
        // Don't reconnect if:
        // 1. Auction is completed
        // 2. User is logged out (check localStorage)
        // 3. Close code indicates server rejection (1008 = policy violation, 1011 = server error)
        const state = auctionState();
        const isLoggedIn = localStorage.getItem('authToken') !== null;
        const shouldNotReconnect = 
          !isLoggedIn ||
          (state && (state.status === 'completed' || state.isRunning === false)) ||
          event.code === 1008 || 
          event.code === 1011;
        
        if (shouldNotReconnect) {
          if (!isLoggedIn) {
            // User logged out
          }
        } else {
          reconnectTimeout = setTimeout(connect, 2000);
        }
      };
    };

    connect();
  });

  onCleanup(() => {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (pingInterval) clearInterval(pingInterval);
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    if (ws) ws.close();
  });

  const placeBid = (teamId, amount) => {
    if (ws && ws.readyState === WebSocket.OPEN && teamId != null) {
      const teamIdStr = String(teamId);
      ws.send(JSON.stringify({ type: 'bid', teamId: teamIdStr, amount }));
    }
  };

  const getNextBidAmount = (increment = 0.5) => {
    const state = auctionState();
    if (!state) return 0;
    if (!state.currentBidder) return state.currentPlayer?.basePrice ?? 0;
    return (state.currentBid || 0) + increment;
  };

  const sendControl = (command) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'control', command }));
    }
  };

  // Smart keepalive system
  const startSmartKeepalive = () => {
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    
    keepaliveInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN && isInAuctionRoom) {
        lastPingTime = Date.now();
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000); // Every 25 seconds - safely under 30s timeout
  };

  const enterAuctionRoom = () => {
    isInAuctionRoom = true;
    if (ws?.readyState === WebSocket.OPEN) {
      startSmartKeepalive();
    }
  };

  const leaveAuctionRoom = () => {
    isInAuctionRoom = false;
    if (keepaliveInterval) {
      clearInterval(keepaliveInterval);
      keepaliveInterval = null;
    }
  };

  // Page visibility optimization
  const handleVisibilityChange = () => {
    if (!isInAuctionRoom) return;
    
    if (document.visibilityState === 'hidden') {
      // Tab hidden - reduce frequency but don't stop
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN && isInAuctionRoom) {
            lastPingTime = Date.now();
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 45000); // Every 45 seconds when hidden
      }
    } else {
      // Tab visible - resume normal frequency
      if (isInAuctionRoom) startSmartKeepalive();
    }
  };

  // Set up visibility change listener
  onMount(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onCleanup(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return { 
    auctionState, 
    isConnected, 
    placeBid, 
    getNextBidAmount, 
    sendControl, 
    lastMessageTime, 
    bidHistory, 
    unsoldPlayers, 
    soldPlayers, 
    ping,
    enterAuctionRoom,
    leaveAuctionRoom
  };
}
