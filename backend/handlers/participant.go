package handlers

import (
	"context"
	"time"

	"cricket-auction/config"
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
