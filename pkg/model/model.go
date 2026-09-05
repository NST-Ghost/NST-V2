package model

import (
	"time"
)

// TranslationStatus represents the review/translation lifecycle of an entry
type TranslationStatus string

const (
	StatusUntranslated TranslationStatus = "untranslated"
	StatusTranslated   TranslationStatus = "translated"
	StatusReviewed     TranslationStatus = "reviewed"
	StatusApproved     TranslationStatus = "approved"
	StatusSkipped      TranslationStatus = "skipped"
)

// TextEntry is the fundamental unit of text to translate
type TextEntry struct {
	ID         string            `json:"id"`
	Source     string            `json:"source"`
	Target     string            `json:"target,omitempty"`
	FilePath   string            `json:"file_path"` // Relative to game data dir
	KeyPath    string            `json:"key_path"`  // JSON path or line number e.g. "events[1].pages[0].parameters[0]"
	Status     TranslationStatus `json:"status"`
	Context    string            `json:"context,omitempty"` // Character name, speaker, or location
	Translator string            `json:"translator,omitempty"` // Service or user that translated it
	UpdatedAt  time.Time         `json:"updated_at"`
}

// Project represents an active translation project
type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Engine      string    `json:"engine"`      // "rpgm-mv", "rpgm-mz", "renpy", etc.
	SourcePath  string    `json:"source_path"` // Path to game root folder
	SourceLang  string    `json:"source_lang"` // e.g. "Japanese", "English"
	TargetLang  string    `json:"target_lang"` // e.g. "Thai"
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ExtractionStats contains summary metrics of an extraction run
type ExtractionStats struct {
	TotalEntries int           `json:"total_entries"`
	UniqueTexts  int           `json:"unique_texts"`
	TotalWords   int           `json:"total_words"`
	FilesScanned int           `json:"files_scanned"`
	Duration     time.Duration `json:"duration"`
}

// TranslationProgress reports progress during batch translation
type TranslationProgress struct {
	Total       int     `json:"total"`
	Completed   int     `json:"completed"`
	CurrentFile string  `json:"current_file"`
	Failed      int     `json:"failed"`
	Percent     float64 `json:"percent"`
}
