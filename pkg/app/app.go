package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	rpgmInj "nst-go/pkg/injection/rpgm"
	"nst-go/pkg/merger"
	"nst-go/pkg/model"
	"nst-go/pkg/parser"
	"nst-go/pkg/pipeline"
	"nst-go/pkg/plugins/chanomhub"
	"nst-go/pkg/registry"
	"nst-go/pkg/storage"
	"nst-go/pkg/translator"
	"nst-go/pkg/translator/custom"
	"nst-go/pkg/translator/gemini"
	"nst-go/pkg/translator/google"
	"nst-go/pkg/translator/mock"
	"nst-go/pkg/translator/openai"
)

// ProviderConfig holds configuration for constructing a translator provider
type ProviderConfig struct {
	Name    string `json:"name"` // "mock", "gemini", "openai", "google"
	APIKey  string `json:"api_key"`
	Model   string `json:"model"`
	BaseURL string `json:"base_url"`
}

// TranslateOptions configures a batch translation run
type TranslateOptions struct {
	Provider    ProviderConfig `json:"provider"`
	SourceLang  string         `json:"source_lang"`
	TargetLang  string         `json:"target_lang"`
	BatchSize   int            `json:"batch_size"`
	Concurrency int            `json:"concurrency"`
	Scope       string         `json:"scope"` // "all", "untranslated", or file path
}

// PublishOptions configures translation mod publishing to Chanomhub
type PublishOptions struct {
	GameDir    string `json:"game_dir"`
	Slug       string `json:"slug"`
	Token      string `json:"token"`
	Language   string `json:"language"`
	APIBase    string `json:"api_base"`
	StorageURL string `json:"storage_url"`
}

// Workspace manages an open translation project workspace (.nst)
type Workspace struct {
	mu      sync.RWMutex
	path    string
	store   *storage.Storage
	project *model.Project
}

// Open opens an existing workspace file. It returns an error if the file does not exist.
func Open(wsPath string) (*Workspace, error) {
	if _, err := os.Stat(wsPath); err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("workspace file does not exist: %s", wsPath)
		}
		return nil, fmt.Errorf("failed to check workspace file: %w", err)
	}

	store, err := storage.Open(wsPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open workspace storage: %w", err)
	}

	proj, err := store.GetProject()
	if err != nil {
		store.Close()
		return nil, fmt.Errorf("failed to read project metadata: %w", err)
	}
	if proj == nil {
		store.Close()
		return nil, fmt.Errorf("workspace has no project metadata: %s", wsPath)
	}

	return &Workspace{
		path:    wsPath,
		store:   store,
		project: proj,
	}, nil
}

// CreateFromGame extracts texts from a game directory, creates a new workspace (.nst), and registers it
func CreateFromGame(gamePath, wsPath, srcLang, tgtLang string, engine ...string) (*Workspace, *model.ExtractionStats, error) {
	absGamePath, err := filepath.Abs(gamePath)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid game path: %w", err)
	}

	var engineParser parser.EngineParser
	if len(engine) > 0 && engine[0] != "" {
		engineParser, err = parser.GetParser(engine[0])
		if err != nil {
			return nil, nil, fmt.Errorf("invalid engine '%s': %w", engine[0], err)
		}
	} else {
		engineParser, err = parser.DetectEngine(absGamePath)
		if err != nil {
			return nil, nil, fmt.Errorf("engine detection failed: %w", err)
		}
	}

	ctx := context.Background()
	entries, stats, err := engineParser.Extract(ctx, absGamePath)
	if err != nil {
		return nil, nil, fmt.Errorf("extraction failed: %w", err)
	}

	if wsPath == "" {
		wsPath = "workspace.nst"
	}

	store, err := storage.Open(wsPath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create workspace storage: %w", err)
	}

	proj := &model.Project{
		ID:         filepath.Base(absGamePath),
		Name:       filepath.Base(absGamePath),
		Engine:     engineParser.Name(),
		SourcePath: absGamePath,
		SourceLang: srcLang,
		TargetLang: tgtLang,
		CreatedAt:  time.Now(),
	}

	if err := store.SaveProject(proj); err != nil {
		store.Close()
		return nil, nil, fmt.Errorf("failed to save project: %w", err)
	}

	if err := store.SaveEntries(entries); err != nil {
		store.Close()
		return nil, nil, fmt.Errorf("failed to save entries: %w", err)
	}

	// Register in project registry
	if reg, err := registry.New(); err == nil {
		_, _ = reg.Register(wsPath)
	}

	ws := &Workspace{
		path:    wsPath,
		store:   store,
		project: proj,
	}

	return ws, stats, nil
}

// Path returns the path of the workspace file
func (w *Workspace) Path() string {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.path
}

// Store returns the underlying storage
func (w *Workspace) Store() *storage.Storage {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.store
}

// Project returns a copy of current project metadata
func (w *Workspace) Project() *model.Project {
	w.mu.RLock()
	defer w.mu.RUnlock()
	if w.project == nil {
		return nil
	}
	cp := *w.project
	return &cp
}

// Close closes the underlying workspace storage
func (w *Workspace) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.store != nil {
		return w.store.Close()
	}
	return nil
}

// Stats returns workspace metrics
func (w *Workspace) Stats() (storage.WorkspaceStats, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.store.Stats()
}

// ListFiles returns summary stats per file
func (w *Workspace) ListFiles() ([]storage.FileSummary, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.store.ListFiles()
}

// QueryEntries queries entries with filtering and pagination
func (w *Workspace) QueryEntries(q storage.EntryQuery) ([]model.TextEntry, int, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.store.QueryEntries(q)
}

// UpdateEntry updates a single entry target text
func (w *Workspace) UpdateEntry(id, target string, status model.TranslationStatus, translator string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if status == "" {
		if target == "" {
			status = model.StatusUntranslated
		} else {
			status = model.StatusTranslated
		}
	}
	if translator == "" {
		translator = "manual"
	}
	return w.store.UpdateEntryTarget(id, target, status, translator)
}

// Translate runs a translation batch pipeline
func (w *Workspace) Translate(ctx context.Context, opts TranslateOptions, progressCb func(model.TranslationProgress)) error {
	w.mu.RLock()
	store := w.store
	proj := w.project
	wsPath := w.path
	w.mu.RUnlock()

	trans, err := CreateTranslator(opts.Provider)
	if err != nil {
		return fmt.Errorf("failed to create translator: %w", err)
	}

	var query storage.EntryQuery
	switch opts.Scope {
	case "untranslated":
		query.Status = "untranslated"
	case "", "all":
		// all entries
	default:
		// Specific file
		query.File = opts.Scope
	}

	entries, _, err := store.QueryEntries(query)
	if err != nil {
		return fmt.Errorf("failed to query entries for translation: %w", err)
	}

	batchSize := opts.BatchSize
	if batchSize <= 0 {
		batchSize = 10
	}
	concurrency := opts.Concurrency
	if concurrency <= 0 {
		concurrency = 4
	}

	pipe := pipeline.New(store, trans, pipeline.Config{
		BatchSize:   batchSize,
		Concurrency: concurrency,
	})

	srcLang := opts.SourceLang
	if srcLang == "" && proj != nil {
		srcLang = proj.SourceLang
	}
	tgtLang := opts.TargetLang
	if tgtLang == "" && proj != nil {
		tgtLang = proj.TargetLang
	}

	tOpts := translator.Options{
		SourceLang: srcLang,
		TargetLang: tgtLang,
		Model:      opts.Provider.Model,
	}

	_, err = pipe.Run(ctx, entries, tOpts, progressCb)

	// Refresh in registry to update completion stats
	if reg, regErr := registry.New(); regErr == nil {
		_, _ = reg.Register(wsPath)
	}

	return err
}

// DeployLayer deploys non-destructive translation layer (RPGM only)
func (w *Workspace) DeployLayer(gamePath, langName string) error {
	w.mu.RLock()
	store := w.store
	proj := w.project
	w.mu.RUnlock()

	targetGamePath := gamePath
	if targetGamePath == "" && proj != nil {
		targetGamePath = proj.SourcePath
	}
	if targetGamePath == "" {
		return fmt.Errorf("game path is required for deploy")
	}

	if proj != nil && proj.Engine != "rpgm" && proj.Engine != "rpgm-mv" && proj.Engine != "rpgm-mz" {
		// check if detected engine is rpgm
		p, err := parser.DetectEngine(targetGamePath)
		if err != nil || (p.Name() != "rpgm" && p.Name() != "rpgm-mv" && p.Name() != "rpgm-mz") {
			return fmt.Errorf("non-destructive JS layer is only supported for RPG Maker MV/MZ games (engine: %s)", proj.Engine)
		}
	}

	entries, err := store.GetEntries("all")
	if err != nil {
		return fmt.Errorf("failed to read entries: %w", err)
	}

	if langName == "" && proj != nil {
		langName = proj.TargetLang
	}
	if langName == "" {
		langName = "Thai"
	}

	exporter := rpgmInj.NewExporter()
	return exporter.Deploy(targetGamePath, entries, rpgmInj.DeployOptions{
		LanguageName:   langName,
		OnlyTranslated: true,
	})
}

// ExportCopy injects translations into a destination directory (copy mode)
func (w *Workspace) ExportCopy(ctx context.Context, gamePath, destPath string) error {
	w.mu.RLock()
	store := w.store
	proj := w.project
	w.mu.RUnlock()

	targetGamePath := gamePath
	if targetGamePath == "" && proj != nil {
		targetGamePath = proj.SourcePath
	}
	if targetGamePath == "" {
		return fmt.Errorf("source game path is required")
	}
	if destPath == "" {
		return fmt.Errorf("destination directory is required")
	}

	entries, err := store.GetEntries("all")
	if err != nil {
		return fmt.Errorf("failed to read entries: %w", err)
	}

	var engineParser parser.EngineParser
	if proj != nil && proj.Engine != "" {
		engineParser, _ = parser.GetParser(proj.Engine)
	}
	if engineParser == nil {
		engineParser, err = parser.DetectEngine(targetGamePath)
		if err != nil {
			return fmt.Errorf("engine detection failed: %w", err)
		}
	}

	return engineParser.Inject(ctx, targetGamePath, destPath, entries)
}

// MergeNewVersion merges existing translations with an updated version of the game
func (w *Workspace) MergeNewVersion(ctx context.Context, newGamePath string) (*merger.MergeStats, error) {
	w.mu.RLock()
	proj := w.project
	wsPath := w.path
	w.mu.RUnlock()

	var engineParser parser.EngineParser
	var err error
	if proj != nil && proj.Engine != "" {
		engineParser, _ = parser.GetParser(proj.Engine)
	}
	if engineParser == nil {
		engineParser, err = parser.DetectEngine(newGamePath)
		if err != nil {
			return nil, fmt.Errorf("failed to detect engine for new game: %w", err)
		}
	}

	m := merger.New()
	stats, err := m.UpdateWorkspaceWithNewGame(ctx, engineParser, newGamePath, wsPath)
	if err != nil {
		return stats, err
	}

	// Update registry
	if reg, regErr := registry.New(); regErr == nil {
		_, _ = reg.Register(wsPath)
	}

	return stats, nil
}

// ProviderInfo represents metadata about an available translation provider
type ProviderInfo struct {
	Name            string   `json:"name"`
	DisplayName     string   `json:"display_name"`
	Description     string   `json:"description,omitempty"`
	IsCustom        bool     `json:"is_custom"`
	BaseURL         string   `json:"base_url,omitempty"`
	DefaultModel    string   `json:"default_model,omitempty"`
	AvailableModels []string `json:"available_models,omitempty"`
}

// ListAvailableProviders returns all built-in and detected external custom providers
func ListAvailableProviders() []ProviderInfo {
	list := []ProviderInfo{
		{
			Name:        "mock",
			DisplayName: "Mock (Debug / Test)",
			Description: "Fast offline mock provider for testing without API usage",
			IsCustom:    false,
		},
		{
			Name:            "gemini",
			DisplayName:     "Google Gemini AI",
			Description:     "Official Google Gemini models (Gemini 2.5 Flash, Gemini 1.5 Pro)",
			IsCustom:        false,
			DefaultModel:    "gemini-2.5-flash",
			AvailableModels: []string{"gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"},
		},
		{
			Name:            "openai",
			DisplayName:     "OpenAI / Compatible",
			Description:     "Standard OpenAI API or local LLM server (Ollama, LM Studio)",
			IsCustom:        false,
			BaseURL:         "https://api.openai.com/v1",
			DefaultModel:    "gpt-4o-mini",
			AvailableModels: []string{"gpt-4o-mini", "gpt-4o", "o3-mini", "gpt-3.5-turbo"},
		},
		{
			Name:        "google",
			DisplayName: "Google Translate API",
			Description: "Google Cloud Translation API v2",
			IsCustom:    false,
		},
	}

	if customList, err := custom.List(); err == nil {
		for _, c := range customList {
			list = append(list, ProviderInfo{
				Name:            c.Name,
				DisplayName:     c.DisplayName,
				Description:     c.Description,
				IsCustom:        true,
				BaseURL:         c.BaseURL,
				DefaultModel:    c.DefaultModel,
				AvailableModels: c.AvailableModels,
			})
		}
	}
	return list
}

// CreateTranslator constructs a translator implementation from ProviderConfig
func CreateTranslator(cfg ProviderConfig) (translator.Translator, error) {
	switch cfg.Name {
	case "mock", "":
		return mock.New("[TH] "), nil
	case "gemini":
		if cfg.APIKey == "" {
			return nil, fmt.Errorf("API key is required for Gemini provider")
		}
		return gemini.New(gemini.Config{
			APIKey: cfg.APIKey,
			Model:  cfg.Model,
		}), nil
	case "openai":
		return openai.New(openai.Config{
			APIKey:  cfg.APIKey,
			BaseURL: cfg.BaseURL,
			Model:   cfg.Model,
		}), nil
	case "google":
		return google.New(google.Config{
			APIKey: cfg.APIKey,
		}), nil
	default:
		// Attempt to load external custom provider definition (e.g. from ~/.config/nst/providers/*.json or ./providers/*.json)
		if customDef, err := custom.Find(cfg.Name); err == nil {
			return custom.NewTranslator(*customDef, cfg.APIKey, cfg.Model, cfg.BaseURL)
		}
		return nil, fmt.Errorf("unsupported provider: %s (available built-in: mock, gemini, openai, google, or custom providers in providers/)", cfg.Name)
	}
}

// Publish uploads a translation mod to Chanomhub
func Publish(ctx context.Context, opts PublishOptions) (*chanomhub.PublishResult, error) {
	if opts.GameDir == "" || opts.Slug == "" || opts.Token == "" {
		return nil, fmt.Errorf("game_dir, slug, and token are required to publish")
	}

	client := chanomhub.NewClient(opts.APIBase, opts.StorageURL, opts.Token)
	return client.PublishTranslation(ctx, chanomhub.PublishRequest{
		GameDir:  opts.GameDir,
		Slug:     opts.Slug,
		Language: opts.Language,
	})
}
