package rpgm

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestExtractAndInjectRPGM(t *testing.T) {
	tempDir := t.TempDir()
	dataDir := filepath.Join(tempDir, "data")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		t.Fatalf("Failed to create test dir: %v", err)
	}

	// 1. Create a dummy System.json
	systemJSON := map[string]interface{}{
		"gameTitle":    "Test RPG Game",
		"currencyUnit": "G",
		"terms": map[string]interface{}{
			"messages": map[string]interface{}{
				"actionFailure": "Action failed!",
			},
		},
	}
	sysBytes, _ := json.Marshal(systemJSON)
	if err := os.WriteFile(filepath.Join(dataDir, "System.json"), sysBytes, 0644); err != nil {
		t.Fatal(err)
	}

	// 2. Create a dummy Map001.json with dialogue and choices
	mapJSON := map[string]interface{}{
		"displayName": "Starting Village",
		"events": []interface{}{
			nil, // RPG Maker 1-based index
			map[string]interface{}{
				"id":   1,
				"name": "Villager NPC",
				"pages": []interface{}{
					map[string]interface{}{
						"list": []interface{}{
							map[string]interface{}{
								"code":       101, // ShowTextSetup (MZ Speaker)
								"parameters": []interface{}{"", 0, 0, 2, "Old Man"},
							},
							map[string]interface{}{
								"code":       401, // ShowTextLine
								"parameters": []interface{}{"Hello traveler! Welcome."},
							},
							map[string]interface{}{
								"code":       102, // ShowChoices
								"parameters": []interface{}{[]interface{}{"Thank you!", "Goodbye."}},
							},
							map[string]interface{}{
								"code":       0,
								"parameters": []interface{}{},
							},
						},
					},
				},
			},
		},
	}
	mapBytes, _ := json.Marshal(mapJSON)
	if err := os.WriteFile(filepath.Join(dataDir, "Map001.json"), mapBytes, 0644); err != nil {
		t.Fatal(err)
	}

	parser := New()

	// Test Detect
	if !parser.Detect(tempDir) {
		t.Fatalf("Detect failed to detect RPG Maker game")
	}

	// Test Extract
	ctx := context.Background()
	entries, stats, err := parser.Extract(ctx, tempDir)
	if err != nil {
		t.Fatalf("Extract failed: %v", err)
	}

	if len(entries) == 0 {
		t.Fatalf("Expected extracted entries, got 0")
	}
	t.Logf("Extracted %d entries. Files scanned: %d", len(entries), stats.FilesScanned)

	// Verify specific texts are found
	foundDialogue := false
	foundSpeaker := false
	foundChoice := false
	foundTitle := false

	for i := range entries {
		switch entries[i].Source {
		case "Hello traveler! Welcome.":
			foundDialogue = true
			entries[i].Target = "สวัสดีนักเดินทาง! ยินดีต้อนรับ"
		case "Old Man":
			foundSpeaker = true
			entries[i].Target = "ชายชรา"
		case "Thank you!":
			foundChoice = true
			entries[i].Target = "ขอบคุณนะ!"
		case "Test RPG Game":
			foundTitle = true
			entries[i].Target = "เกม RPG ทดสอบ"
		}
	}

	if !foundDialogue {
		t.Errorf("Missing expected dialogue entry")
	}
	if !foundSpeaker {
		t.Errorf("Missing expected speaker entry")
	}
	if !foundChoice {
		t.Errorf("Missing expected choice entry")
	}
	if !foundTitle {
		t.Errorf("Missing expected gameTitle entry")
	}

	// Test Inject to a new output folder
	outDir := filepath.Join(tempDir, "translated_game")
	if err := parser.Inject(ctx, tempDir, outDir, entries); err != nil {
		t.Fatalf("Inject failed: %v", err)
	}

	// Verify injected file content
	injectedMapBytes, err := os.ReadFile(filepath.Join(outDir, "data", "Map001.json"))
	if err != nil {
		t.Fatalf("Failed to read injected Map001.json: %v", err)
	}

	var injectedMap map[string]interface{}
	if err := json.Unmarshal(injectedMapBytes, &injectedMap); err != nil {
		t.Fatalf("Failed to parse injected Map001.json: %v", err)
	}

	events := injectedMap["events"].([]interface{})
	event1 := events[1].(map[string]interface{})
	pages := event1["pages"].([]interface{})
	page0 := pages[0].(map[string]interface{})
	list := page0["list"].([]interface{})

	cmdSpeaker := list[0].(map[string]interface{})
	speakerParams := cmdSpeaker["parameters"].([]interface{})
	if speakerParams[4] != "ชายชรา" {
		t.Errorf("Expected speaker 'ชายชรา', got %v", speakerParams[4])
	}

	cmdDialogue := list[1].(map[string]interface{})
	dialogueParams := cmdDialogue["parameters"].([]interface{})
	if dialogueParams[0] != "สวัสดีนักเดินทาง! ยินดีต้อนรับ" {
		t.Errorf("Expected dialogue 'สวัสดีนักเดินทาง! ยินดีต้อนรับ', got %v", dialogueParams[0])
	}

	t.Log("Extract and Inject tests completed successfully!")
}

func TestHeuristicKeyFinderAndCustomFiles(t *testing.T) {
	tempDir := t.TempDir()
	dataDir := filepath.Join(tempDir, "data")
	pluginsDir := filepath.Join(tempDir, "js", "plugins")
	_ = os.MkdirAll(dataDir, 0755)
	_ = os.MkdirAll(pluginsDir, 0755)

	// 1. Write System.json
	_ = os.WriteFile(filepath.Join(dataDir, "System.json"), []byte(`{"gameTitle":"EdgeCaseGame"}`), 0644)

	// 2. Write a plugin with an XOR key array
	// XOR key "TestKey123" XOR 0x3F
	testKey := "TestKey123"
	var nums []string
	for _, b := range []byte(testKey) {
		nums = append(nums, fmt.Sprintf("%d", b^0x3F))
	}
	jsContent := fmt.Sprintf(`
var SECRET_KEY = (function() {
    var a = [%s];
    return a.map(function(c) { return String.fromCharCode(c ^ 0x3F); }).join('');
})();
var uiMenu = "이어하기";
var uiOption = "옵션 설정";
`, strings.Join(nums, ","))
	_ = os.WriteFile(filepath.Join(pluginsDir, "CustomPlugin.js"), []byte(jsContent), 0644)

	// 3. Write an encrypted RCSV file using this key
	rawCsv := "Key,Text_KR,Text_EN\n1,사무실로 가자,Go to office\n2,집으로 돌아가자,Go home\n"
	csvBuf := []byte(rawCsv)
	for i := 0; i < len(csvBuf) && i < 1024; i++ {
		csvBuf[i] ^= testKey[i%len(testKey)]
	}
	_ = os.WriteFile(filepath.Join(dataDir, "QuestData.rcsv"), csvBuf, 0644)

	// 4. Run Extract
	parser := New()
	entries, stats, err := parser.Extract(context.Background(), tempDir)
	if err != nil {
		t.Fatalf("Extract failed: %v", err)
	}

	if stats.TotalEntries == 0 {
		t.Fatalf("Expected extracted entries, got 0")
	}

	foundRCSVText := false
	foundPluginText := false
	for _, e := range entries {
		if e.Source == "사무실로 가자" && e.FilePath == "QuestData.rcsv" {
			foundRCSVText = true
		}
		if e.Source == "이어하기" && e.FilePath == "PluginUI.json" {
			foundPluginText = true
		}
	}

	if !foundRCSVText {
		t.Errorf("Expected to extract '사무실로 가자' from decrypted QuestData.rcsv")
	}
	if !foundPluginText {
		t.Errorf("Expected to harvest '이어하기' from CustomPlugin.js")
	}
}

