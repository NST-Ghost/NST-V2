package webui

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/pprof"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"nst-go/pkg/app"
	"nst-go/pkg/model"
	"nst-go/pkg/registry"
	"nst-go/pkg/storage"
)

//go:embed static/*
var staticFS embed.FS

type Server struct {
	port       int
	autoOpen   bool
	mu         sync.Mutex
	progress   model.TranslationProgress
	isTranslating bool
}

func New(port int, autoOpen bool) *Server {
	return &Server{
		port:     port,
		autoOpen: autoOpen,
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// 1. Static Files (Embedded)
	subFS, err := fs.Sub(staticFS, "static")
	if err == nil {
		mux.Handle("/", http.FileServer(http.FS(subFS)))
	}

	// 2. API Routes
	mux.HandleFunc("/api/status", s.handleStatus)
	mux.HandleFunc("/api/project/extract", s.handleExtract)
	mux.HandleFunc("/api/entries", s.handleGetEntries)
	mux.HandleFunc("/api/entries/update", s.handleUpdateEntry)
	mux.HandleFunc("/api/translate/start", s.handleStartTranslation)
	mux.HandleFunc("/api/translate/progress", s.handleGetProgress)
	mux.HandleFunc("/api/inject", s.handleInject)
	mux.HandleFunc("/api/deploy", s.handleDeploy)
	mux.HandleFunc("/api/projects", s.handleListProjects)
	mux.HandleFunc("/api/projects/register", s.handleRegisterProject)
	mux.HandleFunc("/api/project/merge", s.handleMerge)
	mux.HandleFunc("/api/publish/chanomhub", s.handlePublishChanomhub)
	mux.HandleFunc("/api/system/stats", s.handleSystemStats)

	// 3. Go Runtime Performance & Profiling (pprof)
	mux.HandleFunc("/debug/pprof/", pprof.Index)
	mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
	mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", pprof.Trace)

	return mux
}

func (s *Server) Start() error {
	mux := s.Handler()

	url := fmt.Sprintf("http://localhost:%d", s.port)
	fmt.Println("==================================================")
	fmt.Printf("🌐 NST Web Dashboard running at: %s\n", url)
	fmt.Println("   Press Ctrl+C to stop")
	fmt.Println("==================================================")

	if s.autoOpen {
		go func() {
			time.Sleep(500 * time.Millisecond)
			openBrowser(url)
		}()
	}

	return http.ListenAndServe(fmt.Sprintf(":%d", s.port), mux)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	wsPath := r.URL.Query().Get("workspace")
	if wsPath == "" {
		wsPath = "workspace.nst"
	}

	ws, err := app.Open(wsPath)
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	defer ws.Close()

	proj := ws.Project()
	stats, err := ws.Stats()
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}

	resp := map[string]interface{}{
		"project":    proj,
		"total":      stats.Total,
		"translated": stats.Translated,
		"pending":    stats.Pending,
	}
	jsonResponse(w, resp)
}

type extractReq struct {
	GamePath   string `json:"game_path"`
	Workspace  string `json:"workspace"`
	SourceLang string `json:"source_lang"`
	TargetLang string `json:"target_lang"`
}

func (s *Server) handleExtract(w http.ResponseWriter, r *http.Request) {
	var req extractReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), 400)
		return
	}

	wsPath := req.Workspace
	if wsPath == "" {
		wsPath = "workspace.nst"
	}

	ws, stats, err := app.CreateFromGame(req.GamePath, wsPath, req.SourceLang, req.TargetLang)
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	defer ws.Close()

	jsonResponse(w, map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}

func (s *Server) handleGetEntries(w http.ResponseWriter, r *http.Request) {
	wsPath := r.URL.Query().Get("workspace")
	if wsPath == "" {
		wsPath = "workspace.nst"
	}
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "all"
	}

	ws, err := app.Open(wsPath)
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	defer ws.Close()

	entries, _, err := ws.QueryEntries(storage.EntryQuery{Status: status})
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"entries": entries,
	})
}

type updateReq struct {
	Workspace string `json:"workspace"`
	ID        string `json:"id"`
	Target    string `json:"target"`
}

func (s *Server) handleUpdateEntry(w http.ResponseWriter, r *http.Request) {
	var req updateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), 400)
		return
	}

	wsPath := req.Workspace
	if wsPath == "" {
		wsPath = "workspace.nst"
	}

	ws, err := app.Open(wsPath)
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	defer ws.Close()

	if err := ws.UpdateEntry(req.ID, req.Target, "", "manual"); err != nil {
		jsonError(w, err.Error(), 500)
		return
	}

	jsonResponse(w, map[string]bool{"success": true})
}

type translateReq struct {
	Workspace   string `json:"workspace"`
	Provider    string `json:"provider"`
	APIKey      string `json:"api_key"`
	Model       string `json:"model"`
	BaseURL     string `json:"base_url"`
	SourceLang  string `json:"source_lang"`
	TargetLang  string `json:"target_lang"`
	BatchSize   int    `json:"batch_size"`
	Concurrency int    `json:"concurrency"`
	Scope       string `json:"scope"`
}

func (s *Server) handleStartTranslation(w http.ResponseWriter, r *http.Request) {
	var req translateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), 400)
		return
	}

	s.mu.Lock()
	if s.isTranslating {
		s.mu.Unlock()
		jsonError(w, "Translation is already running", 409)
		return
	}
	s.isTranslating = true
	s.mu.Unlock()

	wsPath := req.Workspace
	if wsPath == "" {
		wsPath = "workspace.nst"
	}

	ws, err := app.Open(wsPath)
	if err != nil {
		s.mu.Lock()
		s.isTranslating = false
		s.mu.Unlock()
		jsonError(w, err.Error(), 500)
		return
	}

	go func() {
		defer ws.Close()
		defer func() {
			s.mu.Lock()
			s.isTranslating = false
			s.mu.Unlock()
		}()

		_ = ws.Translate(context.Background(), app.TranslateOptions{
			Provider: app.ProviderConfig{
				Name:    req.Provider,
				APIKey:  req.APIKey,
				Model:   req.Model,
				BaseURL: req.BaseURL,
			},
			SourceLang:  req.SourceLang,
			TargetLang:  req.TargetLang,
			BatchSize:   req.BatchSize,
			Concurrency: req.Concurrency,
			Scope:       req.Scope,
		}, func(p model.TranslationProgress) {
			s.mu.Lock()
			s.progress = p
			s.mu.Unlock()
		})
	}()

	jsonResponse(w, map[string]bool{"started": true})
}

func (s *Server) handleGetProgress(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	prog := s.progress
	running := s.isTranslating
	s.mu.Unlock()

	jsonResponse(w, map[string]interface{}{
		"running":      running,
		"percent":      prog.Percent,
		"completed":    prog.Completed,
		"total":        prog.Total,
		"current_file": prog.CurrentFile,
	})
}

type injectReq struct {
	GamePath  string `json:"game_path"`
	Workspace string `json:"workspace"`
	DestPath  string `json:"dest_path"`
}

func (s *Server) handleInject(w http.ResponseWriter, r *http.Request) {
	var req injectReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), 400)
		return
	}

	wsPath := req.Workspace
	if wsPath == "" {
		wsPath = "workspace.nst"
	}

	ws, err := app.Open(wsPath)
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	defer ws.Close()

	ctx := context.Background()
	if err := ws.ExportCopy(ctx, req.GamePath, req.DestPath); err != nil {
		jsonError(w, fmt.Sprintf("Injection failed: %v", err), 500)
		return
	}

	jsonResponse(w, map[string]bool{"success": true})
}

type deployReq struct {
	GamePath     string `json:"game_path"`
	Workspace    string `json:"workspace"`
	LanguageName string `json:"language_name"`
	Mode         string `json:"mode"` // "injection" or "patch"
}

func (s *Server) handleDeploy(w http.ResponseWriter, r *http.Request) {
	var req deployReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), 400)
		return
	}

	wsPath := req.Workspace
	if wsPath == "" {
		wsPath = "workspace.nst"
	}

	ws, err := app.Open(wsPath)
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	defer ws.Close()

	if err := ws.DeployLayer(req.GamePath, req.LanguageName); err != nil {
		jsonError(w, fmt.Sprintf("Deploy failed: %v", err), 500)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"success": true,
		"message": "Non-destructive translation layer successfully deployed to " + req.GamePath,
	})
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	reg, err := registry.New()
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	reg.RefreshAll()
	jsonResponse(w, map[string]interface{}{
		"projects": reg.List(),
	})
}

type registerReq struct {
	Workspace string `json:"workspace"`
}

func (s *Server) handleRegisterProject(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), 400)
		return
	}
	reg, err := registry.New()
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	entry, err := reg.Register(req.Workspace)
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	jsonResponse(w, entry)
}

type mergeReq struct {
	NewGamePath string `json:"new_game_path"`
	Workspace   string `json:"workspace"`
}

func (s *Server) handleMerge(w http.ResponseWriter, r *http.Request) {
	var req mergeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), 400)
		return
	}

	wsPath := req.Workspace
	if wsPath == "" {
		wsPath = "workspace.nst"
	}

	ws, err := app.Open(wsPath)
	if err != nil {
		jsonError(w, err.Error(), 500)
		return
	}
	defer ws.Close()

	ctx := context.Background()
	stats, err := ws.MergeNewVersion(ctx, req.NewGamePath)
	if err != nil {
		jsonError(w, fmt.Sprintf("Merge failed: %v", err), 500)
		return
	}

	jsonResponse(w, map[string]interface{}{
		"success": true,
		"stats":   stats,
	})
}

type publishReq struct {
	GamePath string `json:"game_path"`
	Slug     string `json:"slug"`
	Token    string `json:"token"`
	Language string `json:"language"`
}

func (s *Server) handlePublishChanomhub(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", 405)
		return
	}

	var req publishReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, err.Error(), 400)
		return
	}

	ctx := context.Background()
	res, err := app.Publish(ctx, app.PublishOptions{
		GameDir:  req.GamePath,
		Slug:     req.Slug,
		Token:    req.Token,
		Language: req.Language,
	})
	if err != nil {
		jsonError(w, fmt.Sprintf("Publish failed: %v", err), 500)
		return
	}

	jsonResponse(w, res)
}

func (s *Server) handleSystemStats(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	jsonResponse(w, map[string]interface{}{
		"goroutines":      runtime.NumGoroutine(),
		"heap_alloc_mb":   float64(m.HeapAlloc) / 1024 / 1024,
		"heap_inuse_mb":   float64(m.HeapInuse) / 1024 / 1024,
		"total_alloc_mb":  float64(m.TotalAlloc) / 1024 / 1024,
		"sys_mb":          float64(m.Sys) / 1024 / 1024,
		"num_gc":          m.NumGC,
		"last_gc_time":    time.Unix(0, int64(m.LastGC)).Format("15:04:05"),
	})
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func openBrowser(url string) {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start", url}
	case "darwin":
		cmd = "open"
		args = []string{url}
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
		args = []string{url}
	}
	_ = exec.Command(cmd, args...).Start()
}
