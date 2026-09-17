# NST Keyboard Shortcut & Command Architecture Governance

> **Central Command & Keybinding Standard**  
> Scalable shortcut engine supporting hundreds of commands across global keyboard layouts (100% W3C Hardware Code Standard), completely free of hardcoded language mappings, with automated CI enforcement and real-time debugging tools.

---

## 1. The 5 Golden Rules of Keybinding Governance

1. **NEVER attach `addEventListener('keydown', ...)` or `document.addEventListener('keydown', ...)` in components**
   * The application uses a single centralized event listener attached at the root (`CommandProvider`).
   * Ad-hoc event listeners bypass command scoping, input suppression, and diagnostics. Any violation will be caught by `npm run check:ui` and flagged as a fatal **ERROR**.
2. **NEVER test `e.key === 'x'` for shortcuts involving `Ctrl`, `Alt`, or `Meta` modifiers**
   * `e.key` resolves to the localized character of the active keyboard layout (e.g. pressing the physical `F` key yields `"ด"` in Thai, `"а"` in Russian, `"ب"` in Arabic).
   * The central key normalizer maps physical keystrokes to **W3C Physical Hardware Key Codes (`e.code`)** (e.g. `"KeyF"`, `"KeyO"`, `"Enter"`, `"Comma"`), guaranteeing global compatibility across all 190+ languages without manual layout dictionaries.
3. **ALWAYS register shortcuts via `useCommands()` or `registry.register()`**
   * This ties shortcuts to component lifecycles, automatically cleaning up bindings on unmount to prevent lingering shortcuts and memory leaks.
4. **ALWAYS specify an explicit `scope` for view-specific shortcuts**
   * Application-wide shortcuts = `scope: "global"`
   * String editor table shortcuts = `scope: "editor"`
   * Modal dialog shortcuts = `scope: "modal"`
   * Scoping isolates commands and prevents shortcut collision as the application scales to hundreds of commands.
5. **Enforce `preventInInput: true` (default) for character-based shortcuts**
   * Prevents shortcuts from firing while the user is actively typing in an `<input>`, `<textarea>`, or `contenteditable` field.
   * Dedicated navigation shortcuts (e.g. `Ctrl+Enter` to submit, `Escape` to blur/close) can explicitly opt out via `preventInInput: false`.

---

## 2. Component Usage & Patterns

### Registering Scoped Commands (`useCommands` & `useActiveScope`)

```tsx
import { useCommands, useActiveScope } from "@/lib/commands";

export const MyFeatureComponent = () => {
  // 1. Declare active scope for this view (restores previous scope on unmount)
  useActiveScope("my-feature");

  // 2. Register commands with automatic lifecycle cleanup
  useCommands([
    {
      id: "my-feature.save",
      title: "Save Changes",
      category: "Feature",
      keybinding: "Ctrl+S",
      scope: "my-feature",
      run: () => handleSave(),
    },
    {
      id: "my-feature.refresh",
      title: "Refresh Data",
      keybinding: "Ctrl+R",
      scope: "my-feature",
      when: () => isReadyToRefresh, // Guard condition evaluated before execution
      run: () => handleRefresh(),
    },
  ]);

  return <div>...</div>;
};
```

### Component-Local Keystroke Handling (Inputs & Modals)

If you must handle keystrokes directly on an element's `onKeyDown` (such as inline editor commit or cancel):
* **ALWAYS** inspect `e.code` (e.g. `e.code === "Enter"`, `e.code === "Escape"`).
* **NEVER** inspect `e.key` for shortcuts or modifier combinations.

```tsx
<Input
  value={value}
  onKeyDown={(e) => {
    if (e.code === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCommit();
    } else if (e.code === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  }}
/>
```

---

## 3. Debugging & Diagnostics (Runtime Troubleshooting)

When investigating shortcut issues or user reports, diagnose the command system in seconds via the **Browser / Desktop DevTools Console (`Ctrl+Shift+I` or Inspect)**:

### 1. Enable Verbose Debug Logging
Run in the DevTools Console:
```js
__NST_COMMANDS__.setDebug(true)
```
Or set the global window flag before application load:
```js
window.__NST_KEYBINDINGS_DEBUG__ = true
```

### 2. Real-Time Keystroke Audit Logs
Every keystroke will output detailed matching telemetry:
```text
[NST Shortcut Triggered] command='editor.find' keybinding='Ctrl+F' scope='editor' (hardware code='KeyF', printed key='ด')
```
If a shortcut does not trigger, the console logs the exact failure cause:
* `[NST Shortcut Suppressed in Input]` ➔ Suppressed because the active element is an input/textarea.
* `[NST Shortcut Guard Failed]` ➔ Command's `when()` guard condition returned `false`.
* `[NST Shortcut Unmatched]` ➔ No command registered for the physical key combination in the active scope.

### 3. Inspect Registered Commands
```js
// Inspect all registered commands and their scopes in a formatted table
console.table(__NST_COMMANDS__.getAll());

// Programmatically invoke any command to test execution logic in isolation
__NST_COMMANDS__.execute("file.open-game");
```

---

## 4. Keybinding Syntax Reference

| Category | Syntax Examples | Description |
|---|---|---|
| Modifiers | `Ctrl+...`, `Shift+...`, `Alt+...`, `Cmd+...` | Case-insensitive; normalizes `Ctrl` and `Cmd`/`Meta`. |
| Letters | `Ctrl+O`, `Ctrl+Shift+O`, `Ctrl+F` | Matches physical hardware key coordinates independently of OS input layout. |
| Function Keys | `F1`, `F2`, ..., `F12` | Standard function keys. |
| Special Keys | `Enter`, `Escape`, `Tab`, `Space`, `Backspace` | Handles both standard and Numpad equivalents (e.g. `NumpadEnter`). |
| Punctuation | `Ctrl+,`, `Ctrl+.`, `Ctrl+/`, `Ctrl+-` | Punctuation keys mapped by physical key coordinate. |

---

## 5. Automated CI Audit Enforcement

Run the automated architecture audit:
```bash
npm run check:ui
```
The AST scanner traverses the entire codebase. Any ad-hoc `addEventListener("keydown")` call outside `src/lib/commands/` will immediately trigger a CI failure under Category **`9. Keyboard Shortcut Governance (@/commands)`** (`FORBIDDEN_KEYDOWN_LISTENER`).
