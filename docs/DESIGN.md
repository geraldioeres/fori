# Fori — PDF Form Builder: design decisions

Settled during the design interview on 2026-11-18.

## Product
| # | Decision |
|---|----------|
| Q1 | **Fillable-form builder**: places real AcroForm fields on an existing PDF so others can fill them in any reader. "Fill & flatten" is a possible later add-on. |
| Q2 | Personal / internal tool. No accounts, no billing. |
| Q3 | 100% client-side. pdf.js renders, pdf-lib reads/writes. Files never leave the browser. |
| Q4 | v1 field types: single-line text, multi-line text (a separate tool/type), checkbox, radio group, dropdown. An image field (Acrobat-style `buttonImportIcon()` button) was built and removed: choosing an image only worked in Acrobat Pro, not the free Adobe Reader the target users have. |
| Q5 | React + TypeScript + Vite; DOM overlay for fields (no canvas lib). |
| Q6 | Input is an uploaded PDF only (no blank documents in v1). |
| Q7 | Existing AcroForm fields are imported and editable. Unsupported types (signature, button, list box) are preserved untouched and shown as locked outlines. |
| Q8 | Properties: name (auto-generated, unique, duplicate warnings), required, read-only, tooltip; text: default value, font size (auto or fixed), max length; multi-line text: default value, **fixed** font size (default 12, no auto, so readers scroll instead of shrinking the text as lines are added), max length; dropdown: options + default; radio: group name + per-button export value; checkbox: checked by default; colors: border / background / text. Helvetica only. |
| Q9 | Editor: drag or click to place, move/resize, arrow-key nudge, delete, copy/paste/duplicate, undo/redo, zoom, page thumbnails, snap-to-edges. Not in v1: multi-select, align tools, auto-detect, page ops. |
| Q10 | Autosave the current session to IndexedDB. Re-uploading a downloaded PDF is the "project file". |
| Q11 | Static build, deployable to any static host. |
| Q12 | pdf-lib generates appearance streams; `NeedAppearances` set as fallback. Output name: `<name>-form.pdf`. |
| Q13 | Reject encrypted PDFs. Strip XFA with a warning. Correct coordinates on rotated and crop-box-offset pages. Soft warning above 50 MB / 200 pages. |
| Q14 | Preview opens the generated PDF in a new tab (browser viewer). |
| Q15 | Tab order: automatic reading order (page → row → left-to-right). |
| Q16 | Desktop only (Chrome, Edge, Firefox, Safari); phones get a message. |
| Q17 | Vitest round-trip unit tests + one Playwright e2e test. |
| Q18 | Tailwind CSS, Radix primitives, Zustand. English only. |

## Color palette

All UI color comes from the logo purple plus Tailwind's neutral `gray` scale. The brand scale is defined once, as Tailwind
theme tokens in `src/index.css` (`--color-brand-*`), so components use classes like `bg-brand-600`; no raw hex in components.
Field colors chosen by the user (border/background/text in the properties panel) are PDF output, not UI, and are unaffected.

### Brand (purple)

| Token | Hex | On white | Use |
|-------|-----|---------:|-----|
| `brand-50` | `#faf5fb` | 1.08 | Drop-zone overlay fill, subtle hover backgrounds |
| `brand-100` | `#f3e6f5` | 1.20 | Active tool background, focus-ring halo |
| `brand-200` | `#e7cdeb` | 1.47 | Focus rings on primary buttons |
| `brand-300` | `#d5a8dc` | 2.01 | Decorative only |
| `brand-400` | `#c07fc8` | 2.95 | Unselected field outline, thumbnail hover ring |
| `brand-500` | `#b25bb8` | 4.13 | Field fill tint (10%), input focus border, drop-zone border. Not for text |
| **`brand-600`** | **`#9b4aa3`** | **5.38** | **Logo color. Primary buttons, selected field, field name tag, handles, badges, accent text** |
| `brand-700` | `#843c8c` | 6.99 | Primary button hover, active-tool text, overlay text |
| `brand-800` | `#6c3173` | 9.03 | Primary button pressed |
| `brand-900` | `#572a5c` | 11.11 | Reserved (dark text on tints) |
| `brand-950` | `#3a163e` | 15.39 | Reserved |

Rules: text in brand color uses **600 or darker** (WCAG AA ≥ 4.5:1 on white); white text sits on **600 or darker**.
500 and lighter are for fills, borders and outlines only (≥ 3:1 is enough for 500 as a non-text UI boundary).
`brand-700` on `brand-100` is 5.80:1, so the active-tool label is readable.

### Neutrals, status and helpers

| Role | Token | Use |
|------|-------|-----|
| Page / panels | `white` | Landing page, toolbar, side panels |
| Workspace | `gray-200` (`#e5e7eb`) | Area behind PDF pages; neutral so it doesn't tint the document |
| Sidebar | `gray-50` | Thumbnail column |
| Lines | `gray-200` / `gray-300` | Dividers / input borders |
| Text | `gray-900` / `gray-700` / `gray-500` | Headings / body and ghost buttons / hints (4.83:1) |
| Ghost hover | `gray-100` | Toolbar and panel ghost buttons |
| Danger | `red-600` | Delete, "Close file", error toasts, invalid inputs |
| Warning | `amber-50` / `amber-200` / `amber-900` | Warning banner (XFA, large files) |
| Snap guides | `teal-500` (`#14b8a6`) | Alignment guides while dragging: complementary to purple so guides stand out against purple field outlines |
| Locked fields | `gray-500` dashed, `gray-400` 15% fill | Fields the editor preserves but can't edit |

### Element mapping

| Element | Colors |
|---------|--------|
| Primary button (Upload PDF, Download PDF) | `bg-brand-600`, hover `brand-700`, pressed `brand-800`, white text, focus ring `brand-200` |
| Ghost button (toolbar, panel) | `text-gray-700`, hover `bg-gray-100` |
| Active field tool | `bg-brand-100`, `text-brand-700` |
| Field box (editor overlay) | fill `brand-500` at 10%, outline `brand-400`/70 → hover `brand-600` → selected 2px `brand-600` |
| Field name tag, resize handles | `bg-brand-600` white text; handles white with `brand-600` border |
| Text inputs, selects | border `gray-300`; focus border + 1px ring `brand-500` |
| Checkboxes / native controls | `accent-brand-600` |
| Thumbnails | hover ring `brand-400`; field-count badge `bg-brand-600` |
| Drop overlay (landing page) | border `brand-500` dashed, fill `brand-50`/95, text and icon `brand-700`/`brand-600` |
| Tagline / accent text | `text-brand-600` |
| Browser theme color | `#9b4aa3` (`brand-600`) in `index.html` and the web manifest |

## Architecture
- `src/model` — field types, defaults, naming, validation, coordinate math (pure, unit-tested).
- `src/pdf` — `importPdf` (pdf-lib → page info + fields) and `exportPdf` (model → PDF bytes). Pure, run in Node for tests.
- `src/state` — Zustand store with snapshot undo/redo and IndexedDB autosave.
- `src/components` — UI: toolbar, page canvas (pdf.js) + field overlay, thumbnails, properties panel.

### Coordinates
Fields are stored in **display space**: points at scale 1, top-left origin, with page rotation already applied
(the same space pdf.js uses for a viewport at scale 1). `src/model/coords.ts` converts to/from PDF user space
using the page's crop box and `/Rotate`.

### Export strategy
Load the original bytes, remove every *imported, supported* field, then recreate all model fields in reading order.
Locked fields are never touched.

## v2 backlog
Multi-select, align/distribute, manual tab order, blank documents, fill & flatten, date/number/signature fields.
