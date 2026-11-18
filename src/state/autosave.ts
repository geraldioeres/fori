import { del, get, set } from 'idb-keyval';
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
    return (await get<SavedSession>(KEY)) ?? null;
  } catch {
    return null;
  }
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
