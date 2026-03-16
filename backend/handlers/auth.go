package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"cricket-auction/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// Session with timestamp for creation (no expiration based on inactivity)
type SessionInfo struct {
	Token     string
	CreatedAt time.Time
}

// teamSessions stores the current valid session per teamId (in-memory cache)
var (
	teamSessions   = make(map[int64]*SessionInfo)
	teamSessionsMux sync.RWMutex
	
	// adminSessions stores the current valid session per admin username (in-memory cache)
	adminSessions   = make(map[string]*SessionInfo)
	adminSessionsMux sync.RWMutex
)

// Initialize - load sessions from database on startup
func init() {
	// Load sessions from database on startup
	go loadSessionsFromDB()
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

// RegisterAdminSession stores the token for this admin (in memory and database)
func RegisterAdminSession(username string, token string) {
	adminSessionsMux.Lock()
	defer adminSessionsMux.Unlock()
	now := time.Now()
	adminSessions[username] = &SessionInfo{
		Token:     token,
		CreatedAt: now,
	}
	
	// Persist to database
	if config.DB != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("admin_sessions").UpdateOne(
				ctx,
				bson.M{"_id": username},
				bson.M{"$set": bson.M{"token": token, "createdAt": now}},
				options.Update().SetUpsert(true),
			)
		}()
	}
}

// InvalidateAdminSession removes the admin's session (from memory and database)
func InvalidateAdminSession(username string) {
	adminSessionsMux.Lock()
	defer adminSessionsMux.Unlock()
	delete(adminSessions, username)
	
	// Remove from database
	if config.DB != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			config.GetCollection("admin_sessions").DeleteOne(ctx, bson.M{"_id": username})
		}()
	}
}

// ValidateAdminSession returns true if the token is the current valid session for this admin
// Does NOT update LastUsed - sessions don't expire on inactivity
func ValidateAdminSession(username string, token string) bool {
	adminSessionsMux.Lock()
	defer adminSessionsMux.Unlock()
	
	session, exists := adminSessions[username]
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
	
	// Load admin sessions
	cursor, err = config.GetCollection("admin_sessions").Find(ctx, bson.M{})
	if err == nil {
		defer cursor.Close(ctx)
		var sessions []bson.M
		if err := cursor.All(ctx, &sessions); err == nil {
			adminSessionsMux.Lock()
			for _, sess := range sessions {
				if username, ok := sess["_id"].(string); ok {
					if token, ok := sess["token"].(string); ok {
						adminSessions[username] = &SessionInfo{
							Token:     token,
							CreatedAt: sess["createdAt"].(time.Time),
						}
					}
				}
			}
			adminSessionsMux.Unlock()
		}
	}
}

type Admin struct {
	ID           string    `json:"id" bson:"_id,omitempty"`
	Username     string    `json:"username" bson:"username"`
	Password     string    `json:"-" bson:"password"` // Never send to frontend
	Role         string    `json:"role" bson:"role"` // "superadmin" or "admin"
	SessionToken string    `json:"sessionToken,omitempty" bson:"sessionToken,omitempty"`
	CreatedAt    time.Time `json:"createdAt" bson:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt" bson:"updatedAt"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// TeamLoginRequest is the body for team login by code
type TeamLoginRequest struct {
	Code string `json:"code"`
}

type ChangePasswordRequest struct {
	Username    string `json:"username"`
	OldPassword string `json:"oldPassword,omitempty"` // Only for own password
	NewPassword string `json:"newPassword"`
}

func InitializeDefaultAdmin() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("admins")

	// Check if any admin exists
	count, err := collection.CountDocuments(ctx, bson.M{})
	if err != nil || count > 0 {
		return // Admins already exist
	}

	// Create default superadmin
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	
	defaultAdmin := Admin{
		Username:  "superadmin",
		Password:  string(hashedPassword),
		Role:      "superadmin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err = collection.InsertOne(ctx, defaultAdmin)
	if err != nil {
		return
	}

}

// Login authenticates admin and returns session token
func Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("admins")

	// Find admin by username
	var admin Admin
	err := collection.FindOne(ctx, bson.M{"username": req.Username}).Decode(&admin)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate session token
	token := generateSessionToken()
	
	// Update session token in database
	_, err = collection.UpdateOne(
		ctx,
		bson.M{"username": req.Username},
		bson.M{
			"$set": bson.M{
				"sessionToken": token,
				"updatedAt":    time.Now(),
			},
		},
	)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	// Register admin session in memory
	RegisterAdminSession(req.Username, token)

	// Log audit event
	ipAddress := r.RemoteAddr
	LogAuditEvent(req.Username, "LOGIN", "", "", "Admin logged in", ipAddress)

	// Return admin info with token
	response := map[string]interface{}{
		"token":    token,
		"username": admin.Username,
		"role":     admin.Role,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func TeamLogin(w http.ResponseWriter, r *http.Request) {
	var req TeamLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" || len(code) != 5 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid team code", "message": "Team code must be 5 letters"})
		return
	}

	allTeams := GetTeamsStore()
	log.Printf("[TeamLogin] Checking code '%s' against %d teams", code, len(allTeams))
	for _, t := range allTeams {
		log.Printf("[TeamLogin] Team: %s, Code: %s, ID: %d", t.Name, t.Code, t.ID)
		if t.Code == code {
			token := generateSessionToken()
			RegisterTeamSession(t.ID, token)
			log.Printf("[TeamLogin] SUCCESS: Team %s (ID: %d) logged in with code %s", t.Name, t.ID, code)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"token":     token,
				"teamId":    strconv.FormatInt(t.ID, 10), // Convert to string to avoid JS precision loss
				"teamName":  t.Name,
				"shortName": t.ShortName,
			})
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]string{"error": "Invalid team code", "message": "No team found with this code"})
}

// TeamValidateRequest is the body for team session validation (optional; teamId can also be query param)
type TeamValidateRequest struct {
	TeamID int64 `json:"teamId"`
}

// TeamValidate checks if the current team session (token + teamId) is still valid. Returns 401 if admin changed the team code.
func TeamValidate(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	token = strings.TrimPrefix(token, "Bearer ")
	token = strings.TrimSpace(token)
	if token == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	var teamId int64
	if idStr := r.URL.Query().Get("teamId"); idStr != "" {
		var err error
		teamId, err = strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			http.Error(w, "Invalid teamId", http.StatusBadRequest)
			return
		}
	} else if r.Method == "POST" {
		var req TeamValidateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			teamId = req.TeamID
		}
	}
	if teamId == 0 {
		http.Error(w, "teamId required", http.StatusBadRequest)
		return
	}

	if !ValidateTeamSession(teamId, token) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// ChangePassword allows superadmin to change any password, admin to change own
func ChangePassword(w http.ResponseWriter, r *http.Request) {
	// Get session token from header
	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Strip "Bearer " prefix if present
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	// Verify token and get current admin
	currentAdmin, err := getAdminByToken(token)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("admins")

	// Check permissions
	if currentAdmin.Role != "superadmin" {
		// Admin can only change own password
		if req.Username != currentAdmin.Username {
			http.Error(w, "Forbidden: You can only change your own password", http.StatusForbidden)
			return
		}

		// Verify old password
		err = bcrypt.CompareHashAndPassword([]byte(currentAdmin.Password), []byte(req.OldPassword))
		if err != nil {
			http.Error(w, "Invalid old password", http.StatusUnauthorized)
			return
		}
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	// Update password and invalidate session token to force logout
	newToken := generateSessionToken() // Generate new token
	_, err = collection.UpdateOne(
		ctx,
		bson.M{"username": req.Username},
		bson.M{
			"$set": bson.M{
				"password":     string(hashedPassword),
				"sessionToken": newToken, // Invalidate old session
				"updatedAt":    time.Now(),
			},
		},
	)
	if err != nil {
		http.Error(w, "Failed to update password", http.StatusInternalServerError)
		return
	}

	// Invalidate admin session to force logout
	InvalidateAdminSession(req.Username)

	// Log audit event
	ipAddress := r.RemoteAddr
	if req.Username == currentAdmin.Username {
		LogAuditEvent(currentAdmin.Username, "CHANGE_OWN_PASSWORD", req.Username, req.Username, "Changed own password", ipAddress)
	} else {
		LogAuditEvent(currentAdmin.Username, "CHANGE_ADMIN_PASSWORD", req.Username, req.Username, "Changed password for "+req.Username, ipAddress)
	}

	// Return response with flag indicating if user should logout
	shouldLogout := req.Username != currentAdmin.Username // Logout if changing another admin's password
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":      "Password updated successfully",
		"shouldLogout": shouldLogout,
	})
}

// GetAllAdmins returns all admins (superadmin only)
func GetAllAdmins(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	// Strip "Bearer " prefix if present
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	
	currentAdmin, err := getAdminByToken(token)
	if err != nil || currentAdmin.Role != "superadmin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("admins")

	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var admins []Admin
	if err = cursor.All(ctx, &admins); err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(admins)
}

// CreateAdmin creates a new admin (superadmin only)
func CreateAdmin(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	// Strip "Bearer " prefix if present
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	
	currentAdmin, err := getAdminByToken(token)
	if err != nil || currentAdmin.Role != "superadmin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"` // "admin" only, cannot create superadmin
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate role
	if req.Role != "admin" {
		http.Error(w, "Can only create admin role", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("admins")

	// Check if username exists
	count, _ := collection.CountDocuments(ctx, bson.M{"username": req.Username})
	if count > 0 {
		http.Error(w, "Username already exists", http.StatusConflict)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	// Create admin
	newAdmin := Admin{
		Username:  req.Username,
		Password:  string(hashedPassword),
		Role:      req.Role,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err = collection.InsertOne(ctx, newAdmin)
	if err != nil {
		http.Error(w, "Failed to create admin", http.StatusInternalServerError)
		return
	}

	// Log audit event
	ipAddress := r.RemoteAddr
	LogAuditEvent(currentAdmin.Username, "CREATE_ADMIN", req.Username, req.Username, "Created new admin: "+req.Username, ipAddress)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Admin created successfully"})
}

// DeleteAdmin deletes an admin (superadmin only, cannot delete self)
func DeleteAdmin(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	// Strip "Bearer " prefix if present
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	
	currentAdmin, err := getAdminByToken(token)
	if err != nil || currentAdmin.Role != "superadmin" {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Username string `json:"username"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Cannot delete self
	if req.Username == currentAdmin.Username {
		http.Error(w, "Cannot delete yourself", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("admins")

	_, err = collection.DeleteOne(ctx, bson.M{"username": req.Username})
	if err != nil {
		http.Error(w, "Failed to delete admin", http.StatusInternalServerError)
		return
	}

	// Invalidate admin session to force logout
	InvalidateAdminSession(req.Username)

	// Log audit event
	ipAddress := r.RemoteAddr
	LogAuditEvent(currentAdmin.Username, "DELETE_ADMIN", req.Username, req.Username, "Deleted admin: "+req.Username, ipAddress)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Admin deleted successfully"})
}

// Helper functions
func ValidateSession(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Strip "Bearer " prefix if present
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	// Check if token is valid
	_, err := getAdminByToken(token)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "valid"})
}

func getAdminByToken(token string) (*Admin, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("admins")

	var admin Admin
	err := collection.FindOne(ctx, bson.M{"sessionToken": token}).Decode(&admin)
	if err != nil {
		return nil, err
	}

	// Check if session is still valid in memory
	if !ValidateAdminSession(admin.Username, token) {
		return nil, mongo.ErrNoDocuments
	}

	return &admin, nil
}

func generateSessionToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}
