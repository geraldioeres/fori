# Fori — PDF Form Builder

Turn any PDF into a fillable form in the browser. Add text fields, checkboxes, radio groups and dropdowns,
then download a PDF with real AcroForm fields that work in Acrobat, Chrome, Preview and other readers.
Files never leave the browser.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (deploy to any static host)
```

## Test

```sh
npm test                         # Vitest: coordinate math + export→import round trips
npx playwright install chromium  # once
npm run test:e2e                 # Playwright: upload → place fields → undo/redo → download
```

## Features (v1)

- Upload a PDF; existing form fields are imported and editable. Unsupported ones (signatures, buttons) are kept and shown locked.
- Place fields by clicking a tool and clicking the page, or by dragging from the toolbar.
- Move, resize (8 handles), snap to other fields (hold Alt to disable), arrow-key nudge (Shift = 10pt).
- Copy / paste / duplicate, undo / redo, zoom, page thumbnails.
- Properties: name, required, read-only, tooltip, default values, font size, max length, multi-line, dropdown options, radio export values, colors.
- Session autosave in IndexedDB; Preview opens the generated PDF in a new tab.
- Correct placement on rotated and cropped pages; encrypted PDFs are rejected; XFA is stripped with a warning.

See [docs/DESIGN.md](docs/DESIGN.md) for the design decisions and v2 backlog.
