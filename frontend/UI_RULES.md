# UI Rules & Architecture Governance

> **NST Frontend UI & Architecture Standard**  
> Enforces unified UI standards, architectural boundaries, and design system governance across the entire project (React 18 + Vite + Wails Desktop + `@/ui` Design System). Prevents library sprawl, enforces token-based theming, and ensures long-term codebase maintainability.

---

## 1. Core UI Rules (The 13 Commandments)

1. **Always Consume the Design System via `@/ui` Gateway**: All UI primitives must be imported from `@/ui`.
2. **Forbidden 3rd-Party UI Component Libraries**: Installing unauthorized UI component libraries (MUI, Chakra, Ant Design, Mantine, Bootstrap, etc.) is strictly prohibited.
3. **No Reinventing Primitives**: Never hand-craft custom Button, Dialog, Input, Badge, or Progress components. Use the official Design System components (`@/ui`).
4. **No Raw HTML Native Form Elements**: Avoid `<button>`, `<input>`, `<textarea>`, and `<select>` when corresponding Design System components exist. (In rare exceptions, tag with `// @ui-allow-native`).
5. **No Direct Radix Primitive Imports**: Application code must never directly import `@radix-ui/*` packages. All Radix primitives must be wrapped and exported through `src/ui/`.
6. **No Inline Styles for Layout or Theming**: Do not use `style={{ ... }}` for layout or colors. Use Tailwind utility classes.
7. **No Arbitrary Hex Colors**: Hardcoded colors such as `text-[#3399ff]`, `bg-[#1a1a1a]`, or `border-[#2e2e2e]` in application code are strictly forbidden.
8. **All Colors Must Derive from Semantic Design Tokens**: Use semantic tokens (e.g. `bg-background`, `bg-card`, `bg-primary`, `text-foreground`, `text-muted-foreground`, `border-border`).
9. **No Deep Imports from `ui` Subdirectories**: Do not import from `src/components/ui/*`. All imports must pass through the `@/ui` gateway.
10. **Lucide React as the Single Icon Standard**: `lucide-react` is the only approved icon library. Do not import or install competing icon packs.
11. **Sonner as the Notification & Toast Standard**: All toasts and notifications must use `sonner` (`import { toast } from "sonner"`).
12. **Unidirectional Dependency Flow**: Lower layers (UI Primitives) must never import from higher layers (Pages, Dialogs).
13. **Universal Command & Keybinding Standard (`@/lib/commands`)**: Never attach ad-hoc `addEventListener('keydown', ...)` listeners in components. All shortcuts must be managed through the central command registry (see [KEYBINDING_RULES.md](file:///home/jop/work/NST-V2/frontend/KEYBINDING_RULES.md)).

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
├── lib/                     ← Utilities, helpers, providers, command registry
└── index.css                ← Global styles, Tailwind v4 @theme, tokens
```

### Unidirectional Dependency Flow

```text
src/pages (Layer 4)
    ↓
src/components/dialogs (Layer 3)
    ↓
src/components/layout (Layer 2)
    ↓
src/ui (Layer 1 - Design System)
```

* **`src/pages` (Layer 4)**: May import `dialogs`, `layout`, `ui`, and `lib`.
* **`src/components/dialogs` (Layer 3)**: May import `layout`, `ui`, and `lib` (**Forbidden to import from `pages`**).
* **`src/components/layout` (Layer 2)**: May import `ui` and `lib` (**Forbidden to import from `dialogs` or `pages`**).
* **`src/ui` (Layer 1)**: Base foundation of the Design System (**Forbidden to import from `dialogs`, `layout`, or `pages`**).

---

## 3. Single Gateway Import Pattern (`@/ui`)

All application code must import Base UI Components exclusively via `@/ui`:

### ❌ Forbidden
```tsx
// Forbidden: Deep importing individual files
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Forbidden: Direct Radix or 3rd-party UI imports in application code
import * as DialogPrimitive from "@radix-ui/react-dialog";
```

### ✅ Required
```tsx
import { Button, Dialog, Input, Badge, Progress, DropdownMenu } from "@/ui";
```

---

## 4. Semantic Design Token Reference

| Prohibited Pattern (❌) | Approved Semantic Token (✅) | Purpose |
|---|---|---|
| `bg-[#1a1a1a]` | `bg-background` | Base application background |
| `bg-[#242424]`, `bg-[#222222]` | `bg-card`, `bg-popover` | Card and dropdown surfaces |
| `text-[#f0f0f0]`, `text-white` | `text-foreground` | Primary text |
| `text-[#3399ff]`, `bg-[#3399ff]` | `text-primary`, `bg-primary` | Brand interactive focus & accents |
| `text-[#888888]`, `text-[#a0a0a0]` | `text-muted-foreground` | Secondary/muted labels and icons |
| `border-[#333333]`, `border-[#2e2e2e]` | `border-border` | Component and divider borders |
| `border-[#3a3a3a]`, `bg-[#2c2c2c]` | `border-input`, `bg-muted` | Input borders and muted containers |
| `text-rose-400`, `bg-rose-600` | `text-destructive`, `bg-destructive` | Errors and destructive actions |

---

## 5. Automated Architectural Audit Scripts

The repository includes automated AST static analysis scripts to verify architecture compliance and token discipline:

### Summary Report
```bash
bun run audit:ui -- --summary
# or
npm run audit:ui -- --summary
```

### Full Detailed Report (with file locations and remediation steps)
```bash
npm run audit:ui
```

### Filter by Violation Category
```bash
# Check arbitrary hex color usage
npm run audit:ui -- --category=ARBITRARY_COLOR

# Check deep imports from ui/
npm run audit:ui -- --category=DEEP_UI_IMPORT

# Check raw native button/input usage
npm run audit:ui -- --category=NATIVE_ELEMENT

# Check keyboard shortcut violations
npm run audit:ui -- --category=FORBIDDEN_KEYDOWN_LISTENER
```

### Strict CI Enforcement (Exit code 1 on errors)
```bash
npm run check:ui
```
