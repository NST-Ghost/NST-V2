package prompts

import (
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
}
