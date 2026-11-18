import { create } from 'zustand';
import { DEFAULT_SIZE, MIN_SIZE, createField, newId, nextName, nextRadioValue } from '../model/fields';
import type { FieldType, FormField, LockedField, PageInfo, Rect } from '../model/types';

const HISTORY_LIMIT = 200;
/** Edits with the same key within this window share one undo step (e.g. typing a name). */
const COALESCE_MS = 1000;

export interface DocState {
  fileName: string;
  bytes: Uint8Array;
  pages: PageInfo[];
  locked: LockedField[];
}

interface EditorState {
  doc: DocState | null;
  fields: FormField[];
  selectedId: string | null;
  tool: FieldType | null;
  zoom: number;
  warnings: string[];
  clipboard: FormField | null;
  past: FormField[][];
  future: FormField[][];
  lastKey: string | null;
  lastAt: number;
  /** Bumped whenever `fields` changes, for autosave. */
  revision: number;

  openDocument(doc: DocState, fields: FormField[], warnings: string[]): void;
  closeDocument(): void;
  setTool(tool: FieldType | null): void;
  setZoom(zoom: number): void;
  select(id: string | null): void;
  dismissWarning(i: number): void;

  /** Push the current fields onto the undo stack (call once before a drag). */
  checkpoint(key?: string): void;
  addField(type: FieldType, page: number, at: { x: number; y: number }, centered?: boolean): FormField;
  /** Update a field. `history` = false skips the undo stack (use after `checkpoint` during drags). */
  updateField(id: string, patch: Partial<FormField>, history?: boolean | string): void;
  deleteField(id: string): void;
  copy(): void;
  paste(): void;
  duplicate(): void;
  nudge(dx: number, dy: number): void;
  undo(): void;
  redo(): void;
}

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

function clampToPage(r: Rect, page: PageInfo): Rect {
  const w = Math.max(MIN_SIZE, Math.min(r.w, page.width));
  const h = Math.max(MIN_SIZE, Math.min(r.h, page.height));
  return {
    x: Math.max(0, Math.min(r.x, page.width - w)),
    y: Math.max(0, Math.min(r.y, page.height - h)),
    w,
    h,
  };
}

function takenNames(s: Pick<EditorState, 'fields' | 'doc'>): string[] {
  return [...s.fields.map((f) => f.name), ...(s.doc?.locked.map((l) => l.name) ?? [])];
}

export const useEditor = create<EditorState>((set, get) => {
  /** Record history then apply `fields`. */
  const commit = (fields: FormField[], key: string | null = null, extra: Partial<EditorState> = {}) => {
    const s = get();
    const now = Date.now();
    const coalesce = key !== null && key === s.lastKey && now - s.lastAt < COALESCE_MS;
    set({
      fields,
      past: coalesce ? s.past : [...s.past, s.fields].slice(-HISTORY_LIMIT),
      future: [],
      lastKey: key,
      lastAt: now,
      revision: s.revision + 1,
      ...extra,
    });
  };

  return {
    doc: null,
    fields: [],
    selectedId: null,
    tool: null,
    zoom: 1,
    warnings: [],
    clipboard: null,
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
    revision: 0,

    openDocument(doc, fields, warnings) {
      set({
        doc,
        fields,
        warnings,
        selectedId: null,
        tool: null,
        past: [],
        future: [],
        lastKey: null,
        revision: get().revision + 1,
      });
    },
    closeDocument() {
      set({ doc: null, fields: [], selectedId: null, past: [], future: [], warnings: [], revision: get().revision + 1 });
    },
    setTool(tool) {
      set({ tool, selectedId: tool ? null : get().selectedId });
    },
    setZoom(zoom) {
      set({ zoom: Math.max(0.25, Math.min(4, zoom)) });
    },
    select(id) {
      set({ selectedId: id });
    },
    dismissWarning(i) {
      set({ warnings: get().warnings.filter((_, k) => k !== i) });
    },

    checkpoint(key) {
      const s = get();
      set({ past: [...s.past, s.fields].slice(-HISTORY_LIMIT), future: [], lastKey: key ?? null, lastAt: Date.now() });
    },

    addField(type, page, at, centered = true) {
      const s = get();
      const info = s.doc!.pages[page];
      const size = DEFAULT_SIZE[type];
      const rect = clampToPage(
        { x: centered ? at.x - size.w / 2 : at.x, y: centered ? at.y - size.h / 2 : at.y, ...size },
        info,
      );
      const field = createField(type, page, rect, takenNames(s));
      commit([...s.fields, field], null, { selectedId: field.id, tool: null });
      return field;
    },

    updateField(id, patch, history = true) {
      const s = get();
      const fields = s.fields.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...patch } as FormField;
        if ('x' in patch || 'y' in patch || 'w' in patch || 'h' in patch) {
          Object.assign(next, clampToPage(next, s.doc!.pages[next.page]));
        }
        return next;
      });
      // Only one radio button per group can be the default.
      const changed = fields.find((f) => f.id === id);
      const normalized =
        changed?.type === 'radio' && (patch as { checked?: boolean }).checked
          ? fields.map((f) => (f.type === 'radio' && f.name === changed.name && f.id !== id ? { ...f, checked: false } : f))
          : fields;
      if (history === false) set({ fields: normalized, revision: s.revision + 1 });
      else commit(normalized, typeof history === 'string' ? history : null);
    },

    deleteField(id) {
      const s = get();
      commit(
        s.fields.filter((f) => f.id !== id),
        null,
        { selectedId: s.selectedId === id ? null : s.selectedId },
      );
    },

    copy() {
      const s = get();
      const f = s.fields.find((x) => x.id === s.selectedId);
      if (f) set({ clipboard: f });
    },

    paste() {
      const s = get();
      const src = s.clipboard;
      if (!src || !s.doc) return;
      const page = s.doc.pages[src.page] ? src.page : 0;
      // A pasted radio joins the same group with a new value; everything else gets a new name.
      const clone = {
        ...src,
        id: newId(),
        page,
        ...clampToPage({ x: src.x + 12, y: src.y + 12, w: src.w, h: src.h }, s.doc.pages[page]),
      } as FormField;
      if (clone.type === 'radio') {
        clone.exportValue = nextRadioValue(s.fields, clone.name);
        clone.checked = false;
      } else {
        clone.name = nextName(clone.type, takenNames(s));
      }
      commit([...s.fields, clone], null, { selectedId: clone.id, clipboard: clone });
    },

    duplicate() {
      get().copy();
      get().paste();
    },

    nudge(dx, dy) {
      const s = get();
      const f = s.fields.find((x) => x.id === s.selectedId);
      if (!f) return;
      get().updateField(f.id, { x: f.x + dx, y: f.y + dy }, `nudge:${f.id}`);
    },

    undo() {
      const s = get();
      if (s.past.length === 0) return;
      const prev = s.past[s.past.length - 1];
      set({
        fields: prev,
        past: s.past.slice(0, -1),
        future: [s.fields, ...s.future],
        lastKey: null,
        revision: s.revision + 1,
        selectedId: prev.some((f) => f.id === s.selectedId) ? s.selectedId : null,
      });
    },

    redo() {
      const s = get();
      if (s.future.length === 0) return;
      const next = s.future[0];
      set({
        fields: next,
        past: [...s.past, s.fields],
        future: s.future.slice(1),
        lastKey: null,
        revision: s.revision + 1,
        selectedId: next.some((f) => f.id === s.selectedId) ? s.selectedId : null,
      });
    },
  };
});
