package godot

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGodotExtractAndInject(t *testing.T) {
	tempGame := t.TempDir()

	// 1. Create dummy project.godot
	_ = os.WriteFile(filepath.Join(tempGame, "project.godot"), []byte("config_version=5\n[application]\nconfig/name=\"Test Game\"\n"), 0644)

	// 2. Create sample main.tscn
	tscnContent := `[gd_scene load_steps=2 format=3]

[node name="TitleScreen" type="Control"]
[node name="StartBtn" type="Button" parent="."]
text = "Start Adventure"

[node name="QuitBtn" type="Button" parent="."]
text = "Quit Game"
`
	_ = os.WriteFile(filepath.Join(tempGame, "main.tscn"), []byte(tscnContent), 0644)

	parser := New()

	// 1. Detect
	if !parser.Detect(tempGame) {
		t.Fatalf("Failed to detect Godot game")
	}

	// 2. Extract
	ctx := context.Background()
	entries, stats, err := parser.Extract(ctx, tempGame)
	if err != nil {
		t.Fatalf("Extract failed: %v", err)
	}

	if len(entries) != 2 {
		t.Fatalf("Expected 2 entries, got %d", len(entries))
	}

	if entries[0].Source != "Start Adventure" {
		t.Errorf("Expected 'Start Adventure', got '%s'", entries[0].Source)
	}

	// 3. Inject
	entries[0].Target = "เริ่มการผจญภัย"
	entries[1].Target = "ออกจากเกม"

	outDir := filepath.Join(tempGame, "translated")
	if err := parser.Inject(ctx, tempGame, outDir, entries); err != nil {
		t.Fatalf("Inject failed: %v", err)
	}

	// Verify injected tscn
	injectedBytes, err := os.ReadFile(filepath.Join(outDir, "main.tscn"))
	if err != nil {
		t.Fatalf("Failed to read injected main.tscn: %v", err)
	}

	injectedStr := string(injectedBytes)
	if !strings.Contains(injectedStr, `text = "เริ่มการผจญภัย"`) {
		t.Errorf("Injected content missing Thai translation:\n%s", injectedStr)
	}

	t.Logf("Godot parser test passed in %v!", stats.Duration)
}
