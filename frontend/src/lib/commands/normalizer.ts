import type { ParsedKeybinding } from "./types";

const SPECIAL_KEYS: Record<string, { code: string; key: string }> = {
  enter: { code: "Enter", key: "Enter" },
  return: { code: "Enter", key: "Enter" },
  escape: { code: "Escape", key: "Escape" },
  esc: { code: "Escape", key: "Escape" },
  space: { code: "Space", key: " " },
  tab: { code: "Tab", key: "Tab" },
  backspace: { code: "Backspace", key: "Backspace" },
  delete: { code: "Delete", key: "Delete" },
  del: { code: "Delete", key: "Delete" },
  up: { code: "ArrowUp", key: "ArrowUp" },
  arrowup: { code: "ArrowUp", key: "ArrowUp" },
  down: { code: "ArrowDown", key: "ArrowDown" },
  arrowdown: { code: "ArrowDown", key: "ArrowDown" },
  left: { code: "ArrowLeft", key: "ArrowLeft" },
  arrowleft: { code: "ArrowLeft", key: "ArrowLeft" },
  right: { code: "ArrowRight", key: "ArrowRight" },
  arrowright: { code: "ArrowRight", key: "ArrowRight" },
  comma: { code: "Comma", key: "," },
  period: { code: "Period", key: "." },
  slash: { code: "Slash", key: "/" },
  semicolon: { code: "Semicolon", key: ";" },
  minus: { code: "Minus", key: "-" },
  equal: { code: "Equal", key: "=" },
  backslash: { code: "Backslash", key: "\\" },
  bracketleft: { code: "BracketLeft", key: "[" },
  bracketright: { code: "BracketRight", key: "]" },
};

const PUNCTUATION_CODE_MAP: Record<string, string> = {
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
  "-": "Minus",
  "=": "Equal",
  "\\": "Backslash",
  "[": "BracketLeft",
  "]": "BracketRight",
};

/**
 * Parses a keybinding string (e.g. "Ctrl+Shift+O", "Ctrl+,", "Ctrl+Enter")
 * into normalized physical W3C KeyboardEvent.code and modifier flags.
 * 
 * Works 100% universally across any keyboard layout on Earth (Thai, Russian,
 * Japanese, Arabic, Greek, Hebrew, French AZERTY, German QWERTZ, etc.)
 * by targeting the physical hardware key position (e.code).
 */
export function parseKeybinding(raw: string): ParsedKeybinding {
  const parts = raw.split("+").map((p) => p.trim());
  let ctrl = false;
  let shift = false;
  let alt = false;
  let meta = false;
  let keyPart = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      ctrl = true;
    } else if (lower === "shift") {
      shift = true;
    } else if (lower === "alt" || lower === "option") {
      alt = true;
    } else if (lower === "meta" || lower === "cmd" || lower === "command" || lower === "super") {
      meta = true;
    } else {
      keyPart = part;
    }
  }

  const lowerKey = keyPart.toLowerCase();
  let code = "";
  let key = keyPart;

  // 1. Special named keys (Enter, Escape, Comma, etc.)
  if (SPECIAL_KEYS[lowerKey]) {
    code = SPECIAL_KEYS[lowerKey].code;
    key = SPECIAL_KEYS[lowerKey].key;
  }
  // 2. Direct punctuation character (",", ".", etc.)
  else if (PUNCTUATION_CODE_MAP[keyPart]) {
    code = PUNCTUATION_CODE_MAP[keyPart];
    key = keyPart;
  }
  // 3. Function keys (F1 - F12)
  else if (/^f[1-9][0-2]?$/i.test(keyPart)) {
    code = keyPart.toUpperCase();
    key = keyPart.toUpperCase();
  }
  // 4. Numeric digits (0 - 9)
  else if (/^[0-9]$/.test(keyPart)) {
    code = `Digit${keyPart}`;
    key = keyPart;
  }
  // 5. Alphabetic letters (A - Z) -> W3C physical hardware code "Key" + letter
  else if (keyPart.length === 1 && /[a-z]/i.test(keyPart)) {
    code = `Key${keyPart.toUpperCase()}`;
    key = keyPart.toLowerCase();
  }
  // 6. Generic fallback
  else {
    code = keyPart;
    key = keyPart;
  }

  return {
    raw,
    ctrl,
    shift,
    alt,
    meta,
    code,
    key,
  };
}

/**
 * Checks whether a given KeyboardEvent matches the parsed keybinding definition.
 * Prioritizes physical `e.code` (independent of OS keyboard language),
 * with a fallback to `e.key` for virtual keyboards or software IMEs.
 */
export function matchesKeybinding(
  e: KeyboardEvent | React.KeyboardEvent,
  parsed: ParsedKeybinding
): boolean {
  // 1. Check Modifiers
  // Treat Ctrl and Meta interchangeably for Mac Cmd / Linux Super cross-platform convenience
  const hasCtrlOrMeta = Boolean(e.ctrlKey || e.metaKey);
  const wantsCtrlOrMeta = parsed.ctrl || parsed.meta;

  if (wantsCtrlOrMeta && !hasCtrlOrMeta) return false;
  if (!wantsCtrlOrMeta && hasCtrlOrMeta) return false;

  if (Boolean(e.shiftKey) !== parsed.shift) return false;
  if (Boolean(e.altKey) !== parsed.alt) return false;

  // 2. Physical hardware code matching (Primary check - universal across all languages)
  if (parsed.code && e.code === parsed.code) {
    return true;
  }

  // Support NumpadEnter when Enter is requested
  if (parsed.code === "Enter" && e.code === "NumpadEnter") {
    return true;
  }

  // 3. Fallback check by printed character (for soft keyboards or layout match)
  if (parsed.key && e.key && e.key.toLowerCase() === parsed.key.toLowerCase()) {
    return true;
  }

  return false;
}
