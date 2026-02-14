package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"cricket-auction/config"
	"cricket-auction/handlers"
)

type Player struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Role     string  `json:"role"`
	BasePrice float64 `json:"basePrice"`
	ImageURL string  `json:"imageUrl"`
}

type Bid struct {
	PlayerID string  `json:"playerId"`
	TeamName string  `json:"teamName"`
	Amount   float64 `json:"amount"`
	Time     string  `json:"time"`
}

func main() {
	// Load .env file
	godotenv.Load()

	// Initialize MongoDB Atlas
	config.ConnectMongoDB()

	// Load teams and players from DB into memory
	handlers.LoadTeamsFromDB()
	handlers.LoadPlayersFromDB()
	handlers.LoadAuctionsFromDB()
	handlers.LoadRetentionAuctionsFromDB()
	handlers.LoadTradesFromDB()

	// Initialize ID counter based on existing data
	maxID := handlers.GetMaxIDFromData()
	handlers.InitializeIDCounter(maxID)

	// Initialize Cloudinary
	config.InitCloudinary()

	// Initialize default superadmin
	handlers.InitializeDefaultAdmin()
	
	// Start automatic cleanup (runs daily)
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		
		// Run cleanup immediately on startup
		handlers.CleanupOldAuditLogs()
		handlers.CleanupOldDraftAuctions()
		
		for range ticker.C {
			handlers.CleanupOldAuditLogs()
			handlers.CleanupOldDraftAuctions()
		}
	}()
	
	r := mux.NewRouter()

	// Enable CORS
	r.Use(corsMiddleware)

	// API Routes
	api := r.PathPrefix("/api").Subrouter()
	
	// Teams
	api.HandleFunc("/teams", handlers.GetTeams).Methods("GET")
	api.HandleFunc("/teams", handlers.CreateTeam).Methods("POST")
	api.HandleFunc("/teams/{id}", handlers.UpdateTeam).Methods("PUT")
	api.HandleFunc("/teams/{id}", handlers.DeleteTeam).Methods("DELETE")
	api.HandleFunc("/teams/regenerate-code", handlers.RegenerateTeamCode).Methods("POST")
	
	// Players
	api.HandleFunc("/players", handlers.GetPlayers).Methods("GET")
	api.HandleFunc("/players", handlers.CreatePlayer).Methods("POST")
	api.HandleFunc("/players/{id}", handlers.UpdatePlayer).Methods("PUT")
	api.HandleFunc("/players/{id}", handlers.DeletePlayer).Methods("DELETE")
	
	// Auction Health
	api.HandleFunc("/auction/health", handlers.GetAuctionHealth).Methods("GET")
	
	// Legacy endpoints
	api.HandleFunc("/players", getPlayers).Methods("GET")
	api.HandleFunc("/players/{id}", getPlayer).Methods("GET")
	api.HandleFunc("/bids", placeBid).Methods("POST")
	api.HandleFunc("/bids/{playerId}", getBids).Methods("GET")
	
	// Auction management routes
	api.HandleFunc("/auctions", handlers.CreateAuction).Methods("POST")
	api.HandleFunc("/auctions", handlers.GetAuctions).Methods("GET")
	api.HandleFunc("/auctions/{id}", handlers.GetAuctionByID).Methods("GET")
	api.HandleFunc("/auctions/{id}", handlers.UpdateAuction).Methods("PUT")
	api.HandleFunc("/auctions/{id}", handlers.DeleteAuction).Methods("DELETE")
	api.HandleFunc("/auctions/{id}/status", handlers.GetAuctionStatus).Methods("GET")
	api.HandleFunc("/auctions/{id}/results", handlers.GetAuctionResults).Methods("GET")
	api.HandleFunc("/auctions/{id}/start", handlers.StartAuction).Methods("POST")
	api.HandleFunc("/auctions/{id}/presence", handlers.UpdateAuctionPresenceHandler).Methods("POST")
	api.HandleFunc("/auctions/{id}/presence", handlers.GetAuctionPresenceHandler).Methods("GET")
	
	// Post-auction actions
	api.HandleFunc("/auctions/duplicate", handlers.DuplicateAuction).Methods("POST")
	api.HandleFunc("/auctions/retention", handlers.CreateRetentionPhase).Methods("POST")
	api.HandleFunc("/auctions/trade-window", handlers.CreateTradeWindow).Methods("POST")
	
	// Retention Auction routes
	api.HandleFunc("/retention-auctions", handlers.CreateRetentionAuction).Methods("POST")
	api.HandleFunc("/retention-auctions", handlers.GetRetentionAuctions).Methods("GET")
	api.HandleFunc("/retention-auctions/{id}", handlers.GetRetentionAuctionByID).Methods("GET")
	api.HandleFunc("/retention-auctions/{id}", handlers.DeleteRetentionAuction).Methods("DELETE")
	api.HandleFunc("/retention-auctions/{id}/start", handlers.StartRetentionWindow).Methods("POST")
	api.HandleFunc("/retention-auctions/{id}/close", handlers.CloseRetentionWindow).Methods("POST")
	api.HandleFunc("/retention-auctions/{id}/team/{teamId}/players", handlers.GetTeamAssignedPlayers).Methods("GET")
	api.HandleFunc("/retention-auctions/{id}/retentions", handlers.GetTeamRetentions).Methods("GET")
	api.HandleFunc("/retention-auctions/{id}/review", handlers.GetRetentionReview).Methods("GET")
	api.HandleFunc("/retention-auctions/{id}/start-auction", handlers.StartLiveAuctionFromRetention).Methods("POST")
	api.HandleFunc("/retention-auctions/{id}/presence", handlers.UpdateRetentionPresenceHandler).Methods("POST")
	api.HandleFunc("/retention-auctions/{id}/presence", handlers.GetRetentionPresenceHandler).Methods("GET")
	api.HandleFunc("/retention-auctions/submit", handlers.SubmitTeamRetention).Methods("POST")
	
	// Trade routes
	api.HandleFunc("/auctions/trade", handlers.CreateTradeRequest).Methods("POST")
	api.HandleFunc("/auctions/{id}/trades", handlers.GetAuctionTrades).Methods("GET")
	api.HandleFunc("/auctions/trade/{tradeId}/accept", handlers.AcceptTradeRequest).Methods("POST")
	api.HandleFunc("/auctions/trade/{tradeId}/reject", handlers.RejectTradeRequest).Methods("POST")
	api.HandleFunc("/auctions/trade/{tradeId}/cancel", handlers.CancelTradeRequest).Methods("POST")
	api.HandleFunc("/auctions/{id}/trade-window", handlers.GetTradeWindow).Methods("GET")
	api.HandleFunc("/auctions/{id}/trade-window/start", handlers.StartTradeWindow).Methods("POST")
	api.HandleFunc("/auctions/{id}/trade-window/end", handlers.EndTradeWindow).Methods("POST")
	
	// WebSocket for live auction
	api.HandleFunc("/auctions/{id}/ws", handlers.HandleWebSocket)
	api.HandleFunc("/auctions/{id}/state", handlers.GetAuctionState).Methods("GET")
	
	// Image upload
	api.HandleFunc("/upload", handlers.UploadImage).Methods("POST")
	
	// Authentication
	api.HandleFunc("/auth/login", handlers.Login).Methods("POST")
	api.HandleFunc("/auth/team-login", handlers.TeamLogin).Methods("POST")
	api.HandleFunc("/auth/team-validate", handlers.TeamValidate).Methods("GET", "POST")
	api.HandleFunc("/auth/validate", handlers.ValidateSession).Methods("GET")
	api.HandleFunc("/auth/change-password", handlers.ChangePassword).Methods("POST")
	api.HandleFunc("/auth/admins", handlers.GetAllAdmins).Methods("GET")
	api.HandleFunc("/auth/admins", handlers.CreateAdmin).Methods("POST")
	api.HandleFunc("/auth/admins", handlers.DeleteAdmin).Methods("DELETE")
	
	// Audit logs (superadmin only)
	api.HandleFunc("/audit/logs", handlers.GetAuditLogs).Methods("GET")
	api.HandleFunc("/audit/logs", handlers.DeleteAuditLogs).Methods("DELETE")
	api.HandleFunc("/audit/stats", handlers.GetAuditStats).Methods("GET")

	// Health check for UptimeRobot
	r.HandleFunc("/health", handlers.HealthCheck).Methods("GET")
	api.HandleFunc("/health", handlers.HealthCheck).Methods("GET")
	
	// System health
	api.HandleFunc("/system/health", handlers.GetSystemHealth).Methods("GET")

	// Get port from environment variable (Render sets this automatically)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default for local development
	}

	log.Printf("[SERVER] Backend server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow your actual frontend URL and localhost
		origin := r.Header.Get("Origin")
		allowedOrigins := []string{
			"http://localhost:3000",
			"https://cricketive.vercel.app", // Your actual Vercel frontend
		}
		
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func getPlayers(w http.ResponseWriter, r *http.Request) {
	players := []Player{
		{ID: "1", Name: "Shreyas Iyer", Role: "Batsman", BasePrice: 12.25, ImageURL: ""},
		{ID: "2", Name: "Virat Kohli", Role: "Batsman", BasePrice: 15.00, ImageURL: ""},
		{ID: "3", Name: "Jasprit Bumrah", Role: "Bowler", BasePrice: 14.00, ImageURL: ""},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(players)
}

func getPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playerID := vars["id"]

	player := Player{
		ID:       playerID,
		Name:     "Shreyas Iyer",
		Role:     "Batsman",
		BasePrice: 12.25,
		ImageURL: "",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(player)
}

func placeBid(w http.ResponseWriter, r *http.Request) {
	var bid Bid
	if err := json.NewDecoder(r.Body).Decode(&bid); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Bid placed"})
}

func getBids(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playerID := vars["playerId"]

	bids := []Bid{
		{PlayerID: playerID, TeamName: "Team A", Amount: 12.75, Time: "10:30:45"},
		{PlayerID: playerID, TeamName: "Team B", Amount: 13.00, Time: "10:31:12"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bids)
}
