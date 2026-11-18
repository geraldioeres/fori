import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../pdf/renderer';
import { useEditor } from '../state/store';
import { pageElementId } from './Viewer';

const THUMB_WIDTH = 110;

export function Thumbnails() {
  const pages = useEditor((s) => s.doc!.pages);
  return (
    <aside className="w-40 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 py-3" aria-label="Pages">
      <div className="flex flex-col items-center gap-3">
        {pages.map((_, i) => (
          <Thumb key={i} index={i} />
        ))}
      </div>
    </aside>
  );
}

function Thumb({ index }: { index: number }) {
  const doc = useEditor((s) => s.doc!);
  const count = useEditor((s) => s.fields.filter((f) => f.page === index).length);
  const info = doc.pages[index];
  const scale = THUMB_WIDTH / info.width;
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvas.current) return;
    return renderPage(doc.bytes, index, canvas.current, scale);
  }, [visible, doc.bytes, index, scale]);

  return (
    <button
      ref={wrap}
      className="group flex flex-col items-center gap-1"
      onClick={() => document.getElementById(pageElementId(index))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      <div
        className="relative bg-white shadow ring-brand-400 group-hover:ring-2"
        style={{ width: THUMB_WIDTH, height: info.height * scale }}
      >
        <canvas ref={canvas} className="h-full w-full" />
        {count > 0 && (
          <span className="absolute right-1 top-1 rounded-full bg-brand-600 px-1.5 text-[10px] leading-4 text-white">{count}</span>
        )}
      </div>
      <span className="text-xs text-gray-500">{index + 1}</span>
    </button>
  );
}
