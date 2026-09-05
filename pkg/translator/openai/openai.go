package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"nst-go/pkg/translator"
)

type Config struct {
	BaseURL string // e.g. "https://api.openai.com/v1" or "http://localhost:11434/v1"
	APIKey  string
	Model   string
	Timeout time.Duration
	Headers map[string]string
}

type Client struct {
	cfg        Config
	httpClient *http.Client
}

func New(cfg Config) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.openai.com/v1"
	}
	if cfg.Model == "" {
		cfg.Model = "gpt-4o-mini"
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 60 * time.Second
	}
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

func (c *Client) Name() string {
	return "openai"
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature float64       `json:"temperature"`
}

type chatChoice struct {
	Message chatMessage `json:"message"`
}

type chatResponse struct {
	Choices []chatChoice `json:"choices"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (c *Client) Translate(ctx context.Context, texts []string, opts translator.Options) ([]translator.Result, error) {
	if len(texts) == 0 {
		return nil, nil
	}

	systemPrompt := fmt.Sprintf(
		"You are a professional video game localizer translating from %s to %s.\n"+
			"Strict rules:\n"+
			"1. Translate each numbered line accurately, keeping natural dialogue flow and character tones.\n"+
			"2. Preserve all special tokens and tags like __NST_TAG_0__, __NST_TAG_1__ EXACTLY as they are without modifying or dropping them.\n"+
			"3. Output ONLY a valid JSON array of strings corresponding 1-to-1 with the input lines, e.g. [\"line 1\", \"line 2\"]. No markdown, no explanations.",
		opts.SourceLang, opts.TargetLang,
	)

	inputJSON, err := json.Marshal(texts)
	if err != nil {
		return nil, fmt.Errorf("failed to encode input texts: %w", err)
	}

	modelName := c.cfg.Model
	if opts.Model != "" {
		modelName = opts.Model
	}

	reqBody := chatRequest{
		Model: modelName,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: string(inputJSON)},
		},
		Temperature: 0.3,
	}

	reqBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	url := strings.TrimRight(c.cfg.BaseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(reqBytes))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if c.cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)
	}
	for k, v := range c.cfg.Headers {
		httpReq.Header.Set(k, v)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request to LLM backend failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var chatResp chatResponse
	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("no response choices returned from LLM")
	}

	rawContent := strings.TrimSpace(chatResp.Choices[0].Message.Content)
	// Strip markdown code block if model wrapped it in ```json ... ```
	rawContent = strings.TrimPrefix(rawContent, "```json")
	rawContent = strings.TrimPrefix(rawContent, "```")
	rawContent = strings.TrimSuffix(rawContent, "```")
	rawContent = strings.TrimSpace(rawContent)

	var translatedTexts []string
	if err := json.Unmarshal([]byte(rawContent), &translatedTexts); err != nil {
		return nil, fmt.Errorf("failed to parse translated JSON array: %w (raw response: %s)", err, rawContent)
	}

	if len(translatedTexts) != len(texts) {
		return nil, fmt.Errorf("translated count mismatch: expected %d, got %d", len(texts), len(translatedTexts))
	}

	results := make([]translator.Result, len(texts))
	for i := range texts {
		results[i] = translator.Result{
			Source:     texts[i],
			Target:     translatedTexts[i],
			Translator: "openai:" + modelName,
		}
	}

	return results, nil
}
