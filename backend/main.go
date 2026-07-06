package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"cricket-auction/config"
	"cricket-auction/handlers"
)

func main() {
	// Load .env file
	godotenv.Load()

	// Initialize MongoDB Atlas
	config.ConnectMongoDB()

	// Load teams and players from DB into memory
	handlers.LoadTeamsFromDB()
	handlers.LoadPlayersFromDB()
	handlers.LoadAuctionsFromDB()

	// Initialize ID counter based on existing data
	maxID := handlers.GetMaxIDFromData()
	handlers.InitializeIDCounter(maxID)

	// Initialize Cloudinary
	config.InitCloudinary()
	
	// Start automatic cleanup (runs daily)
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		
		// Run cleanup immediately on startup
		handlers.CleanupOldDraftAuctions()
		
		for range ticker.C {
			handlers.CleanupOldDraftAuctions()
		}
	}()
	
	r := mux.NewRouter()

	// Enable CORS for all routes
	r.Use(corsMiddleware)
	
	// Add panic recovery middleware
	r.Use(panicRecoveryMiddleware)

	// Define public routes (accessible without UUID)
	publicRoutes := map[string]bool{
		"GET /api/auctions":   true,
		"GET /api/teams":      true,
		"GET /api/players":    true,
		"GET /health":         true,
		"OPTIONS /api":        true,
		"OPTIONS /":           true,
	}

	// Apply UUID middleware (checks X-Device-UUID header for protected routes)
	r.Use(uuidMiddleware(publicRoutes))
	
	// Handle OPTIONS requests for all routes
	r.Methods("OPTIONS").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// CORS headers are already set by middleware
		w.WriteHeader(http.StatusOK)
	})

	// API Routes
	api := r.PathPrefix("/api").Subrouter()
	
	// Handle OPTIONS for all API routes
	api.Methods("OPTIONS").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// CORS headers are already set by middleware
		w.WriteHeader(http.StatusOK)
	})
	
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
	
	// Auction management routes
	api.HandleFunc("/auctions", handlers.CreateAuctionNoAuth).Methods("POST")
	api.HandleFunc("/auctions", handlers.GetAuctions).Methods("GET")
	api.HandleFunc("/auctions/{id}", handlers.GetAuctionByID).Methods("GET")
	api.HandleFunc("/auctions/{id}", handlers.UpdateAuction).Methods("PUT")
	api.HandleFunc("/auctions/{id}", handlers.DeleteAuction).Methods("DELETE")
	api.HandleFunc("/auctions/{id}/status", handlers.GetAuctionStatus).Methods("GET")
	api.HandleFunc("/auctions/{id}/results", handlers.GetAuctionResults).Methods("GET")
	api.HandleFunc("/auctions/{id}/start", handlers.StartAuction).Methods("POST")
	api.HandleFunc("/auctions/{id}/presence", handlers.UpdateAuctionPresenceHandler).Methods("POST")
	api.HandleFunc("/auctions/{id}/presence", handlers.GetAuctionPresenceHandler).Methods("GET")
	api.HandleFunc("/auctions/{id}/join", handlers.JoinAuction).Methods("POST")
	api.HandleFunc("/auctions/{id}/remove-user", handlers.RemoveParticipant).Methods("POST")
	api.HandleFunc("/auctions/{id}/assign-team", handlers.AssignTeam).Methods("POST")
	
	// Post-auction actions
	api.HandleFunc("/auctions/{id}/duplicate", handlers.DuplicateAuction).Methods("POST")
	
	// WebSocket for live auction
	api.HandleFunc("/auctions/{id}/ws", handlers.HandleWebSocket)
	api.HandleFunc("/auctions/{id}/state", handlers.GetAuctionState).Methods("GET")
	
	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}).Methods("GET")

	// ========== ADMIN ROUTES ==========
	// Admin login (public endpoint, no auth required)
	r.HandleFunc("/admin/login", handlers.AdminLogin).Methods("POST")
	r.HandleFunc("/admin/logout", handlers.AdminLogout).Methods("POST")

	// Admin API routes (protected with auth middleware)
	admin := r.PathPrefix("/admin/api").Subrouter()
	admin.Use(adminAuthMiddleware)

	// Admin Teams Management
	admin.HandleFunc("/teams", handlers.GetTeams).Methods("GET")
	admin.HandleFunc("/teams", handlers.CreateTeam).Methods("POST")
	admin.HandleFunc("/teams/{id}", handlers.UpdateTeam).Methods("PUT")
	admin.HandleFunc("/teams/{id}", handlers.DeleteTeam).Methods("DELETE")

	// Admin Players Management
	admin.HandleFunc("/players", handlers.GetPlayers).Methods("GET")
	admin.HandleFunc("/players", handlers.CreatePlayer).Methods("POST")
	admin.HandleFunc("/players/{id}", handlers.UpdatePlayer).Methods("PUT")
	admin.HandleFunc("/players/{id}", handlers.DeletePlayer).Methods("DELETE")

	// Get port from environment variable (Render sets this automatically)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default for local development
	}

	// Create HTTP server with proper timeouts for long-running auctions
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadTimeout:       15 * time.Second,  // Time to read request
		WriteTimeout:      0,                  // No write timeout for WebSocket streaming
		IdleTimeout:       120 * time.Second, // Keep-alive for idle connections
		ReadHeaderTimeout: 10 * time.Second,  // Time to read headers
		MaxHeaderBytes:    1 << 20,           // 1 MB max header size
	}

	log.Printf("[SERVER] Backend server starting on port %s", port)
	log.Printf("[SERVER] Configured for long-running WebSocket connections")
	log.Fatal(srv.ListenAndServe())
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		
		// Set CORS headers for all requests
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-UUID")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		
		// Allow your specific domains
		if origin == "https://cricketive-auction.onrender.com" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else if origin == "http://localhost:3000" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else if strings.HasSuffix(origin, ".onrender.com") {
			// Allow any Render deployment
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func panicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC RECOVERY] Recovered from panic: %v", err)
				log.Printf("[PANIC RECOVERY] Request: %s %s", r.Method, r.URL.Path)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// uuidMiddleware extracts X-Device-UUID header from requests
// For protected routes: returns 400 if UUID header is missing
// For public routes: UUID is optional
func uuidMiddleware(publicRoutes map[string]bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uuid := r.Header.Get("X-Device-UUID")
			path := r.URL.Path
			method := r.Method

			// Check if this is a public route (method + path combination)
			routeKey := method + " " + path
			isPublic := publicRoutes[routeKey]

			// Check for pattern-based public routes
			if !isPublic && (strings.HasPrefix(path, "/api/auctions") && method == "GET") {
				isPublic = true // GET /api/auctions is public
			}
			if !isPublic && (strings.HasPrefix(path, "/api/teams") && method == "GET") {
				isPublic = true // GET /api/teams is public
			}

			// For protected routes, UUID is required
			if !isPublic && uuid == "" {
				http.Error(w, "Missing X-Device-UUID header", http.StatusBadRequest)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// adminAuthMiddleware validates admin session tokens
func adminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}

		// Token format: "Bearer <token>"
		const bearerSchema = "Bearer "
		if len(authHeader) < len(bearerSchema) || authHeader[:len(bearerSchema)] != bearerSchema {
			http.Error(w, "Invalid authorization format", http.StatusUnauthorized)
			return
		}

		token := authHeader[len(bearerSchema):]

		// Validate token
		_, valid := handlers.ValidateAdminSession(token)
		if !valid {
			http.Error(w, "Invalid or expired session token", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}
