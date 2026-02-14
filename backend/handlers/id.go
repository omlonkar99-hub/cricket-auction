package handlers

import (
	"sync"
)

var (
	lastGeneratedID int64 = 0
	idMux           sync.Mutex
)

// InitializeIDCounter sets the ID counter based on existing data
func InitializeIDCounter(maxID int64) {
	idMux.Lock()
	defer idMux.Unlock()
	if maxID > lastGeneratedID {
		lastGeneratedID = maxID
	}
}

// newID returns a unique, monotonically increasing ID starting from 1
func newID() int64 {
	idMux.Lock()
	defer idMux.Unlock()

	lastGeneratedID++
	return lastGeneratedID
}

// GetMaxIDFromData returns the highest ID from teams, players, and auctions
func GetMaxIDFromData() int64 {
	var maxID int64 = 0
	
	// Check teams
	for _, team := range GetTeamsStore() {
		if team.ID > maxID {
			maxID = team.ID
		}
	}
	
	// Check players
	for _, player := range GetPlayersStore() {
		if player.ID > maxID {
			maxID = player.ID
		}
	}
	
	// Check auctions
	for _, auction := range GetAuctionsStore() {
		if auction.ID > maxID {
			maxID = auction.ID
		}
	}
	
	return maxID
}
