package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"cricket-auction/config"
)

// UploadImage handles image uploads to Cloudinary
func UploadImage(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (max 2MB)
	err := r.ParseMultipartForm(2 << 20) // 2MB = 2 * 1024 * 1024 bytes
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "File too large (max 2MB)"})
		return
	}

	// Get file from form
	file, header, err := r.FormFile("image")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Get folder from form (teams, players, etc.)
	folder := r.FormValue("folder")
	if folder == "" {
		folder = "auction" // Default folder
	}

	if config.CloudinaryClient == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"error": "Image upload not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend .env"})
		return
	}

	// Upload to Cloudinary with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Pass the file reader directly to Cloudinary
	imageURL, err := config.UploadImage(ctx, file, folder)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to upload image: " + err.Error()})
		return
	}
	if imageURL == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Upload succeeded but no URL returned"})
		return
	}

	// Return URL
	response := map[string]string{
		"url":      imageURL,
		"filename": header.Filename,
		"folder":   folder,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
