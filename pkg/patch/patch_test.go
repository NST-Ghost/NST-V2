package patch

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSaveAndLoadPatchGz(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "patch_test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	patchFile := filepath.Join(tmpDir, "test.patch.json.gz")

	original := &PatchPackage{
		FormatVersion: "1.0",
		Engine:        "rpgm",
		GameTitle:     "Test Game",
		GameVersion:   "1.0.0",
		ChanomhubSlug: "test-game-slug",
		SourceLang:    "en",
		TargetLang:    "th",
		CreatedAt:     time.Now().Truncate(time.Second),
		Metadata: map[string]string{
			"author": "tester",
		},
		Stats: PatchStats{
			TotalEntries:      2,
			TranslatedEntries: 2,
			UniqueTexts:       2,
		},
		Entries: []PatchEntry{
			{
				FilePath: "data/Actors.json",
				KeyPath:  "1.name",
				Source:   "Harold",
				Target:   "ฮาโรลด์",
			},
			{
				FilePath: "data/Actors.json",
				KeyPath:  "1.profile",
				Source:   "A brave warrior",
				Target:   "นักรบผู้กล้าหาญ",
			},
		},
	}

	if err := SavePatch(original, patchFile); err != nil {
		t.Fatalf("SavePatch failed: %v", err)
	}

	loaded, err := LoadPatch(patchFile)
	if err != nil {
		t.Fatalf("LoadPatch failed: %v", err)
	}

	if loaded.GameTitle != original.GameTitle {
		t.Errorf("expected GameTitle %s, got %s", original.GameTitle, loaded.GameTitle)
	}
	if loaded.ChanomhubSlug != original.ChanomhubSlug {
		t.Errorf("expected ChanomhubSlug %s, got %s", original.ChanomhubSlug, loaded.ChanomhubSlug)
	}
	if len(loaded.Entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(loaded.Entries))
	}
	if loaded.Entries[0].Target != "ฮาโรลด์" {
		t.Errorf("expected target 'ฮาโรลด์', got '%s'", loaded.Entries[0].Target)
	}
}
