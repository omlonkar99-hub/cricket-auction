package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"cricket-auction/config"
)

type AuctionHealth struct {
	TotalBudget   float64 `json:"totalBudget"`
	SpentBudget   float64 `json:"spentBudget"`
	SoldPlayers   int     `json:"soldPlayers"`
	UnsoldPlayers int     `json:"unsoldPlayers"`
	TotalPlayers  int     `json:"totalPlayers"`
}

// Simple health check for UptimeRobot
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Verify DB is reachable
	if err := config.PingDB(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "unhealthy",
			"reason":    "database unreachable",
			"timestamp": time.Now().Format(time.RFC3339),
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
		"service":   "cricket-auction-api",
	})
}

func GetAuctionHealth(w http.ResponseWriter, r *http.Request) {
	soldCount := 0
	unsoldCount := 0
	spentBudget := 0.0

	for _, player := range players {
		if player.Status == "sold" {
			soldCount++
			spentBudget += player.SoldPrice
		} else if player.Status == "unsold" {
			unsoldCount++
		}
	}

	totalBudget := 0.0
	for _, team := range teams {
		totalBudget += team.Budget
	}

	health := AuctionHealth{
		TotalBudget:   totalBudget,
		SpentBudget:   spentBudget,
		SoldPlayers:   soldCount,
		UnsoldPlayers: unsoldCount,
		TotalPlayers:  len(players),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}
