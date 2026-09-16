# UI Rules & Architecture Governance

> **NST Frontend UI & Architecture Standard**  
> บังคับใช้มาตรฐาน UI และโครงสร้างสถาปัตยกรรมเดียวกันทั้งโปรเจกต์ (React 18 + Vite + Wails Desktop + `@/ui` Design System) ป้องกัน library รั่วไหล และควบคุม Theme ด้วย Semantic Tokens

---

## 1. กฎเหล็ก 12 ข้อ (Core UI Rules)

1. **ใช้ Design System ผ่าน Gateway `@/ui` เสมอ**
2. **ห้ามติดตั้ง UI Component Library อื่น** โดยไม่ได้รับอนุมัติ (ห้าม MUI, Chakra, Ant Design, Mantine, Bootstrap ฯลฯ)
3. **ห้ามสร้าง Button, Dialog, Input, Badge ใหม่เอง** ต้องใช้ตัวที่มีใน Design System (`@/ui`)
4. **ห้ามใช้ Native UI Element** (`<button>`, `<input>`, `<textarea>`, `<select>`) หากมี Component ใน Design System รองรับ (กรณีจำเป็นอย่างยิ่ง ให้ใช้ comment `// @ui-allow-native` กำกับ)
5. **ห้าม import Radix Primitive หรือ 3rd-party UI โดยตรง** ใน Application code (อนุญาตเฉพาะภายใน `src/ui/`)
6. **ห้ามใช้ Inline Style** (`style={{ ... }}`) สำหรับ layout หรือ color ให้ใช้ Tailwind Utility Classes เสมอ
7. **ห้ามใช้ Arbitrary Colors** เช่น `text-[#3399ff]`, `bg-[#1a1a1a]`, `border-[#2e2e2e]` ใน Application code
8. **สีต้องมาจาก Semantic Design Tokens** (เช่น `bg-background`, `bg-card`, `bg-primary`, `text-foreground`, `text-muted-foreground`, `border-border`)
9. **ห้าม Deep Import** UI primitives จาก `src/components/ui/*` ให้ import ผ่าน `@/ui` เท่านั้น
10. **ใช้ `lucide-react` เป็น Icon Library มาตรฐานเดียวทั้งระบบ** ห้ามติดตั้งหรือ import icon libraries อื่นซ้ำซ้อน
11. **ใช้ `sonner` เป็น Notification & Toast มาตรฐาน** (`import { toast } from "sonner"`)
12. **Unidirectional Dependency Flow**: โค้ดระดับล่าง (UI Primitives) ต้องไม่เรียกโค้ดระดับบน (Pages, Dialogs)

---

## 2. Architecture Layer Hierarchy

```text
frontend/src/
├── pages/                   ← Layer 4: Pages / View Entry
│   ├── EditorPage.tsx       (Main translation string table workspace)
│   └── ProjectsPage.tsx     (Workspace project registry & launcher)
│
├── components/
│   ├── dialogs/             ← Layer 3: Feature Dialogs & Modals
│   │   ├── SettingsDialog.tsx, TranslateDialog.tsx, DeployDialog.tsx, ...
│   │
│   └── layout/              ← Layer 2: Reusable Layout Containers
│       ├── Menubar.tsx
│       └── Statusbar.tsx
│
├── ui/                      ← Layer 1: Design System Primitives (Gateway @/ui)
│   ├── index.ts             (Public export gate)
│   ├── button.tsx, dialog.tsx, input.tsx, badge.tsx, progress.tsx, ...
│
├── lib/                     ← Utilities, helpers, providers
└── index.css                ← Global styles, Tailwind v4 @theme, tokens
```

### ทิศทางการ Import (Unidirectional Dependency Flow)

```text
src/pages (Layer 4)
    ↓
src/components/dialogs (Layer 3)
    ↓
src/components/layout (Layer 2)
    ↓
src/ui (Layer 1 - Design System)
```

* **`src/pages` (Layer 4)**: นำเข้า `dialogs`, `layout`, `ui`, `lib`
* **`src/components/dialogs` (Layer 3)**: นำเข้า `layout`, `ui`, `lib` (**ห้ามเรียกข้ามไปยัง `pages`**)
* **`src/components/layout` (Layer 2)**: นำเข้า `ui`, `lib` (**ห้ามเรียก `dialogs` หรือ `pages`**)
* **`src/ui` (Layer 1)**: ฐานล่างสุดของ Design System (**ห้ามเรียก `dialogs`, `layout`, หรือ `pages`**)

---

## 3. การ Import ผ่าน "ประตูเดียว" (`@/ui`)

ทุก Application code ต้องนำเข้า Base UI Component ผ่าน `@/ui` เท่านั้น:

### ❌ ห้ามเขียน (Forbidden)
```tsx
// ห้าม deep import ทีละไฟล์
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ห้าม import Radix หรือ 3rd-party UI library โดยตรง
import * as DialogPrimitive from "@radix-ui/react-dialog";
```

### ✅ ต้องเขียน (Required)
```tsx
import { Button, Dialog, Input, Badge, Progress, DropdownMenu } from "@/ui";
```

---

## 4. Semantic Design Token Reference

| สิ่งที่พบบ่อย (❌ หลีกเลี่ยง) | Semantic Token ที่ถูกต้อง (✅ ควรใช้) |
|---|---|
| `bg-[#1a1a1a]` | `bg-background` |
| `bg-[#242424]`, `bg-[#222222]` | `bg-card`, `bg-popover` |
| `text-[#f0f0f0]`, `text-white` | `text-foreground` |
| `text-[#3399ff]`, `bg-[#3399ff]` | `text-primary`, `bg-primary` |
| `text-[#888888]`, `text-[#777777]`, `text-[#a0a0a0]` | `text-muted-foreground` |
| `border-[#333333]`, `border-[#2e2e2e]` | `border-border` |
| `border-[#3a3a3a]`, `bg-[#2c2c2c]` | `border-input`, `bg-muted` |
| `text-rose-400`, `bg-rose-600` | `text-destructive`, `bg-destructive` |

---

## 5. การตรวจสอบด้วยสคริปต์อัตโนมัติ (Automated Check)

โปรเจกต์มีสคริปต์สำหรับ Audit สถาปัตยกรรมและ Design Tokens อัตโนมัติ:

### ตรวจสอบภาพรวม (Summary Report)
```bash
bun run audit:ui -- --summary
# หรือ
npm run audit:ui -- --summary
```

### ตรวจสอบอย่างละเอียด (Full Report พร้อมตำแหน่งไฟล์และวิธีแก้)
```bash
npm run audit:ui
```

### กรองดูเฉพาะหมวดหมู่
```bash
# ตรวจสอบการใช้สีแบบ Arbitrary Hex
npm run audit:ui -- --category=ARBITRARY_COLOR

# ตรวจสอบการ Deep Import
npm run audit:ui -- --category=DEEP_UI_IMPORT

# ตรวจสอบการใช้ native button/input
npm run audit:ui -- --category=NATIVE_ELEMENT
```

### โหมด CI Enforcement (เข้มงวด - มี Error จะสั่ง exit code 1)
```bash
npm run check:ui
```
