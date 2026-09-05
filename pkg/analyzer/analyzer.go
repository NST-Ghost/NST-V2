package analyzer

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Dependency describes a relationship between game elements (e.g. MapEvent -> CommonEvent or Switch)
type Dependency struct {
	SourceID     string `json:"source_id"`
	SourceType   string `json:"source_type"`   // "MapEvent", "CommonEvent"
	SourceLabel  string `json:"source_label"`
	TargetID     string `json:"target_id"`
	TargetType   string `json:"target_type"`   // "CommonEvent", "Switch", "Variable"
	TargetLabel  string `json:"target_label"`
	RelationType string `json:"relation_type"` // "Calls", "Toggles", "Modifies"
}

type Analyzer struct {
	gameDir      string
	switchNames  map[int]string
	varNames     map[int]string
	commonNames  map[int]string
}

func New(gameDir string) *Analyzer {
	return &Analyzer{
		gameDir:     gameDir,
		switchNames: make(map[int]string),
		varNames:    make(map[int]string),
		commonNames: make(map[int]string),
	}
}

func (a *Analyzer) findDataDir() string {
	candidates := []string{
		filepath.Join(a.gameDir, "data"),
		filepath.Join(a.gameDir, "www", "data"),
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			return c
		}
	}
	return filepath.Join(a.gameDir, "data")
}

// Analyze scans data files and extracts relationships
func (a *Analyzer) Analyze() ([]Dependency, error) {
	dataDir := a.findDataDir()
	a.loadSystemData(dataDir)
	a.loadCommonEventNames(dataDir)

	var deps []Dependency

	// 1. Analyze CommonEvents.json
	ceDeps := a.analyzeCommonEventsFile(dataDir)
	deps = append(deps, ceDeps...)

	// 2. Analyze Map files (MapXXX.json)
	files, err := os.ReadDir(dataDir)
	if err == nil {
		for _, f := range files {
			name := f.Name()
			if strings.HasPrefix(name, "Map") && strings.HasSuffix(name, ".json") && name != "MapInfos.json" {
				mapDeps := a.analyzeMapFile(filepath.Join(dataDir, name), name)
				deps = append(deps, mapDeps...)
			}
		}
	}

	return deps, nil
}

func (a *Analyzer) loadSystemData(dataDir string) {
	path := filepath.Join(dataDir, "System.json")
	bytes, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var root map[string]interface{}
	if err := json.Unmarshal(bytes, &root); err != nil {
		return
	}

	if switches, ok := root["switches"].([]interface{}); ok {
		for idx, s := range switches {
			if str, ok := s.(string); ok && str != "" {
				a.switchNames[idx] = str
			}
		}
	}
	if vars, ok := root["variables"].([]interface{}); ok {
		for idx, v := range vars {
			if str, ok := v.(string); ok && str != "" {
				a.varNames[idx] = str
			}
		}
	}
}

func (a *Analyzer) loadCommonEventNames(dataDir string) {
	path := filepath.Join(dataDir, "CommonEvents.json")
	bytes, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var arr []interface{}
	if err := json.Unmarshal(bytes, &arr); err != nil {
		return
	}

	for _, item := range arr {
		if m, ok := item.(map[string]interface{}); ok {
			if idVal, ok := m["id"].(float64); ok {
				id := int(idVal)
				if name, ok := m["name"].(string); ok && name != "" {
					a.commonNames[id] = name
				}
			}
		}
	}
}

func (a *Analyzer) analyzeCommonEventsFile(dataDir string) []Dependency {
	var deps []Dependency
	path := filepath.Join(dataDir, "CommonEvents.json")
	bytes, err := os.ReadFile(path)
	if err != nil {
		return deps
	}

	var arr []interface{}
	if err := json.Unmarshal(bytes, &arr); err != nil {
		return deps
	}

	for _, item := range arr {
		if m, ok := item.(map[string]interface{}); ok {
			id := int(m["id"].(float64))
			ceName := a.commonNames[id]
			srcID := fmt.Sprintf("CommonEvent:%d", id)

			if list, ok := m["list"].([]interface{}); ok {
				a.scanEventList(list, srcID, "CommonEvent", ceName, &deps)
			}
		}
	}
	return deps
}

func (a *Analyzer) analyzeMapFile(path, fileName string) []Dependency {
	var deps []Dependency
	bytes, err := os.ReadFile(path)
	if err != nil {
		return deps
	}

	var root map[string]interface{}
	if err := json.Unmarshal(bytes, &root); err != nil {
		return deps
	}

	events, ok := root["events"].([]interface{})
	if !ok {
		return deps
	}

	for _, ev := range events {
		if evMap, ok := ev.(map[string]interface{}); ok {
			evID := int(evMap["id"].(float64))
			evName, _ := evMap["name"].(string)
			srcID := fmt.Sprintf("%s:EV%03d", fileName, evID)

			if pages, ok := evMap["pages"].([]interface{}); ok {
				for _, page := range pages {
					if pageMap, ok := page.(map[string]interface{}); ok {
						if list, ok := pageMap["list"].([]interface{}); ok {
							a.scanEventList(list, srcID, "MapEvent", evName, &deps)
						}
					}
				}
			}
		}
	}
	return deps
}

func (a *Analyzer) scanEventList(list []interface{}, srcID, srcType, srcLabel string, deps *[]Dependency) {
	for _, cmd := range list {
		cmdMap, ok := cmd.(map[string]interface{})
		if !ok {
			continue
		}
		code := int(cmdMap["code"].(float64))
		params, _ := cmdMap["parameters"].([]interface{})

		switch code {
		case 117: // Call Common Event
			if len(params) > 0 {
				targetID := int(params[0].(float64))
				*deps = append(*deps, Dependency{
					SourceID:     srcID,
					SourceType:   srcType,
					SourceLabel:  srcLabel,
					TargetID:     fmt.Sprintf("CommonEvent:%d", targetID),
					TargetType:   "CommonEvent",
					TargetLabel:  a.commonNames[targetID],
					RelationType: "Calls",
				})
			}

		case 121: // Control Switches
			if len(params) >= 2 {
				start := int(params[0].(float64))
				end := int(params[1].(float64))
				for s := start; s <= end; s++ {
					*deps = append(*deps, Dependency{
						SourceID:     srcID,
						SourceType:   srcType,
						SourceLabel:  srcLabel,
						TargetID:     fmt.Sprintf("Switch:%d", s),
						TargetType:   "Switch",
						TargetLabel:  a.switchNames[s],
						RelationType: "Toggles",
					})
				}
			}

		case 122: // Control Variables
			if len(params) >= 2 {
				start := int(params[0].(float64))
				end := int(params[1].(float64))
				for v := start; v <= end; v++ {
					*deps = append(*deps, Dependency{
						SourceID:     srcID,
						SourceType:   srcType,
						SourceLabel:  srcLabel,
						TargetID:     fmt.Sprintf("Variable:%d", v),
						TargetType:   "Variable",
						TargetLabel:  a.varNames[v],
						RelationType: "Modifies",
					})
				}
			}
		}
	}
}
