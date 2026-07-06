package handlers

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"cricket-auction/config"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var teams []Team

// LoadTeamsFromDB loads teams from MongoDB into memory (call after DB connect)
func LoadTeamsFromDB() {
	if config.DB == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	collection := config.GetCollection("teams")
	
	cursor, err := collection.Find(ctx, bson.M{}, options.Find().SetSort(bson.M{"createdAt": 1}))
	if err != nil {
		log.Printf("[ERROR] Load teams from DB failed: %v", err)
		return
	}
	defer cursor.Close(ctx)
	var loaded []Team
	if err := cursor.All(ctx, &loaded); err != nil {
		log.Printf("[ERROR] Decode teams failed: %v", err)
		return
	}
	
	// Fix missing fields in imported teams
	needsUpdate := false
	for i := range loaded {
		if loaded[i].Code == "" {
			loaded[i].Code = generateTeamCode()
			needsUpdate = true
		}
		if loaded[i].CreatedAt.IsZero() {
			loaded[i].CreatedAt = time.Now()
			needsUpdate = true
		}
		if loaded[i].Budget == 0 {
			loaded[i].Budget = 100
			needsUpdate = true
		}
		// Update in DB if needed
		if needsUpdate {
			go func(t Team) {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				collection.ReplaceOne(ctx, bson.M{"_id": t.ID}, t)
			}(loaded[i])
		}
		needsUpdate = false
	}
	
	teams = loaded
}

// GetTeamsStore returns the teams slice for use by other handlers
func GetTeamsStore() []Team {
	return teams
}

// generateTeamCode generates a random 5-letter uppercase code
func generateTeamCode() string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	code := make([]byte, 5)
	for i := range code {
		code[i] = letters[rand.Intn(len(letters))]
	}
	return string(code)
}

// generateRandomColor generates a random hex color
func generateRandomColor() string {
	colors := []string{
		"#3B82F6", // Blue
		"#EF4444", // Red
		"#10B981", // Green
		"#F59E0B", // Amber
		"#8B5CF6", // Purple
		"#EC4899", // Pink
		"#06B6D4", // Cyan
		"#F97316", // Orange
		"#6366F1", // Indigo
		"#14B8A6", // Teal
	}
	return colors[rand.Intn(len(colors))]
}

func GetTeams(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

func CreateTeam(w http.ResponseWriter, r *http.Request) {
	var team Team
	if err := json.NewDecoder(r.Body).Decode(&team); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check for duplicate name
	for _, t := range teams {
		if t.Name == team.Name {
			http.Error(w, "Team name already exists", http.StatusConflict)
			return
		}
	}

	team.ID = newID()
	team.CreatedAt = time.Now()
	team.Code = generateTeamCode() // Generate unique code
	if team.Color == "" {
		team.Color = generateRandomColor() // Generate random color if not provided
	}
	if team.Budget == 0 {
		team.Budget = 100
	}

	// Add to memory immediately
	teams = append(teams, team)

	// Save to DB asynchronously
	if config.DB != nil {
		go func(t Team) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, err := config.GetCollection("teams").InsertOne(ctx, t)
			if err != nil {
				log.Printf("[ERROR] CreateTeam DB insert failed: %v", err)
			}
		}(team)
	}

	// Team created (audit logging removed for MVP)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(team)
}

func DeleteTeam(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	// Find team before deleting
	var team *Team
	for i := range teams {
		if teams[i].ID == id {
			team = &teams[i]
			break
		}
	}

	if team == nil {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	// Team deleted (audit logging removed for MVP)

	// Create snapshots for completed auctions BEFORE deleting
	createTeamSnapshots(id, *team)

	// Remove from memory
	for i := range teams {
		if teams[i].ID == id {
			teams = append(teams[:i], teams[i+1:]...)
			break
		}
	}

	// Delete from DB asynchronously
	if config.DB != nil {
		go func(teamID int64) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("teams").DeleteOne(ctx, bson.M{"_id": teamID})
		}(id)
	}

	// Invalidate any active sessions for this team
	InvalidateTeamSession(id)

	w.WriteHeader(http.StatusNoContent)
}

func UpdateTeam(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	
	// Convert string ID to int64
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	var updatedTeam Team
	if err := json.NewDecoder(r.Body).Decode(&updatedTeam); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check for duplicate name (excluding current team)
	for _, t := range teams {
		if t.Name == updatedTeam.Name && t.ID != id {
			http.Error(w, "Team name already exists", http.StatusConflict)
			return
		}
	}

	for i := range teams {
		if teams[i].ID == id {
			updatedTeam.ID = teams[i].ID
			updatedTeam.CreatedAt = teams[i].CreatedAt
			if updatedTeam.Code == "" {
				updatedTeam.Code = teams[i].Code
			}
			if updatedTeam.Budget == 0 {
				updatedTeam.Budget = teams[i].Budget
			}

			codeChanged := updatedTeam.Code != teams[i].Code
			if codeChanged {
				InvalidateTeamSession(id)
			}

			// Update memory immediately
			teams[i] = updatedTeam

			// Team updated (audit logging removed for MVP)

			// Save to DB asynchronously
			if config.DB != nil {
				go func(t Team) {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					config.GetCollection("teams").ReplaceOne(ctx, bson.M{"_id": t.ID}, t)
				}(updatedTeam)
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(teams[i])
			return
		}
	}

	http.Error(w, "Team not found", http.StatusNotFound)
}

func RegenerateTeamCode(w http.ResponseWriter, r *http.Request) {
	var request struct {
		TeamID string `json:"teamId"` // Accept as string
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Convert string to int64
	teamID, err := strconv.ParseInt(request.TeamID, 10, 64)
	if err != nil {
		http.Error(w, "Invalid team ID", http.StatusBadRequest)
		return
	}

	for i := range teams {
		if teams[i].ID == teamID {
			InvalidateTeamSession(teamID)
			teams[i].Code = generateTeamCode()
			if config.DB != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				if _, err := config.GetCollection("teams").ReplaceOne(ctx, bson.M{"_id": request.TeamID}, teams[i]); err != nil {
					log.Println("RegenerateTeamCode DB:", err)
				}
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(teams[i])
			return
		}
	}

	http.Error(w, "Team not found", http.StatusNotFound)
}
