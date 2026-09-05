package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"runtime/debug"
	"strings"
	"time"

	"nst-go/pkg/app"
	"nst-go/pkg/mcp"
	"nst-go/pkg/model"
	"nst-go/pkg/registry"
	"nst-go/pkg/storage"
	"nst-go/pkg/webui"
)

const version = "2.0.0-alpha (Go Pure Cross-Platform)"

func main() {
	// Enforce 64 MiB soft memory ceiling on Go runtime to prevent heap ballooning
	debug.SetMemoryLimit(64 * 1024 * 1024)

	if len(os.Args) < 2 {
		printUsage()
		fmt.Println("\nTip: Run 'nst ui' for web dashboard, or 'nst-desktop' for the GUI.")
		return
	}

	command := os.Args[1]

	switch command {
	case "app", "gui":
		fmt.Println("For the native desktop GUI, please run 'nst-desktop'.")
		fmt.Println("To launch the browser-based dashboard, run 'nst ui'.")
	case "ui", "web":
		handleWeb(os.Args[2:])
	case "extract":
		handleExtract(os.Args[2:])
	case "translate":
		handleTranslate(os.Args[2:])
	case "inject":
		handleInject(os.Args[2:])
	case "deploy":
		handleDeploy(os.Args[2:])
	case "merge":
		handleMerge(os.Args[2:])
	case "projects":
		handleProjects(os.Args[2:])
	case "status":
		handleStatus(os.Args[2:])
	case "mcp":
		handleMCP(os.Args[2:])
	case "publish":
		handlePublish(os.Args[2:])
	case "import-cache":
		handleImportCache(os.Args[2:])
	case "version", "-v", "--version":
		fmt.Printf("NST CLI %s\n", version)
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`NST (Novelty Translation Tool) - Next-Gen Go Edition

Usage:
  nst <command> [arguments]

Commands:
  ui         Launch the interactive Web Dashboard in browser (recommended)
  extract    Extract translatable texts from a game into a .nst workspace file
  translate  Translate extracted texts using AI or Translation APIs
  inject     Apply translated texts back into game files
  deploy     Export non-destructive runtime translation mod
  merge      Merge existing translations into an updated game version
  projects   List registered projects and translation progress
  status     Show translation statistics of a workspace
  publish    Compress and publish translation mod to Chanomhub
  mcp        Start the Model Context Protocol (MCP) server over stdio
  version    Show version info

Examples:
  nst ui
  nst extract -path ./MyGame -workspace ./project.nst
  nst translate -workspace ./project.nst -provider mock -source Japanese -target Thai
  nst inject -path ./MyGame -workspace ./project.nst -dest ./MyGame_Translated
  nst deploy -path ./MyGame -workspace ./project.nst
  nst publish -path ./MyGame -slug my-game-slug -token <YOUR_JWT>
  nst mcp`)
}

func handleExtract(args []string) {
	fs := flag.NewFlagSet("extract", flag.ExitOnError)
	gamePath := fs.String("path", "", "Path to game root directory (required)")
	wsPath := fs.String("workspace", "workspace.nst", "Output .nst workspace file")
	srcLang := fs.String("source-lang", "Japanese", "Source language")
	tgtLang := fs.String("target-lang", "Thai", "Target language")
	engineFlag := fs.String("engine", "", "Game engine (optional: rpgm, renpy, godot, unity)")
	fs.Parse(args)

	if *gamePath == "" {
		fmt.Println("Error: -path is required")
		fs.Usage()
		os.Exit(1)
	}

	ws, stats, err := app.CreateFromGame(*gamePath, *wsPath, *srcLang, *tgtLang, *engineFlag)
	if err != nil {
		fmt.Printf("Extraction failed: %v\n", err)
		os.Exit(1)
	}
	defer ws.Close()

	fmt.Println("------------------------------------------")
	fmt.Printf("✅ Extracted successfully in %v\n", stats.Duration)
	fmt.Printf("   Files Scanned : %d\n", stats.FilesScanned)
	fmt.Printf("   Total Entries : %d\n", stats.TotalEntries)
	fmt.Printf("   Unique Texts  : %d\n", stats.UniqueTexts)
	fmt.Printf("   Total Words   : %d\n", stats.TotalWords)
	fmt.Printf("   Workspace File: %s\n", *wsPath)
	fmt.Println("------------------------------------------")
}

func handleTranslate(args []string) {
	fs := flag.NewFlagSet("translate", flag.ExitOnError)
	wsPath := fs.String("workspace", "workspace.nst", "Path to .nst workspace file")
	providerName := fs.String("provider", "mock", "Provider: mock, gemini, openai, google")
	apiKey := fs.String("api-key", os.Getenv("NST_API_KEY"), "API Key (or env NST_API_KEY)")
	modelName := fs.String("model", "", "Model name (e.g. gemini-2.5-flash, gpt-4o-mini)")
	baseURL := fs.String("base-url", "", "Custom Base URL for OpenAI/Ollama")
	srcLang := fs.String("source", "Japanese", "Source language")
	tgtLang := fs.String("target", "Thai", "Target language")
	batchSize := fs.Int("batch-size", 10, "Batch size")
	concurrency := fs.Int("concurrency", 4, "Number of concurrent workers")
	fs.Parse(args)

	ws, err := app.Open(*wsPath)
	if err != nil {
		fmt.Printf("Failed to open workspace: %v\n", err)
		os.Exit(1)
	}
	defer ws.Close()

	fmt.Println("🚀 Starting Translation Pipeline...")
	fmt.Printf("   Provider:    %s\n", strings.ToUpper(*providerName))
	fmt.Printf("   Language:    %s -> %s\n", *srcLang, *tgtLang)
	fmt.Printf("   Batch Size:  %d\n", *batchSize)
	fmt.Printf("   Concurrency: %d workers\n", *concurrency)
	fmt.Println("------------------------------------------")

	startTime := time.Now()
	ctx := context.Background()

	err = ws.Translate(ctx, app.TranslateOptions{
		Provider: app.ProviderConfig{
			Name:    *providerName,
			APIKey:  *apiKey,
			Model:   *modelName,
			BaseURL: *baseURL,
		},
		SourceLang:  *srcLang,
		TargetLang:  *tgtLang,
		BatchSize:   *batchSize,
		Concurrency: *concurrency,
		Scope:       "all",
	}, func(p model.TranslationProgress) {
		fmt.Printf("\r⏳ Progress: %5.1f%% (%d/%d) | Current: %-25s",
			p.Percent, p.Completed, p.Total, p.CurrentFile)
	})

	if err != nil {
		fmt.Printf("\nTranslation failed: %v\n", err)
		os.Exit(1)
	}

	stats, _ := ws.Stats()
	fmt.Printf("\n------------------------------------------\n")
	fmt.Printf("🎉 Translation finished in %v\n", time.Since(startTime).Round(time.Millisecond))
	fmt.Printf("   Total:      %d\n", stats.Total)
	fmt.Printf("   Translated: %d\n", stats.Translated)
	fmt.Printf("   Pending:    %d\n", stats.Pending)
	fmt.Println("------------------------------------------")
}

func handleInject(args []string) {
	fs := flag.NewFlagSet("inject", flag.ExitOnError)
	gamePath := fs.String("path", "", "Path to game root directory (required)")
	wsPath := fs.String("workspace", "workspace.nst", "Path to .nst workspace file")
	destPath := fs.String("dest", "", "Destination path for patched game (required)")
	fs.Parse(args)

	if *gamePath == "" || *destPath == "" {
		fmt.Println("Error: -path and -dest are required")
		fs.Usage()
		os.Exit(1)
	}

	ws, err := app.Open(*wsPath)
	if err != nil {
		fmt.Printf("Failed to open workspace: %v\n", err)
		os.Exit(1)
	}
	defer ws.Close()

	ctx := context.Background()
	if err := ws.ExportCopy(ctx, *gamePath, *destPath); err != nil {
		fmt.Printf("Injection failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("------------------------------------------")
	fmt.Println("✅ Injection completed successfully!")
	fmt.Printf("   Patched game written to: %s\n", *destPath)
	fmt.Println("------------------------------------------")
}

func handleDeploy(args []string) {
	fs := flag.NewFlagSet("deploy", flag.ExitOnError)
	gamePath := fs.String("path", "", "Path to game root directory (required)")
	wsPath := fs.String("workspace", "workspace.nst", "Path to .nst workspace file")
	langName := fs.String("lang", "Thai", "Display name of translated language")
	fs.Parse(args)

	if *gamePath == "" {
		fmt.Println("Error: -path is required")
		fs.Usage()
		os.Exit(1)
	}

	ws, err := app.Open(*wsPath)
	if err != nil {
		fmt.Printf("Failed to open workspace: %v\n", err)
		os.Exit(1)
	}
	defer ws.Close()

	fmt.Printf("🚀 Deploying non-destructive translation layer to %s ...\n", *gamePath)
	if err := ws.DeployLayer(*gamePath, *langName); err != nil {
		fmt.Printf("Deploy failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("------------------------------------------")
	fmt.Println("✅ Deployment completed successfully!")
	fmt.Printf("   Target: %s\n", *gamePath)
	fmt.Printf("   Layer : %s/js/plugins/NST_TranslationLayer.js\n", *gamePath)
	fmt.Printf("   Files : %s/nst_translations/\n", *gamePath)
	fmt.Println("------------------------------------------")
}

func handleMerge(args []string) {
	fs := flag.NewFlagSet("merge", flag.ExitOnError)
	newGamePath := fs.String("new-game", "", "Path to new/updated game folder (required)")
	wsPath := fs.String("workspace", "workspace.nst", "Path to existing .nst workspace (required)")
	fs.Parse(args)

	if *newGamePath == "" || *wsPath == "" {
		fmt.Println("Error: -new-game and -workspace are required")
		fs.Usage()
		os.Exit(1)
	}

	ws, err := app.Open(*wsPath)
	if err != nil {
		fmt.Printf("Failed to open workspace: %v\n", err)
		os.Exit(1)
	}
	defer ws.Close()

	ctx := context.Background()
	stats, err := ws.MergeNewVersion(ctx, *newGamePath)
	if err != nil {
		fmt.Printf("Merge failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("------------------------------------------")
	fmt.Printf("✅ Version Merge Complete in %v\n", stats.Duration)
	fmt.Printf("   Total New Texts : %d\n", stats.TotalNew)
	fmt.Printf("   Exact Preserved : %d\n", stats.ExactMatches)
	fmt.Printf("   Fuzzy Preserved : %d\n", stats.FuzzyMatches)
	fmt.Printf("   New To Translate: %d\n", stats.NewUntranslated)
	fmt.Printf("   Obsolete Lines  : %d\n", stats.ObsoleteCount)
	fmt.Println("------------------------------------------")
}

func handleStatus(args []string) {
	fs := flag.NewFlagSet("status", flag.ExitOnError)
	wsPath := fs.String("workspace", "workspace.nst", "Path to .nst workspace file")
	fs.Parse(args)

	ws, err := app.Open(*wsPath)
	if err != nil {
		fmt.Printf("Failed to open workspace: %v\n", err)
		os.Exit(1)
	}
	defer ws.Close()

	proj := ws.Project()
	stats, err := ws.Stats()
	if err != nil {
		fmt.Printf("Failed to read workspace stats: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("------------------------------------------")
	if proj != nil {
		fmt.Printf("Project:    %s\n", proj.Name)
		fmt.Printf("Engine:     %s\n", strings.ToUpper(proj.Engine))
		fmt.Printf("Source Path:%s\n", proj.SourcePath)
		fmt.Printf("Languages:  %s -> %s\n", proj.SourceLang, proj.TargetLang)
	}
	fmt.Printf("Total:      %d\n", stats.Total)
	fmt.Printf("Translated: %d (%.1f%%)\n", stats.Translated, stats.Percent)
	fmt.Printf("Pending:    %d\n", stats.Pending)
	fmt.Println("------------------------------------------")
}

func handleProjects(args []string) {
	reg, err := registry.New()
	if err != nil {
		fmt.Printf("Failed to open project registry: %v\n", err)
		os.Exit(1)
	}
	reg.RefreshAll()
	list := reg.List()

	fmt.Println("================================================================================")
	fmt.Println("📋 Registered Translation Projects")
	fmt.Println("================================================================================")
	if len(list) == 0 {
		fmt.Println("No registered projects found. Extract or load a project to register it.")
		fmt.Println("================================================================================")
		return
	}

	for i, p := range list {
		fmt.Printf("[%d] %s (%s) - Progress: %.1f%% (%d/%d)\n",
			i+1, p.DisplayName, p.EngineName, p.TranslatedPercent, p.TranslatedEntries, p.TotalEntries)
		fmt.Printf("    Workspace: %s\n", p.FilePath)
		fmt.Printf("    Game Dir : %s\n", p.ProjectPath)
		fmt.Printf("    Languages: %s -> %s | Modified: %s\n", p.SourceLang, p.TargetLang, p.LastModified.Format("2006-01-02 15:04"))
		fmt.Println("--------------------------------------------------------------------------------")
	}
}

func handleWeb(args []string) {
	fs := flag.NewFlagSet("ui", flag.ExitOnError)
	port := fs.Int("port", 18080, "Web server port")
	open := fs.Bool("open", true, "Open default browser automatically")
	fs.Parse(args)

	srv := webui.New(*port, *open)
	if err := srv.Start(); err != nil {
		fmt.Printf("Web server error: %v\n", err)
		os.Exit(1)
	}
}

func handleMCP(args []string) {
	server := mcp.NewServer()
	ctx := context.Background()
	if err := server.ServeStdio(ctx, os.Stdin, os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "MCP server stopped: %v\n", err)
	}
}

func handlePublish(args []string) {
	fs := flag.NewFlagSet("publish", flag.ExitOnError)
	gamePath := fs.String("path", "", "Path to game folder containing nst_translations/ (required)")
	slug := fs.String("slug", "", "Chanomhub game article slug (required)")
	token := fs.String("token", os.Getenv("CHANOMHUB_TOKEN"), "Chanomhub API token (or CHANOMHUB_TOKEN env)")
	lang := fs.String("lang", "Thai", "Target language name")
	apiBase := fs.String("api-base", "", "Custom API base URL")
	storageURL := fs.String("storage-url", "", "Custom storage URL")
	fs.Parse(args)

	if *gamePath == "" || *slug == "" || *token == "" {
		fmt.Println("Error: -path, -slug, and -token are required")
		fs.Usage()
		os.Exit(1)
	}

	fmt.Printf("📦 Compressing translations and publishing to Chanomhub for [%s]...\n", *slug)
	ctx := context.Background()
	res, err := app.Publish(ctx, app.PublishOptions{
		GameDir:    *gamePath,
		Slug:       *slug,
		Token:      *token,
		Language:   *lang,
		APIBase:    *apiBase,
		StorageURL: *storageURL,
	})
	if err != nil {
		fmt.Printf("Publish failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ %s\n", res.Message)
	fmt.Printf("   Download URL: %s\n", res.DownloadURL)
	fmt.Printf("   Archive Size: %d bytes\n", res.FileSizeBytes)
}

func handleImportCache(args []string) {
	fs := flag.NewFlagSet("import-cache", flag.ExitOnError)
	wsPath := fs.String("workspace", "", "Path to .nst workspace file (required)")
	cachePath := fs.String("cache", "", "Path to JSON cache file (required)")
	srcLang := fs.String("source-lang", "", "Source language (optional)")
	tgtLang := fs.String("target-lang", "", "Target language (optional)")
	fs.Parse(args)

	if *wsPath == "" || *cachePath == "" {
		fmt.Println("Error: -workspace and -cache are required")
		fs.Usage()
		os.Exit(1)
	}

	store, err := storage.Open(*wsPath)
	if err != nil {
		fmt.Printf("Failed to open workspace: %v\n", err)
		os.Exit(1)
	}
	defer store.Close()

	proj, err := store.GetProject()
	if err == nil && proj != nil {
		if *srcLang == "" {
			*srcLang = proj.SourceLang
		}
		if *tgtLang == "" {
			*tgtLang = proj.TargetLang
		}
	}
	if *srcLang == "" {
		*srcLang = "Korean"
	}
	if *tgtLang == "" {
		*tgtLang = "Thai"
	}

	data, err := os.ReadFile(*cachePath)
	if err != nil {
		fmt.Printf("Failed to read cache file: %v\n", err)
		os.Exit(1)
	}

	var cacheMap map[string]string
	if err := json.Unmarshal(data, &cacheMap); err != nil {
		fmt.Printf("Failed to parse cache JSON: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("📥 Importing %d translations from %s into %s ...\n", len(cacheMap), *cachePath, *wsPath)
	importedTM := 0
	for src, tgt := range cacheMap {
		if strings.TrimSpace(tgt) != "" {
			_ = store.SetCache(src, tgt, *srcLang, *tgtLang, "imported_cache")
			importedTM++
		}
	}

	entries, err := store.GetEntries("untranslated")
	if err != nil {
		fmt.Printf("Failed to read entries: %v\n", err)
		os.Exit(1)
	}

	updatedEntries := 0
	for _, e := range entries {
		if tgt, ok := cacheMap[e.Source]; ok && strings.TrimSpace(tgt) != "" {
			_ = store.UpdateEntryTarget(e.ID, tgt, model.StatusTranslated, "cache_import")
			updatedEntries++
		}
	}

	fmt.Println("------------------------------------------")
	fmt.Printf("✅ Cache import complete!\n")
	fmt.Printf("   TM Cache entries populated  : %d\n", importedTM)
	fmt.Printf("   Workspace entries translated: %d\n", updatedEntries)
	fmt.Println("------------------------------------------")
}

