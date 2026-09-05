# NST Remake Blueprint & Master Plan (Golang Edition)

> **สำหรับ AI และนักพัฒนาในรอบถัดไป:** โปรดอ่านเอกสารนี้และข้อกำหนดใน `.agents/rules/golang_remake_guide.md` ก่อนเริ่มงานทุกครั้ง เพื่อให้สถาปัตยกรรมและการพัฒนาเป็นไปในทิศทางเดียวกันอย่างต่อเนื่อง

---

## 1. เป้าหมายและบริบทของโปรเจกต์ (Project Context)

โปรเจกต์ดั้งเดิม **NST (Novelty Translation Tool)** ถูกพัฒนาด้วย:
- **C++20 & Qt 6 Widgets:** เจอปัญหา Dynamic Linking / DLL Dependency บน Windows, Shared Library Compatibility บน Linux (glibc mismatch), และ Packaging ที่ซับซ้อนบน macOS
- **Rust Toolchains & FFI Bindings (`rpgm_rs`, `renpy_rs`, `unity_assets_rs`):** ต้องคอมไพล์ข้ามภาษาผ่าน C/C++ FFI
- **Python / uv / Lua:** มี runtime ซ้อนกันหลายชั้น

**เป้าหมายของ Go Remake (`nst-go/`):**
1. **100% Cross-Platform Pure Go (`CGO_ENABLED=0`):** คอมไพล์เป็น Static Binary ไฟล์เดียว ไม่ต้องติดตั้ง runtime หรือ dependency ใด ๆ บนเครื่องปลายทาง
2. **Instant Multi-Platform Build:** สามารถสั่ง `make cross-compile` เพื่อสร้าง `.exe` สำหรับ Windows, Binaries สำหรับ Linux (x86_64, ARM64), และ macOS (Apple Silicon, Intel) ได้จากเครื่องเดียวในเวลาไม่กี่วินาที
3. **High Concurrency & Safety:** การประมวลผลแปลไฟล์เกมคู่ขนานด้วย Goroutines พร้อมระบบ Translation Memory (TM Cache) และระบบ Masking ป้องกันแท็กเกมเสียหาย 100%

---

## 2. แผนที่เทียบเคียงโค้ดเดิม vs โค้ดใหม่ (Codebase Mapping)

| ระบบงาน | โค้ดต้นฉบับเดิม (C++ / Rust) | โค้ดใหม่ใน Go (`nst-go/`) | สถานะ |
| :--- | :--- | :--- | :--- |
| **Data Models & Types** | `src/models/*`, `src/core/translationcore.h` | [`nst-go/pkg/model/model.go`](file:///home/jop/work/NST/nst-go/pkg/model/model.go) | ✅ สำเร็จ (PASS) |
| **Control Code Masker** | `src/core/rpgm_control_masker.h/cpp` | [`nst-go/pkg/masker/masker.go`](file:///home/jop/work/NST/nst-go/pkg/masker/masker.go) | ✅ สำเร็จ (PASS) |
| **Workspace & TM Cache** | `src/db/nstdatabase.h/cpp` (Qt QSqlDatabase) | [`nst-go/pkg/storage/storage.go`](file:///home/jop/work/NST/nst-go/pkg/storage/storage.go) | ✅ สำเร็จ (PASS) |
| **RPG Maker MV/MZ Parser**| `rpgm_rs/src/lib.rs` (Rust FFI) | [`nst-go/pkg/parser/rpgm/`](file:///home/jop/work/NST/nst-go/pkg/parser/rpgm/) | ✅ สำเร็จ (PASS) |
| **Translation Engine** | `src/core/translationcore.cpp`, `qtlingo` | [`nst-go/pkg/pipeline/pipeline.go`](file:///home/jop/work/NST/nst-go/pkg/pipeline/pipeline.go) | ✅ สำเร็จ (PASS) |
| **Translation Providers** | `src/plugins/*`, `qtlingo` | [`nst-go/pkg/translator/`](file:///home/jop/work/NST/nst-go/pkg/translator/) | ✅ สำเร็จ (PASS) |
| **CLI Management** | `src/main.cpp` (QCommandLineParser) | [`nst-go/cmd/nst/main.go`](file:///home/jop/work/NST/nst-go/cmd/nst/main.go) | ✅ สำเร็จ (PASS) |
| **Interactive GUI / Web** | `src/ui/*`, `src/ui_new/*` (Qt Widgets) | `pkg/webui/` + `cmd/nst-desktop/` (Wails v3) | ⏳ Phase 12 (In Progress) |
| **Ren'Py Parser** | `renpy_rs/` + `unrpyc_rs/` (Rust) | `nst-go/pkg/parser/renpy/` | ✅ สำเร็จ (PASS) |
| **Unity Assets Parser** | `unity_assets_rs/` (Rust) | `nst-go/pkg/parser/unity/` | ✅ สำเร็จ (PASS) |
| **MCP Server Integration**| `src/core/mcpserver.h/cpp` | `nst-go/pkg/mcp/` | ✅ สำเร็จ (PASS) |
| **Image OCR / Translation**| `scripts/install-ai-features.sh` | Subprocess / Vision API Pipeline | ⏳ แผนลำดับถัดไป |

---

## 3. รายละเอียดและสถานะของแต่ละ Phase (Milestone Checklist)

### Phase 1: Core Foundation & Storage ✅ (เสร็จสมบูรณ์)
- [x] ออกแบบโครงสร้าง Go Module ใน `nst-go/`
- [x] นิยาม Domain Models: `Project`, `TextEntry`, `TranslationStatus`, `ExtractionStats`
- [x] ใช้ Pure Go SQLite (`modernc.org/sqlite`) เก็บไฟล์ `.nst` และ Translation Memory (TM Cache)
- [x] ทดสอบ Unit Tests สำหรับ Storage (`go test -v ./pkg/storage`)

### Phase 2: RPG Maker Parser & Masker ✅ (เสร็จสมบูรณ์)
- [x] พอร์ตลอจิกจาก `rpgm_rs` มาเป็น Pure Go ใน `pkg/parser/rpgm/`
- [x] ระบบสกัดข้อความ (Dialogue 401, Choices 102, Speaker 101, Database files)
- [x] ระบบแพตช์ไฟล์กลับ (JSON Tree Injector ตาม KeyPath)
- [x] ระบบ Masking ป้องกันแท็กควบคุมเกม (`\c[1]`, `\v[n]`, `\n[n]`, `\{`, ฯลฯ) พร้อม Fuzzy Recovery
- [x] ทดสอบ Unit Tests (`go test -v ./pkg/parser/rpgm`, `go test -v ./pkg/masker`)

### Phase 3: Translation Pipeline & Providers ✅ (เสร็จสมบูรณ์)
- [x] ออกแบบ Generic `Translator` interface ใน `pkg/translator/`
- [x] Implement Mock Translator สำหรับการทดสอบ
- [x] Implement Google Gemini API provider (`gemini-2.5-flash`, etc.)
- [x] Implement OpenAI / Ollama / Local LLM provider
- [x] ระบบ Concurrent Worker Pool, Auto Retry, และ TM Cache Lookup
- [x] ทดสอบ Unit Tests สำหรับ Pipeline (`go test -v ./pkg/pipeline`)

### Phase 4: CLI & Cross-Platform Verification ✅ (เสร็จสมบูรณ์)
- [x] สร้าง CLI Tool `cmd/nst` รองรับคำสั่ง `extract`, `translate`, `inject`, `status`, `version`
- [x] ทดสอบ End-to-End กับเกมทดสอบ (สกัด -> แปล -> แพตช์กลับ สำเร็จสมบูรณ์)
- [x] สร้าง `Makefile` สำหรับ Cross-compilation
- [x] คอมไพล์ทดสอบสร้าง Binaries สำเร็จครบทุก OS ใน `nst-go/dist/`:
  - `nst-windows-amd64.exe` (11 MB)
  - `nst-linux-amd64` (11 MB)
  - `nst-linux-arm64` (9.6 MB)
  - `nst-darwin-arm64` (9.8 MB - Apple Silicon M1/M2/M3/M4)
  - `nst-darwin-amd64` (11 MB - Intel Mac)

---

### Phase 5: GUI (Native Desktop GUI Application) ✅ (เสร็จสมบูรณ์)
- [x] **Native Desktop Window:** พัฒนา [`pkg/desktop/desktop.go`](file:///home/jop/work/NST/nst-go/pkg/desktop/desktop.go) รันหน้าต่าง Native Desktop App ผ่าน WebKitGTK/WebView
- [x] **ถอดแบบ UI จากโปรเจกต์เดิม (1:1 NST Qt Style):**
  - [x] **Theme & Color Palette:** ใช้สีดั้งเดิมจาก `src/ui/style.qss` (พื้นหลัง `#1a1a1a`, แถบเมนู `#2b2b2b`, สีไฮไลต์ Accent `#3399ff`)
  - [x] **Top Menu Bar (Qt style):** เมนู File, Translate, View, Help พร้อม Dropdowns
  - [x] **Main Toolbar:** ปุ่ม Open Project, Save, Translate, Deploy, Settings, และช่อง Search (Ctrl+F)
  - [x] **Left Panel (File List):** แสดงรายการไฟล์ทั้งหมด (`Map001.json`, `System.json`, ฯลฯ) พร้อม Badge จำนวนข้อความต่อไฟล์ และคลิกเพื่อกรองไฟล์ที่ต้องการได้ทันที
  - [x] **Right Panel (Translation Grid & Detail Box):** ตาราง Spreadsheet คอลัมน์ `#`, `Key`, `Original (Source)`, `Translation (Target)` พร้อมกล่อง Detail Preview ด้านล่างสำหรับแก้ไขคำแปลแบบเต็มบรรทัด
  - [x] **Bottom Status Bar:** แสดงสถานะการทำงาน, ชื่อไฟล์ที่เลือก, จำนวนข้อความทั้งหมด, จำนวนที่แปลแล้ว และหลอด Progress Bar ในตัว

### Phase 6: Non-Destructive JS Injection Layer (`pkg/injection/rpgm`) ✅ (เสร็จสมบูรณ์)
- [x] **Drop-in Translation Layer:** พอร์ตตัว Export จาก `src/core/rpgm_injection_exporter.cpp` และฝัง `NST_TranslationLayer.js` ไว้ใน Go binary ผ่าน `//go:embed`
- [x] **Output Structure:** สร้างโฟลเดอร์ `nst_translations/` บรรจุไฟล์ `.txt` (`<<<ORIGINAL>>>` / `<<<TRANSLATED>>>`) และ `.json` พร้อม `config.json`
- [x] **Auto-Register Runtime:** ตรวจจับและแพตช์ `js/plugins.js` ของเกม MV/MZ ให้อ่านไฟล์แปลอัตโนมัติ โดยไม่แตะต้องไฟล์ `data/*.json` เดิมแม้แต่ไบต์เดียว
- [x] **Cross-Platform Play:** ใช้งานได้ทันทีบน PC (NW.js), JoiPlay (Android), Mac, Linux, และ Browser
- [x] **Unit Tests & Integration:** ทดสอบผ่าน 100% (`go test -v ./pkg/injection/rpgm`) และมีคำสั่ง `nst deploy` ใน CLI และ REST API `/api/deploy` ใน Desktop UI

### Phase 7: Real-time In-Game TCP Server (`pkg/realtimeserver`) ⏳
- [ ] **TCP Server:** พอร์ต `src/core/translationserver.cpp` ที่รันบนพอร์ต `14478`
- [ ] **Live Hook Bridge:** รับข้อความที่เกมส่งผ่าน Socket เข้ามา เช็ค TM Cache แปล และส่งกลับแบบ Real-time
- [ ] **Live Dialogue View:** แสดงผลบทสนทนาที่กำลังวิ่งสดในเกมลงใน UI

### Phase 8: Project Registry & Game Version Auto-Merge (`pkg/registry`, `pkg/merger`) ✅ (เสร็จสมบูรณ์)
- [x] **Project Registry:** พัฒนา [`pkg/registry/registry.go`](file:///home/jop/work/NST/nst-go/pkg/registry/registry.go) จดจำรายชื่อโปรเจกต์ทั้งหมดในเครื่อง (`~/.config/nst/projects.json`) พร้อมคำนวณ % การแปล และคำสั่ง `nst projects`
- [x] **Game Version Auto-Merge:** พัฒนา [`pkg/merger/merger.go`](file:///home/jop/work/NST/nst-go/pkg/merger/merger.go) สแกนเกมเวอร์ชันอัปเดตใหม่ (เช่น v1.0 -> v1.1) และ Auto-Merge คำแปลเดิมให้อัตโนมัติ (Exact Match + Fuzzy Relocation Match) สกัดเฉพาะประโยคใหม่
- [x] **Unit Tests & Integration:** ทดสอบผ่าน 100% (`go test -v ./pkg/registry`, `go test -v ./pkg/merger`) และมีคำสั่ง `nst merge` ใน CLI และ REST API `/api/projects`, `/api/project/merge`

### Phase 9: Smart Filter Rules & Relation Analyzer (`pkg/filter`, `pkg/analyzer`) ✅ (ออกแบบแบบ Loose Coupling)
- [x] **Smart Filter Manager:** พัฒนา [`pkg/filter/filter.go`](file:///home/jop/work/NST/nst-go/pkg/filter/filter.go) จัดการการข้ามคำที่ไม่ต้องแปล (URLs, นามสกุลไฟล์, symbols, numbers, prefixes) รองรับ Learn/Unlearn และ Import/Export Rules เป็น JSON
- [x] **RPG Relation Analyzer:** พัฒนา [`pkg/analyzer/analyzer.go`](file:///home/jop/work/NST/nst-go/pkg/analyzer/analyzer.go) แบบ Standalone สแกนความเชื่อมโยงของ Events (Calls CommonEvent, Toggles Switch, Modifies Variable)
- [x] **Decoupled Architecture:** แยกออกเป็นโมดูลอิสระ ไม่ผูกติดกับ Core Pipeline หากในอนาคตต้องการตัดออก สามารถถอดออกได้ทันทีโดยไม่กระทบส่วนอื่น

### Phase 10: Multi-Engine Parsers (Ren'Py, Godot, Unity) ✅ (เสร็จสมบูรณ์)
- [x] **Ren'Py (`pkg/parser/renpy`):** สกัด `.rpy` / `.rpyc` dialogue และ menu choices, สร้าง translation files รูปแบบ native Ren'Py (`tl/Thai/nst_translations.rpy` และ `nst_language.rpy`)
- [x] **Godot (`pkg/parser/godot`):** สกัดข้อความจาก `.tscn` scene files, GDScript `tr("...")`, และ `.csv` translation tables พร้อมรองรับการแพตช์ไฟล์กลับ
- [x] **Unity (`pkg/parser/unity`):** สกัด YAML `.asset` / `.prefab`, `StreamingAssets` JSON/CSV localization tables, และ Export สู่มาตรฐาน universal `XUnity.AutoTranslator` (`Translation/th/Text/nst_translations.txt`) ที่นำไป drop-in ใส่ตัวเกม Unity ได้ทันทีโดยไม่ต้อง decompile
- [x] **Unified Engine Dispatcher (`pkg/parser`):** พัฒนา `DetectEngine()`, `GetParser()`, `SupportedEngines()` ตรวจจับเอนจินของเกมอัตโนมัติ และเชื่อมต่อเข้ากับทั้ง CLI (`nst extract`, `nst inject`, `nst merge`) และ WebUI / Desktop App REST API
- [x] **Unit Tests & Cross-Platform Build:** ทดสอบ Unit Tests ทุก Engine ผ่าน 100% (`go test -v ./pkg/parser/...`) และคอมไพล์ผ่านทั้ง 5 แพลตฟอร์มด้วย `CGO_ENABLED=0`

### Phase 11: Ecosystem & Plugins (`pkg/plugins`, `pkg/mcp`) ✅ (เสร็จสมบูรณ์)
- [x] **Chanomhub Publisher (`pkg/plugins/chanomhub`):** บีบอัดโฟลเดอร์คำแปล `nst_translations/` เป็น `.zip` อัตโนมัติด้วย Pure Go (`archive/zip`) พร้อมฟังก์ชันอัปโหลดไปยัง Storage Service (`/upload`) และส่งข้อมูลเข้าสู่ระบบ Moderation ของ Chanomhub ผ่าน REST API (`/mods/article/<slug>/nst-submission`) รองรับการเรียกผ่าน CLI (`nst publish`) และ REST API (`/api/publish/chanomhub`)
- [x] **Sensitive Content AI Prompts (`pkg/translator/prompts`):** ออกแบบระบบ Persona Prompts (`standard`, `vn_romance`, `dan_uncensored`, `fantasy_rpg`) เพื่อวางกรอบบริบท (Framing Context) ให้กับ AI (Gemini, OpenAI, Ollama) ป้องกันปัญหา AI ปฏิเสธการแปล (Refusal Bypass) ในบทสนทนาเกมที่มีความโรแมนติก ละเอียดอ่อน หรือเนื้อหา 18+
- [x] **MCP Server (`pkg/mcp`):** พัฒนาระบบ Model Context Protocol (JSON-RPC 2.0 มาตรฐานปี 2024-11-05) บน Stdio (`nst mcp`) รองรับ 7 เครื่องมือหลัก (`nst_load_project`, `nst_get_status`, `nst_query_entries`, `nst_update_entry`, `nst_translate`, `nst_deploy`, `nst_publish_chanomhub`) ให้ Cursor, Claude Desktop, Antigravity, และ External AI Agents เชื่อมต่อเข้ามาควบคุมการแปลได้โดยตรง
- [x] **Unit Tests & Integration:** ทดสอบ Unit Tests ทุกโมดูลผ่าน 100% (`chanomhub_test.go`, `server_test.go`, `prompts_test.go`) และรองรับ Cross-Compilation ครบทุกแพลตฟอร์ม

### Phase 12: Modern Desktop GUI (Wails v3 + React + Vite + TypeScript) ✅ (เสร็จสมบูรณ์)
- [x] **Shared Use-Case Layer (`pkg/app`):** แยก Business Logic ออกจาก `cmd/nst` และ `pkg/webui` เพื่อให้ CLI, WebUI, MCP, และ Wails เรียกใช้ร่วมกันได้แบบ DRY
- [x] **Optimized Storage Query (`pkg/storage`):** เพิ่ม Query Filtering, Paging และ `ListFiles()` สำหรับจัดการโปรเจกต์ขนาดใหญ่ (26k+ entries)
- [x] **Wails v3 Desktop Architecture (`cmd/nst-desktop`):** สถาปัตยกรรม Desktop Application สมัยใหม่พร้อม Typed TS Bindings
- [x] **Modern Frontend UI (`frontend/`):** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Table/Virtual สำหรับแสดงผลและแก้ไขคำแปล
- [x] **Native File Dialogs & Settings:** รองรับการเลือกโฟลเดอร์เกม/ไฟล์ `.nst` ด้วย Native OS Dialogs และเก็บการตั้งค่าไว้ที่ `~/.config/nst/settings.json`

---

## 4. วิธีการทดสอบและคำสั่งที่สำคัญ (How to Test & Build)

สำหรับ AI หรือผู้พัฒนาที่ต้องการตรวจสอบหรือรันคำสั่งในรอบถัดไป:

```bash
# 1. เข้าไปที่โฟลเดอร์ Go
cd nst-go

# 2. รัน Unit Tests ทั้งหมด (CLI & Core packages พร้อม CGO_ENABLED=0)
CGO_ENABLED=0 go test -v ./...

# 3. คอมไพล์ CLI เฉพาะเครื่องปัจจุบัน
make build

# 4. ทดสอบคำสั่ง CLI
./bin/nst --help
./bin/nst version

# 5. คอมไพล์แจกจ่าย CLI ทุกแพลตฟอร์ม (Windows, Linux, macOS)
make cross-compile

# 6. คอมไพล์ Desktop Application (Wails v3 - ต้องใช้ CGO)
wails3 build
```

---

## 5. กฎเหล็กสำหรับการเขียนโค้ดต่อยอด (Rules for Next Developers / AI)

1. **CGO Dependency Policy:**
   - สำหรับ CLI (`cmd/nst`) และ Core Packages (`pkg/...` ยกเว้น GUI bindings): **ต้องรักษา `CGO_ENABLED=0`** เพื่อให้การ build ข้าม OS ไม่พัง
   - สำหรับ Desktop Application (`cmd/nst-desktop`): **อนุญาตให้ใช้ `CGO_ENABLED=1`** เนื่องจาก Wails v3 จำเป็นต้องเชื่อมต่อกับ WebKitGTK (Linux), WebView2 (Windows), และ WebKit (macOS)
2. **รักษา Tag Masking เสมอ:** อย่าให้ข้อความที่มี `\c[1]` หรือแท็กพิเศษถูกส่งไปแปลดิบ ๆ โดยไม่ผ่าน `masker.Mask`
3. **Empty Text Fallback:** หากบริการแปลคืนค่าว่าง ให้ fallback กลับไปใช้ Source Text เสมอ เพื่อป้องกันเกม Error หน้าจอดำ
4. **Shared Layer Principle:** ห้ามเขียน logic ซ้ำซ้อนระหว่าง CLI, WebUI, MCP และ Desktop GUI ให้รวม logic อยู่ที่ `pkg/app` เสมอ
