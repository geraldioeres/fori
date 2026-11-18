import { del, get, set } from 'idb-keyval';
import { MULTILINE_DEFAULT_FONT_SIZE } from '../model/fields';
import type { FormField, LockedField, PageInfo } from '../model/types';
import { useEditor } from './store';

const KEY = 'fori:session:v1';

export interface SavedSession {
  fileName: string;
  bytes: Uint8Array;
  pages: PageInfo[];
  locked: LockedField[];
  fields: FormField[];
  savedAt: number;
}

export async function loadSession(): Promise<SavedSession | null> {
  try {
    const saved = (await get<SavedSession>(KEY)) ?? null;
    if (saved) {
      // Image fields existed briefly (Acrobat-only, removed); drop any left in a saved session.
      saved.fields = saved.fields.filter((f) => (f.type as string) !== 'image').map(migrateField);
    }
    return saved;
  } catch {
    return null;
  }
}

/** Sessions saved before multi-line became its own type stored it as `text` + `multiline: true`. */
function migrateField(f: FormField): FormField {
  const legacy = f as FormField & { multiline?: boolean };
  if (legacy.type !== 'text' || legacy.multiline === undefined) return f;
  const { multiline, ...rest } = legacy;
  if (!multiline) return rest;
  return { ...rest, type: 'multiline', fontSize: rest.fontSize > 0 ? rest.fontSize : MULTILINE_DEFAULT_FONT_SIZE };
}

export async function clearSession(): Promise<void> {
  try {
    await del(KEY);
  } catch {
    // Storage unavailable (private mode etc.) — nothing to clear.
  }
}

/** Debounced save of the current document + fields whenever the store's revision changes. */
export function startAutosave(delayMs = 800): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastRevision = useEditor.getState().revision;
  const unsubscribe = useEditor.subscribe((s) => {
    if (s.revision === lastRevision) return;
    lastRevision = s.revision;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { doc, fields } = useEditor.getState();
      if (!doc) {
        void clearSession();
        return;
      }
      const session: SavedSession = {
        fileName: doc.fileName,
        bytes: doc.bytes,
        pages: doc.pages,
        locked: doc.locked,
        fields,
        savedAt: Date.now(),
      };
      set(KEY, session).catch(() => {
        // Quota exceeded or storage blocked: autosave is best-effort.
      });
    }, delayMs);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
