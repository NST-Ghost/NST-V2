package prompts

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildSystemPrompt(t *testing.T) {
	prompt := BuildSystemPrompt(PersonaDanUncensored, "Japanese", "Thai")
	if !strings.Contains(prompt, "FICTIONAL LOCALIZATION ONLY") {
		t.Errorf("expected DanUncensored prompt to contain fiction directive")
	}
	if !strings.Contains(prompt, "Japanese to Thai") {
		t.Errorf("expected language pair in prompt")
	}

	vnPrompt := BuildSystemPrompt(PersonaVisualNovelRomance, "Japanese", "Thai")
	if !strings.Contains(vnPrompt, "VISUAL NOVEL") {
		t.Errorf("expected VN prompt to contain VISUAL NOVEL")
	}

	stdPrompt := BuildSystemPrompt(PersonaStandard, "English", "Thai")
	if !strings.Contains(stdPrompt, "LOCALIZATION GUIDELINES") {
		t.Errorf("expected standard prompt")
	}

	nsfwPrompt := BuildSystemPrompt(PersonaNSFW, "English", "Thai")
	if !strings.Contains(nsfwPrompt, "ADULT & NSFW LOCALIZATION") {
		t.Errorf("expected NSFW prompt to contain NSFW directive")
	}
}

func TestResolvePrompt_CustomTemplate(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "nst_template_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	tplPath := filepath.Join(tmpDir, "my_nsfw.txt")
	_ = os.WriteFile(tplPath, []byte("Translate with intense passion and explicit terms"), 0644)

	res := ResolvePrompt(tplPath, "en", "th", "")
	if !strings.Contains(res, "Translate with intense passion and explicit terms") {
		t.Errorf("expected custom template to be resolved")
	}
}
