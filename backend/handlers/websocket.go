package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins (configure properly in production)
	},
}

// WebSocketMessage represents incoming messages from clients
type WebSocketMessage struct {
	Type    string  `json:"type"`   // bid, control
	TeamID  string  `json:"teamId,omitempty"`  // Accept as string
	Amount  float64 `json:"amount,omitempty"`
	Command string  `json:"command,omitempty"` // pause, resume, skip, stop
}

// HandleWebSocket upgrades HTTP to WebSocket and connects client to auction
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auctionIDStr := vars["id"]
	auctionID, err := strconv.ParseInt(auctionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	
	// Upgrade connection first (before checking if auction is live)
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	
	// Get live auction
	auction, exists := GetLiveAuction(auctionID)
	if !exists {
		// Auction not started yet - send waiting state and keep connection open
		waitingState := AuctionUpdate{
			Type:    "waiting",
			Message: "Waiting for auction to start...",
		}
		data, _ := json.Marshal(waitingState)
		conn.WriteMessage(websocket.TextMessage, data)
		
		// Keep connection open and poll for auction start
		go waitForAuctionStart(conn, auctionID)
		return
	}
	
	// Register client
	auction.ClientsMux.Lock()
	auction.Clients[conn] = true
	auction.ClientsMux.Unlock()
	
	// Send initial state
	initialState := AuctionUpdate{
		Type:               "initial_state",
		CurrentPlayer:      auction.CurrentPlayer,
		CurrentPlayerIndex: auction.CurrentPlayerIndex + 1, // 1-based for display
		TotalPlayers:       len(auction.Players),
		CurrentBid:         auction.CurrentBid,
		CurrentBidder:      auction.CurrentBidder,
		Timer:              auction.Timer,
		TimerDuration:      auction.TimerDuration,
		IsPaused:           auction.IsPaused,
		Teams:              auction.getTeamSnapshots(),
		AllPlayers:         auction.Players, // Send all players for image preloading
	}
	
	data, _ := json.Marshal(initialState)
	conn.WriteMessage(websocket.TextMessage, data)
	
	// Listen for messages from this client
	go handleClientMessages(conn, auction)
}

// waitForAuctionStart keeps connection open and waits for auction to start
func waitForAuctionStart(conn *websocket.Conn, auctionID int64) {
	defer conn.Close()
	
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	
	timeout := time.After(5 * time.Minute) // 5 minute timeout
	
	for {
		select {
		case <-ticker.C:
			// Check if auction has started
			auction, exists := GetLiveAuction(auctionID)
			if exists {
				// Auction started! Register client and send initial state
				auction.ClientsMux.Lock()
				auction.Clients[conn] = true
				auction.ClientsMux.Unlock()
				
				// Send initial state
				initialState := AuctionUpdate{
					Type:               "initial_state",
					CurrentPlayer:      auction.CurrentPlayer,
					CurrentPlayerIndex: auction.CurrentPlayerIndex + 1,
					TotalPlayers:       len(auction.Players),
					CurrentBid:         auction.CurrentBid,
					CurrentBidder:      auction.CurrentBidder,
					Timer:              auction.Timer,
					TimerDuration:      auction.TimerDuration,
					IsPaused:           auction.IsPaused,
					Teams:              auction.getTeamSnapshots(),
					AllPlayers:         auction.Players,
				}
				
				data, _ := json.Marshal(initialState)
				conn.WriteMessage(websocket.TextMessage, data)
				
				// Start listening for messages
				handleClientMessages(conn, auction)
				return
			}
			
		case <-timeout:
			// Timeout - close connection
			return
		}
	}
}

// handleClientMessages processes incoming messages from a client
func handleClientMessages(conn *websocket.Conn, auction *LiveAuction) {
	defer func() {
		// Unregister client on disconnect
		auction.ClientsMux.Lock()
		delete(auction.Clients, conn)
		auction.ClientsMux.Unlock()
		conn.Close()
	}()
	
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				// Silent error
			}
			break
		}
		
		var msg WebSocketMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}
		
		// Process message
		switch msg.Type {
		case "ping":
			// Respond to ping with pong
			pongResponse := map[string]string{"type": "pong"}
			data, _ := json.Marshal(pongResponse)
			conn.WriteMessage(websocket.TextMessage, data)
			
		case "bid":
			// Convert string TeamID to int64
			teamID, err := strconv.ParseInt(msg.TeamID, 10, 64)
			if err != nil {
				continue
			}
			
			// Send bid to auction loop
			auction.BidChannel <- Bid{
				TeamID: teamID,
				Amount: msg.Amount,
			}
			
		case "control":
			// Send control command (admin only - add auth check in production)
			auction.ControlChannel <- msg.Command
		}
	}
}

// GetAuctionState returns current state (for HTTP polling fallback)
func GetAuctionState(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auctionIDStr := vars["id"]
	auctionID, err := strconv.ParseInt(auctionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	
	auction, exists := GetLiveAuction(auctionID)
	if !exists {
		http.Error(w, "Auction not found or not live", http.StatusNotFound)
		return
	}
	
	state := AuctionUpdate{
		Type:               "state",
		CurrentPlayer:      auction.CurrentPlayer,
		CurrentPlayerIndex: auction.CurrentPlayerIndex + 1, // 1-based for display
		TotalPlayers:       len(auction.Players),
		CurrentBid:         auction.CurrentBid,
		CurrentBidder:      auction.CurrentBidder,
		Timer:              auction.Timer,
		IsPaused:           auction.IsPaused,
		Teams:              auction.getTeamSnapshots(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}
