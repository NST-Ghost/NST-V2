package parser

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEngineAutoDetect(t *testing.T) {
	// 1. Supported engines check
	engines := SupportedEngines()
	if len(engines) < 4 {
		t.Fatalf("expected at least 4 engines, got %d", len(engines))
	}

	// 2. Test GetParser
	for _, name := range []string{"rpgm", "rpgm-mv", "rpgm-mz", "renpy", "godot", "unity"} {
		p, err := GetParser(name)
		if err != nil || p == nil {
			t.Errorf("expected GetParser(%s) to succeed, got %v", name, err)
		}
	}

	// 3. Test DetectEngine on RPG Maker structure
	tmpDir, err := os.MkdirTemp("", "nst_detect_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create RPGM
	rpgmDir := filepath.Join(tmpDir, "rpgm_game", "data")
	_ = os.MkdirAll(rpgmDir, 0755)
	_ = os.WriteFile(filepath.Join(rpgmDir, "System.json"), []byte("{}"), 0644)

	p, err := DetectEngine(filepath.Join(tmpDir, "rpgm_game"))
	if err != nil || p.Name() != "rpgm" {
		t.Errorf("expected rpgm detection, got %v (%v)", p, err)
	}

	// Create Ren'Py
	renpyDir := filepath.Join(tmpDir, "renpy_game", "game")
	_ = os.MkdirAll(renpyDir, 0755)
	_ = os.WriteFile(filepath.Join(renpyDir, "script.rpy"), []byte("label start:"), 0644)

	p, err = DetectEngine(filepath.Join(tmpDir, "renpy_game"))
	if err != nil || p.Name() != "renpy" {
		t.Errorf("expected renpy detection, got %v (%v)", p, err)
	}

	// Create Godot
	godotDir := filepath.Join(tmpDir, "godot_game")
	_ = os.MkdirAll(godotDir, 0755)
	_ = os.WriteFile(filepath.Join(godotDir, "project.godot"), []byte("[application]"), 0644)

	p, err = DetectEngine(godotDir)
	if err != nil || p.Name() != "godot" {
		t.Errorf("expected godot detection, got %v (%v)", p, err)
	}

	// Create Unity
	unityDir := filepath.Join(tmpDir, "unity_game", "Assets")
	_ = os.MkdirAll(unityDir, 0755)

	p, err = DetectEngine(filepath.Join(tmpDir, "unity_game"))
	if err != nil || p.Name() != "unity" {
		t.Errorf("expected unity detection, got %v (%v)", p, err)
	}
}
