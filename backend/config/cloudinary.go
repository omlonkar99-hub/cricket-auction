package config

import (
	"context"
	"log"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

var CloudinaryClient *cloudinary.Cloudinary

// InitCloudinary initializes Cloudinary client
func InitCloudinary() {
	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")

	if cloudName == "" || apiKey == "" || apiSecret == "" {
		return
	}

	cld, err := cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		log.Fatal("Failed to initialize Cloudinary:", err)
	}

	CloudinaryClient = cld
}

// UploadImage uploads an image to Cloudinary
// Accepts: jpg, png, webp, gif, svg
// Returns: optimized URL
func UploadImage(ctx context.Context, file interface{}, folder string) (string, error) {
	if CloudinaryClient == nil {
		return "", nil // Cloudinary not configured
	}

	uniqueFilename := true
	overwrite := false
	
	uploadParams := uploader.UploadParams{
		Folder:           folder,
		ResourceType:     "image",
		Transformation:   "c_limit,w_1200,h_1200,q_auto:good,f_auto", // Max 1200x1200 for high quality
		UniqueFilename:   &uniqueFilename,
		Overwrite:        &overwrite,
	}

	result, err := CloudinaryClient.Upload.Upload(ctx, file, uploadParams)
	if err != nil {
		return "", err
	}

	// Return secure URL (HTTPS)
	return result.SecureURL, nil
}

// GetOptimizedImageURL returns a Cloudinary URL with specific transformations
// Use this to get different sizes for different contexts
func GetOptimizedImageURL(baseURL string, width int, height int) string {
	// This is a helper function - you can use Cloudinary's URL transformation
	// Example: https://res.cloudinary.com/demo/image/upload/w_200,h_200,c_fill,q_auto,f_auto/sample.jpg
	// For now, return the base URL (transformations already applied on upload)
	return baseURL
}

// DeleteImage deletes an image from Cloudinary
func DeleteImage(ctx context.Context, publicID string) error {
	if CloudinaryClient == nil {
		return nil
	}

	_, err := CloudinaryClient.Upload.Destroy(ctx, uploader.DestroyParams{
		PublicID: publicID,
	})

	return err
}
