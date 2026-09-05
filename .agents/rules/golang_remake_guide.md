# AI Guidelines: NST Golang Remake (Cross-Platform Modernization)

When working on the NST Golang remake (located in `nst-go/`), ALL AI agents MUST adhere to the following architectural rules, standards, and progress tracking:

---

## 1. Golden Architectural Rules

### Rule 1: Zero CGO Dependency for CLI (`CGO_ENABLED=0`)
- **Requirement:** The CLI tool (`cmd/nst`) and all core packages (`pkg/...` except GUI bindings) MUST build and pass tests with `CGO_ENABLED=0`.
- **Desktop Target (`cmd/nst-desktop`):** The Wails desktop GUI binary requires CGO (`CGO_ENABLED=1`) for native OS webview / WebKitGTK bindings and per-OS builds.
- **Reason:** To allow seamless cross-compilation for the CLI across Windows (`.exe`), Linux, and macOS from any host without external cross-toolchains.
- **SQLite Storage:** Always use pure Go SQLite driver `modernc.org/sqlite` (DO NOT use `github.com/mattn/go-sqlite3` which requires CGO).

### Rule 2: Game Engine Safety & Preservation
- Reference: Follow `.agents/rules/rpgm_translation_safety.md` strictly.
- **Escape Code Masking:** All escape codes (`\V[...]`, `\N[...]`, `\C[...]`, `\I[...]`, `\FS[...]`, etc.) and plugin prefixes (`X座標 = `, `テキスト = `, etc.) MUST be masked with immutable tokens (`__NST_TAG_n__`) before calling any translation provider, and unmasked post-translation.
- **Fallback Guard:** If a translation service returns an empty string, whitespace, or invalid tags for a non-empty source text, NEVER inject or save an empty string. Fall back to the original `sourceText`.

### Rule 3: Single-Binary Principle
- CLI, Embedded Web UI assets, and core logic must compile into a single standalone binary.
- Use Go's standard `//go:embed` for embedding frontend web assets, default dictionaries, or scripts.

---

## 2. Codebase Mapping: Original (C++/Rust/Qt) -> New (Go)

| Original Component (C++/Rust/Qt) | Go Target (`nst-go/`) | Status | Responsibility |
| :--- | :--- | :--- | :--- |
| `rpgm_rs/` (Rust crate) | `pkg/parser/rpgm/` | ✅ Done | RPG Maker MV/MZ JSON extractor & JSON patch injector |
| `src/core/rpgm_control_masker.*` | `pkg/masker/` | ✅ Done | Control code masking, fuzzy unmasking, token protection |
| `src/db/nstdatabase.*` (Qt SQL) | `pkg/storage/` | ✅ Done | Pure Go SQLite storage (`.nst` workspace & TM cache) |
| `src/core/translationcore.*` | `pkg/pipeline/` | ✅ Done | Concurrent batch translation, rate limiting, TM cache lookup |
| `src/managers/translationservicemanager.*` | `pkg/translator/` | ✅ Done | Pluggable providers (Gemini, OpenAI/Ollama, Mock) |
| `src/main.cpp` / CLI flags | `cmd/nst/` | ✅ Done | Unified CLI commands (`extract`, `translate`, `inject`, `deploy`, `merge`, `projects`, `publish`, `mcp`) |
| `src/core/rpgm_injection_exporter.*` | `pkg/injection/rpgm/` | ✅ Done | Non-destructive JS translation layer (`NST_TranslationLayer.js`) |
| `src/managers/projectregistry.*` | `pkg/registry/` | ✅ Done | Central project tracker & statistics |
| `src/core/smartmerge.*` | `pkg/merger/` | ✅ Done | Two-tier exact & fuzzy version reconciler |
| `src/managers/smartfiltermanager.*` | `pkg/filter/` | ✅ Done | Standalone pattern filter manager (loose coupling) |
| `src/core/relationanalyzer.*` | `pkg/analyzer/` | ✅ Done | RPG Maker event relation & dependency analyzer |
| `renpy_rs/` + `unrpyc_rs/` (Rust) | `pkg/parser/renpy/` | ✅ Done | Pure Go parser for Ren'Py dialogue, menu choices, and `tl/Thai/` export |
| `BGA/bga_rs/` (Godot engine) | `pkg/parser/godot/` | ✅ Done | Godot `.tscn`, `tr()`, and `.csv` localization parser |
| `unity_assets_rs/` (Rust) | `pkg/parser/unity/` | ✅ Done | Unity YAML assets, StreamingAssets JSON/CSV, and XUnity.AutoTranslator |
| `src/ui/` & `src/ui_new/` (Qt6 Widgets) | `pkg/desktop/` + `pkg/webui/` | ✅ Done | Native 1:1 Qt6 dark theme GUI with webview & REST API |
| `src/plugins/ChanomhubPlugin/` | `pkg/plugins/chanomhub/` | ✅ Done | Pure Go zip packager & Chanomhub API publisher |
| `src/core/mcpserver.*` | `pkg/mcp/` | ✅ Done | Model Context Protocol (JSON-RPC 2.0) server over Stdio (`nst mcp`) |

---

## 3. How Future AI Sessions Should Pick Up Work

When a user asks to continue development, follow these steps:
1. Check `REMAKE_SPEC.md` for current milestone progress.
2. Verify existing tests with `cd nst-go && go test -v ./...`.
3. Pick the next uncompleted task `[ ]` from `REMAKE_SPEC.md`.
4. Always write unit tests before/alongside implementation.
5. Verify cross-compilation with `make cross-compile`.
6. Update checkboxes `[x]` in `REMAKE_SPEC.md` upon completion.
