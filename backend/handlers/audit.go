package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"cricket-auction/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type AuditLog struct {
	ID          string    `json:"id" bson:"_id,omitempty"`
	AdminUser   string    `json:"adminUser" bson:"adminUser"`
	Action      string    `json:"action" bson:"action"`
	Target      string    `json:"target,omitempty" bson:"target,omitempty"`
	TargetName  string    `json:"targetName,omitempty" bson:"targetName,omitempty"`
	IndianTime  string    `json:"indianTime" bson:"indianTime"`
	// Removed Details and IPAddress to make it lightweight
	// Removed Timestamp as we have IndianTime
}

// LogAuditEvent creates an audit log entry with Indian time (lightweight)
func LogAuditEvent(adminUser, action, target, targetName, details, ipAddress string) {
	// Skip login/logout events - only log meaningful actions
	skipActions := []string{"LOGIN", "LOGOUT", "CHANGE_OWN_PASSWORD"}
	for _, skipAction := range skipActions {
		if action == skipAction {
			return
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := config.GetCollection("audit_logs")

	// Convert to Indian Standard Time (IST)
	ist, _ := time.LoadLocation("Asia/Kolkata")
	now := time.Now()
	istTime := now.In(ist)

	log := AuditLog{
		AdminUser:  adminUser,
		Action:     action,
		Target:     target,
		TargetName: targetName,
		IndianTime: istTime.Format("2006-01-02 15:04:05 IST"),
		// Removed Details and IPAddress to keep it lightweight
	}

	collection.InsertOne(ctx, log)
}

// GetAuditLogs returns audit logs (superadmin only)
func GetAuditLogs(w http.ResponseWriter, r *http.Request) {
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("audit_logs")

	// Get query parameters for filtering
	adminUser := r.URL.Query().Get("adminUser")
	action := r.URL.Query().Get("action")
	limit := 100 // Default limit

	// Build filter
	filter := bson.M{}
	if adminUser != "" {
		filter["adminUser"] = adminUser
	}
	if action != "" {
		filter["action"] = action
	}

	// Sort by timestamp descending (newest first)
	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}}).SetLimit(int64(limit))

	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var logs []AuditLog
	if err = cursor.All(ctx, &logs); err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	if logs == nil {
		logs = []AuditLog{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}

// GetAuditStats returns audit statistics (superadmin only)
func GetAuditStats(w http.ResponseWriter, r *http.Request) {
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("audit_logs")

	// Get total count
	totalCount, _ := collection.CountDocuments(ctx, bson.M{})

	// Get count by action type
	pipeline := []bson.M{
		{"$group": bson.M{
			"_id":   "$action",
			"count": bson.M{"$sum": 1},
		}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var actionCounts []bson.M
	if err = cursor.All(ctx, &actionCounts); err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	stats := map[string]interface{}{
		"totalLogs":    totalCount,
		"actionCounts": actionCounts,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// DeleteAuditLogs deletes all audit logs (superadmin only)
func DeleteAuditLogs(w http.ResponseWriter, r *http.Request) {
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

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("audit_logs")

	// Delete all audit logs
	result, err := collection.DeleteMany(ctx, bson.M{})
	if err != nil {
		http.Error(w, "Failed to delete audit logs", http.StatusInternalServerError)
		return
	}

	// Log this action
	ipAddress := r.RemoteAddr
	LogAuditEvent(currentAdmin.Username, "DELETE_ALL_AUDITS", "", "", "Deleted all audit logs", ipAddress)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "All audit logs deleted successfully",
		"deleted": result.DeletedCount,
	})
}

// CleanupOldAuditLogs removes audit logs older than 30 days (automatic cleanup)
func CleanupOldAuditLogs() {
	if config.DB == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := config.GetCollection("audit_logs")

	// Delete logs older than 30 days based on IndianTime string
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	// Use regex to match dates older than 30 days ago
	filter := bson.M{
		"indianTime": bson.M{"$regex": "^(19|20)[0-9][0-9]-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])"},
		"$expr": bson.M{
			"$lt": []interface{}{
				bson.M{"$dateFromString": bson.M{
					"dateString": bson.M{"$substr": []interface{}{"$indianTime", 0, 10}},
					"format":     "%Y-%m-%d",
				}},
				thirtyDaysAgo,
			},
		},
	}

	collection.DeleteMany(ctx, filter)
	// Silent cleanup - automatic cleanup performed
}
