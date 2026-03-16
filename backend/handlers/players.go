package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"cricket-auction/config"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	players    []Player
	playersMux sync.RWMutex // Protect players array from race conditions
)

// LoadPlayersFromDB loads players from MongoDB into memory (call after DB connect)
func LoadPlayersFromDB() {
	if config.DB == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("players")

	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"createdAt": 1}))
	if err != nil {
		log.Printf("[ERROR] Load players from DB failed: %v", err)
		return
	}
	defer cursor.Close(ctx)
	var loaded []Player
	if err := cursor.All(ctx, &loaded); err != nil {
		log.Printf("[ERROR] Decode players failed: %v", err)
		return
	}
	
	// Fix missing CreatedAt for old records
	for i := range loaded {
		if loaded[i].CreatedAt.IsZero() {
			loaded[i].CreatedAt = time.Now()
			// Update in DB
			go func(p Player) {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				collection.ReplaceOne(ctx, bson.M{"_id": p.ID}, p)
			}(loaded[i])
		}
	}
	
	playersMux.Lock()
	players = loaded
	playersMux.Unlock()
}

// GetPlayersStore returns a copy of the players slice for use by other handlers
func GetPlayersStore() []Player {
	playersMux.RLock()
	defer playersMux.RUnlock()
	// Return a copy to prevent external modifications
	result := make([]Player, len(players))
	copy(result, players)
	return result
}

func GetPlayers(w http.ResponseWriter, r *http.Request) {
	playersMux.RLock()
	defer playersMux.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(players)
}

func CreatePlayer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name       string  `json:"name"`
		Role       string  `json:"role"`
		BasePrice  float64 `json:"basePrice"`
		IsOverseas bool    `json:"isOverseas"`
		Image      string  `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	playersMux.Lock()
	defer playersMux.Unlock()

	// Check for duplicate name
	for _, p := range players {
		if p.Name == req.Name {
			http.Error(w, "Player name already exists", http.StatusConflict)
			return
		}
	}

	player := Player{
		ID:         newID(),
		Name:       req.Name,
		Role:       req.Role,
		BasePrice:  req.BasePrice,
		IsOverseas: req.IsOverseas,
		Image:      req.Image,
		CreatedAt:  time.Now(),
	}

	players = append(players, player)

	// Log audit event
	ipAddress := r.RemoteAddr
	LogAuditEvent("admin", "CREATE_PLAYER", strconv.FormatInt(player.ID, 10), player.Name, "Created player: "+player.Name, ipAddress)

	if config.DB != nil {
		go func(p Player) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, err := config.GetCollection("players").InsertOne(ctx, p)
			if err != nil {
				log.Printf("[ERROR] CreatePlayer DB insert failed: %v", err)
			}
		}(player)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(player)
}

func DeletePlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid player ID", http.StatusBadRequest)
		return
	}

	playersMux.Lock()
	defer playersMux.Unlock()

	// Find player before deleting
	var player *Player
	for i := range players {
		if players[i].ID == id {
			player = &players[i]
			break
		}
	}

	if player == nil {
		http.Error(w, "Player not found", http.StatusNotFound)
		return
	}

	// Log audit event before deletion
	ipAddress := r.RemoteAddr
	LogAuditEvent("admin", "DELETE_PLAYER", strconv.FormatInt(player.ID, 10), player.Name, "Deleted player: "+player.Name, ipAddress)

	// Create snapshots for completed auctions BEFORE deleting
	createPlayerSnapshots(id, *player)

	// Remove from memory
	for i := range players {
		if players[i].ID == id {
			players = append(players[:i], players[i+1:]...)
			break
		}
	}

	// Delete from DB asynchronously
	if config.DB != nil {
		go func(playerID int64) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("players").DeleteOne(ctx, bson.M{"_id": playerID})
		}(id)
	}

	w.WriteHeader(http.StatusNoContent)
}

func UpdatePlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]

	// Convert string ID to int64
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid player ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Name       string  `json:"name"`
		Role       string  `json:"role"`
		BasePrice  float64 `json:"basePrice"`
		IsOverseas bool    `json:"isOverseas"`
		Image      string  `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	playersMux.Lock()
	defer playersMux.Unlock()

	// Check for duplicate name (excluding current player)
	for _, p := range players {
		if p.Name == req.Name && p.ID != id {
			http.Error(w, "Player name already exists", http.StatusConflict)
			return
		}
	}

	for i := range players {
		if players[i].ID == id {
			oldName := players[i].Name
			// Update only the core player fields
			players[i].Name = req.Name
			players[i].Role = req.Role
			players[i].BasePrice = req.BasePrice
			players[i].IsOverseas = req.IsOverseas
			players[i].Image = req.Image
			// Preserve auction-specific fields (Order, Status, TeamID, SoldPrice)
			// These should only be modified during auction operations, not player management

			// Log audit event
			ipAddress := r.RemoteAddr
			details := "Updated player: " + oldName
			if oldName != req.Name {
				details += " → " + req.Name
			}
			LogAuditEvent("admin", "UPDATE_PLAYER", strconv.FormatInt(players[i].ID, 10), players[i].Name, details, ipAddress)

			// Save to DB asynchronously
			if config.DB != nil {
				go func(p Player) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					config.GetCollection("players").ReplaceOne(ctx, bson.M{"_id": p.ID}, p)
				}(players[i])
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(players[i])
			return
		}
	}

	http.Error(w, "Player not found", http.StatusNotFound)
}
