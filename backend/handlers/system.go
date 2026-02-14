package handlers

import (
	"encoding/json"
	"net/http"
	"runtime"
	"time"
	
	"cricket-auction/config"
)

var serverStartTime = time.Now()

type SystemHealth struct {
	Status          string  `json:"status"`
	Uptime          string  `json:"uptime"`
	UptimeSeconds   int64   `json:"uptimeSeconds"`
	ActiveAuctions  int     `json:"activeAuctions"`
	TotalAuctions   int     `json:"totalAuctions"`
	TotalTeams      int     `json:"totalTeams"`
	TotalPlayers    int     `json:"totalPlayers"`
	MemoryUsageMB   uint64  `json:"memoryUsageMB"`
	GoRoutines      int     `json:"goRoutines"`
	DatabaseStatus  string  `json:"databaseStatus"`
	CloudinaryStatus string `json:"cloudinaryStatus"`
}

func GetSystemHealth(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(serverStartTime)
	uptimeStr := formatUptime(uptime)

	// Count active auctions
	activeCount := 0
	for _, auction := range auctions {
		if auction.IsLive {
			activeCount++
		}
	}

	// Memory stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	health := SystemHealth{
		Status:           "healthy",
		Uptime:           uptimeStr,
		UptimeSeconds:    int64(uptime.Seconds()),
		ActiveAuctions:   activeCount,
		TotalAuctions:    len(auctions),
		TotalTeams:       len(teams),
		TotalPlayers:     len(players),
		MemoryUsageMB:    m.Alloc / 1024 / 1024,
		GoRoutines:       runtime.NumGoroutine(),
		DatabaseStatus:   getDatabaseStatus(),
		CloudinaryStatus: getCloudinaryStatus(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func formatUptime(d time.Duration) string {
	days := int(d.Hours() / 24)
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		return formatDuration(days, "day", hours, "hour")
	}
	if hours > 0 {
		return formatDuration(hours, "hour", minutes, "min")
	}
	return formatDuration(minutes, "min", int(d.Seconds())%60, "sec")
}

func formatDuration(val1 int, unit1 string, val2 int, unit2 string) string {
	if val1 > 1 {
		unit1 += "s"
	}
	if val2 > 1 {
		unit2 += "s"
	}
	return formatInt(val1) + " " + unit1 + " " + formatInt(val2) + " " + unit2
}

func formatInt(n int) string {
	if n < 10 {
		return "0" + string(rune('0'+n))
	}
	return string(rune('0'+n/10)) + string(rune('0'+n%10))
}

func getDatabaseStatus() string {
	// Check if DB is connected
	if config.DB != nil {
		return "connected"
	}
	return "disconnected"
}

func getCloudinaryStatus() string {
	// Check if Cloudinary is configured
	if config.CloudinaryClient != nil {
		return "configured"
	}
	return "not configured"
}
