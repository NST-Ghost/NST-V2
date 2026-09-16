# NST Design System & AI Design Foundation

> **Single Source of Truth for UI Design, Design Tokens, and AI-Generated Interfaces**  
> Based on the "System-First, Anti-Slop" methodology: Define clear design constraints so AI tools and engineers produce unified, branded, and non-generic interfaces.

---

## 1. Brand Identity & Strategy

* **Brand Philosophy:** **NST (Novel / Game String Translator)** — A specialized developer and localizer workstation designed for long hours of precision text editing, game engine string extraction, and machine/LLM translation. It embodies a clean, focused, deep-slate technical aesthetic with high-readability typography and purposeful electric blue interactive accents.
* **Theme Model:** **Dark-First Desktop Workstation**. Dark mode is the primary canonical experience tailored for high-contrast string inspection without eye fatigue.
* **Accent Strategy:** Electric Blue (`--primary: #3399ff` / `rgb(51 153 255)`) carries primary interactive focus, active states, key CTAs, and selected tabs/cells.

---

## 2. Anti-Slop Directives (กฎเหล็กป้องกันงาน AI โหล)

AI tools (and human developers) must **NEVER** apply generic AI defaults:

| ❌ AI Slop Pattern (ห้ามใช้) | ✅ NST Standard (สิ่งที่ต้องใช้) | เหตุผล |
|---|---|---|
| **Generic Indigo / Violet Accents** (`bg-indigo-600`, `text-indigo-400`, `via-indigo-950`) | `bg-primary`, `text-primary`, `bg-primary/10`, `border-primary/20` | NST ใช้ Electric Blue (`#3399ff`) ไม่ใช่สีม่วง SaaS โหลๆ |
| **Arbitrary Hex Colors** (`bg-[#1a1a1a]`, `text-[#3399ff]`, `border-[#2e2e2e]`, `text-[#888888]`) | `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border` | เพื่อให้สลับ Theme, ปรับ Contrast, หรือเปลี่ยน Palette กลางได้ทันที |
| **Overly-Rounded Blobs** (`rounded-3xl`, `rounded-[2rem]` บนการ์ดหรือหน้าต่าง) | `rounded-md` (`var(--radius)` = `0.375rem`), `rounded-lg`, `rounded-sm` | สไตล์ Desktop Workstation ต้องกระชับ เป็นระเบียบ ไม่เป็นการ์ตูน |
| **Heavy Blur & Fuzzy Drop-Shadows** (`shadow-2xl shadow-indigo-500/50`) | Subtle border `border-border` หรือ `shadow-sm` | การจัด hierarchy ของแอพ Desktop อาศัย surface contrast และ divider border ที่คมชัด |
| **Inventing Custom Elements** (`<button className="...">`, `<input ...>`) | Import จาก Gateway `@/ui` (`Button`, `Input`, `Dialog`, `Badge`, `Progress`, `DropdownMenu`) | ควบคุม a11y, keyboard shortcut, focus ring, transition ที่จุดเดียว |
| **Random Icon Libraries** (`react-icons`, `@heroicons`, `font-awesome`) | `lucide-react` เท่านั้น | ขนาด stroke, visual weight, และ license มีมาตรฐานเดียว |

---

## 3. Design Tokens (Tailwind v4 System)

All tokens are defined as CSS variables in `src/index.css` and mapped via `@theme`. Never bypass these tokens:

### Palette Tokens (Dark-First Workstation)

| Semantic Token | Tailwind Class | CSS Variable / Value | Intended Usage |
|---|---|---|---|
| `--background` | `bg-background` | `#1a1a1a` | Base viewport, desktop background |
| `--foreground` | `text-foreground` | `#f0f0f0` | Primary high-contrast text & headings |
| `--card` | `bg-card` | `#242424` | Surface for panels, project cards, modals |
| `--card-foreground` | `text-card-foreground` | `#f0f0f0` | Text inside card/panel surfaces |
| `--popover` | `bg-popover` | `#222222` | Menus, tooltips, dropdown popovers |
| `--popover-foreground`| `text-popover-foreground` | `#f0f0f0` | Text inside dropdowns & popovers |
| `--primary` | `bg-primary`, `text-primary` | `#3399ff` | Electric blue — CTA, active states, key focus |
| `--primary-foreground`| `text-primary-foreground` | `#ffffff` | Text on top of solid primary buttons |
| `--secondary` | `bg-secondary` | `#2d2d2d` | Secondary buttons, subtle highlights |
| `--secondary-foreground`| `text-secondary-foreground`| `#e0e0e0` | Text on secondary elements |
| `--muted` | `bg-muted` | `#282828` | Hover states, inactive chips, progress tracks |
| `--muted-foreground` | `text-muted-foreground` | `#9a9a9a` | Subtitle text, line counts, timestamps |
| `--border` | `border-border` | `#333333` | Panel borders, card strokes, dividers |
| `--input` | `border-input`, `bg-card`| `#2c2c2c` | Form field borders and backgrounds |
| `--ring` | `ring-ring` | `#3399ff` | Keyboard focus ring |
| `--destructive` | `bg-destructive`, `text-destructive`| `#f43f5e` | Destructive actions (delete workspace, revert) |

---

## 4. Typography & Visual Hierarchy

* **Font Stack:** Inter font stack (`font-sans`) + Monospace (`font-mono`) for source strings and IDs.
* **Heading & Text Scale:**
  * **Window / Page Title:** `text-xl font-bold tracking-tight text-foreground`
  * **Section Title:** `text-base sm:text-lg font-semibold text-foreground`
  * **Card / Dialog Title:** `text-sm sm:text-base font-semibold text-foreground`
  * **Body Text:** `text-sm leading-relaxed text-foreground`
  * **Meta / Subtitle:** `text-xs text-muted-foreground`
  * **Editor Cells & Game Tokens:** `font-mono text-xs leading-normal`

---

## 5. Border Radius & Elevation Scale

* **Global Radius:** `var(--radius)` = `0.375rem` (6px).
* **Modal Dialogs & Panels:** `rounded-lg` or `rounded-md`
* **Buttons, Inputs, Selects:** `rounded-md` (h-8 standard desktop size, sm = h-7)
* **Status Badges & Tokens:** `rounded-full` or `rounded-xs`
* **Borders & Elevation:**
  * Standard Card: `border border-border bg-card shadow-sm`
  * Hover Card: `hover:border-primary/60 hover:shadow-lg transition-all duration-200`
  * Focus State: `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`

---

## 6. Layout & Spacing Standards

* **Desktop Viewport:** Fullscreen overflow-hidden container with fixed Menu bar, workspace split view, and bottom Statusbar.
* **Internal Padding:** `p-4` or `p-6`
* **Form & Dialog Spacing:** `space-y-4` or `space-y-3`
* **Inline Element Spacing:** `gap-1.5` or `gap-2`

---

## 7. Component Architecture (@/ui)

All application code must import primitives strictly through `@/ui`:

```tsx
// ✅ Correct
import { Button, Input, Badge, Dialog, DropdownMenu } from "@/ui";
import { FolderOpen, Settings, Play } from "lucide-react";

// ❌ Never do this
import { Button } from "@/components/ui/button"; // Deep import forbidden
import * as DialogPrimitive from "@radix-ui/react-dialog"; // Raw primitive leak forbidden
```

---

## 8. Checklist for AI Code Generation (Anti-Slop Audit)

Before outputting UI code, verify against this checklist:
1. [ ] Are all colors using semantic tokens (`bg-background`, `bg-card`, `text-primary`, `border-border`)?
2. [ ] Are there ZERO arbitrary hex codes (`#...`) or generic `indigo-*` classes?
3. [ ] Are interactive elements imported from `@/ui` instead of native `<button>` / `<input>`?
4. [ ] Are icons exclusively imported from `lucide-react`?
5. [ ] Is the styling consistent with NST Desktop Workstation aesthetic?
