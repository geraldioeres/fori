import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { MIN_SIZE } from '../model/fields';
import { snapRect } from '../model/snap';
import type { Guide } from '../model/snap';
import type { FormField, LockedField, Rect } from '../model/types';
import { useEditor } from '../state/store';

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_POS: Record<Handle, CSSProperties> = {
  nw: { left: -4, top: -4, cursor: 'nwse-resize' },
  n: { left: 'calc(50% - 4px)', top: -4, cursor: 'ns-resize' },
  ne: { right: -4, top: -4, cursor: 'nesw-resize' },
  e: { right: -4, top: 'calc(50% - 4px)', cursor: 'ew-resize' },
  se: { right: -4, bottom: -4, cursor: 'nwse-resize' },
  s: { left: 'calc(50% - 4px)', bottom: -4, cursor: 'ns-resize' },
  sw: { left: -4, bottom: -4, cursor: 'nesw-resize' },
  w: { left: -4, top: 'calc(50% - 4px)', cursor: 'ew-resize' },
};
/** Snap distance in screen pixels. */
const SNAP_PX = 6;

interface Props {
  field: FormField;
  zoom: number;
  siblings: FormField[];
  onGuides(g: Guide[]): void;
}

export function FieldBox({ field, zoom, siblings, onGuides }: Props) {
  const selected = useEditor((s) => s.selectedId === field.id);
  const select = useEditor((s) => s.select);
  const checkpoint = useEditor((s) => s.checkpoint);
  const update = useEditor((s) => s.updateField);
  const drag = useRef<{ startX: number; startY: number; rect: Rect; handle: Handle | null; moved: boolean } | null>(null);

  const begin = (e: ReactPointerEvent, handle: Handle | null) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    select(field.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      rect: { x: field.x, y: field.y, w: field.w, h: field.h },
      handle,
      moved: false,
    };
  };

  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;
    if (!d.moved) {
      if (Math.abs(dx) * zoom < 2 && Math.abs(dy) * zoom < 2) return;
      d.moved = true;
      checkpoint();
    }
    const others = siblings.filter((s) => s.id !== field.id);
    const threshold = e.altKey ? 0 : SNAP_PX / zoom;
    let r: Rect;
    if (!d.handle) {
      r = { ...d.rect, x: d.rect.x + dx, y: d.rect.y + dy };
      const snap = snapRect(r, others, threshold);
      r.x += snap.dx;
      r.y += snap.dy;
      onGuides(snap.guides);
    } else {
      const h = d.handle;
      let { x, y, w, h: ht } = d.rect;
      if (h.includes('e')) w = d.rect.w + dx;
      if (h.includes('s')) ht = d.rect.h + dy;
      if (h.includes('w')) {
        x = d.rect.x + dx;
        w = d.rect.w - dx;
      }
      if (h.includes('n')) {
        y = d.rect.y + dy;
        ht = d.rect.h - dy;
      }
      r = { x, y, w, h: ht };
      const edges = {
        x: h.includes('e') ? [r.x + r.w] : h.includes('w') ? [r.x] : [],
        y: h.includes('s') ? [r.y + r.h] : h.includes('n') ? [r.y] : [],
      };
      const snap = snapRect(r, others, threshold, edges);
      if (h.includes('e')) r.w += snap.dx;
      if (h.includes('w')) {
        r.x += snap.dx;
        r.w -= snap.dx;
      }
      if (h.includes('s')) r.h += snap.dy;
      if (h.includes('n')) {
        r.y += snap.dy;
        r.h -= snap.dy;
      }
      // Keep the opposite edge fixed when hitting the minimum size.
      if (r.w < MIN_SIZE) {
        if (h.includes('w')) r.x -= MIN_SIZE - r.w;
        r.w = MIN_SIZE;
      }
      if (r.h < MIN_SIZE) {
        if (h.includes('n')) r.y -= MIN_SIZE - r.h;
        r.h = MIN_SIZE;
      }
      onGuides(snap.guides);
    }
    update(field.id, r, false);
  };

  const end = () => {
    drag.current = null;
    onGuides([]);
  };

  const s = field.style;
  const fontPx = (field.type === 'text' || field.type === 'dropdown') && field.fontSize > 0
    ? field.fontSize * zoom
    : Math.max(8, Math.min(field.h * 0.65, 14) * zoom);

  return (
    <div
      data-field-id={field.id}
      data-testid="field"
      className={`absolute select-none ${selected ? 'outline-2 outline-blue-600' : 'outline-1 outline-blue-400/70 hover:outline-blue-600'}`}
      style={{
        left: field.x * zoom,
        top: field.y * zoom,
        width: field.w * zoom,
        height: field.h * zoom,
        background: s.backgroundColor ?? 'rgba(59,130,246,0.10)',
        border: s.borderColor ? `${Math.max(1, zoom)}px solid ${s.borderColor}` : undefined,
        borderRadius: field.type === 'radio' ? '50%' : undefined,
        color: s.textColor,
        fontSize: fontPx,
        cursor: 'move',
        outlineStyle: 'solid',
        outlineOffset: 1,
      }}
      onPointerDown={(e) => begin(e, null)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <FieldContent field={field} />
      {selected && (
        <>
          <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-blue-600 px-1 text-[10px] leading-4 text-white">
            {field.type === 'radio' ? `${field.name} = ${field.exportValue}` : field.name}
          </span>
          {HANDLES.map((h) => (
            <span
              key={h}
              data-handle={h}
              className="absolute h-2 w-2 rounded-sm border border-blue-600 bg-white"
              style={HANDLE_POS[h]}
              onPointerDown={(e) => begin(e, h)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
          ))}
        </>
      )}
    </div>
  );
}

function FieldContent({ field }: { field: FormField }) {
  const cls = 'pointer-events-none flex h-full w-full overflow-hidden px-1';
  switch (field.type) {
    case 'text':
      return (
        <div className={`${cls} ${field.multiline ? 'items-start pt-0.5' : 'items-center'} whitespace-pre-wrap`}>
          {field.defaultValue || <span className="opacity-40">{field.name}</span>}
        </div>
      );
    case 'checkbox':
      return <div className={`${cls} items-center justify-center`}>{field.checked ? '✔' : ''}</div>;
    case 'radio':
      return <div className={`${cls} items-center justify-center`}>{field.checked ? '●' : ''}</div>;
    case 'dropdown':
      return (
        <div className={`${cls} items-center justify-between`}>
          <span className={field.defaultValue ? '' : 'opacity-40'}>{field.defaultValue || field.name}</span>
          <span className="opacity-60">▾</span>
        </div>
      );
  }
}

export function LockedBox({ field, zoom }: { field: LockedField; zoom: number }) {
  return (
    <div
      className="pointer-events-auto absolute border border-dashed border-gray-500 bg-gray-400/15"
      style={{ left: field.x * zoom, top: field.y * zoom, width: field.w * zoom, height: field.h * zoom }}
      title={`${field.name} — ${field.kind} (locked: kept as-is)`}
    >
      <span className="absolute right-0.5 top-0 text-[10px] text-gray-600" aria-hidden>
        🔒
      </span>
    </div>
  );
}
