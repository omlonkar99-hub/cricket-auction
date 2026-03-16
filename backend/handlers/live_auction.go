package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"cricket-auction/config"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// LiveAuction represents an in-memory auction state
type LiveAuction struct {
	ID                  int64
	Name                string
	Teams               []Team
	Players             []Player
	AllPlayersOriginal  []Player // Keep original list for frontend
	Budget              float64
	TimerDuration       int
	MinBidIncrement     float64
	PlayersLimit        int
	OverseasLimit       int
	TradeWindowDuration int

	// Live state (in-memory only)
	CurrentPlayerIndex int
	CurrentPlayer      *Player
	CurrentBid         float64
	CurrentBidder      *Team
	Timer              int
	IsRunning          bool
	IsPaused           bool

	// Channels for communication
	BidChannel     chan Bid
	ControlChannel chan string

	// WebSocket connections
	Clients    map[*websocket.Conn]*ClientConn
	ClientsMux sync.RWMutex // Changed to RWMutex for better concurrency

	// Results (written to DB at end of each player)
	Results []AuctionResult
	// Track if unsold round has started
	unsoldRoundStarted bool
	
	// Cache for team snapshots (optimization)
	cachedTeamSnapshots []LiveTeamSnapshot
	teamSnapshotsDirty  bool
	snapshotMux         sync.RWMutex
}

// ClientConn wraps a WebSocket connection with a mutex for safe concurrent writes
type ClientConn struct {
	Conn  *websocket.Conn
	Mutex sync.Mutex
}

type Bid struct {
	TeamID int64
	Amount float64
	Time   time.Time
}

type AuctionResult struct {
	AuctionID  int64   `json:"auctionId" bson:"auctionId"`
	PlayerID   int64   `json:"playerId,string" bson:"playerId"`
	PlayerName string  `json:"playerName" bson:"playerName"`
	TeamID     int64   `json:"teamId,string,omitempty" bson:"teamId,omitempty"`
	TeamName   string  `json:"teamName,omitempty" bson:"teamName,omitempty"`
	Price      float64 `json:"price,omitempty" bson:"price,omitempty"`
	Status     string  `json:"status" bson:"status"` // sold or unsold
}

type AuctionUpdate struct {
	Type               string             `json:"type"` // bid, timer, player_sold, player_unsold, next_player, error
	CurrentPlayer      *Player            `json:"currentPlayer,omitempty"`
	CurrentPlayerIndex int                `json:"currentPlayerIndex,omitempty"`
	TotalPlayers       int                `json:"totalPlayers,omitempty"`
	CurrentBid         float64            `json:"currentBid,omitempty"`
	CurrentBidder      *Team              `json:"currentBidder,omitempty"`
	Timer              int                `json:"timer,omitempty"`
	TimerDuration      int                `json:"timerDuration,omitempty"`
	IsPaused           bool               `json:"isPaused,omitempty"`
	IsRunning          bool               `json:"isRunning,omitempty"`
	Status             string             `json:"status,omitempty"`
	PlayersLimit       int                `json:"playersLimit,omitempty"`
	OverseasLimit      int                `json:"overseasLimit,omitempty"`
	Teams              []LiveTeamSnapshot `json:"teams,omitempty"`
	AllPlayers         []Player           `json:"allPlayers,omitempty"` // All players in auction for preloading
	Message            string             `json:"message,omitempty"`
	TeamID             int64              `json:"teamId,string,omitempty"` // For targeted messages
}

type LiveTeamSnapshot struct {
	ID              int64   `json:"id,string"`
	Name            string  `json:"name"`
	ShortName       string  `json:"shortName"`
	Logo            string  `json:"logo"`
	Color           string  `json:"color"`
	RemainingBudget float64 `json:"remainingBudget"`
	PlayersCount    int     `json:"playersCount"`
	OverseasCount   int     `json:"overseasCount"`
}

// Global map to store live auctions (in-memory)
var (
	liveAuctions    = make(map[int64]*LiveAuction)
	liveAuctionsMux sync.RWMutex
)

// loadAuctionResults loads existing auction results from database
func loadAuctionResults(auctionID int64) []AuctionResult {
	if config.DB == nil {
		return make([]AuctionResult, 0)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("auction_results")
	cursor, err := collection.Find(ctx, bson.M{"auctionId": auctionID})
	if err != nil {
		return make([]AuctionResult, 0)
	}
	defer cursor.Close(ctx)

	var results []AuctionResult
	if err = cursor.All(ctx, &results); err != nil {
		return make([]AuctionResult, 0)
	}

	return results
}

// StartLiveAuction creates and starts an isolated auction worker
func StartLiveAuction(auctionID int64, auction Auction) {
	liveAuctionsMux.Lock()
	defer liveAuctionsMux.Unlock()

	// Check if already running
	if _, exists := liveAuctions[auctionID]; exists {
		return
	}
	
	// Create live auction state
	// Load existing auction results first (for retention auctions with pre-assigned players)
	existingResults := loadAuctionResults(auctionID)
	
	// Calculate spent budget per team from existing results
	teamSpentBudget := make(map[int64]float64)
	for _, result := range existingResults {
		if result.Status == "sold" {
			teamSpentBudget[result.TeamID] += result.Price
		}
	}
	
	// Set team budgets: auction budget minus already spent (from retention)
	teamsWithBudget := make([]Team, len(auction.Teams))
	for i, team := range auction.Teams {
		teamsWithBudget[i] = team
		spent := teamSpentBudget[team.ID]
		teamsWithBudget[i].Budget = float64(auction.Budget) - spent
	}
	
	// Create complete player list for frontend (includes retained players for display)
	var allPlayersForFrontend []Player
	
	// Add players available for bidding
	allPlayersForFrontend = append(allPlayersForFrontend, auction.Players...)
	
	// Add retained players from results (for team tab display)
	retainedPlayerIDs := make(map[int64]bool)
	for _, result := range existingResults {
		if result.Status == "sold" {
			retainedPlayerIDs[result.PlayerID] = true
		}
	}
	
	// Get retained player objects and add them to frontend list
	for _, result := range existingResults {
		if result.Status == "sold" {
			// Find player in global store and add to frontend list
			allPlayers := GetPlayersStore()
			for _, player := range allPlayers {
				if player.ID == result.PlayerID {
					retainedPlayer := player
					retainedPlayer.Status = "sold"
					retainedPlayer.TeamID = result.TeamID
					retainedPlayer.SoldPrice = result.Price
					allPlayersForFrontend = append(allPlayersForFrontend, retainedPlayer)
					break
				}
			}
		}
	}

	live := &LiveAuction{
		ID:                  auctionID,
		Name:                auction.Name,
		Teams:               teamsWithBudget, // Use teams with correct budgets
		Players:             auction.Players, // Only players available for bidding
		AllPlayersOriginal:  allPlayersForFrontend, // Complete list for frontend display
		Budget:              float64(auction.Budget),
		TimerDuration:       auction.TimerDuration, // Keep in seconds
		MinBidIncrement:     0.25, // Minimum increment (allows 0.25, 0.50, 1.00 bids)
		PlayersLimit:        auction.PlayersLimit,
		OverseasLimit:       auction.OverseasLimit,
		TradeWindowDuration: auction.TradeWindowDuration,

		CurrentPlayerIndex: 0,
		Timer:              auction.TimerDuration, // Keep in seconds
		IsRunning:          true,
		IsPaused:           false,

		BidChannel:     make(chan Bid, 100),
		ControlChannel: make(chan string, 10),
		Clients:        make(map[*websocket.Conn]*ClientConn),
		Results:        existingResults, // Load existing results (retained players)
		
		// Initialize cache
		teamSnapshotsDirty: true,
	}
	

	if len(live.Players) > 0 {
		live.CurrentPlayer = &live.Players[0]
		live.CurrentBid = live.CurrentPlayer.BasePrice
		live.CurrentPlayerIndex = 0
	}

	liveAuctions[auctionID] = live

	// Start the isolated auction loop in a goroutine
	go live.runAuctionLoop()
}

// runAuctionLoop is the isolated worker for this auction
func (la *LiveAuction) runAuctionLoop() {
	ticker := time.NewTicker(1 * time.Second) // Back to 1 second for efficiency
	defer ticker.Stop()

	for la.IsRunning {
		select {
		case bid := <-la.BidChannel:
			// Process bid sequentially (one at a time)
			la.processBid(bid)

		case control := <-la.ControlChannel:
			// Handle control commands (pause, resume, skip, etc.)
			la.handleControl(control)

		case <-ticker.C:
			// Timer tick (every second)
			if !la.IsPaused && la.CurrentPlayer != nil {
				la.Timer--

				// Broadcast timer update with current player info (no teams data - teams don't change during timer)
				la.broadcast(AuctionUpdate{
					Type:               "timer",
					CurrentPlayer:      la.CurrentPlayer,
					CurrentPlayerIndex: la.CurrentPlayerIndex + 1, // 1-based for display
					TotalPlayers:       len(la.Players),
					CurrentBid:         la.CurrentBid,
					CurrentBidder:      la.CurrentBidder,
					Timer:              la.Timer,
					TimerDuration:      la.TimerDuration,
					IsPaused:           la.IsPaused,
					PlayersLimit:       la.PlayersLimit,
					OverseasLimit:      la.OverseasLimit,
					// Teams:              la.getTeamSnapshots(), // REMOVED - teams don't change during timer countdown
				})

				// Timer expired
				if la.Timer <= 0 {
					la.finalizePlayer()
				}
			}
		}
	}
}

// processBid handles a single bid (sequential processing)
func (la *LiveAuction) processBid(bid Bid) {
	if la.CurrentPlayer == nil {
		return
	}

	// Find team - use flexible comparison
	var team *Team
	for i := range la.Teams {
		if la.Teams[i].ID == bid.TeamID {
			team = &la.Teams[i]
			break
		}
	}

	if team == nil {
		return
	}

	// RULE 1: Cannot bid consecutively on same player
	if la.CurrentBidder != nil && la.CurrentBidder.ID == bid.TeamID {
		// Silently reject - no error message to user
		return
	}

	// RULE 2: First bid must be at least base price
	if la.CurrentBidder == nil {
		// This is the first bid
		if bid.Amount < la.CurrentPlayer.BasePrice {
			// Silently reject - no error message to user
			return
		}
	} else {
		// Subsequent bids must be at least minBidIncrement higher
		minBid := la.CurrentBid + la.MinBidIncrement
		if bid.Amount < minBid {
			// Silently reject - no error message to user
			return
		}
	}

	// RULE 3: Check team budget
	if bid.Amount > team.Budget {
		// Silently reject - no error message to user
		return
	}

	// RULE 4: Check squad size limit
	teamPlayerCount := la.getTeamPlayerCount(team.ID)
	if teamPlayerCount >= la.PlayersLimit {
		// Silently reject - no error message to user
		return
	}

	// RULE 5: Check overseas player limit
	if la.CurrentPlayer.IsOverseas {
		teamOverseasCount := la.getTeamOverseasCount(team.ID)
		if teamOverseasCount >= la.OverseasLimit {
			// Silently reject - no error message to user
			return
		}
	}

	// Accept bid
	la.CurrentBid = bid.Amount
	la.CurrentBidder = team
	la.Timer = la.TimerDuration // Reset timer

	// Broadcast bid update (teams data changes with bids, so include it)
	la.broadcast(AuctionUpdate{
		Type:               "bid",
		CurrentPlayerIndex: la.CurrentPlayerIndex + 1, // 1-based for display
		TotalPlayers:       len(la.Players),
		CurrentBid:         la.CurrentBid,
		CurrentBidder:      la.CurrentBidder,
		Timer:              la.Timer,
		TimerDuration:      la.TimerDuration,
		PlayersLimit:       la.PlayersLimit,
		OverseasLimit:      la.OverseasLimit,
		Teams:              la.getTeamSnapshots(), // Include teams since budget/counts changed
	})
}

// finalizePlayer marks player as sold/unsold and writes to DB
func (la *LiveAuction) finalizePlayer() {
	if la.CurrentPlayer == nil {
		return
	}

	result := AuctionResult{
		AuctionID:  la.ID,
		PlayerID:   la.CurrentPlayer.ID,
		PlayerName: la.CurrentPlayer.Name,
		Status:     "unsold",
	}

	updateType := "player_unsold"
	message := la.CurrentPlayer.Name + " is UNSOLD"

	if la.CurrentBidder != nil {
		// Player sold
		result.TeamID = la.CurrentBidder.ID
		result.TeamName = la.CurrentBidder.Name
		result.Price = la.CurrentBid
		result.Status = "sold"

		// Update team budget (in-memory)
		for i := range la.Teams {
			if la.Teams[i].ID == la.CurrentBidder.ID {
				la.Teams[i].Budget -= la.CurrentBid
				break
			}
		}
		
		// Invalidate team snapshots cache since teams changed
		la.invalidateTeamSnapshots()

		updateType = "player_sold"
		message = la.CurrentPlayer.Name + " SOLD to " + la.CurrentBidder.Name + " for ₹" + formatPrice(la.CurrentBid)
	} else {
		// Player unsold
	}

	// Store result
	la.Results = append(la.Results, result)

	// Update the actual player object in the Players array
	for i := range la.Players {
		if la.Players[i].ID == la.CurrentPlayer.ID {
			la.Players[i].Status = result.Status
			if result.Status == "sold" {
				la.Players[i].TeamID = result.TeamID
				la.Players[i].SoldPrice = result.Price
			}
			break
		}
	}

	// Write to MongoDB (async, non-blocking)
	go writeResultToDB(result)

	// Broadcast player finalized (sold/unsold) - don't send allPlayers here (already sent in initial state)
	la.broadcast(AuctionUpdate{
		Type:          updateType,
		Message:       message,
		PlayersLimit:  la.PlayersLimit,
		OverseasLimit: la.OverseasLimit,
		Teams:         la.getTeamSnapshots(),
		// AllPlayers removed - only send in initial_state and next_player to reduce payload
	})
	
	la.nextPlayer()
}

// nextPlayer moves to the next player in queue
func (la *LiveAuction) nextPlayer() {
	la.CurrentPlayerIndex++

	if la.CurrentPlayerIndex >= len(la.Players) {
		// Check if this is the main round or unsold round
		if la.unsoldRoundStarted {
			// Unsold round complete, auction is fully completed
			la.IsRunning = false
			
			// Log audit event for auction completion
			LogAuditEvent("admin", "END_AUCTION", strconv.FormatInt(la.ID, 10), la.Name, "Auction completed: "+la.Name, "system")
			
			// Save all auction results to DB synchronously before marking as completed
			SaveAllAuctionResults(la)
			
			// Update in-memory auction list
			UpdateAuctionStatus(la.ID, "completed", false)
			
			// Create trade window automatically if duration is set
			if la.TradeWindowDuration > 0 {
				CreateTradeWindowForAuction(la.ID, la.TradeWindowDuration)
			}
			
			// Update auction status in database (async)
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				
				collection := config.GetCollection("auctions")
				filter := bson.M{"_id": la.ID}
				update := bson.M{
					"$set": bson.M{
						"status": "completed",
						"isLive": false,
					},
				}
				
				if _, err := collection.UpdateOne(ctx, filter, update); err != nil {
					log.Printf("[ERROR] Failed to update auction status: %v", err)
				} else {
					
				}
			}()
			
			la.broadcast(AuctionUpdate{
				Type:    "auction_ended",
				Message: "Auction completed!",
			})
			// Clean up
			go la.cleanup()
			return
		}

		// Prepare unsold round
		unsoldPlayers := []Player{}
		for _, player := range la.Players {
			found := false
			for _, result := range la.Results {
				if result.PlayerID == player.ID && result.Status == "sold" {
					found = true
					break
				}
			}
			if !found {
				unsoldPlayers = append(unsoldPlayers, player)
			}
		}

		if len(unsoldPlayers) > 0 {
			la.unsoldRoundStarted = true
			la.Players = unsoldPlayers
			la.CurrentPlayerIndex = 0
			la.CurrentPlayer = &la.Players[0]
			la.CurrentBid = la.CurrentPlayer.BasePrice // Always start at base price
			la.CurrentBidder = nil                      // No bidder yet
			la.Timer = la.TimerDuration                 // Full timer
			
			// Broadcast unsold round start with complete state (includes first unsold player)
			la.broadcast(AuctionUpdate{
				Type:               "unsold_round_start",
				Message:            "Unsold round started!",
				CurrentPlayer:      la.CurrentPlayer,
				CurrentPlayerIndex: la.CurrentPlayerIndex + 1, // 1-based for display
				TotalPlayers:       len(la.Players),
				CurrentBid:         la.CurrentBid, // Will be base price
				CurrentBidder:      nil,           // Explicitly nil
				Timer:              la.Timer,
				PlayersLimit:       la.PlayersLimit,
				OverseasLimit:      la.OverseasLimit,
				Teams:              la.getTeamSnapshots(),
				AllPlayers:         la.AllPlayersOriginal, // Send complete list including retained players
			})
			return
		} else {
			// No unsold players, auction is fully completed
			la.IsRunning = false
			
			// Log audit event for auction completion
			LogAuditEvent("admin", "END_AUCTION", strconv.FormatInt(la.ID, 10), la.Name, "Auction completed: "+la.Name, "system")
			
			// Save all auction results to DB synchronously before marking as completed
			SaveAllAuctionResults(la)
			
			// Update in-memory auction list
			UpdateAuctionStatus(la.ID, "completed", false)
			
			// Create trade window automatically if duration is set
			if la.TradeWindowDuration > 0 {
				CreateTradeWindowForAuction(la.ID, la.TradeWindowDuration)
			}
			
			// Update auction status in database (async)
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				
				collection := config.GetCollection("auctions")
				filter := bson.M{"_id": la.ID}
				update := bson.M{
					"$set": bson.M{
						"status": "completed",
						"isLive": false,
					},
				}
				
				if _, err := collection.UpdateOne(ctx, filter, update); err != nil {
					log.Printf("[ERROR] Failed to update auction status: %v", err)
				} else {
					
				}
			}()
			
			la.broadcast(AuctionUpdate{
				Type:    "auction_ended",
				Message: "Auction completed!",
			})
			// Clean up
			go la.cleanup()
			return
		}
	}

	// Set next player - ensure clean state
	la.CurrentPlayer = &la.Players[la.CurrentPlayerIndex]
	la.CurrentBid = la.CurrentPlayer.BasePrice // Always start at base price
	la.CurrentBidder = nil                      // No bidder yet
	la.Timer = la.TimerDuration                 // Full timer

	// Broadcast next player
	la.broadcast(AuctionUpdate{
		Type:               "next_player",
		CurrentPlayer:      la.CurrentPlayer,
		CurrentPlayerIndex: la.CurrentPlayerIndex + 1, // 1-based for display
		TotalPlayers:       len(la.Players),
		CurrentBid:         la.CurrentBid, // Will be base price
		CurrentBidder:      nil,           // Explicitly nil
		Timer:              la.Timer,
		TimerDuration:      la.TimerDuration,
		PlayersLimit:       la.PlayersLimit,
		OverseasLimit:      la.OverseasLimit,
		Teams:              la.getTeamSnapshots(),
		AllPlayers:         la.AllPlayersOriginal, // Send complete list including retained players
	})
}

// handleControl processes control commands
func (la *LiveAuction) handleControl(command string) {
	switch command {
	case "pause":
		la.IsPaused = true
		// Broadcast pause state (no teams data - teams don't change when pausing)
		la.broadcast(AuctionUpdate{
			Type:               "control",
			CurrentPlayer:      la.CurrentPlayer,
			CurrentPlayerIndex: la.CurrentPlayerIndex + 1,
			TotalPlayers:       len(la.Players),
			CurrentBid:         la.CurrentBid,
			CurrentBidder:      la.CurrentBidder,
			Timer:              la.Timer,
			TimerDuration:      la.TimerDuration,
			IsPaused:           la.IsPaused,
			PlayersLimit:       la.PlayersLimit,
			OverseasLimit:      la.OverseasLimit,
			// Teams:              la.getTeamSnapshots(), // REMOVED - teams don't change when pausing
			Message:            "Auction paused",
		})
	case "resume":
		la.IsPaused = false
		// Broadcast resume state (no teams data - teams don't change when resuming)
		la.broadcast(AuctionUpdate{
			Type:               "control",
			CurrentPlayer:      la.CurrentPlayer,
			CurrentPlayerIndex: la.CurrentPlayerIndex + 1,
			TotalPlayers:       len(la.Players),
			CurrentBid:         la.CurrentBid,
			CurrentBidder:      la.CurrentBidder,
			Timer:              la.Timer,
			TimerDuration:      la.TimerDuration,
			IsPaused:           la.IsPaused,
			PlayersLimit:       la.PlayersLimit,
			OverseasLimit:      la.OverseasLimit,
			// Teams:              la.getTeamSnapshots(), // REMOVED - teams don't change when resuming
			Message:            "Auction resumed",
		})
	case "skip":
		la.finalizePlayer()
	case "stop":
		la.IsRunning = false
		
		// Log audit event for manual auction stop
		LogAuditEvent("admin", "STOP_AUCTION", strconv.FormatInt(la.ID, 10), la.Name, "Auction manually stopped: "+la.Name, "admin")
		
		// Save all auction results to DB synchronously before marking as completed
		SaveAllAuctionResults(la)
		
		// Update in-memory auction list FIRST (synchronously)
		UpdateAuctionStatus(la.ID, "completed", false)
		
		// Create trade window automatically if duration is set
		if la.TradeWindowDuration > 0 {
			CreateTradeWindowForAuction(la.ID, la.TradeWindowDuration)
		}
		
		// Update auction status in database (async)
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			
			collection := config.GetCollection("auctions")
			filter := bson.M{"_id": la.ID} // Use _id not id
			update := bson.M{
				"$set": bson.M{
					"status": "completed",
					"isLive": false,
				},
			}
			
			if _, err := collection.UpdateOne(ctx, filter, update); err != nil {
				log.Printf("[ERROR] Failed to update auction status: %v", err)
			}
		}()
		
		// Broadcast final state to all clients
		la.broadcast(AuctionUpdate{
			Type:    "auction_ended",
			Message: "Auction has been ended by admin",
		})
	}
}

// broadcast sends update to all connected clients (optimized with parallel writes)
func (la *LiveAuction) broadcast(update AuctionUpdate) {
	la.ClientsMux.RLock()
	clientCount := len(la.Clients)
	la.ClientsMux.RUnlock()
	
	if clientCount == 0 {
		return // No clients, skip broadcast
	}

	data, err := json.Marshal(update)
	if err != nil {
		log.Printf("[BROADCAST ERROR] Failed to marshal update: %v", err)
		return
	}

	// Get snapshot of clients for parallel broadcast
	la.ClientsMux.RLock()
	clients := make(map[*websocket.Conn]*ClientConn, len(la.Clients))
	for conn, client := range la.Clients {
		clients[conn] = client
	}
	la.ClientsMux.RUnlock()
	
	// Broadcast to all clients in parallel
	var wg sync.WaitGroup
	failedConnsChan := make(chan *websocket.Conn, len(clients))
	
	for conn, clientConn := range clients {
		wg.Add(1)
		go func(c *websocket.Conn, cc *ClientConn) {
			defer wg.Done()
			
			// Lock this specific connection for writing
			cc.Mutex.Lock()
			defer cc.Mutex.Unlock()
			
			// Set write deadline to prevent hanging (critical for Render free tier)
			cc.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			
			err := cc.Conn.WriteMessage(websocket.TextMessage, data)
			if err != nil {
				failedConnsChan <- c
			}
		}(conn, clientConn)
	}
	
	// Wait for all writes to complete
	wg.Wait()
	close(failedConnsChan)
	
	// Clean up failed connections
	failedConns := make([]*websocket.Conn, 0)
	for conn := range failedConnsChan {
		failedConns = append(failedConns, conn)
	}
	
	if len(failedConns) > 0 {
		la.ClientsMux.Lock()
		for _, conn := range failedConns {
			if client, exists := la.Clients[conn]; exists {
				client.Conn.Close()
				delete(la.Clients, conn)
			}
		}
		la.ClientsMux.Unlock()
		log.Printf("[BROADCAST] Cleaned up %d failed connections", len(failedConns))
	}
}

// sendErrorToTeam sends error message to specific team
func (la *LiveAuction) sendErrorToTeam(teamID int64, message string) {
	update := AuctionUpdate{
		Type:    "error",
		TeamID:  teamID,
		Message: message,
	}

	data, _ := json.Marshal(update)

	la.ClientsMux.RLock()
	defer la.ClientsMux.RUnlock()

	// In production, you'd track which connection belongs to which team
	// For now, broadcast to all (frontend will filter by teamID)
	for _, clientConn := range la.Clients {
		clientConn.Mutex.Lock()
		clientConn.Conn.WriteMessage(websocket.TextMessage, data)
		clientConn.Mutex.Unlock()
	}
}

// getTeamSnapshots returns current team states
func (la *LiveAuction) getTeamSnapshots() []LiveTeamSnapshot {
	// Check if cache is valid
	la.snapshotMux.RLock()
	if !la.teamSnapshotsDirty && la.cachedTeamSnapshots != nil {
		snapshots := la.cachedTeamSnapshots
		la.snapshotMux.RUnlock()
		return snapshots
	}
	la.snapshotMux.RUnlock()
	
	// Cache is dirty, recalculate
	la.snapshotMux.Lock()
	defer la.snapshotMux.Unlock()
	
	// Double-check after acquiring write lock
	if !la.teamSnapshotsDirty && la.cachedTeamSnapshots != nil {
		return la.cachedTeamSnapshots
	}
	
	snapshots := make([]LiveTeamSnapshot, len(la.Teams))
	for i, team := range la.Teams {
		snapshots[i] = LiveTeamSnapshot{
			ID:              team.ID,
			Name:            team.Name,
			ShortName:       team.ShortName,
			Logo:            team.Logo,
			Color:           team.Color,
			RemainingBudget: team.Budget,
			PlayersCount:    la.getTeamPlayerCount(team.ID),
			OverseasCount:   la.getTeamOverseasCount(team.ID),
		}
	}
	
	la.cachedTeamSnapshots = snapshots
	la.teamSnapshotsDirty = false
	
	return snapshots
}

// invalidateTeamSnapshots marks the cache as dirty (call when teams change)
func (la *LiveAuction) invalidateTeamSnapshots() {
	la.snapshotMux.Lock()
	la.teamSnapshotsDirty = true
	la.snapshotMux.Unlock()
}

// getTeamPlayerCount returns the number of players bought by a team
func (la *LiveAuction) getTeamPlayerCount(teamID int64) int {
	count := 0
	for _, result := range la.Results {
		if result.TeamID == teamID && result.Status == "sold" {
			count++
		}
	}
	return count
}

// getTeamOverseasCount returns the number of overseas players bought by a team
func (la *LiveAuction) getTeamOverseasCount(teamID int64) int {
	count := 0
	for _, result := range la.Results {
		if result.TeamID == teamID && result.Status == "sold" {
			// Find the player in the original players list to check if overseas
			for _, player := range la.AllPlayersOriginal {
				if player.ID == result.PlayerID && player.IsOverseas {
					count++
					break
				}
			}
		}
	}
	return count
}

// cleanup removes auction from memory
func (la *LiveAuction) cleanup() {
	log.Printf("[CLEANUP] Starting cleanup for auction %d (%s)", la.ID, la.Name)
	time.Sleep(30 * time.Second) // Keep alive for 30 seconds to allow summary creation

	liveAuctionsMux.Lock()
	defer liveAuctionsMux.Unlock()

	// Close all connections
	la.ClientsMux.Lock()
	for _, clientConn := range la.Clients {
		clientConn.Conn.Close()
	}
	la.Clients = nil // Clear map to help GC
	la.ClientsMux.Unlock()

	// Close channels to prevent goroutine leaks
	close(la.BidChannel)
	close(la.ControlChannel)

	// Remove from memory
	delete(liveAuctions, la.ID)
	log.Printf("[CLEANUP] Completed cleanup for auction %d", la.ID)
}

// GetLiveAuction retrieves a live auction
func GetLiveAuction(auctionID int64) (*LiveAuction, bool) {
	liveAuctionsMux.RLock()
	defer liveAuctionsMux.RUnlock()

	auction, exists := liveAuctions[auctionID]
	return auction, exists
}

// StopLiveAuction forcefully stops a live auction
func StopLiveAuction(auctionID int64) {
	liveAuctionsMux.Lock()
	defer liveAuctionsMux.Unlock()

	auction, exists := liveAuctions[auctionID]
	if !exists {
		return // Auction not live
	}

	// Stop the auction loop
	auction.IsRunning = false
	
	// Send stop command through control channel (non-blocking)
	select {
	case auction.ControlChannel <- "stop":
	default:
		// Channel full or closed, auction is already stopping
	}

	// Clean up and remove from live auctions
	auction.cleanup()
	delete(liveAuctions, auctionID)
	
	log.Printf("Forcefully stopped live auction %d", auctionID)
}

// Helper functions
func writeResultToDB(result AuctionResult) {
	// Write to MongoDB Atlas with retry logic
	go func() {
		maxRetries := 3
		for attempt := 1; attempt <= maxRetries; attempt++ {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			
			collection := config.GetCollection("auction_results")

			// Use upsert to avoid duplicates - update if exists, insert if not
			filter := bson.M{
				"auctionId": result.AuctionID,
				"playerId":  result.PlayerID,
			}
			update := bson.M{"$set": result}
			opts := options.Update().SetUpsert(true)

			_, err := collection.UpdateOne(ctx, filter, update, opts)
			cancel()
			
			if err == nil {
				// Success
				return
			}
			
			// Log error and retry
			log.Printf("[DB ERROR] Failed to save result (attempt %d/%d) for player %s: %v", 
				attempt, maxRetries, result.PlayerName, err)
			
			if attempt < maxRetries {
				time.Sleep(time.Duration(attempt) * time.Second) // Exponential backoff
			}
		}
		
		// All retries failed - log critical error
		log.Printf("[CRITICAL] Failed to save result after %d attempts for player %s (ID: %d, Auction: %d)", 
			maxRetries, result.PlayerName, result.PlayerID, result.AuctionID)
	}()
}

// SaveAllAuctionResults saves all sold players to DB synchronously when auction ends
// This ensures data persists even if server restarts
func SaveAllAuctionResults(la *LiveAuction) {
	if config.DB == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	collection := config.GetCollection("auction_results")
	
	// Use upsert to avoid duplicates - update if exists, insert if not
	var savedCount int
	var errorCount int
	
	for _, player := range la.Players {
		if player.Status == "sold" && player.TeamID > 0 {
			result := AuctionResult{
				AuctionID:  la.ID,
				PlayerID:   player.ID,
				PlayerName: player.Name,
				TeamID:     player.TeamID,
				Price:      player.SoldPrice,
				Status:     player.Status,
			}
			
			// Use upsert: update if exists (based on auctionId + playerId), insert if not
			filter := bson.M{
				"auctionId": la.ID,
				"playerId":  player.ID,
			}
			update := bson.M{"$set": result}
			opts := options.Update().SetUpsert(true)
			
			_, err := collection.UpdateOne(ctx, filter, update, opts)
			if err != nil {
				log.Printf("[ERROR] Failed to save result for player %s: %v", player.Name, err)
				errorCount++
			} else {
				savedCount++
			}
		}
	}
	
	// Silent completion - results saved
}

func formatPrice(price float64) string {
	return fmt.Sprintf("%.2f", price)
}
