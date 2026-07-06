package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"cricket-auction/config"
	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
)

// Helper to get participants for an auction
func GetParticipantsByAuctionID(auctionID int64) []Participant {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("participants")
	cursor, err := collection.Find(ctx, bson.M{"auctionId": auctionID})
	if err != nil {
		return []Participant{}
	}
	defer cursor.Close(ctx)

	var participants []Participant
	cursor.All(ctx, &participants)
	return participants
}

// Helper to check if UUID already in auction
func IsParticipantInAuction(auctionID int64, uuid string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("participants")
	count, err := collection.CountDocuments(ctx, bson.M{
		"auctionId": auctionID,
		"uuid":      uuid,
	})

	return count > 0 && err == nil
}

// Helper to get participant by UUID and auctionID
func GetParticipant(auctionID int64, uuid string) *Participant {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("participants")
	var participant Participant
	err := collection.FindOne(ctx, bson.M{
		"auctionId": auctionID,
		"uuid":      uuid,
	}).Decode(&participant)

	if err != nil {
		return nil
	}
	return &participant
}

// GetParticipantStatus returns 200 if user is participant, 404 otherwise
func GetParticipantStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	
	vars := mux.Vars(r)
	auctionIDStr := vars["id"]
	uuid := vars["uuid"]
	
	if auctionIDStr == "" || uuid == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing auction ID or UUID"})
		return
	}
	
	// Parse auction ID
	auctionID, err := strconv.ParseInt(auctionIDStr, 10, 64)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid auction ID"})
		return
	}
	
	// Check if participant exists
	participant := GetParticipant(auctionID, uuid)
	if participant == nil || participant.Status == "removed" {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Participant not found"})
		return
	}
	
	// Return participant info
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(participant)
}
