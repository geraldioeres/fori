# Fori — PDF Form Builder: design decisions

Settled during the design interview on 2026-11-18.

## Product
| # | Decision |
|---|----------|
| Q1 | **Fillable-form builder**: places real AcroForm fields on an existing PDF so others can fill them in any reader. "Fill & flatten" is a possible later add-on. |
| Q2 | Personal / internal tool. No accounts, no billing. |
| Q3 | 100% client-side. pdf.js renders, pdf-lib reads/writes. Files never leave the browser. |
| Q4 | v1 field types: single-line text, multi-line text (a separate tool/type), checkbox, radio group, dropdown. |
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
