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

func UploadImage(ctx context.Context, file interface{}, folder string) (string, error) {
	if CloudinaryClient == nil {
		return "", nil 
	}

	uniqueFilename := true
	overwrite := false
	
	uploadParams := uploader.UploadParams{
		Folder:           folder,
		ResourceType:     "image",
		Transformation:   "c_limit,w_1200,h_1200,q_auto:good,f_auto", // 
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

func GetOptimizedImageURL(baseURL string, width int, height int) string {

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
