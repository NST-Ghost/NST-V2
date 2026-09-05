package main

import (
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"nst-go/frontend"
	"nst-go/pkg/model"
)

func init() {
	// Register custom events for strongly typed TS bindings
	application.RegisterEvent[model.TranslationProgress]("translation:progress")
	application.RegisterEvent[TranslationDonePayload]("translation:done")
}

func main() {
	session := NewSession()

	projectService := NewProjectService(session)
	entryService := NewEntryService(session)
	translationService := NewTranslationService(session)
	deployService := NewDeployService(session)
	settingsService := NewSettingsService()

	app := application.New(application.Options{
		Name:        "nst-desktop",
		Description: "NST Ghost - Novelty Translation Tool",
		Services: []application.Service{
			application.NewService(projectService),
			application.NewService(entryService),
			application.NewService(translationService),
			application.NewService(deployService),
			application.NewService(settingsService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(frontend.Assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "NST Ghost - Novelty Translation Tool",
		Width:  1320,
		Height: 880,
		MinWidth: 1000,
		MinHeight: 650,
		BackgroundColour: application.NewRGB(26, 26, 26),
		URL: "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
