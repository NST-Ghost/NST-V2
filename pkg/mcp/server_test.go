package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMCPServerProtocol(t *testing.T) {
	server := NewServer()
	ctx := context.Background()

	// 1. Test Initialize
	initReq := &RPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "initialize",
	}
	resp := server.HandleRequest(ctx, initReq)
	if resp == nil || resp.Error != nil {
		t.Fatalf("initialize failed: %v", resp)
	}
	resMap := resp.Result.(map[string]interface{})
	if resMap["protocolVersion"] != "2024-11-05" {
		t.Errorf("expected protocol version 2024-11-05, got %v", resMap["protocolVersion"])
	}

	// 2. Test Tools List
	toolsReq := &RPCRequest{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "tools/list",
	}
	resp = server.HandleRequest(ctx, toolsReq)
	if resp == nil || resp.Error != nil {
		t.Fatalf("tools/list failed: %v", resp)
	}
	toolsMap := resp.Result.(map[string]interface{})
	toolsList := toolsMap["tools"].([]map[string]interface{})
	if len(toolsList) < 5 {
		t.Errorf("expected at least 5 tools, got %d", len(toolsList))
	}

	// 3. Test Tool Calls (Load, Status, Update, Translate)
	tmpDir, err := os.MkdirTemp("", "nst_mcp_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create mock RPG Maker game
	gameDir := filepath.Join(tmpDir, "rpgm_game", "data")
	_ = os.MkdirAll(gameDir, 0755)
	_ = os.WriteFile(filepath.Join(gameDir, "System.json"), []byte(`{"gameTitle": "Hero's Quest"}`), 0644)
	wsPath := filepath.Join(tmpDir, "test.nst")

	// Call nst_load_project
	loadArgs, _ := json.Marshal(map[string]string{
		"path":      filepath.Join(tmpDir, "rpgm_game"),
		"workspace": wsPath,
	})
	callReq := &RPCRequest{
		JSONRPC: "2.0",
		ID:      3,
		Method:  "tools/call",
		Params: json.RawMessage(fmtToolCall("nst_load_project", string(loadArgs))),
	}
	resp = server.HandleRequest(ctx, callReq)
	if resp == nil || resp.Error != nil {
		t.Fatalf("nst_load_project call failed: %v", resp)
	}

	// Call nst_get_status
	statusArgs, _ := json.Marshal(map[string]string{"workspace": wsPath})
	callReq = &RPCRequest{
		JSONRPC: "2.0",
		ID:      4,
		Method:  "tools/call",
		Params: json.RawMessage(fmtToolCall("nst_get_status", string(statusArgs))),
	}
	resp = server.HandleRequest(ctx, callReq)
	if resp == nil || resp.Error != nil {
		t.Fatalf("nst_get_status call failed: %v", resp)
	}
	result := resp.Result.(*ToolCallResult)
	if !strings.Contains(result.Content[0].Text, "Total Entries:") {
		t.Errorf("unexpected status response: %s", result.Content[0].Text)
	}

	// Call nst_translate with mock
	transArgs, _ := json.Marshal(map[string]string{
		"workspace": wsPath,
		"provider":  "mock",
	})
	callReq = &RPCRequest{
		JSONRPC: "2.0",
		ID:      5,
		Method:  "tools/call",
		Params: json.RawMessage(fmtToolCall("nst_translate", string(transArgs))),
	}
	resp = server.HandleRequest(ctx, callReq)
	if resp == nil || resp.Error != nil {
		t.Fatalf("nst_translate call failed: %v", resp)
	}

	// Test ServeStdio pipe
	inBuf := &bytes.Buffer{}
	outBuf := &bytes.Buffer{}
	inBuf.WriteString(`{"jsonrpc":"2.0","id":10,"method":"tools/list"}` + "\n")
	err = server.ServeStdio(ctx, inBuf, outBuf)
	if err != nil {
		t.Fatalf("ServeStdio error: %v", err)
	}
	if !strings.Contains(outBuf.String(), `"tools"`) {
		t.Errorf("expected tools in stdio output, got: %s", outBuf.String())
	}

	t.Log("MCP Server protocol tests completed successfully!")
}

func fmtToolCall(name, argsJSON string) string {
	return `{"name":"` + name + `","arguments":` + argsJSON + `}`
}
