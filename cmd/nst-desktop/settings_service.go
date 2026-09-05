package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"nst-go/pkg/app"
)

type Settings struct {
	DefaultProvider    string            `json:"default_provider"`     // "mock", "gemini", "openai", "google", or any custom plugin name
	DefaultModel       string            `json:"default_model"`        // e.g. "gemini-2.5-flash", "gpt-4o-mini", etc.
	GeminiAPIKey       string            `json:"gemini_api_key"`
	OpenAIAPIKey       string            `json:"openai_api_key"`
	OpenAIBaseURL      string            `json:"openai_base_url"`
	GoogleAPIKey       string            `json:"google_api_key"`
	ChanomhubToken     string            `json:"chanomhub_token"`
	PluginKeys         map[string]string `json:"plugin_keys,omitempty"`      // dynamic map: provider_name -> api_key
	PluginBaseURLs     map[string]string `json:"plugin_base_urls,omitempty"`  // dynamic map: provider_name -> base_url
	DefaultSourceLang  string            `json:"default_source_lang"`  // "Japanese"
	DefaultTargetLang  string            `json:"default_target_lang"`  // "Thai"
	DefaultBatchSize   int               `json:"default_batch_size"`   // 10
	DefaultConcurrency int               `json:"default_concurrency"`  // 4
	Theme              string            `json:"theme"`                // "dark"
}

type SettingsService struct {
	mu           sync.RWMutex
	filePath     string
}

func NewSettingsService(customPath ...string) *SettingsService {
	path := ""
	if len(customPath) > 0 {
		path = customPath[0]
	} else {
		cfgDir, err := os.UserConfigDir()
		if err != nil {
			cfgDir = "."
		}
		path = filepath.Join(cfgDir, "nst", "settings.json")
	}
	return &SettingsService{filePath: path}
}

// defaultSettings returns sensible defaults populated with any existing environment variables
func defaultSettings() Settings {
	s := Settings{
		DefaultProvider:    "mock",
		DefaultModel:       "gemini-2.5-flash",
		DefaultSourceLang:  "Japanese",
		DefaultTargetLang:  "Thai",
		DefaultBatchSize:   10,
		DefaultConcurrency: 4,
		Theme:              "dark",
	}

	if envKey := os.Getenv("NST_API_KEY"); envKey != "" {
		s.GeminiAPIKey = envKey
		s.OpenAIAPIKey = envKey
		s.GoogleAPIKey = envKey
	}
	if envToken := os.Getenv("CHANOMHUB_TOKEN"); envToken != "" {
		s.ChanomhubToken = envToken
	}
	return s
}

// GetSettings reads persisted settings or returns defaults
func (s *SettingsService) GetSettings() (Settings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultSettings(), nil
		}
		return defaultSettings(), err
	}

	settings := defaultSettings()
	if err := json.Unmarshal(data, &settings); err != nil {
		return defaultSettings(), err
	}

	return settings, nil
}

// GetProviders returns list of all built-in and plugin translation providers
func (s *SettingsService) GetProviders() []app.ProviderInfo {
	return app.ListAvailableProviders()
}

// SaveSettings writes updated settings to disk
func (s *SettingsService) SaveSettings(settings Settings) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, data, 0600)
}
