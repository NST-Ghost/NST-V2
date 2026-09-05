package masker

import (
	"testing"
)

func TestMaskAndUnmask(t *testing.T) {
	tests := []struct {
		name         string
		input        string
		simulatedLLM func(masked string) string
		expected     string
	}{
		{
			name:  "Basic color and variable code",
			input: `\C[1]Hero\C[0]: I have \V[10] coins!`,
			simulatedLLM: func(masked string) string {
				// Simulates translation to Thai
				// "__NST_TAG_0__Hero__NST_TAG_1__: I have __NST_TAG_2__ coins!"
				return "__NST_TAG_0__ผู้กล้า__NST_TAG_1__: ฉันมีเหรียญ __NST_TAG_2__ เหรียญ!"
			},
			expected: `\C[1]ผู้กล้า\C[0]: ฉันมีเหรียญ \V[10] เหรียญ!`,
		},
		{
			name:  "Double backslashes JSON format",
			input: `\\N[1] went to the store.`,
			simulatedLLM: func(masked string) string {
				return "__NST_TAG_0__ เดินไปที่ร้านค้า"
			},
			expected: `\\N[1] เดินไปที่ร้านค้า`,
		},
		{
			name:  "Fuzzy LLM whitespace recovery",
			input: `Danger! \!\{Run!\}`,
			simulatedLLM: func(masked string) string {
				// LLM accidentally puts spaces inside tag e.g. __ NST_TAG_0 __
				return "อันตราย! __ NST_TAG_0 ____NST_TAG_1__วิ่ง!__NST_TAG_2__"
			},
			expected: `อันตราย! \!\{วิ่ง!\}`,
		},
		{
			name:  "No control codes",
			input: "Just plain text without codes.",
			simulatedLLM: func(masked string) string {
				return "ข้อความธรรมดาไม่มีโค้ด"
			},
			expected: "ข้อความธรรมดาไม่มีโค้ด",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := Mask(tt.input)
			translated := tt.simulatedLLM(res.MaskedText)
			restored := Unmask(translated, res.TagMap)

			if restored != tt.expected {
				t.Errorf("Expected:\n%q\nGot:\n%q", tt.expected, restored)
			}
		})
	}
}
