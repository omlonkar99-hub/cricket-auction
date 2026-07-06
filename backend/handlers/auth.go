package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"cricket-auction/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// Session with timestamp for creation (no expiration based on inactivity)
type SessionInfo struct {
	Token     string
	CreatedAt time.Time
}

// Admin struct for superadmin authentication
type Admin struct {
	ID           int64     `json:"id" bson:"_id"`
	Username     string    `json:"username" bson:"username"`
	PasswordHash string    `json:"-" bson:"passwordHash"`
	CreatedAt    time.Time `json:"createdAt" bson:"createdAt"`
}

// AdminSession struct for admin session tracking
type AdminSession struct {
	Token     string    `json:"token" bson:"token"`
	UserID    int64     `json:"userId" bson:"userId"`
	ExpiresAt time.Time `json:"expiresAt" bson:"expiresAt"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
}

// teamSessions stores the current valid session per teamId (in-memory cache)
var (
	teamSessions    = make(map[int64]*SessionInfo)
	teamSessionsMux sync.RWMutex
)

// adminSessions stores active admin sessions (in-memory cache)
var (
	adminSessions    = make(map[string]*AdminSession) // token -> AdminSession
	adminSessionsMux sync.RWMutex
)

// superadminPasswordHash stores the hashed superadmin password (loaded from env on startup)
var superadminPasswordHash string

// superadminUsername stores the superadmin username (loaded from env on startup)
var superadminUsername string

// Initialize - load sessions and superadmin credentials from environment on startup
func init() {
	// Load sessions from database on startup
	go loadSessionsFromDB()
	
	// Load superadmin credentials from environment
	loadSuperadminCredentials()
}

// RegisterTeamSession stores the session for this team (in memory and database)
func RegisterTeamSession(teamId int64, token string) {
	teamSessionsMux.Lock()
	defer teamSessionsMux.Unlock()
	now := time.Now()
	teamSessions[teamId] = &SessionInfo{
		Token:     token,
		CreatedAt: now,
	}
	
	// Persist to database
	if config.DB != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("team_sessions").UpdateOne(
				ctx,
				bson.M{"_id": teamId},
				bson.M{"$set": bson.M{"token": token, "createdAt": now}},
				options.Update().SetUpsert(true),
			)
		}()
	}
}

// InvalidateTeamSession removes the team's session (from memory and database)
func InvalidateTeamSession(teamId int64) {
	teamSessionsMux.Lock()
	defer teamSessionsMux.Unlock()
	delete(teamSessions, teamId)
	
	// Remove from database
	if config.DB != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("team_sessions").DeleteOne(ctx, bson.M{"_id": teamId})
		}()
	}
}

func ValidateTeamSession(teamId int64, token string) bool {
	teamSessionsMux.Lock()
	defer teamSessionsMux.Unlock()
	
	session, exists := teamSessions[teamId]
	if !exists || session.Token != token {
		return false
	}
	
	return true
}

// loadSessionsFromDB loads all sessions from database into memory on startup
func loadSessionsFromDB() {
	if config.DB == nil {
		return
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	// Load team sessions
	cursor, err := config.GetCollection("team_sessions").Find(ctx, bson.M{})
	if err == nil {
		defer cursor.Close(ctx)
		var sessions []bson.M
		if err := cursor.All(ctx, &sessions); err == nil {
			teamSessionsMux.Lock()
			for _, sess := range sessions {
				if teamId, ok := sess["_id"].(int64); ok {
					if token, ok := sess["token"].(string); ok {
						teamSessions[teamId] = &SessionInfo{
							Token:     token,
							CreatedAt: sess["createdAt"].(time.Time),
						}
					}
				}
			}
			teamSessionsMux.Unlock()
		}
	}
}

// generateSessionToken generates a random session token
func generateSessionToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// loadSuperadminCredentials loads superadmin credentials from environment variables
func loadSuperadminCredentials() {
	superadminUsername = os.Getenv("SUPERADMIN_USERNAME")
	if superadminUsername == "" {
		superadminUsername = "superadmin" // Default username
	}

	rawPassword := os.Getenv("SUPERADMIN_PASSWORD")
	if rawPassword == "" {
		log.Println("[WARNING] SUPERADMIN_PASSWORD not set in environment")
		return
	}

	// Hash the password with bcrypt
	hash, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[ERROR] Failed to hash superadmin password: %v", err)
		return
	}

	superadminPasswordHash = string(hash)
	log.Println("[AUTH] Superadmin credentials loaded from environment")
}

// RegisterAdminSession stores the admin session (in memory and database)
func RegisterAdminSession(userID int64, token string) {
	adminSessionsMux.Lock()
	defer adminSessionsMux.Unlock()

	now := time.Now()
	// Admin sessions expire after 24 hours
	expiresAt := now.Add(24 * time.Hour)

	session := &AdminSession{
		Token:     token,
		UserID:    userID,
		ExpiresAt: expiresAt,
		CreatedAt: now,
	}

	adminSessions[token] = session

	// Persist to database
	if config.DB != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("admin_sessions").InsertOne(ctx, session)
		}()
	}
}

// ValidateAdminSession validates an admin session token
func ValidateAdminSession(token string) (int64, bool) {
	adminSessionsMux.RLock()
	defer adminSessionsMux.RUnlock()

	session, exists := adminSessions[token]
	if !exists {
		return 0, false
	}

	// Check if session is expired
	if time.Now().After(session.ExpiresAt) {
		return 0, false
	}

	return session.UserID, true
}

// InvalidateAdminSession removes an admin session
func InvalidateAdminSession(token string) {
	adminSessionsMux.Lock()
	defer adminSessionsMux.Unlock()

	delete(adminSessions, token)

	// Remove from database
	if config.DB != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("admin_sessions").DeleteOne(ctx, bson.M{"token": token})
		}()
	}
}

// AdminLoginRequest represents the login request payload
type AdminLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AdminLoginResponse represents the login response payload
type AdminLoginResponse struct {
	Token   string `json:"token"`
	Message string `json:"message"`
}

// AdminLogin handles superadmin login
func AdminLogin(w http.ResponseWriter, r *http.Request) {
	var req AdminLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate credentials
	if req.Username != superadminUsername {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if superadminPasswordHash == "" {
		http.Error(w, "Admin authentication not configured", http.StatusInternalServerError)
		return
	}

	// Verify password
	err := bcrypt.CompareHashAndPassword([]byte(superadminPasswordHash), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate session token
	token := generateSessionToken()

	// Register the session (hardcoded userID of 1 for superadmin)
	RegisterAdminSession(1, token)

	// Return token
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(AdminLoginResponse{
		Token:   token,
		Message: "Login successful",
	})
}

// AdminLogout handles admin logout
func AdminLogout(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if token == "" {
		http.Error(w, "Missing authorization token", http.StatusBadRequest)
		return
	}

	InvalidateAdminSession(token)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Logout successful"})
}
