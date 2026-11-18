import { useEffect, useRef, useState } from 'react';
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { FieldType } from '../model/types';
import type { Guide } from '../model/snap';
import { renderPage } from '../pdf/renderer';
import { useEditor } from '../state/store';
import { FieldBox, LockedBox } from './FieldBox';
import { DRAG_MIME } from './Toolbar';

export function pageElementId(i: number) {
  return `page-${i}`;
}

export function Viewer() {
  const pages = useEditor((s) => s.doc!.pages);
  const select = useEditor((s) => s.select);
  return (
    <main
      className="min-w-0 flex-1 overflow-auto"
      id="viewer"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) select(null);
      }}
    >
      <div className="flex flex-col items-center gap-6 px-8 py-6">
        {pages.map((_, i) => (
          <PageView key={i} index={i} />
        ))}
      </div>
    </main>
  );
}

function useVisible<T extends Element>(rootMargin = '800px') {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, visible] as const;
}

function PageView({ index }: { index: number }) {
  const doc = useEditor((s) => s.doc!);
  const info = doc.pages[index];
  const zoom = useEditor((s) => s.zoom);
  const tool = useEditor((s) => s.tool);
  const fields = useEditor((s) => s.fields);
  const addField = useEditor((s) => s.addField);
  const select = useEditor((s) => s.select);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ref, visible] = useVisible<HTMLDivElement>();
  const [guides, setGuides] = useState<Guide[]>([]);

  useEffect(() => {
    if (!visible || !canvas.current) return;
    return renderPage(doc.bytes, index, canvas.current, zoom);
  }, [visible, doc.bytes, index, zoom]);

  const pointFromEvent = (e: { clientX: number; clientY: number }, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    if (tool) {
      addField(tool, index, pointFromEvent(e, e.currentTarget), false);
    } else {
      select(null);
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    const type = e.dataTransfer.getData(DRAG_MIME) as FieldType;
    if (!type) return;
    e.preventDefault();
    addField(type, index, pointFromEvent(e, e.currentTarget), true);
  };

  const pageFields = fields.filter((f) => f.page === index);
  const locked = doc.locked.filter((l) => l.page === index);
  const w = info.width * zoom;
  const h = info.height * zoom;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={ref}
        id={pageElementId(index)}
        data-page={index}
        className="relative bg-white shadow-md"
        style={{ width: w, height: h }}
      >
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
        <div
          className={`absolute inset-0 ${tool ? 'cursor-crosshair' : ''}`}
          data-testid={`page-overlay-${index}`}
          onPointerDown={onPointerDown}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {locked.map((l) => (
            <LockedBox key={l.id} field={l} zoom={zoom} />
          ))}
          {pageFields.map((f) => (
            <FieldBox key={f.id} field={f} zoom={zoom} siblings={pageFields} onGuides={setGuides} />
          ))}
          {guides.map((g, i) =>
            g.axis === 'x' ? (
              <div key={i} className="pointer-events-none absolute top-0 bottom-0 w-px bg-teal-500" style={{ left: g.at * zoom }} />
            ) : (
              <div key={i} className="pointer-events-none absolute right-0 left-0 h-px bg-teal-500" style={{ top: g.at * zoom }} />
            ),
          )}
        </div>
      </div>
      <span className="text-xs text-gray-500">
        Page {index + 1} of {doc.pages.length}
      </span>
    </div>
  );
}
