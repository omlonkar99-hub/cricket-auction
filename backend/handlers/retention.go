package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"cricket-auction/config"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Data Models
type RetentionSlot struct {
	Slot  int     `json:"slot" bson:"slot"`
	Price float64 `json:"price" bson:"price"`
}

type PreAssignedSquad struct {
	TeamID    int64   `json:"teamId" bson:"teamId"`
	PlayerIDs []int64 `json:"playerIds" bson:"playerIds"`
}

type RetentionChoice struct {
	PlayerID int     `json:"playerId" bson:"playerId"`
	Slot     int     `json:"slot" bson:"slot"`
	Price    float64 `json:"price" bson:"price"`
	Action   string  `json:"action" bson:"action"` // "retain" or "release"
}

type RetentionAuction struct {
	ID                  int64              `json:"id,string" bson:"_id"`
	Name                string             `json:"name" bson:"name"`
	Description         string             `json:"description" bson:"description"`
	Type                string             `json:"type" bson:"type"`
	SourceAuctionID     *int64             `json:"sourceAuctionId,omitempty,string" bson:"sourceAuctionId,omitempty"`
	Budget              float64            `json:"budget" bson:"budget"`
	MaxPlayers          int                `json:"maxPlayers" bson:"maxPlayers"`
	MaxOverseas         int                `json:"maxOverseas" bson:"maxOverseas"`
	TimerDuration       int                `json:"timerDuration" bson:"timerDuration"`
	MaxRetentions       int                `json:"maxRetentions" bson:"maxRetentions"`
	MaxOverseasRetention int               `json:"maxOverseasRetention" bson:"maxOverseasRetention"`
	RetentionSlots      []RetentionSlot    `json:"retentionSlots" bson:"retentionSlots"`
	PreAssignedSquads   []PreAssignedSquad `json:"preAssignedSquads,omitempty" bson:"preAssignedSquads,omitempty"`
	GeneralPoolPlayers  []int64            `json:"generalPoolPlayers" bson:"generalPoolPlayers"`
	WindowDuration      int                `json:"windowDuration" bson:"windowDuration"`
	WindowStartTime     *time.Time         `json:"windowStartTime,omitempty" bson:"windowStartTime,omitempty"`
	WindowEndTime       *time.Time         `json:"windowEndTime,omitempty" bson:"windowEndTime,omitempty"`
	Status              string             `json:"status" bson:"status"`
	IsLive              bool               `json:"isLive" bson:"isLive"`
	LiveAuctionID       *int64             `json:"liveAuctionId,omitempty,string" bson:"liveAuctionId,omitempty"`
	SelectedTeams       []int64            `json:"selectedTeams" bson:"selectedTeams"`
	CreatedAt           time.Time          `json:"createdAt" bson:"createdAt"`
	
	Teams               []Team             `json:"teams,omitempty" bson:"-"`
	Players             []Player           `json:"players,omitempty" bson:"-"`
}

type TeamRetention struct {
	ID              int64             `json:"id,string" bson:"_id"`
	AuctionID       int64             `json:"auctionId,string" bson:"auctionId"`
	TeamID          int64             `json:"teamId,string" bson:"teamId"`
	Choices         []RetentionChoice `json:"choices" bson:"choices"`
	TotalCost       float64           `json:"totalCost" bson:"totalCost"`
	RemainingBudget float64           `json:"remainingBudget" bson:"remainingBudget"`
	IsSubmitted     bool              `json:"isSubmitted" bson:"isSubmitted"`
	SubmittedAt     *time.Time        `json:"submittedAt,omitempty" bson:"submittedAt,omitempty"`
	CreatedAt       time.Time         `json:"createdAt" bson:"createdAt"`
}

var retentionAuctions []RetentionAuction
var teamRetentions []TeamRetention

// LoadRetentionAuctionsFromDB loads retention auctions from database into memory
func LoadRetentionAuctionsFromDB() {
	if config.DB == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("retention_auctions")
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var loadedAuctions []RetentionAuction
	if err = cursor.All(ctx, &loadedAuctions); err != nil {
		return
	}

	retentionAuctions = loadedAuctions
}

// CreateRetentionAuction creates a new retention auction
func CreateRetentionAuction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name                 string              `json:"name"`
		Description          string              `json:"description"`
		SourceAuctionID      string              `json:"sourceAuctionId"`      // Accept as string
		Budget               float64             `json:"budget"`
		MaxPlayers           int                 `json:"maxPlayers"`
		MaxOverseas          int                 `json:"maxOverseas"`
		TimerDuration        int                 `json:"timerDuration"`
		MaxRetentions        int                 `json:"maxRetentions"`
		MaxOverseasRetention int                 `json:"maxOverseasRetention"`
		RetentionSlots       []RetentionSlot     `json:"retentionSlots"`
		PreAssignedSquads    []struct {
			TeamID    string   `json:"teamId"`    // Accept as string
			PlayerIDs []string `json:"playerIds"` // Accept as strings
		} `json:"preAssignedSquads"`
		GeneralPoolPlayers []string `json:"generalPoolPlayers"` // Accept as strings
		WindowDuration     int      `json:"windowDuration"`
		SelectedTeams      []string `json:"selectedTeams"` // Accept as strings
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Parse source auction ID
	var sourceAuctionID *int64
	if req.SourceAuctionID != "" {
		id, err := strconv.ParseInt(req.SourceAuctionID, 10, 64)
		if err != nil {
			http.Error(w, "Invalid source auction ID", http.StatusBadRequest)
			return
		}
		sourceAuctionID = &id
	}

	// Convert selected teams
	selectedTeams := make([]int64, len(req.SelectedTeams))
	for i, idStr := range req.SelectedTeams {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			http.Error(w, "Invalid team ID: "+idStr, http.StatusBadRequest)
			return
		}
		selectedTeams[i] = id
	}

	// Convert general pool players
	generalPoolPlayers := make([]int64, len(req.GeneralPoolPlayers))
	for i, idStr := range req.GeneralPoolPlayers {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			http.Error(w, "Invalid player ID: "+idStr, http.StatusBadRequest)
			return
		}
		generalPoolPlayers[i] = id
	}

	// Convert pre-assigned squads
	var preAssignedSquads []PreAssignedSquad
	for _, squad := range req.PreAssignedSquads {
		teamID, err := strconv.ParseInt(squad.TeamID, 10, 64)
		if err != nil {
			http.Error(w, "Invalid team ID in squad: "+squad.TeamID, http.StatusBadRequest)
			return
		}
		
		playerIDs := make([]int64, len(squad.PlayerIDs))
		for i, idStr := range squad.PlayerIDs {
			id, err := strconv.ParseInt(idStr, 10, 64)
			if err != nil {
				http.Error(w, "Invalid player ID in squad: "+idStr, http.StatusBadRequest)
				return
			}
			playerIDs[i] = id
		}
		
		preAssignedSquads = append(preAssignedSquads, PreAssignedSquad{
			TeamID:    teamID,
			PlayerIDs: playerIDs,
		})
	}

	now := time.Now()
	auction := RetentionAuction{
		ID:                   newID(),
		Name:                 req.Name,
		Description:          req.Description,
		Type:                 "retention",
		SourceAuctionID:      sourceAuctionID,
		Budget:               req.Budget,
		MaxPlayers:           req.MaxPlayers,
		MaxOverseas:          req.MaxOverseas,
		TimerDuration:        req.TimerDuration,
		MaxRetentions:        req.MaxRetentions,
		MaxOverseasRetention: req.MaxOverseasRetention,
		RetentionSlots:       req.RetentionSlots,
		PreAssignedSquads:    preAssignedSquads,
		GeneralPoolPlayers:   generalPoolPlayers,
		WindowDuration:       req.WindowDuration,
		Status:               "upcoming",
		IsLive:               false,
		SelectedTeams:        selectedTeams,
		CreatedAt:            now,
	}

	retentionAuctions = append(retentionAuctions, auction)

	if config.DB != nil {
		go func(a RetentionAuction) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("retention_auctions").InsertOne(ctx, a)
		}(auction)
	}

	auction.Teams = getTeamsByIDs(auction.SelectedTeams)
	
	if auction.SourceAuctionID != nil {
		auction.Players = getPlayersFromPastAuction(*auction.SourceAuctionID)
	} else {
		var allPlayerIDs []int64
		for _, squad := range auction.PreAssignedSquads {
			allPlayerIDs = append(allPlayerIDs, squad.PlayerIDs...)
		}
		allPlayerIDs = append(allPlayerIDs, auction.GeneralPoolPlayers...)
		auction.Players = getPlayersByIDs(allPlayerIDs)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(auction)
}

// GetRetentionAuctions returns all retention auctions
func GetRetentionAuctions(w http.ResponseWriter, r *http.Request) {
	for i := range retentionAuctions {
		retentionAuctions[i].Teams = getTeamsByIDs(retentionAuctions[i].SelectedTeams)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(retentionAuctions)
}

// GetRetentionAuctionByID returns a specific retention auction
func GetRetentionAuctionByID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id := parseRetentionID(idStr)

	for i := range retentionAuctions {
		if retentionAuctions[i].ID == id {
			auction := retentionAuctions[i]
			auction.Teams = getTeamsByIDs(auction.SelectedTeams)
			
			if auction.SourceAuctionID != nil {
				auction.Players = getPlayersFromPastAuction(*auction.SourceAuctionID)
			} else {
				var allPlayerIDs []int64
				for _, squad := range auction.PreAssignedSquads {
					allPlayerIDs = append(allPlayerIDs, squad.PlayerIDs...)
				}
				allPlayerIDs = append(allPlayerIDs, auction.GeneralPoolPlayers...)
				auction.Players = getPlayersByIDs(allPlayerIDs)
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(auction)
			return
		}
	}

	http.Error(w, "Retention auction not found", http.StatusNotFound)
}

// StartRetentionWindow activates the retention window
func StartRetentionWindow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := parseRetentionID(vars["id"])

	for i := range retentionAuctions {
		if retentionAuctions[i].ID == id {
			now := time.Now()
			endTime := now.Add(time.Duration(retentionAuctions[i].WindowDuration) * time.Hour)
			
			retentionAuctions[i].WindowStartTime = &now
			retentionAuctions[i].WindowEndTime = &endTime
			retentionAuctions[i].Status = "retention_active"

			if config.DB != nil {
				go func(a RetentionAuction) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					config.GetCollection("retention_auctions").ReplaceOne(ctx, bson.M{"_id": a.ID}, a)
				}(retentionAuctions[i])
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(retentionAuctions[i])
			return
		}
	}

	http.Error(w, "Retention auction not found", http.StatusNotFound)
}

// GetTeamAssignedPlayers returns players assigned to a specific team
func GetTeamAssignedPlayers(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auctionID := parseRetentionID(vars["id"])
	teamID := parseRetentionID(vars["teamId"])

	var auction *RetentionAuction
	for i := range retentionAuctions {
		if retentionAuctions[i].ID == auctionID {
			auction = &retentionAuctions[i]
			break
		}
	}

	if auction == nil {
		http.Error(w, "Retention auction not found", http.StatusNotFound)
		return
	}

	log.Printf("[RETENTION] Found auction: %s, SourceAuctionID: %v, PreAssignedSquads: %d, GeneralPoolPlayers: %d", 
		auction.Name, auction.SourceAuctionID, len(auction.PreAssignedSquads), len(auction.GeneralPoolPlayers))

	var assignedPlayerIDs []int64

	if auction.SourceAuctionID != nil {
		assignedPlayerIDs = getTeamPlayersFromPastAuction(*auction.SourceAuctionID, teamID)
	} else {
		for _, squad := range auction.PreAssignedSquads {
			if squad.TeamID == teamID {
				assignedPlayerIDs = squad.PlayerIDs
				break
			}
		}
		// If no team-specific squad found, use general pool players
		if len(assignedPlayerIDs) == 0 && len(auction.GeneralPoolPlayers) > 0 {
			assignedPlayerIDs = auction.GeneralPoolPlayers
		}
	}

	// Get base player data
	players := getPlayersByIDs(assignedPlayerIDs)
	
	// Add team assignment to each player for retention context
	for i := range players {
		players[i].TeamID = teamID
		players[i].Status = "available" // Available for retention
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(players)
}

// SubmitTeamRetention submits team's retention choices
func SubmitTeamRetention(w http.ResponseWriter, r *http.Request) {
	var rawReq map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&rawReq); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Helper to parse int64
	parseInt64 := func(v interface{}) int64 {
		switch val := v.(type) {
		case float64:
			return int64(val)
		case string:
			id, _ := strconv.ParseInt(val, 10, 64)
			return id
		default:
			return 0
		}
	}

	auctionID := parseInt64(rawReq["auctionId"])
	teamID := parseInt64(rawReq["teamId"])

	// Parse choices
	var choices []RetentionChoice
	if choicesRaw, ok := rawReq["choices"].([]interface{}); ok {
		for _, item := range choicesRaw {
			if choice, ok := item.(map[string]interface{}); ok {
				choices = append(choices, RetentionChoice{
					PlayerID: int(parseInt64(choice["playerId"])),
					Slot:     int(choice["slot"].(float64)),
					Price:    choice["price"].(float64),
					Action:   choice["action"].(string),
				})
			}
		}
	}

	var auction *RetentionAuction
	for i := range retentionAuctions {
		if retentionAuctions[i].ID == auctionID {
			auction = &retentionAuctions[i]
			break
		}
	}

	if auction == nil {
		http.Error(w, "Retention auction not found", http.StatusNotFound)
		return
	}

	if auction.Status != "retention_active" {
		http.Error(w, "Retention window is not active", http.StatusBadRequest)
		return
	}

	if auction.WindowEndTime != nil && time.Now().After(*auction.WindowEndTime) {
		http.Error(w, "Retention window has expired", http.StatusBadRequest)
		return
	}

	retainedCount := 0
	overseasCount := 0
	totalCost := 0.0
	allPlayers := getPlayersByIDs(getAllPlayerIDsFromChoices(choices))

	for _, choice := range choices {
		if choice.Action == "retain" {
			retainedCount++
			totalCost += choice.Price

			for _, player := range allPlayers {
				if player.ID == int64(choice.PlayerID) && player.IsOverseas {
					overseasCount++
					break
				}
			}
		}
	}

	if retainedCount > auction.MaxRetentions {
		http.Error(w, "Exceeded maximum retentions", http.StatusBadRequest)
		return
	}

	if overseasCount > auction.MaxOverseasRetention {
		http.Error(w, "Exceeded overseas player limit in retentions", http.StatusBadRequest)
		return
	}

	if totalCost > auction.Budget {
		http.Error(w, "Retention cost exceeds budget", http.StatusBadRequest)
		return
	}

	for i := range teamRetentions {
		if teamRetentions[i].AuctionID == auctionID && teamRetentions[i].TeamID == teamID {
			now := time.Now()
			teamRetentions[i].Choices = choices
			teamRetentions[i].TotalCost = totalCost
			teamRetentions[i].RemainingBudget = auction.Budget - totalCost
			teamRetentions[i].IsSubmitted = true
			teamRetentions[i].SubmittedAt = &now

			if config.DB != nil {
				go func(tr TeamRetention) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					config.GetCollection("team_retentions").ReplaceOne(ctx, bson.M{"_id": tr.ID}, tr)
				}(teamRetentions[i])
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(teamRetentions[i])
			return
		}
	}

	now := time.Now()
	retention := TeamRetention{
		ID:              newID(),
		AuctionID:       auctionID,
		TeamID:          teamID,
		Choices:         choices,
		TotalCost:       totalCost,
		RemainingBudget: auction.Budget - totalCost,
		IsSubmitted:     true,
		SubmittedAt:     &now,
		CreatedAt:       now,
	}

	teamRetentions = append(teamRetentions, retention)

	if config.DB != nil {
		go func(tr TeamRetention) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("team_retentions").InsertOne(ctx, tr)
		}(retention)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(retention)
}

// GetTeamRetentions returns all team retention submissions for an auction
func GetTeamRetentions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auctionID := parseRetentionID(vars["id"])

	var submissions []TeamRetention
	for _, retention := range teamRetentions {
		if retention.AuctionID == auctionID {
			submissions = append(submissions, retention)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(submissions)
}

// CloseRetentionWindow manually closes the retention window
func CloseRetentionWindow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := parseRetentionID(vars["id"])

	for i := range retentionAuctions {
		if retentionAuctions[i].ID == id {
			retentionAuctions[i].Status = "retention_closed"

			if config.DB != nil {
				go func(a RetentionAuction) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					config.GetCollection("retention_auctions").ReplaceOne(ctx, bson.M{"_id": a.ID}, a)
				}(retentionAuctions[i])
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(retentionAuctions[i])
			return
		}
	}

	http.Error(w, "Retention auction not found", http.StatusNotFound)
}

// GetRetentionReview returns summary for admin review
func GetRetentionReview(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	auctionID := parseRetentionID(vars["id"])

	var auction *RetentionAuction
	for i := range retentionAuctions {
		if retentionAuctions[i].ID == auctionID {
			auction = &retentionAuctions[i]
			break
		}
	}

	if auction == nil {
		http.Error(w, "Retention auction not found", http.StatusNotFound)
		return
	}

	var submissions []TeamRetention
	for _, retention := range teamRetentions {
		if retention.AuctionID == auctionID {
			submissions = append(submissions, retention)
		}
	}

	review := map[string]interface{}{
		"auction":     auction,
		"submissions": submissions,
		"teams":       getTeamsByIDs(auction.SelectedTeams),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(review)
}

// StartLiveAuctionFromRetention creates and starts live auction from retention
func StartLiveAuctionFromRetention(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	retentionID := parseRetentionID(vars["id"])

	var retAuction *RetentionAuction
	for i := range retentionAuctions {
		if retentionAuctions[i].ID == retentionID {
			retAuction = &retentionAuctions[i]
			break
		}
	}

	if retAuction == nil {
		http.Error(w, "Retention auction not found", http.StatusNotFound)
		return
	}

	var submissions []TeamRetention
	for _, retention := range teamRetentions {
		if retention.AuctionID == retentionID {
			submissions = append(submissions, retention)
		}
	}

	var auctionPlayerIDs []int64
	retainedPlayerIDs := make(map[int64]bool)

	for _, submission := range submissions {
		for _, choice := range submission.Choices {
			if choice.Action == "retain" {
				retainedPlayerIDs[int64(choice.PlayerID)] = true
			}
		}
	}

	// Collect released players for auction pool
	var releasedPlayerIDs []int64
	if retAuction.SourceAuctionID != nil {
		allSquadPlayers := getPlayersFromPastAuction(*retAuction.SourceAuctionID)
		for _, player := range allSquadPlayers {
			if !retainedPlayerIDs[player.ID] {
				releasedPlayerIDs = append(releasedPlayerIDs, player.ID)
			}
		}
	} else {
		for _, squad := range retAuction.PreAssignedSquads {
			for _, playerID := range squad.PlayerIDs {
				if !retainedPlayerIDs[playerID] {
					releasedPlayerIDs = append(releasedPlayerIDs, playerID)
				}
			}
		}
	}

	releasedPlayerIDs = append(releasedPlayerIDs, retAuction.GeneralPoolPlayers...)
	
	// SelectedPlayers includes ALL players (retained + released) for tracking
	auctionPlayerIDs = releasedPlayerIDs
	for retainedID := range retainedPlayerIDs {
		auctionPlayerIDs = append(auctionPlayerIDs, retainedID)
	}

	now := time.Now()
	liveAuction := Auction{
		ID:              newID(),
		Name:            retAuction.Name + " - Live Auction",
		Description:     "Live auction phase after retention",
		Type:            "regular",
		SelectedTeams:   retAuction.SelectedTeams,
		SelectedPlayers: auctionPlayerIDs,
		Budget:          int(retAuction.Budget),
		TimerDuration:   retAuction.TimerDuration,
		PlayersLimit:    retAuction.MaxPlayers,
		OverseasLimit:   retAuction.MaxOverseas,
		Status:          "upcoming", // Will be set to "live" when started
		IsLive:          false,
		CreatedAt:       now,
	}

	auctions = append(auctions, liveAuction)

	retAuction.LiveAuctionID = &liveAuction.ID
	retAuction.Status = "auction_live"

	if config.DB != nil {
		go func(a Auction, ra RetentionAuction) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("auctions").InsertOne(ctx, a)
			config.GetCollection("retention_auctions").ReplaceOne(ctx, bson.M{"_id": ra.ID}, ra)
		}(liveAuction, *retAuction)
	}

	// Apply retained players to teams
	retainedPlayerMap := make(map[int64]struct {
		teamID int64
		price  float64
	})
	
	for _, submission := range submissions {
		for _, choice := range submission.Choices {
			if choice.Action == "retain" {
				// Create auction result for retained player
				result := AuctionResult{
					AuctionID:  liveAuction.ID,
					PlayerID:   int64(choice.PlayerID),
					TeamID:     submission.TeamID,
					Price:      choice.Price,
					Status:     "sold",
				}
				
				// Save to database synchronously to ensure consistency
				if config.DB != nil {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					
					// Use upsert to avoid duplicates
					filter := bson.M{
						"auctionId": result.AuctionID,
						"playerId":  result.PlayerID,
					}
					update := bson.M{"$set": result}
					opts := options.Update().SetUpsert(true)
					
					_, err := config.GetCollection("auction_results").UpdateOne(ctx, filter, update, opts)
					if err != nil {
						// Silent error
					}
				}
				
				// Track retained players
				retainedPlayerMap[int64(choice.PlayerID)] = struct {
					teamID int64
					price  float64
				}{submission.TeamID, choice.Price}
			}
		}
	}
	
	// Load teams (budgets remain unchanged - they're managed during live auction)
	liveAuction.Teams = getTeamsByIDs(liveAuction.SelectedTeams)
	
	// Load all players from SelectedPlayers
	liveAuction.Players = getPlayersByIDs(liveAuction.SelectedPlayers)
	
	// Apply retention status to players
	for i := range liveAuction.Players {
		if retInfo, isRetained := retainedPlayerMap[liveAuction.Players[i].ID]; isRetained {
			liveAuction.Players[i].Status = "sold"
			liveAuction.Players[i].TeamID = retInfo.teamID
			liveAuction.Players[i].SoldPrice = retInfo.price
		} else {
			liveAuction.Players[i].Status = "upcoming"
			liveAuction.Players[i].TeamID = 0
			liveAuction.Players[i].SoldPrice = 0
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"liveAuction":      liveAuction,
		"retentionAuction": retAuction,
	})
}

// DeleteRetentionAuction removes a retention auction
func DeleteRetentionAuction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := parseRetentionID(vars["id"])

	for i := range retentionAuctions {
		if retentionAuctions[i].ID == id {
			if retentionAuctions[i].Status == "retention_active" {
				http.Error(w, "Cannot delete active retention auction", http.StatusBadRequest)
				return
			}
			
			retentionAuctions = append(retentionAuctions[:i], retentionAuctions[i+1:]...)
			
			if config.DB != nil {
				go func(auctionID int64) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					config.GetCollection("retention_auctions").DeleteOne(ctx, bson.M{"_id": auctionID})
					config.GetCollection("team_retentions").DeleteMany(ctx, bson.M{"auctionId": auctionID})
				}(id)
			}
			
			var remainingRetentions []TeamRetention
			for _, retention := range teamRetentions {
				if retention.AuctionID != id {
					remainingRetentions = append(remainingRetentions, retention)
				}
			}
			teamRetentions = remainingRetentions
			
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	http.Error(w, "Retention auction not found", http.StatusNotFound)
}

// UpdateRetentionPresenceHandler records team presence
func UpdateRetentionPresenceHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := parseRetentionID(vars["id"])
	
	var req struct {
		TeamID int64 `json:"teamId,string"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TeamID == 0 {
		http.Error(w, "teamId required", http.StatusBadRequest)
		return
	}

	retentionPresenceMux.Lock()
	if retentionPresence[id] == nil {
		retentionPresence[id] = make(map[int64]time.Time)
	}
	retentionPresence[id][req.TeamID] = time.Now()
	retentionPresenceMux.Unlock()

	w.WriteHeader(http.StatusOK)
}

// GetRetentionPresenceHandler returns active teams
func GetRetentionPresenceHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := parseRetentionID(vars["id"])

	retentionPresenceMux.RLock()
	defer retentionPresenceMux.RUnlock()

	activeTeams := []int64{}
	if presence, ok := retentionPresence[id]; ok {
		cutoff := time.Now().Add(-15 * time.Second)
		for teamID, lastSeen := range presence {
			if lastSeen.After(cutoff) {
				activeTeams = append(activeTeams, teamID)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"activeTeams": activeTeams,
	})
}

// Helper functions
func parseRetentionID(idStr string) int64 {
	id, _ := strconv.ParseInt(idStr, 10, 64)
	return id
}

func getPlayersFromPastAuction(auctionID int64) []Player {
	for _, auction := range auctions {
		if auction.ID == auctionID {
			return auction.Players
		}
	}
	return []Player{}
}

func getTeamPlayersFromPastAuction(auctionID int64, teamID int64) []int64 {
	var playerIDs []int64
	for _, auction := range auctions {
		if auction.ID == auctionID {
			for _, player := range auction.Players {
				if player.TeamID == teamID && player.Status == "sold" {
					playerIDs = append(playerIDs, player.ID)
				}
			}
			break
		}
	}
	return playerIDs
}

func getAllPlayerIDsFromChoices(choices []RetentionChoice) []int64 {
	var ids []int64
	for _, choice := range choices {
		ids = append(ids, int64(choice.PlayerID))
	}
	return ids
}
