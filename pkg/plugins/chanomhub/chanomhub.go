package chanomhub

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	DefaultAPIBase    = "https://api.chanomhub.com"
	DefaultStorageURL = "https://oi.chanomhub.com"
)

// Client handles interaction with the Chanomhub platform
type Client struct {
	APIBase    string
	StorageURL string
	Token      string
	HTTPClient *http.Client
}

// Config stores persistent settings
type Config struct {
	APIBase         string `json:"api_base"`
	StorageURL      string `json:"storage_url"`
	Token           string `json:"token"`
	DefaultLanguage string `json:"default_language"`
	LastSlug        string `json:"last_slug"`
}

// NewClient creates a new Chanomhub client
func NewClient(apiBase, storageURL, token string) *Client {
	if apiBase == "" {
		apiBase = DefaultAPIBase
	}
	if storageURL == "" {
		storageURL = DefaultStorageURL
	}
	return &Client{
		APIBase:    strings.TrimRight(apiBase, "/"),
		StorageURL: strings.TrimRight(storageURL, "/"),
		Token:      token,
		HTTPClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// PublishRequest holds parameters for publishing a translation mod
type PublishRequest struct {
	Workspace   string                 `json:"workspace,omitempty"`
	PatchFile   string                 `json:"patch_file,omitempty"`
	GameDir     string                 `json:"game_dir,omitempty"`
	Slug        string                 `json:"slug"`
	Language    string                 `json:"language"`
	Engine      string                 `json:"engine"`
	CreditTo    string                 `json:"credit_to"`
	GameVersion string                 `json:"game_version,omitempty"`
	Config      map[string]interface{} `json:"config,omitempty"`
}

// PublishResult contains response details from Chanomhub
type PublishResult struct {
	Success      bool   `json:"success"`
	DownloadURL  string `json:"download_url"`
	FileSizeBytes int64  `json:"file_size_bytes"`
	Message      string `json:"message"`
}

// ZipDirectory compresses a directory into a zip archive
func ZipDirectory(srcDir, outZipPath string) (int64, error) {
	if fi, err := os.Stat(srcDir); err != nil || !fi.IsDir() {
		return 0, fmt.Errorf("source directory does not exist: %s", srcDir)
	}

	if err := os.MkdirAll(filepath.Dir(outZipPath), 0755); err != nil {
		return 0, err
	}

	zipFile, err := os.Create(outZipPath)
	if err != nil {
		return 0, fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()

	archive := zip.NewWriter(zipFile)
	defer archive.Close()

	err = filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		// Use forward slashes for zip compatibility
		relPath = filepath.ToSlash(relPath)

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = relPath
		header.Method = zip.Deflate

		writer, err := archive.CreateHeader(header)
		if err != nil {
			return err
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(writer, file)
		return err
	})

	if err != nil {
		return 0, fmt.Errorf("error during archiving: %w", err)
	}

	_ = archive.Close()
	_ = zipFile.Close()

	stat, err := os.Stat(outZipPath)
	if err != nil {
		return 0, err
	}
	return stat.Size(), nil
}

// PublishTranslation zips the nst_translations directory, uploads to storage, and submits mod metadata
func (c *Client) PublishTranslation(ctx context.Context, req PublishRequest) (*PublishResult, error) {
	if c.Token == "" {
		return nil, fmt.Errorf("chanomhub API token is required")
	}
	if req.Slug == "" {
		return nil, fmt.Errorf("article slug is required")
	}
	if req.Language == "" {
		req.Language = "Thai"
	}
	if req.Engine == "" {
		req.Engine = "rpgm"
	}
	if req.CreditTo == "" {
		req.CreditTo = "NST"
	}

	var uploadFilePath string
	var uploadFileName string
	var fileSize int64
	var isTempFile bool

	if req.PatchFile != "" {
		fi, err := os.Stat(req.PatchFile)
		if err != nil {
			return nil, fmt.Errorf("patch file does not exist: %s", req.PatchFile)
		}
		uploadFilePath = req.PatchFile
		uploadFileName = filepath.Base(req.PatchFile)
		fileSize = fi.Size()
	} else {
		// 1. Locate legacy translations directory
		transDir := filepath.Join(req.GameDir, "nst_translations")
		if fi, err := os.Stat(transDir); err != nil || !fi.IsDir() {
			// Fallback: check if gameDir itself has config.json or translations
			if _, err := os.Stat(filepath.Join(req.GameDir, "config.json")); err == nil {
				transDir = req.GameDir
			} else {
				return nil, fmt.Errorf("no patch file specified and no 'nst_translations' directory found in %s", req.GameDir)
			}
		}

		// 2. Compress into temporary zip
		tempZip := filepath.Join(os.TempDir(), fmt.Sprintf("nst_pack_%d.zip", time.Now().UnixMilli()))
		isTempFile = true
		uploadFilePath = tempZip
		uploadFileName = filepath.Base(tempZip)

		sz, err := ZipDirectory(transDir, tempZip)
		if err != nil {
			return nil, fmt.Errorf("failed to pack translations: %w", err)
		}
		fileSize = sz
	}

	if isTempFile {
		defer os.Remove(uploadFilePath)
	}

	// 3. Upload archive to storage service (GOR2-compatible POST /upload?bucket=storage&game=<slug>)
	fileBytes, err := os.ReadFile(uploadFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read upload file: %w", err)
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", uploadFileName)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}
	if _, err := part.Write(fileBytes); err != nil {
		return nil, fmt.Errorf("failed to write multipart data: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	uploadURL := fmt.Sprintf("%s/upload?bucket=storage&game=%s", c.StorageURL, req.Slug)
	uploadReq, err := http.NewRequestWithContext(ctx, "POST", uploadURL, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create upload request: %w", err)
	}
	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadReq.Header.Set("Authorization", "Bearer "+c.Token)

	uploadResp, err := c.HTTPClient.Do(uploadReq)
	if err != nil {
		return nil, fmt.Errorf("upload HTTP request failed: %w", err)
	}
	defer uploadResp.Body.Close()

	uploadRespBody, _ := io.ReadAll(uploadResp.Body)
	if uploadResp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("upload failed (HTTP %d): %s", uploadResp.StatusCode, string(uploadRespBody))
	}

	var uploadJSON map[string]interface{}
	if err := json.Unmarshal(uploadRespBody, &uploadJSON); err != nil {
		return nil, fmt.Errorf("invalid upload response JSON: %w", err)
	}

	var fileKey string
	if key, ok := uploadJSON["key"].(string); ok && key != "" {
		fileKey = key
	} else if fn, ok := uploadJSON["filename"].(string); ok {
		fileKey = fn
	}
	downloadURL := fmt.Sprintf("%s/%s", c.StorageURL, fileKey)
	if u, ok := uploadJSON["url"].(string); ok && u != "" {
		downloadURL = u
	}

	// 4. Register as pending TRANSLATION mod
	submitPayload := map[string]interface{}{
		"downloadLink":  downloadURL,
		"language":      req.Language,
		"engine":        req.Engine,
		"creditTo":      req.CreditTo,
		"fileSizeBytes": fileSize,
		"config":        req.Config,
	}
	payloadBytes, _ := json.Marshal(submitPayload)

	submitURL := fmt.Sprintf("%s/mods/article/%s/nst-submission", c.APIBase, req.Slug)
	submitReq, err := http.NewRequestWithContext(ctx, "POST", submitURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create submit request: %w", err)
	}
	submitReq.Header.Set("Content-Type", "application/json")
	submitReq.Header.Set("Authorization", "Bearer "+c.Token)

	submitResp, err := c.HTTPClient.Do(submitReq)
	if err != nil {
		return nil, fmt.Errorf("submission HTTP request failed: %w", err)
	}
	defer submitResp.Body.Close()

	submitRespBody, _ := io.ReadAll(submitResp.Body)
	if submitResp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("submission failed (HTTP %d): %s", submitResp.StatusCode, string(submitRespBody))
	}

	return &PublishResult{
		Success:       true,
		DownloadURL:   downloadURL,
		FileSizeBytes: fileSize,
		Message:       "Submitted successfully! Translation is pending moderation on Chanomhub.",
	}, nil
}
