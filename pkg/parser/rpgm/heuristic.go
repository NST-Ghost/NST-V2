package rpgm

import (
	"bytes"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

var (
	// Matches: var SECRET_KEY=(function(){var a=[109,114,...];return a.map(function(c){return String.fromCharCode(c^0x3F);}).join('');})();
	arrayXorRegex = regexp.MustCompile(`(?s)\[([0-9,\s]+)\].*?String\.fromCharCode\([a-zA-Z]\s*\^\s*(0x[0-9a-fA-F]+|\d+)\)`)

	// Matches: var SECRET_KEY = "xyz" or key = "xyz"
	literalKeyRegex = regexp.MustCompile(`(?i)(?:secret_key|encrypt_key|xor_key|cipher_key)\s*=\s*["']([^"']{4,64})["']`)
)

// HeuristicKeyFinder scans JS plugins in game folder to discover encryption keys
type HeuristicKeyFinder struct {
	knownKeys []string
}

// NewHeuristicKeyFinder creates a new finder with fallback default keys
func NewHeuristicKeyFinder() *HeuristicKeyFinder {
	return &HeuristicKeyFinder{
		knownKeys: []string{
			"RMMVSecure123!@",
			"RPGMakerMV",
			"RPGMakerMZ",
			"SecretKey",
		},
	}
}

// DiscoverKeys scans plugin directory for XOR keys
func (h *HeuristicKeyFinder) DiscoverKeys(rootDir string) []string {
	keys := make([]string, len(h.knownKeys))
	copy(keys, h.knownKeys)
	seen := make(map[string]bool)
	for _, k := range keys {
		seen[k] = true
	}

	searchDirs := []string{
		filepath.Join(rootDir, "js"),
		filepath.Join(rootDir, "js", "plugins"),
		filepath.Join(rootDir, "www", "js"),
		filepath.Join(rootDir, "www", "js", "plugins"),
	}

	for _, d := range searchDirs {
		entries, err := os.ReadDir(d)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".js") {
				continue
			}
			content, err := os.ReadFile(filepath.Join(d, e.Name()))
			if err != nil {
				continue
			}

			// 1. Check array XOR pattern
			if matches := arrayXorRegex.FindAllSubmatch(content, -1); len(matches) > 0 {
				for _, match := range matches {
					rawNums := string(match[1])
					rawXorVal := string(match[2])

					xorByte := byte(0x3F)
					if strings.HasPrefix(rawXorVal, "0x") || strings.HasPrefix(rawXorVal, "0X") {
						if val, err := strconv.ParseUint(rawXorVal[2:], 16, 8); err == nil {
							xorByte = byte(val)
						}
					} else {
						if val, err := strconv.ParseUint(rawXorVal, 10, 8); err == nil {
							xorByte = byte(val)
						}
					}

					var keyBuf bytes.Buffer
					parts := strings.Split(rawNums, ",")
					for _, p := range parts {
						p = strings.TrimSpace(p)
						if num, err := strconv.Atoi(p); err == nil {
							keyBuf.WriteByte(byte(num) ^ xorByte)
						}
					}

					foundKey := keyBuf.String()
					if len(foundKey) >= 4 && !seen[foundKey] {
						seen[foundKey] = true
						keys = append(keys, foundKey)
					}
				}
			}

			// 2. Check literal string key pattern
			if matches := literalKeyRegex.FindAllStringSubmatch(string(content), -1); len(matches) > 0 {
				for _, m := range matches {
					key := m[1]
					if len(key) >= 4 && !seen[key] {
						seen[key] = true
						keys = append(keys, key)
					}
				}
			}
		}
	}

	return keys
}

// TryDecrypt attempts to decrypt data using candidate keys
// Supports both partial header XOR (first 1024 bytes) and full file XOR
func TryDecrypt(data []byte, keys []string) ([]byte, bool, string) {
	// If it's already clean UTF-8 plain text without high control characters, no decryption needed
	if isLikelyPlainText(data) {
		return data, false, ""
	}

	for _, key := range keys {
		if len(key) == 0 {
			continue
		}

		// Try partial header XOR (first 1024 bytes - typical for RPG Maker web plugins)
		buf1 := make([]byte, len(data))
		copy(buf1, data)
		limit := len(buf1)
		if limit > 1024 {
			limit = 1024
		}
		for i := 0; i < limit; i++ {
			buf1[i] ^= key[i%len(key)]
		}
		if isLikelyPlainText(buf1) {
			return buf1, true, key
		}

		// Try full file XOR
		buf2 := make([]byte, len(data))
		copy(buf2, data)
		for i := 0; i < len(buf2); i++ {
			buf2[i] ^= key[i%len(key)]
		}
		if isLikelyPlainText(buf2) {
			return buf2, true, key
		}
	}

	return data, false, ""
}

func isLikelyPlainText(data []byte) bool {
	if len(data) == 0 {
		return true
	}
	sampleSize := len(data)
	if sampleSize > 1024 {
		sampleSize = 1024
	}
	sample := data[:sampleSize]

	if !utf8.Valid(sample) {
		return false
	}

	// Count non-printable control characters
	controlCount := 0
	for _, b := range sample {
		if b < 0x09 || (b > 0x0D && b < 0x20) {
			controlCount++
		}
	}

	// If more than 2% control characters, it's not plain text
	return float64(controlCount)/float64(sampleSize) < 0.02
}
