import { useEffect } from 'react';
import { useEditor } from '../state/store';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function useKeyboard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Undo/redo work everywhere except inside text inputs (which have their own undo).
      if (mod && !isTyping(e.target)) {
        if (key === 'z' && !e.shiftKey) return void (e.preventDefault(), s.undo());
        if ((key === 'z' && e.shiftKey) || key === 'y') return void (e.preventDefault(), s.redo());
        if (key === 'c' && s.selectedId) return void (e.preventDefault(), s.copy());
        if (key === 'v' && s.clipboard) return void (e.preventDefault(), s.paste());
        if (key === 'd' && s.selectedId) return void (e.preventDefault(), s.duplicate());
        if (key === '=' || key === '+') return void (e.preventDefault(), s.setZoom(s.zoom * 1.25));
        if (key === '-') return void (e.preventDefault(), s.setZoom(s.zoom / 1.25));
      }
      if (isTyping(e.target)) return;

      if (e.key === 'Escape') {
        if (s.tool) s.setTool(null);
        else s.select(null);
        return;
      }
      if (!s.selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.deleteField(s.selectedId);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (arrows[e.key]) {
        e.preventDefault();
        s.nudge(...arrows[e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
