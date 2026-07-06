package handlers

import (
	"context"
	"time"

	"cricket-auction/config"
)

type AuctionResult struct {
	ID            int64                `json:"id,string" bson:"_id"`
	AuctionID     int64                `json:"auctionId,string" bson:"auctionId"`
	AuctionName   string               `json:"auctionName" bson:"auctionName"`
	SoldPlayers   []SoldPlayer         `json:"soldPlayers" bson:"soldPlayers"`
	UnsoldPlayers []int64              `json:"unsoldPlayers" bson:"unsoldPlayers"`
	Participants  []ResultParticipant  `json:"participants" bson:"participants"`
	TeamRosters   []TeamRoster         `json:"teamRosters" bson:"teamRosters"`
	CompletedAt   time.Time            `json:"completedAt" bson:"completedAt"`
}

type SoldPlayer struct {
	PlayerID   int64     `json:"playerId,string" bson:"playerId"`
	PlayerName string    `json:"playerName" bson:"playerName"`
	TeamID     int64     `json:"teamId,string" bson:"teamId"`
	TeamName   string    `json:"teamName" bson:"teamName"`
	Price      float64   `json:"price" bson:"price"`
	SoldAt     time.Time `json:"soldAt" bson:"soldAt"`
}

type ResultParticipant struct {
	UUID               string  `json:"uuid" bson:"uuid"`
	DisplayName        string  `json:"displayName" bson:"displayName"`
	TeamID             int64   `json:"teamId,string" bson:"teamId"`
	TeamName           string  `json:"teamName" bson:"teamName"`
	BudgetUsed         float64 `json:"budgetUsed" bson:"budgetUsed"`
	RemainingBudget    float64 `json:"remainingBudget" bson:"remainingBudget"`
}

type TeamRoster struct {
	TeamID             int64   `json:"teamId,string" bson:"teamId"`
	TeamName           string  `json:"teamName" bson:"teamName"`
	PlayerIds          []int64 `json:"playerIds,string" bson:"playerIds"`
	TotalSpent         float64 `json:"totalSpent" bson:"totalSpent"`
	RemainingBudget    float64 `json:"remainingBudget" bson:"remainingBudget"`
}

// SaveAuctionResults saves the auction result atomically to MongoDB
func SaveAuctionResults(result AuctionResult) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("auction_results")
	_, err := collection.InsertOne(ctx, result)
	return err
}
