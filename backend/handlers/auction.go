package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"cricket-auction/config"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"sync"
	"go.mongodb.org/mongo-driver/mongo"
)

type Team struct {
	ID        int64     `json:"id,string" bson:"_id"`
	Name      string    `json:"name" bson:"name"`
	ShortName string    `json:"shortName" bson:"shortName"`
	Code      string    `json:"code" bson:"code"`
	Logo      string    `json:"logo" bson:"logo"`
	Color     string    `json:"color" bson:"color"`
	Budget    float64   `json:"budget" bson:"budget"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
}

type Player struct {
	ID         int64     `json:"id,string" bson:"_id"`
	Name       string    `json:"name" bson:"name"`
	Role       string    `json:"role" bson:"role"`
	BasePrice  float64   `json:"basePrice" bson:"basePrice"`
	Image      string    `json:"image" bson:"image"`
	IsOverseas bool      `json:"isOverseas" bson:"isOverseas"`
	Order      int       `json:"order" bson:"order"`
	Status     string    `json:"status" bson:"status"`
	TeamID     int64     `json:"teamId,string,omitempty" bson:"teamId,omitempty"`
	SoldPrice  float64   `json:"soldPrice,omitempty" bson:"soldPrice,omitempty"`
	CreatedAt  time.Time `json:"createdAt" bson:"createdAt"`
}

type Auction struct {
	ID                    int64              `json:"id,string" bson:"_id"`
	Name                  string             `json:"name" bson:"name"`
	Description           string             `json:"description" bson:"description"`
	Type                  string             `json:"type" bson:"type"`
	SelectedTeams         []int64            `json:"selectedTeams" bson:"selectedTeams"`       // IDs only
	SelectedPlayers       []int64            `json:"selectedPlayers" bson:"selectedPlayers"`   // IDs only
	RoleOrder             []string           `json:"roleOrder" bson:"roleOrder"`
	PlayerOrder           map[string][]int64 `json:"playerOrder" bson:"playerOrder"`
	Budget                int                `json:"budget" bson:"budget"`
	TimerDuration         int                `json:"timerDuration" bson:"timerDuration"`
	PlayersLimit          int                `json:"playersLimit" bson:"playersLimit"`
	OverseasLimit         int                `json:"overseasLimit" bson:"overseasLimit"`
	TradeWindowDuration   int                `json:"tradeWindowDuration" bson:"tradeWindowDuration"`
	Status                string             `json:"status" bson:"status"`
	IsLive                bool               `json:"isLive" bson:"isLive"`
	CreatedAt             time.Time          `json:"createdAt" bson:"createdAt"`
	
	// Transient fields (not stored in DB, populated on read)
	Teams                 []Team             `json:"teams,omitempty" bson:"-"`
	Players               []Player           `json:"players,omitempty" bson:"-"`
}

// Snapshot structures for deleted teams/players
type TeamSnapshot struct {
	AuctionID int64     `json:"auctionId" bson:"auctionId"`
	TeamID    int64     `json:"teamId" bson:"teamId"`
	Name      string    `json:"name" bson:"name"`
	ShortName string    `json:"shortName" bson:"shortName"`
	Logo      string    `json:"logo" bson:"logo"`
	Color     string    `json:"color" bson:"color"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
}

type PlayerSnapshot struct {
	AuctionID  int64     `json:"auctionId" bson:"auctionId"`
	PlayerID   int64     `json:"playerId" bson:"playerId"`
	Name       string    `json:"name" bson:"name"`
	Role       string    `json:"role" bson:"role"`
	Image      string    `json:"image" bson:"image"`
	IsOverseas bool      `json:"isOverseas" bson:"isOverseas"`
	CreatedAt  time.Time `json:"createdAt" bson:"createdAt"`
}

var auctions []Auction
var teamSnapshots []TeamSnapshot
var playerSnapshots []PlayerSnapshot

// GetAuctionsStore returns the in-memory auctions slice
func GetAuctionsStore() []Auction {
	return auctions
}

// UpdateAuctionStatus updates the status of an auction in memory
func UpdateAuctionStatus(auctionID int64, status string, isLive bool) {
	for i := range auctions {
		if auctions[i].ID == auctionID {
			auctions[i].Status = status
			auctions[i].IsLive = isLive
			log.Printf("[MEMORY] Updated auction %d: status=%s, isLive=%v", auctionID, status, isLive)
			
			// Persist to database
			if DB != nil {
				go func(id int64, s string, live bool) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					
					_, err := GetCollection("auctions").UpdateOne(
						ctx,
						bson.M{"_id": id},
						bson.M{"$set": bson.M{"status": s, "isLive": live}},
					)
					if err != nil {
						log.Printf("[ERROR] Failed to persist auction status update: %v", err)
					}
				}(auctionID, status, isLive)
			}
			break
		}
	}
}

// Presence tracking (in-memory)
var (
	auctionPresence          = make(map[int64]map[int64]time.Time) // auctionID -> teamID -> lastSeen
	retentionPresence        = make(map[int64]map[int64]time.Time) // retentionAuctionID -> teamID -> lastSeen
	auctionPresenceMux       sync.RWMutex
	retentionPresenceMux     sync.RWMutex
)

// UpdateAuctionPresence registers a team's heartbeat for an auction
func UpdateAuctionPresence(auctionID, teamID int64) {
	auctionPresenceMux.Lock()
	defer auctionPresenceMux.Unlock()
	if _, ok := auctionPresence[auctionID]; !ok {
		auctionPresence[auctionID] = make(map[int64]time.Time)
	}
	auctionPresence[auctionID][teamID] = time.Now()
}

// GetOnlineTeams returns team IDs seen within the window
func GetOnlineTeams(auctionID int64, window time.Duration) []int64 {
	auctionPresenceMux.RLock()
	defer auctionPresenceMux.RUnlock()
	lastSeen := auctionPresence[auctionID]
	if lastSeen == nil {
		return []int64{}
	}
	now := time.Now()
	var online []int64
	for teamID, ts := range lastSeen {
		if now.Sub(ts) <= window {
			online = append(online, teamID)
		}
	}
	return online
}

// UpdateRetentionPresence registers a team's heartbeat for a retention auction
func UpdateRetentionPresence(retentionID, teamID int64) {
	retentionPresenceMux.Lock()
	defer retentionPresenceMux.Unlock()
	if _, ok := retentionPresence[retentionID]; !ok {
		retentionPresence[retentionID] = make(map[int64]time.Time)
	}
	retentionPresence[retentionID][teamID] = time.Now()
}

// GetOnlineTeamsRetention returns team IDs seen within the window for retention auction
func GetOnlineTeamsRetention(retentionID int64, window time.Duration) []int64 {
	retentionPresenceMux.RLock()
	defer retentionPresenceMux.RUnlock()
	lastSeen := retentionPresence[retentionID]
	if lastSeen == nil {
		return []int64{}
	}
	now := time.Now()
	var online []int64
	for teamID, ts := range lastSeen {
		if now.Sub(ts) <= window {
			online = append(online, teamID)
		}
	}
	return online
}

// LoadAuctionsFromDB loads auctions from MongoDB into memory (call after DB connect)
func LoadAuctionsFromDB() {
	if config.DB == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("auctions")
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		log.Printf("[ERROR] Load auctions from DB failed: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var loaded []Auction
	if err := cursor.All(ctx, &loaded); err != nil {
		log.Printf("[ERROR] Decode auctions failed: %v", err)
		return
	}
	
	// Populate teams and players for each auction
	for i := range loaded {
		loaded[i].Teams = getTeamsForAuction(loaded[i])
		loaded[i].Players = getPlayersForAuction(loaded[i])
	}
	
	auctions = loaded
	
	// Reset any stuck live auctions since live processes are lost on restart
	// Give a grace period for clients to reconnect before resetting
	for _, auction := range auctions {
		if auction.IsLive && auction.Status == "live" {
			log.Printf("[GRACE] Live auction found on startup: %s (ID: %d) - giving 30 minutes for reconnection", auction.Name, auction.ID)
			
			// Start a goroutine to check for reconnections after grace period
			go func(auctionID int64, auctionName string) {
				time.Sleep(30 * time.Minute) // 30 minute grace period
				
				// Check if auction has active connections after grace period
				liveAuction, exists := GetLiveAuction(auctionID)
				if !exists {
					log.Printf("[RESET] No live auction process found after 30min grace period: %s (ID: %d)", auctionName, auctionID)
					UpdateAuctionStatus(auctionID, "draft", false)
					return
				}
				
				liveAuction.ClientsMux.Lock()
				clientCount := len(liveAuction.Clients)
				liveAuction.ClientsMux.Unlock()
				
				if clientCount == 0 {
					log.Printf("[RESET] No active connections after 30min grace period: %s (ID: %d)", auctionName, auctionID)
					UpdateAuctionStatus(auctionID, "draft", false)
				} else {
					log.Printf("[PRESERVE] Active connections found, keeping auction live: %s (ID: %d, Clients: %d)", auctionName, auctionID, clientCount)
				}
			}(auction.ID, auction.Name)
		}
	}
}

// HasActiveWebSocketConnections checks if an auction has active WebSocket connections
func HasActiveWebSocketConnections(auctionID int64) bool {
	liveAuction, exists := GetLiveAuction(auctionID)
	if !exists {
		return false
	}
	
	liveAuction.ClientsMux.Lock()
	defer liveAuction.ClientsMux.Unlock()
	
	return len(liveAuction.Clients) > 0
}

// CleanupOldDraftAuctions removes draft auctions older than 30 days (automatic cleanup)
func CleanupOldDraftAuctions() {
	if config.DB == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("auctions")

	// Delete draft auctions older than 30 days
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	filter := bson.M{
		"status": "draft",
		"createdAt": bson.M{"$lt": thirtyDaysAgo},
	}

	result, err := collection.DeleteMany(ctx, filter)
	if err != nil {
		return
	}

	if result.DeletedCount > 0 {
		log.Printf("[INFO] Cleaned up %d old draft auctions (older than 30 days)", result.DeletedCount)
		
		// Reload auctions from DB to update memory
		LoadAuctionsFromDB()
	}
}

func CreateAuction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name                string               `json:"name"`
		Description         string               `json:"description"`
		Type                string               `json:"type"`
		Budget              int                  `json:"budget"`
		SquadSize           int                  `json:"squadSize"`
		OverseasLimit       int                  `json:"overseasLimit"`
		TimerDuration       int                  `json:"timerDuration"`
		TradeWindowDuration int                  `json:"tradeWindowDuration"`
		SelectedTeams       []string             `json:"selectedTeams"`       // Accept as strings
		SelectedPlayers     []string             `json:"selectedPlayers"`     // Accept as strings
		RoleOrder           []string             `json:"roleOrder"`
		PlayerOrder         map[string][]string  `json:"playerOrder"`         // Accept as strings
	}
	
	w.Header().Set("Content-Type", "application/json")
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid JSON: " + err.Error()})
		return
	}

	// Convert string IDs to int64
	selectedTeams := make([]int64, len(req.SelectedTeams))
	for i, idStr := range req.SelectedTeams {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid team ID: " + idStr})
			return
		}
		selectedTeams[i] = id
	}
	
	selectedPlayers := make([]int64, len(req.SelectedPlayers))
	for i, idStr := range req.SelectedPlayers {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid player ID: " + idStr})
			return
		}
		selectedPlayers[i] = id
	}
	
	playerOrder := make(map[string][]int64)
	for role, idStrs := range req.PlayerOrder {
		ids := make([]int64, len(idStrs))
		for i, idStr := range idStrs {
			id, err := strconv.ParseInt(idStr, 10, 64)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{"error": "Invalid player ID in playerOrder: " + idStr})
				return
			}
			ids[i] = id
		}
		playerOrder[role] = ids
	}

	// Use provided values or defaults
	timerDuration := req.TimerDuration
	if timerDuration == 0 {
		timerDuration = 10 // Default 10 seconds
	}
	tradeWindowDuration := req.TradeWindowDuration
	if tradeWindowDuration == 0 {
		tradeWindowDuration = 24 // Default 24 hours
	}

	auction := Auction{
		ID:                  newID(),
		Name:                req.Name,
		Description:         req.Description,
		Type:                req.Type,
		Budget:              req.Budget,
		PlayersLimit:        req.SquadSize,
		OverseasLimit:       req.OverseasLimit,
		SelectedTeams:       selectedTeams,   // Use converted IDs
		SelectedPlayers:     selectedPlayers, // Use converted IDs
		RoleOrder:           req.RoleOrder,
		PlayerOrder:         playerOrder,     // Use converted IDs
		TimerDuration:       timerDuration,
		TradeWindowDuration: tradeWindowDuration,
		Status:              "upcoming",
		IsLive:              false,
		CreatedAt:           time.Now(),
	}

	// Populate teams/players for response (transient)
	auction.Teams = getTeamsByIDs(selectedTeams)
	auction.Players = getPlayersByIDs(selectedPlayers)

	// Save to DB (synchronous so errors surface)
	if config.DB == nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Database not connected"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := config.GetCollection("auctions").InsertOne(ctx, auction); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to create auction: " + err.Error()})
		return
	}

	auctions = append(auctions, auction)

	// Log audit event
	ipAddress := r.RemoteAddr
	LogAuditEvent("admin", "CREATE_AUCTION", strconv.FormatInt(auction.ID, 10), auction.Name, "Created auction: "+auction.Name, ipAddress)

	json.NewEncoder(w).Encode(auction)
}

func GetAuctions(w http.ResponseWriter, r *http.Request) {
	if len(auctions) == 0 && config.DB != nil {
		LoadAuctionsFromDB()
	}
	// Populate teams/players for each auction
	enrichedAuctions := make([]Auction, len(auctions))
	for i, auction := range auctions {
		enrichedAuctions[i] = auction
		enrichedAuctions[i].Teams = getTeamsForAuction(auction)
		enrichedAuctions[i].Players = getPlayersForAuction(auction)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(enrichedAuctions)
}

func getAuctionID(r *http.Request) (int64, bool) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		return 0, false
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	return id, err == nil
}

// Helper function to get auction by ID (returns auction object, not HTTP response)
func getAuctionByID(id int64) *Auction {
	for i := range auctions {
		if auctions[i].ID == id {
			return &auctions[i]
		}
	}
	
	// Try loading from DB if not in memory
	if config.DB != nil {
		LoadAuctionsFromDB()
		for i := range auctions {
			if auctions[i].ID == id {
				return &auctions[i]
			}
		}
		
		// Fallback: fetch directly from DB
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var auction Auction
		if err := config.GetCollection("auctions").FindOne(ctx, bson.M{"_id": id}).Decode(&auction); err == nil {
			auctions = append(auctions, auction)
			return &auction
		}
	}
	
	return nil
}

func GetAuctionByID(w http.ResponseWriter, r *http.Request) {
	id, ok := getAuctionID(r)
	if !ok {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	for i := range auctions {
		if auctions[i].ID == id {
			auction := auctions[i]
			// Populate teams/players
			auction.Teams = getTeamsForAuction(auction)
			auction.Players = getPlayersForAuction(auction)
			
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(auction)
			return
		}
	}
	if config.DB != nil {
		LoadAuctionsFromDB()
		for i := range auctions {
			if auctions[i].ID == id {
				auction := auctions[i]
				auction.Teams = getTeamsForAuction(auction)
				auction.Players = getPlayersForAuction(auction)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(auction)
				return
			}
		}
	}
	// Fallback: fetch from DB if not in memory
	if config.DB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var auction Auction
		if err := config.GetCollection("auctions").FindOne(ctx, bson.M{"_id": id}).Decode(&auction); err == nil {
			auction.Teams = getTeamsForAuction(auction)
			auction.Players = getPlayersForAuction(auction)
			auctions = append(auctions, auction)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(auction)
			return
		}
	}
	http.Error(w, "Auction not found", http.StatusNotFound)
}

func GetAuctionStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := getAuctionID(r)
	if !ok {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	for i := range auctions {
		if auctions[i].ID == id {
			status := map[string]interface{}{
				"isLive": auctions[i].IsLive,
				"status": auctions[i].Status,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(status)
			return
		}
	}
	if config.DB != nil {
		LoadAuctionsFromDB()
		for i := range auctions {
			if auctions[i].ID == id {
				status := map[string]interface{}{
					"isLive": auctions[i].IsLive,
					"status": auctions[i].Status,
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(status)
				return
			}
		}
	}
	// Fallback: read from DB if not in memory
	if config.DB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var auction Auction
		if err := config.GetCollection("auctions").FindOne(ctx, bson.M{"_id": id}).Decode(&auction); err == nil {
			status := map[string]interface{}{
				"isLive": auction.IsLive,
				"status": auction.Status,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(status)
			return
		}
	}
	http.Error(w, "Auction not found", http.StatusNotFound)
}

// UpdateAuctionPresenceHandler records team presence for an auction
func UpdateAuctionPresenceHandler(w http.ResponseWriter, r *http.Request) {
	id, ok := getAuctionID(r)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid auction ID"})
		return
	}
	
	var req struct {
		TeamID string `json:"teamId"` // Accept as string
	}
	
	w.Header().Set("Content-Type", "application/json")
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TeamID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "teamId required"})
		return
	}
	
	// Convert string to int64
	teamID, err := strconv.ParseInt(req.TeamID, 10, 64)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid team ID format"})
		return
	}
	
	// Validate that the team exists and is part of this auction
	auction := getAuctionByID(id)
	if auction == nil {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Auction not found"})
		return
	}

	// Check if team is part of this auction
	teamExists := false
	for _, selectedTeamID := range auction.SelectedTeams {
		if selectedTeamID == teamID {
			teamExists = true
			break
		}
	}
	
	if !teamExists {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "Team not part of this auction"})
		return
	}
	
	UpdateAuctionPresence(id, teamID)
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

// GetAuctionPresenceHandler returns online team IDs for an auction
func GetAuctionPresenceHandler(w http.ResponseWriter, r *http.Request) {
	id, ok := getAuctionID(r)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid auction ID"})
		return
	}
	
	online := GetOnlineTeams(id, 20*time.Second)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]int64{"onlineTeamIds": online})
}

func StartAuction(w http.ResponseWriter, r *http.Request) {
	log.Printf("[StartAuction] HTTP handler called")
	id, ok := getAuctionID(r)
	if !ok {
		log.Printf("[StartAuction] Invalid auction ID")
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	log.Printf("[StartAuction] Looking for auction ID: %d", id)
	for i := range auctions {
		if auctions[i].ID == id {
			log.Printf("[StartAuction] Found auction: %s (ID: %d)", auctions[i].Name, id)
			auctions[i].IsLive = true
			auctions[i].Status = "live"
			
			// Log audit event
			ipAddress := r.RemoteAddr
			LogAuditEvent("admin", "START_AUCTION", strconv.FormatInt(auctions[i].ID, 10), auctions[i].Name, "Started auction: "+auctions[i].Name, ipAddress)
			
			// Populate teams/players for live auction
			auction := auctions[i]
			auction.Teams = getTeamsForAuction(auction)
			auction.Players = getPlayersForAuction(auction)
			
			log.Printf("[StartAuction] Calling StartLiveAuction with %d teams, %d players", len(auction.Teams), len(auction.Players))
			StartLiveAuction(auction.ID, auction)
			if config.DB != nil {
				go func(a Auction) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					config.GetCollection("auctions").ReplaceOne(ctx, bson.M{"_id": a.ID}, a)
				}(auctions[i])
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]bool{"success": true})
			log.Printf("[StartAuction] Response sent")
			return
		}
	}
	log.Printf("[StartAuction] Auction not found: %d", id)
	http.Error(w, "Auction not found", http.StatusNotFound)
}

// UpdateAuction updates an upcoming auction (not live/completed)
func UpdateAuction(w http.ResponseWriter, r *http.Request) {
	id, ok := getAuctionID(r)
	if !ok {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}
	var req struct {
		Name                string             `json:"name"`
		Description         string             `json:"description"`
		Type                string             `json:"type"`
		Budget              int                `json:"budget"`
		SquadSize           int                `json:"squadSize"`
		OverseasLimit       int                `json:"overseasLimit"`
		TimerDuration       int                `json:"timerDuration"`
		TradeWindowDuration int                `json:"tradeWindowDuration"`
		SelectedTeams       []int64            `json:"selectedTeams"`
		SelectedPlayers     []int64            `json:"selectedPlayers"`
		RoleOrder           []string           `json:"roleOrder"`
		PlayerOrder         map[string][]int64 `json:"playerOrder"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	allTeams := GetTeamsStore()
	allPlayers := GetPlayersStore()
	var selectedTeams []Team
	for _, teamID := range req.SelectedTeams {
		for _, t := range allTeams {
			if t.ID == teamID {
				selectedTeams = append(selectedTeams, t)
				break
			}
		}
	}
	var selectedPlayers []Player
	for _, playerID := range req.SelectedPlayers {
		for _, p := range allPlayers {
			if p.ID == playerID {
				selectedPlayers = append(selectedPlayers, p)
				break
			}
		}
	}
	for i := range auctions {
		if auctions[i].ID == id {
			if auctions[i].IsLive || auctions[i].Status == "completed" {
				http.Error(w, "Cannot update live or completed auction", http.StatusBadRequest)
				return
			}
			auctions[i].Name = req.Name
			auctions[i].Description = req.Description
			auctions[i].Type = req.Type
			auctions[i].Budget = req.Budget
			auctions[i].PlayersLimit = req.SquadSize
			auctions[i].OverseasLimit = req.OverseasLimit
			auctions[i].TimerDuration = req.TimerDuration
			auctions[i].TradeWindowDuration = req.TradeWindowDuration
			auctions[i].SelectedTeams = req.SelectedTeams
			auctions[i].SelectedPlayers = req.SelectedPlayers
			auctions[i].RoleOrder = req.RoleOrder
			auctions[i].PlayerOrder = req.PlayerOrder
			auctions[i].Teams = selectedTeams
			auctions[i].Players = selectedPlayers
			if config.DB != nil {
				go func(a Auction) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					config.GetCollection("auctions").ReplaceOne(ctx, bson.M{"_id": a.ID}, a)
				}(auctions[i])
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(auctions[i])
			return
		}
	}

	// Fallback: update in DB if not present in memory (e.g., after restart)
	if config.DB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		var existing Auction
		err := config.GetCollection("auctions").FindOne(ctx, bson.M{"_id": id}).Decode(&existing)
		if err == nil {
			if existing.IsLive || existing.Status == "completed" {
				http.Error(w, "Cannot update live or completed auction", http.StatusBadRequest)
				return
			}
			existing.Name = req.Name
			existing.Description = req.Description
			existing.Type = req.Type
			existing.Budget = req.Budget
			existing.PlayersLimit = req.SquadSize
			existing.OverseasLimit = req.OverseasLimit
			existing.TimerDuration = req.TimerDuration
			existing.TradeWindowDuration = req.TradeWindowDuration
			existing.SelectedTeams = req.SelectedTeams
			existing.SelectedPlayers = req.SelectedPlayers
			existing.RoleOrder = req.RoleOrder
			existing.PlayerOrder = req.PlayerOrder
			existing.Teams = selectedTeams
			existing.Players = selectedPlayers

			if _, err := config.GetCollection("auctions").ReplaceOne(ctx, bson.M{"_id": id}, existing); err == nil {
				// Update in-memory cache
				auctions = append(auctions, existing)
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(existing)
				return
			}
		}
		if err != nil && err != mongo.ErrNoDocuments {
			// Silent error
		}
	}
	http.Error(w, "Auction not found", http.StatusNotFound)
}

// DeleteAuction removes an auction and all its related data (only if not live)
func DeleteAuction(w http.ResponseWriter, r *http.Request) {
	id, ok := getAuctionID(r)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid auction ID"})
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// If DB available, treat it as source of truth
	if config.DB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var existing Auction
		err := config.GetCollection("auctions").FindOne(ctx, bson.M{"_id": id}).Decode(&existing)
		if err == nil {
			// If auction is live, stop it first
			if existing.IsLive {
				// Stop the live auction
				StopLiveAuction(id)
				log.Printf("Stopped live auction %d before deletion", id)
			}
			
			if _, err := config.GetCollection("auctions").DeleteOne(ctx, bson.M{"_id": id}); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": "Failed to delete auction from database"})
				return
			}
			
			// Remove from memory cache if present
			for i := range auctions {
				if auctions[i].ID == id {
					auctions = append(auctions[:i], auctions[i+1:]...)
					break
				}
			}
			
			// Log audit event
			ipAddress := r.RemoteAddr
			LogAuditEvent("admin", "DELETE_AUCTION", strconv.FormatInt(id, 10), existing.Name, "Deleted auction: "+existing.Name, ipAddress)
			
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if err != mongo.ErrNoDocuments {
			// Silent error
		}
	}

	for i := range auctions {
		if auctions[i].ID == id {
			// If auction is live, stop it first
			if auctions[i].IsLive {
				StopLiveAuction(id)
				log.Printf("Stopped live auction %d before deletion", id)
			}
			
			// Log audit event before deletion
			ipAddress := r.RemoteAddr
			LogAuditEvent("admin", "DELETE_AUCTION", strconv.FormatInt(auctions[i].ID, 10), auctions[i].Name, "Deleted auction: "+auctions[i].Name, ipAddress)
			
			// Remove auction from memory
			auctions = append(auctions[:i], auctions[i+1:]...)
			
			// Delete from DB asynchronously (auction + trades + results)
			if config.DB != nil {
				go func(auctionID int64) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					
					// Delete auction
					config.GetCollection("auctions").DeleteOne(ctx, bson.M{"_id": auctionID})
					
					// Delete all trades for this auction
					config.GetCollection("trades").DeleteMany(ctx, bson.M{"auctionId": auctionID})
					
					// Delete all auction results for this auction
					config.GetCollection("auction_results").DeleteMany(ctx, bson.M{"auctionId": auctionID})
					
					log.Printf("Deleted auction %d and all related data", auctionID)
				}(id)
			}
			
			// Remove trades from memory
			var remainingTrades []Trade
			for _, trade := range trades {
				if trade.AuctionID != id {
					remainingTrades = append(remainingTrades, trade)
				}
			}
			trades = remainingTrades
			
			// Clean up presence data
			auctionPresenceMux.Lock()
			delete(auctionPresence, id)
			auctionPresenceMux.Unlock()
			
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(map[string]string{"error": "Auction not found"})
}

// DuplicateAuction creates a new auction with same settings but new budget
func DuplicateAuction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AuctionID int64   `json:"auctionId"`
		NewName   string  `json:"newName"`
		NewBudget int     `json:"newBudget"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Find original auction
	var original *Auction
	for i := range auctions {
		if auctions[i].ID == req.AuctionID {
			original = &auctions[i]
			break
		}
	}

	if original == nil {
		http.Error(w, "Auction not found", http.StatusNotFound)
		return
	}

	// Create duplicate with new settings
	newAuction := Auction{
		ID:                  newID(),
		Name:                req.NewName,
		Description:         original.Description + " (New Season)",
		Teams:               original.Teams, // Copy teams
		Players:             original.Players, // Copy players
		Budget:              req.NewBudget,
		TimerDuration:       original.TimerDuration,
		PlayersLimit:        original.PlayersLimit,
		OverseasLimit:       original.OverseasLimit,
		TradeWindowDuration: original.TradeWindowDuration,
		Status:              "upcoming",
		IsLive:              false,
		CreatedAt:           time.Now(),
	}

	// Reset player statuses
	for i := range newAuction.Players {
		newAuction.Players[i].Status = "unsold"
		newAuction.Players[i].TeamID = 0
		newAuction.Players[i].SoldPrice = 0
	}

	// Reset team budgets
	for i := range newAuction.Teams {
		newAuction.Teams[i].Budget = float64(req.NewBudget)
	}

	auctions = append(auctions, newAuction)
	if config.DB != nil {
		go func(a Auction) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("auctions").InsertOne(ctx, a)
		}(newAuction)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newAuction)
}

// CreateRetentionPhase creates a retention auction from completed auction
func CreateRetentionPhase(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AuctionID       int64  `json:"auctionId"`
		RetentionName   string `json:"retentionName"`
		RetentionBudget int    `json:"retentionBudget"`
		MaxRetentions   int    `json:"maxRetentions"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Find original auction
	var original *Auction
	for i := range auctions {
		if auctions[i].ID == req.AuctionID {
			original = &auctions[i]
			break
		}
	}

	if original == nil {
		http.Error(w, "Auction not found", http.StatusNotFound)
		return
	}

	// Create retention auction with only sold players
	retentionAuction := Auction{
		ID:                  newID(),
		Name:                req.RetentionName,
		Description:         "Retention phase for " + original.Name,
		Teams:               original.Teams,
		Players:             []Player{}, // Only sold players
		Budget:              req.RetentionBudget,
		TimerDuration:       original.TimerDuration,
		PlayersLimit:        req.MaxRetentions,
		OverseasLimit:       original.OverseasLimit,
		TradeWindowDuration: original.TradeWindowDuration,
		Status:              "upcoming",
		IsLive:              false,
		CreatedAt:           time.Now(),
	}

	// Add only sold players from original auction
	for _, player := range original.Players {
		if player.Status == "sold" && player.TeamID > 0 {
			retentionPlayer := player
			retentionPlayer.Status = "unsold" // Reset for retention
			retentionPlayer.SoldPrice = 0
			retentionAuction.Players = append(retentionAuction.Players, retentionPlayer)
		}
	}

	auctions = append(auctions, retentionAuction)
	if config.DB != nil {
		go func(a Auction) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("auctions").InsertOne(ctx, a)
		}(retentionAuction)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(retentionAuction)
}

// Helper functions for populating auction data
func getTeamsByIDs(teamIDs []int64) []Team {
	allTeams := GetTeamsStore()
	var result []Team
	for _, teamID := range teamIDs {
		for _, team := range allTeams {
			if team.ID == teamID {
				result = append(result, team)
				break
			}
		}
	}
	return result
}

func getPlayersByIDs(playerIDs []int64) []Player {
	allPlayers := GetPlayersStore()
	var result []Player
	for _, playerID := range playerIDs {
		for _, player := range allPlayers {
			if player.ID == playerID {
				result = append(result, player)
				break
			}
		}
	}
	return result
}

func getTeamsForAuction(auction Auction) []Team {
	// First try to get from global store
	teams := getTeamsByIDs(auction.SelectedTeams)
	
	// For missing teams (deleted), get from snapshots
	if len(teams) < len(auction.SelectedTeams) {
		for _, teamID := range auction.SelectedTeams {
			found := false
			for _, team := range teams {
				if team.ID == teamID {
					found = true
					break
				}
			}
			if !found {
				// Get from snapshot
				snapshot := getTeamSnapshot(auction.ID, teamID)
				if snapshot != nil {
					teams = append(teams, Team{
						ID:        snapshot.TeamID,
						Name:      snapshot.Name,
						ShortName: snapshot.ShortName,
						Logo:      snapshot.Logo,
						Color:     snapshot.Color,
					})
				}
			}
		}
	}
	
	return teams
}

func getPlayersForAuction(auction Auction) []Player {
	// First try to get from global store
	players := getPlayersByIDs(auction.SelectedPlayers)
	
	// For completed auctions OR auctions with retention data, merge with results to get sold status
	if (auction.Status == "completed" || auction.Status == "upcoming") && config.DB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		cursor, err := config.GetCollection("auction_results").Find(ctx, bson.M{"auctionId": auction.ID})
		if err == nil {
			var results []AuctionResult
			if err := cursor.All(ctx, &results); err == nil {
				// Create a map of player results for quick lookup
				resultMap := make(map[int64]AuctionResult)
				for _, result := range results {
					resultMap[result.PlayerID] = result
				}
				
				// Update players with their auction results
				for i := range players {
					if result, exists := resultMap[players[i].ID]; exists {
						players[i].Status = result.Status
						if result.Status == "sold" {
							players[i].TeamID = result.TeamID
							players[i].SoldPrice = result.Price
						}
					} else if auction.Status == "upcoming" {
						// For upcoming auctions, players without results are in the pool
						players[i].Status = "upcoming"
						players[i].TeamID = 0
						players[i].SoldPrice = 0
					}
				}
			}
		}
	}
	
	// For missing players (deleted), get from snapshots
	if len(players) < len(auction.SelectedPlayers) {
		for _, playerID := range auction.SelectedPlayers {
			found := false
			for _, player := range players {
				if player.ID == playerID {
					found = true
					break
				}
			}
			if !found {
				// Get from snapshot
				snapshot := getPlayerSnapshot(auction.ID, playerID)
				if snapshot != nil {
					players = append(players, Player{
						ID:         snapshot.PlayerID,
						Name:       snapshot.Name,
						Role:       snapshot.Role,
						Image:      snapshot.Image,
						IsOverseas: snapshot.IsOverseas,
					})
				}
			}
		}
	}
	
	// Apply custom player order if configured (RoleOrder + PlayerOrder)
	if len(auction.RoleOrder) > 0 && len(auction.PlayerOrder) > 0 {
		orderedPlayers := make([]Player, 0, len(players))
		playerMap := make(map[int64]Player)
		
		// Create a map for quick player lookup
		for _, player := range players {
			playerMap[player.ID] = player
		}
		
		// Iterate through roles in the specified order
		for _, role := range auction.RoleOrder {
			// Get player IDs for this role from PlayerOrder
			if playerIDs, exists := auction.PlayerOrder[role]; exists {
				for _, playerID := range playerIDs {
					if player, found := playerMap[playerID]; found {
						orderedPlayers = append(orderedPlayers, player)
						delete(playerMap, playerID) // Remove to avoid duplicates
					}
				}
			}
		}
		
		// Add any remaining players not in PlayerOrder (shouldn't happen, but safety)
		for _, player := range playerMap {
			orderedPlayers = append(orderedPlayers, player)
		}
		
		return orderedPlayers
	}
	
	return players
}

func getTeamSnapshot(auctionID, teamID int64) *TeamSnapshot {
	for _, snapshot := range teamSnapshots {
		if snapshot.AuctionID == auctionID && snapshot.TeamID == teamID {
			return &snapshot
		}
	}
	return nil
}

func getPlayerSnapshot(auctionID, playerID int64) *PlayerSnapshot {
	for _, snapshot := range playerSnapshots {
		if snapshot.AuctionID == auctionID && snapshot.PlayerID == playerID {
			return &snapshot
		}
	}
	return nil
}

func createTeamSnapshots(teamID int64, team Team) {
	// Find all completed auctions using this team
	for _, auction := range auctions {
		if auction.Status == "completed" {
			for _, selectedTeamID := range auction.SelectedTeams {
				if selectedTeamID == teamID {
					// Create snapshot
					snapshot := TeamSnapshot{
						AuctionID: auction.ID,
						TeamID:    teamID,
						Name:      team.Name,
						ShortName: team.ShortName,
						Logo:      team.Logo,
						Color:     team.Color,
						CreatedAt: time.Now(),
					}
					teamSnapshots = append(teamSnapshots, snapshot)
					
					// Save to DB asynchronously
					if config.DB != nil {
						go func(s TeamSnapshot) {
							ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
							defer cancel()
							if _, err := config.GetCollection("team_snapshots").InsertOne(ctx, s); err != nil {
								log.Println("[WARN] CreateTeamSnapshot DB:", err)
							}
						}(snapshot)
					}
					break
				}
			}
		}
	}
}

func createPlayerSnapshots(playerID int64, player Player) {
	// Find all completed auctions using this player
	for _, auction := range auctions {
		if auction.Status == "completed" {
			for _, selectedPlayerID := range auction.SelectedPlayers {
				if selectedPlayerID == playerID {
					// Create snapshot
					snapshot := PlayerSnapshot{
						AuctionID:  auction.ID,
						PlayerID:   playerID,
						Name:       player.Name,
						Role:       player.Role,
						Image:      player.Image,
						IsOverseas: player.IsOverseas,
						CreatedAt:  time.Now(),
					}
					playerSnapshots = append(playerSnapshots, snapshot)
					
					// Save to DB asynchronously
					if config.DB != nil {
						go func(s PlayerSnapshot) {
							ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
							defer cancel()
							if _, err := config.GetCollection("player_snapshots").InsertOne(ctx, s); err != nil {
								log.Println("[WARN] CreatePlayerSnapshot DB:", err)
							}
						}(snapshot)
					}
					break
				}
			}
		}
	}
}
// GetAuctionResults returns the final results of a completed auction with team squads
func GetAuctionResults(w http.ResponseWriter, r *http.Request) {
	id, ok := getAuctionID(r)
	if !ok {
		http.Error(w, "Invalid auction ID", http.StatusBadRequest)
		return
	}

	var auction *Auction
	for i := range auctions {
		if auctions[i].ID == id {
			auction = &auctions[i]
			break
		}
	}

	if auction == nil {
		http.Error(w, "Auction not found", http.StatusNotFound)
		return
	}

	// Get auction results from database
	type TeamSquad struct {
		TeamID  int64    `json:"teamId"`
		Players []Player `json:"players"`
	}
	
	teamSquads := make(map[int64][]Player)
	
	// Try to get results from auction_results collection
	if config.DB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		cursor, err := config.GetCollection("auction_results").Find(ctx, bson.M{"auctionId": id})
		if err == nil {
			var results []AuctionResult
			if err := cursor.All(ctx, &results); err == nil {
				// Build team squads from results
				allPlayers := GetPlayersStore()
				for _, result := range results {
					if result.Status == "sold" && result.TeamID > 0 {
						// Find the player details
						for _, player := range allPlayers {
							if player.ID == result.PlayerID {
								// Create a copy with auction-specific data
								playerCopy := player
								playerCopy.TeamID = result.TeamID
								playerCopy.SoldPrice = result.Price
								playerCopy.Status = result.Status
								teamSquads[result.TeamID] = append(teamSquads[result.TeamID], playerCopy)
								break
							}
						}
					}
				}
			}
		}
	}
	
	// Fallback to live state if no results in DB yet
	if len(teamSquads) == 0 {
		liveState, exists := GetLiveAuction(id)
		if exists && liveState != nil {
			for _, player := range liveState.Players {
				if player.Status == "sold" && player.TeamID > 0 {
					teamSquads[player.TeamID] = append(teamSquads[player.TeamID], player)
				}
			}
		}
	}

	// Convert to map format for easier frontend access
	teamSquadsMap := make(map[string]interface{})
	for teamID, players := range teamSquads {
		log.Printf("[GetAuctionResults] Creating squad entry for teamID %d with %d players", teamID, len(players))
		teamSquadsMap[fmt.Sprintf("%d", teamID)] = map[string]interface{}{
			"teamId":  teamID,
			"players": players,
		}
	}

	log.Printf("[GetAuctionResults] Auction %d: %d team squads, total players in squads: %d", id, len(teamSquadsMap), len(teamSquads))
	for teamID, players := range teamSquads {
		log.Printf("[GetAuctionResults] Team %d has %d players", teamID, len(players))
	}

	// Also include budget info - return teamSquads as map for easier frontend access
	result := map[string]interface{}{
		"id":                 auction.ID,
		"name":               auction.Name,
		"status":             auction.Status,
		"budget":             auction.Budget,
		"teams":              getTeamsForAuction(*auction),
		"players":            getPlayersForAuction(*auction),
		"teamSquads":         teamSquadsMap, // Return as map with nested structure
		"maxOverseasPlayers": auction.OverseasLimit,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// CreateTradeWindow creates a new trade window record
func CreateTradeWindow(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AuctionID      int64  `json:"auctionId"`
		TradeName      string `json:"tradeName"`
		DurationDays   int    `json:"durationDays"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Find original auction
	var original *Auction
	for i := range auctions {
		if auctions[i].ID == req.AuctionID {
			original = &auctions[i]
			break
		}
	}

	if original == nil {
		http.Error(w, "Auction not found", http.StatusNotFound)
		return
	}

	// Create trade window record
	tradeWindow := map[string]interface{}{
		"id":          newID(),
		"auctionId":   req.AuctionID,
		"name":        req.TradeName,
		"duration":    req.DurationDays,
		"startDate":   time.Now(),
		"endDate":     time.Now().AddDate(0, 0, req.DurationDays),
		"status":      "active",
		"teams":       original.Teams,
		"players":     original.Players,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tradeWindow)
}
