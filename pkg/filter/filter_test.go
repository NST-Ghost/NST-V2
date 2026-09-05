package filter

import (
	"path/filepath"
	"testing"
)

func TestSmartFilter(t *testing.T) {
	mgr := New()

	// Default engine skips
	if !mgr.ShouldSkip("http://example.com/asset.png") {
		t.Errorf("Expected URL to be skipped")
	}
	if !mgr.ShouldSkip("Actor1_2") {
		t.Errorf("Expected system prefix to be skipped")
	}
	if !mgr.ShouldSkip("12345.67") {
		t.Errorf("Expected number to be skipped")
	}
	if !mgr.ShouldSkip("---===---") {
		t.Errorf("Expected symbol only to be skipped")
	}

	// Normal dialogue should NOT be skipped
	if mgr.ShouldSkip("Hello traveler! Welcome to our village.") {
		t.Errorf("Dialogue should not be skipped")
	}

	// Learn custom pattern
	mgr.Learn(`^DEBUG_.*`)
	if !mgr.ShouldSkip("DEBUG_TEST_STRING") {
		t.Errorf("Learned pattern should be skipped")
	}

	// Unlearn custom pattern
	mgr.Unlearn(`^DEBUG_.*`)
	if mgr.ShouldSkip("DEBUG_TEST_STRING") {
		t.Errorf("Unlearned pattern should not be skipped")
	}

	// Export and Import rules
	tempDir := t.TempDir()
	rulesFile := filepath.Join(tempDir, "rules.json")

	mgr.Learn("CUSTOM_TOKEN_1")
	if err := mgr.ExportRules(rulesFile); err != nil {
		t.Fatalf("ExportRules failed: %v", err)
	}

	mgr2 := New()
	if err := mgr2.ImportRules(rulesFile); err != nil {
		t.Fatalf("ImportRules failed: %v", err)
	}
	if !mgr2.ShouldSkip("CUSTOM_TOKEN_1") {
		t.Errorf("Imported rule should be skipped")
	}
}
