package analyzer

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestRelationAnalyzer(t *testing.T) {
	tempGame := t.TempDir()
	dataDir := filepath.Join(tempGame, "data")
	_ = os.MkdirAll(dataDir, 0755)

	// 1. System.json with switches & variables
	sysJSON := map[string]interface{}{
		"switches":  []interface{}{"", "Quest_Active", "Boss_Defeated"},
		"variables": []interface{}{"", "Gold_Counter"},
	}
	sysBytes, _ := json.Marshal(sysJSON)
	_ = os.WriteFile(filepath.Join(dataDir, "System.json"), sysBytes, 0644)

	// 2. CommonEvents.json
	ceJSON := []interface{}{
		nil,
		map[string]interface{}{
			"id":   1,
			"name": "Intro Sequence",
			"list": []interface{}{
				map[string]interface{}{"code": 121, "parameters": []interface{}{1, 1, 0}}, // Toggle Switch 1 (Quest_Active)
				map[string]interface{}{"code": 0, "parameters": []interface{}{}},
			},
		},
	}
	ceBytes, _ := json.Marshal(ceJSON)
	_ = os.WriteFile(filepath.Join(dataDir, "CommonEvents.json"), ceBytes, 0644)

	// 3. Map001.json
	mapJSON := map[string]interface{}{
		"events": []interface{}{
			nil,
			map[string]interface{}{
				"id":   1,
				"name": "Quest NPC",
				"pages": []interface{}{
					map[string]interface{}{
						"list": []interface{}{
							map[string]interface{}{"code": 117, "parameters": []interface{}{1}}, // Call CommonEvent 1
							map[string]interface{}{"code": 122, "parameters": []interface{}{1, 1, 0, 0, 10}}, // Modifies Variable 1
							map[string]interface{}{"code": 0, "parameters": []interface{}{}},
						},
					},
				},
			},
		},
	}
	mapBytes, _ := json.Marshal(mapJSON)
	_ = os.WriteFile(filepath.Join(dataDir, "Map001.json"), mapBytes, 0644)

	// Run analyzer
	az := New(tempGame)
	deps, err := az.Analyze()
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if len(deps) == 0 {
		t.Fatalf("Expected dependencies, got 0")
	}

	foundCallCE := false
	foundToggleSwitch := false
	foundModifyVar := false

	for _, d := range deps {
		if d.RelationType == "Calls" && d.TargetID == "CommonEvent:1" {
			foundCallCE = true
		}
		if d.RelationType == "Toggles" && d.TargetID == "Switch:1" && d.TargetLabel == "Quest_Active" {
			foundToggleSwitch = true
		}
		if d.RelationType == "Modifies" && d.TargetID == "Variable:1" && d.TargetLabel == "Gold_Counter" {
			foundModifyVar = true
		}
	}

	if !foundCallCE {
		t.Errorf("Missing expected Call CommonEvent relation")
	}
	if !foundToggleSwitch {
		t.Errorf("Missing expected Toggle Switch relation")
	}
	if !foundModifyVar {
		t.Errorf("Missing expected Modify Variable relation")
	}

	t.Logf("Relation Analyzer test passed with %d dependencies found!", len(deps))
}
