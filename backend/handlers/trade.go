package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"cricket-auction/config"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
)

type Trade struct {
	ID           int64     `json:"id,string" bson:"_id"`
	AuctionID    int64     `json:"auctionId,string" bson:"auctionId"`
	Team1ID      int64     `json:"team1Id,string" bson:"team1Id"`      // Initiating team
	Team2ID      int64     `json:"team2Id,string" bson:"team2Id"`      // Receiving team
	Team1Players []string  `json:"team1Players" bson:"team1Players"`   // Players going from Team1 to Team2 (as strings)
	Team2Players []string  `json:"team2Players" bson:"team2Players"`   // Players going from Team2 to Team1 (as strings)
	Status       string    `json:"status" bson:"status"`               // "pending", "accepted", "rejected", "cancelled"
	Message      string    `json:"message,omitempty" bson:"message,omitempty"` // Optional message from initiator
	CreatedAt    time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt" bson:"updatedAt"`
}

type TradeWindow struct {
	ID        int64     `json:"id,string" bson:"_id"`
	AuctionID int64     `json:"auctionId,string" bson:"auctionId"`
	IsActive  bool      `json:"isActive" bson:"isActive"`
	StartedAt time.Time `json:"startedAt" bson:"startedAt"`
	EndsAt    time.Time `json:"endsAt,omitempty" bson:"endsAt,omitempty"`
	Duration  int       `json:"duration" bson:"duration"` // Duration in hours
}

// Trade storage strategy:
// - Trades are stored in BOTH memory (for fast access) AND MongoDB (for persistence)
// - All trade operations save to DB asynchronously using goroutines
// - On server restart, LoadTradesFromDB() loads all trades from DB back into memory
// - This hybrid approach provides both speed and data persistence
var trades []Trade
var tradeWindows []TradeWindow

// LoadTradesFromDB loads all trades from database into memory
func LoadTradesFromDB() {
	if config.DB == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Load trades
	cursor, err := config.GetCollection("trades").Find(ctx, bson.M{})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var loadedTrades []Trade
	if err := cursor.All(ctx, &loadedTrades); err != nil {
		return
	}

	trades = loadedTrades

	// Load trade windows
	cursor2, err := config.GetCollection("trade_windows").Find(ctx, bson.M{})
	if err != nil {
		return
	}
	defer cursor2.Close(ctx)

	var loadedWindows []TradeWindow
	if err := cursor2.All(ctx, &loadedWindows); err != nil {
		return
	}

	tradeWindows = loadedWindows
}

// CreateTradeRequest creates a new trade request (pending status)
func CreateTradeRequest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AuctionID    string   `json:"auctionId"`    // Accept as string for int64 compatibility
		Team1ID      string   `json:"team1Id"`      // Accept as string for int64 compatibility
		Team2ID      string   `json:"team2Id"`      // Accept as string for int64 compatibility
		Team1Players []string `json:"team1Players"`
		Team2Players []string `json:"team2Players"`
		Message      string   `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Parse int64 IDs from strings for finding auction
	auctionID, err := strconv.ParseInt(req.AuctionID, 10, 64)
	if err != nil {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	
	// Keep team and player IDs as strings for comparison
	team1ID := req.Team1ID
	team2ID := req.Team2ID

	// Validate
	if team1ID == team2ID {
		http.Error(w, "Cannot trade with the same team", http.StatusBadRequest)
		return
	}

	if len(req.Team1Players) == 0 || len(req.Team2Players) == 0 {
		http.Error(w, "Both teams must trade at least one player", http.StatusBadRequest)
		return
	}

	// Find auction
	var auction *Auction
	for i := range auctions {
		if auctions[i].ID == auctionID {
			auction = &auctions[i]
			break
		}
	}

	if auction == nil {
		http.Error(w, "Auction not found", http.StatusNotFound)
		return
	}

	// Convert string IDs to int64 only for storage
	team1IDInt, _ := strconv.ParseInt(team1ID, 10, 64)
	team2IDInt, _ := strconv.ParseInt(team2ID, 10, 64)

	for _, playerIDStr := range req.Team1Players {
		found := false
		for _, p := range auction.Players {
			playerIDMatch := fmt.Sprintf("%d", p.ID) == playerIDStr
			teamIDMatch := fmt.Sprintf("%d", p.TeamID) == team1ID
			statusMatch := p.Status == "sold"
			
			if playerIDMatch && teamIDMatch && statusMatch {
				found = true
				break
			}
		}
		if !found {
			http.Error(w, "Invalid player in Team 1 selection", http.StatusBadRequest)
			return
		}
	}

	for _, playerIDStr := range req.Team2Players {
		found := false
		for _, p := range auction.Players {
			playerIDMatch := fmt.Sprintf("%d", p.ID) == playerIDStr
			teamIDMatch := fmt.Sprintf("%d", p.TeamID) == team2ID
			statusMatch := p.Status == "sold"
			
			if playerIDMatch && teamIDMatch && statusMatch {
				found = true
				break
			}
		}
		if !found {
			http.Error(w, "Invalid player in Team 2 selection", http.StatusBadRequest)
			return
		}
	}

	// Check overseas player limits BEFORE creating request
	if auction.OverseasLimit > 0 {
		// Calculate overseas count for Team1 after trade
		team1OverseasCount := 0
		for _, p := range auction.Players {
			if fmt.Sprintf("%d", p.TeamID) == team1ID && p.Status == "sold" {
				isBeingTradedAway := false
				for _, tradedIDStr := range req.Team1Players {
					if fmt.Sprintf("%d", p.ID) == tradedIDStr {
						isBeingTradedAway = true
						break
					}
				}
				if !isBeingTradedAway && p.IsOverseas {
					team1OverseasCount++
				}
			}
		}
		for _, playerIDStr := range req.Team2Players {
			for _, p := range auction.Players {
				if fmt.Sprintf("%d", p.ID) == playerIDStr && p.IsOverseas {
					team1OverseasCount++
					break
				}
			}
		}

		// Calculate overseas count for Team2 after trade
		team2OverseasCount := 0
		for _, p := range auction.Players {
			if fmt.Sprintf("%d", p.TeamID) == team2ID && p.Status == "sold" {
				isBeingTradedAway := false
				for _, tradedIDStr := range req.Team2Players {
					if fmt.Sprintf("%d", p.ID) == tradedIDStr {
						isBeingTradedAway = true
						break
					}
				}
				if !isBeingTradedAway && p.IsOverseas {
					team2OverseasCount++
				}
			}
		}
		for _, playerIDStr := range req.Team1Players {
			for _, p := range auction.Players {
				if fmt.Sprintf("%d", p.ID) == playerIDStr && p.IsOverseas {
					team2OverseasCount++
					break
				}
			}
		}

		// Validate limits
		if team1OverseasCount > auction.OverseasLimit {
			team1Name := ""
			for _, t := range auction.Teams {
				if fmt.Sprintf("%d", t.ID) == team1ID {
					team1Name = t.Name
					break
				}
			}
			http.Error(w, "Trade would exceed overseas player limit for "+team1Name+" (max: "+strconv.Itoa(auction.OverseasLimit)+")", http.StatusBadRequest)
			return
		}

		if team2OverseasCount > auction.OverseasLimit {
			team2Name := ""
			for _, t := range auction.Teams {
				if fmt.Sprintf("%d", t.ID) == team2ID {
					team2Name = t.Name
					break
				}
			}
			http.Error(w, "Trade would exceed overseas player limit for "+team2Name+" (max: "+strconv.Itoa(auction.OverseasLimit)+")", http.StatusBadRequest)
			return
		}
	}

	// Create trade request with pending status (store as strings)
	trade := Trade{
		ID:           newID(),
		AuctionID:    auctionID,
		Team1ID:      team1IDInt,
		Team2ID:      team2IDInt,
		Team1Players: req.Team1Players, // Store as strings
		Team2Players: req.Team2Players, // Store as strings
		Status:       "pending",
		Message:      req.Message,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	trades = append(trades, trade)

	// Save to DB asynchronously
	if config.DB != nil {
		go func(t Trade) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("trades").InsertOne(ctx, t)
		}(trade)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trade)
}

// AcceptTradeRequest accepts a pending trade request and executes it
func AcceptTradeRequest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tradeID := parseTradeID(vars["tradeId"])

	// Find trade
	var trade *Trade
	var tradeIndex int
	for i := range trades {
		if trades[i].ID == tradeID {
			trade = &trades[i]
			tradeIndex = i
			break
		}
	}

	if trade == nil {
		http.Error(w, "Trade not found", http.StatusNotFound)
		return
	}

	if trade.Status != "pending" {
		http.Error(w, "Trade is not pending", http.StatusBadRequest)
		return
	}

	// Find auction
	var auction *Auction
	for i := range auctions {
		if auctions[i].ID == trade.AuctionID {
			auction = &auctions[i]
			break
		}
	}

	if auction == nil {
		http.Error(w, "Auction not found", http.StatusNotFound)
		return
	}

	// Execute trade - swap team IDs (use string comparison)
	for i := range auction.Players {
		for _, playerIDStr := range trade.Team1Players {
			if fmt.Sprintf("%d", auction.Players[i].ID) == playerIDStr {
				auction.Players[i].TeamID = trade.Team2ID
			}
		}
		for _, playerIDStr := range trade.Team2Players {
			if fmt.Sprintf("%d", auction.Players[i].ID) == playerIDStr {
				auction.Players[i].TeamID = trade.Team1ID
			}
		}
	}

	// Update trade status
	trades[tradeIndex].Status = "accepted"
	trades[tradeIndex].UpdatedAt = time.Now()

	// Save to DB synchronously to ensure data consistency
	if config.DB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		// Update trade
		config.GetCollection("trades").ReplaceOne(ctx, bson.M{"_id": trades[tradeIndex].ID}, trades[tradeIndex])
		
		// Update auction_results for swapped players
		for _, playerIDStr := range trade.Team1Players {
			playerID, _ := strconv.ParseInt(playerIDStr, 10, 64)
			config.GetCollection("auction_results").UpdateOne(
				ctx,
				bson.M{"auctionId": auction.ID, "playerId": playerID},
				bson.M{"$set": bson.M{"teamId": trade.Team2ID}},
			)
		}
		for _, playerIDStr := range trade.Team2Players {
			playerID, _ := strconv.ParseInt(playerIDStr, 10, 64)
			config.GetCollection("auction_results").UpdateOne(
				ctx,
				bson.M{"auctionId": auction.ID, "playerId": playerID},
				bson.M{"$set": bson.M{"teamId": trade.Team1ID}},
			)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trades[tradeIndex])
}

// RejectTradeRequest rejects a pending trade request
func RejectTradeRequest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tradeID := parseTradeID(vars["tradeId"])

	// Find trade
	var trade *Trade
	var tradeIndex int
	for i := range trades {
		if trades[i].ID == tradeID {
			trade = &trades[i]
			tradeIndex = i
			break
		}
	}

	if trade == nil {
		http.Error(w, "Trade not found", http.StatusNotFound)
		return
	}

	if trade.Status != "pending" {
		http.Error(w, "Trade is not pending", http.StatusBadRequest)
		return
	}

	// Update trade status
	trades[tradeIndex].Status = "rejected"
	trades[tradeIndex].UpdatedAt = time.Now()

	// Save to DB asynchronously
	if config.DB != nil {
		go func(t Trade) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("trades").ReplaceOne(ctx, bson.M{"_id": t.ID}, t)
		}(trades[tradeIndex])
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trades[tradeIndex])
}

// CancelTradeRequest cancels a pending trade request (by initiator only)
func CancelTradeRequest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tradeID := parseTradeID(vars["tradeId"])

	// Find trade
	var trade *Trade
	var tradeIndex int
	for i := range trades {
		if trades[i].ID == tradeID {
			trade = &trades[i]
			tradeIndex = i
			break
		}
	}

	if trade == nil {
		http.Error(w, "Trade not found", http.StatusNotFound)
		return
	}

	if trade.Status != "pending" {
		http.Error(w, "Trade is not pending", http.StatusBadRequest)
		return
	}

	// Update trade status
	trades[tradeIndex].Status = "cancelled"
	trades[tradeIndex].UpdatedAt = time.Now()

	// Save to DB asynchronously
	if config.DB != nil {
		go func(t Trade) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("trades").ReplaceOne(ctx, bson.M{"_id": t.ID}, t)
		}(trades[tradeIndex])
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trades[tradeIndex])
}

// GetAuctionTrades returns all trades for an auction (with optional status filter)
func GetAuctionTrades(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auctionID := vars["id"]
	status := r.URL.Query().Get("status") // Optional: "pending", "accepted", "rejected", "cancelled"

	var auctionTrades []Trade
	for _, trade := range trades {
		if trade.AuctionID == parseTradeID(auctionID) {
			if status == "" || trade.Status == status {
				auctionTrades = append(auctionTrades, trade)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(auctionTrades)
}

// GetTradeWindow returns the trade window status for an auction
func GetTradeWindow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	auctionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid auction ID format", http.StatusBadRequest)
		return
	}

	// Load auction from DB
	if config.DB == nil {
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var auction Auction
	err = config.GetCollection("auctions").FindOne(ctx, bson.M{"_id": auctionID}).Decode(&auction)
	if err != nil {
		http.Error(w, "Auction not found", http.StatusNotFound)
		return
	}

	// Load trade window from DB
	var window TradeWindow
	err = config.GetCollection("trade_windows").FindOne(ctx, bson.M{"auctionId": auctionID}).Decode(&window)
	hasWindow := err == nil

	// Return trade window information
	response := map[string]interface{}{
		"auctionId":           auction.ID,
		"tradeWindowDuration": auction.TradeWindowDuration,
		"status":              auction.Status,
		"isLive":              auction.IsLive,
		"hasTradeWindow":      hasWindow,
		"isActive":            hasWindow && window.IsActive,
		"canTrade":            hasWindow && window.IsActive,
	}

	if hasWindow {
		response["window"] = window
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// StartTradeWindow starts the trade window for an auction (admin only)
func StartTradeWindow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	auctionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid auction ID format", http.StatusBadRequest)
		return
	}

	// Parse request body for duration
	var req struct {
		Duration int `json:"duration"` // Duration in hours
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// If no body provided, use default from auction
		req.Duration = 0
	}

	// Load auction from DB (not memory)
	if config.DB == nil {
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var auction Auction
	err = config.GetCollection("auctions").FindOne(ctx, bson.M{"_id": auctionID}).Decode(&auction)
	if err != nil {
		http.Error(w, "Auction not found", http.StatusNotFound)
		return
	}

	if auction.Status != "completed" {
		http.Error(w, fmt.Sprintf("Auction must be completed to start trade window (current status: %s)", auction.Status), http.StatusBadRequest)
		return
	}

	// Use provided duration or fall back to auction's default
	duration := req.Duration
	if duration <= 0 {
		duration = auction.TradeWindowDuration
	}
	if duration <= 0 {
		duration = 24 // Default to 24 hours if not specified
	}

	// Check if trade window already exists in DB
	var existingWindow TradeWindow
	err = config.GetCollection("trade_windows").FindOne(ctx, bson.M{"auctionId": auctionID}).Decode(&existingWindow)
	if err == nil {
		// Window exists
		if existingWindow.IsActive {
			http.Error(w, "Trade window is already active", http.StatusBadRequest)
			return
		}
		// Reactivate existing window with new duration
		existingWindow.IsActive = true
		existingWindow.StartedAt = time.Now()
		existingWindow.Duration = duration
		if duration > 0 {
			existingWindow.EndsAt = time.Now().Add(time.Duration(duration) * time.Hour)
		}

		// Update in DB
		_, err = config.GetCollection("trade_windows").ReplaceOne(ctx, bson.M{"_id": existingWindow.ID}, existingWindow)
		if err != nil {
			http.Error(w, "Failed to update trade window", http.StatusInternalServerError)
			return
		}

		// Update in-memory cache
		for i := range tradeWindows {
			if tradeWindows[i].ID == existingWindow.ID {
				tradeWindows[i] = existingWindow
				break
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(existingWindow)
		return
	}

	// Create new trade window
	window := TradeWindow{
		ID:        newID(),
		AuctionID: auctionID,
		IsActive:  true,
		StartedAt: time.Now(),
		Duration:  duration,
	}

	if duration > 0 {
		window.EndsAt = time.Now().Add(time.Duration(duration) * time.Hour)
	}

	// Save to DB
	_, err = config.GetCollection("trade_windows").InsertOne(ctx, window)
	if err != nil {
		http.Error(w, "Failed to create trade window", http.StatusInternalServerError)
		return
	}

	// Add to in-memory cache
	tradeWindows = append(tradeWindows, window)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(window)
}

// EndTradeWindow ends the trade window for an auction (admin only)
func EndTradeWindow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	auctionID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid auction ID format", http.StatusBadRequest)
		return
	}

	// Load trade window from DB
	if config.DB == nil {
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var window TradeWindow
	err = config.GetCollection("trade_windows").FindOne(ctx, bson.M{"auctionId": auctionID}).Decode(&window)
	if err != nil {
		http.Error(w, "Trade window not found", http.StatusNotFound)
		return
	}

	if !window.IsActive {
		http.Error(w, "Trade window is not active", http.StatusBadRequest)
		return
	}

	// Deactivate window
	window.IsActive = false
	window.EndsAt = time.Now()

	// Update in DB
	_, err = config.GetCollection("trade_windows").ReplaceOne(ctx, bson.M{"_id": window.ID}, window)
	if err != nil {
		http.Error(w, "Failed to update trade window", http.StatusInternalServerError)
		return
	}

	// Update in-memory cache
	for i := range tradeWindows {
		if tradeWindows[i].ID == window.ID {
			tradeWindows[i] = window
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(window)
}

// Helper function
func parseTradeID(idStr string) int64 {
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		// Try JSON unmarshal as fallback
		var jsonID int64
		if json.Unmarshal([]byte(idStr), &jsonID) == nil {
			return jsonID
		}
		return 0
	}
	return id
}

// CreateTradeWindowForAuction automatically creates a trade window when auction completes
func CreateTradeWindowForAuction(auctionID int64, duration int) {
	// Check if trade window already exists
	for i := range tradeWindows {
		if tradeWindows[i].AuctionID == auctionID {
			return
		}
	}

	// Create new trade window (inactive by default, admin can activate)
	window := TradeWindow{
		ID:        newID(),
		AuctionID: auctionID,
		IsActive:  false,
		Duration:  duration,
	}

	tradeWindows = append(tradeWindows, window)

	// Save to DB
	if config.DB != nil {
		go func(tw TradeWindow) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("trade_windows").InsertOne(ctx, tw)
		}(window)
	}
}
