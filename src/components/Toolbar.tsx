import { useState } from 'react';
import type { ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dialog from '@radix-ui/react-dialog';
import { downloadPdf, previewPdf } from '../actions';
import { FIELD_LABELS } from '../model/fields';
import type { FieldType } from '../model/types';
import { clearSession } from '../state/autosave';
import { useNotice } from '../state/notice';
import { ZOOM_STEPS, useEditor } from '../state/store';
import { FieldIcon } from './FieldIcon';
import { Logo } from './Logo';

export const DRAG_MIME = 'application/x-fori-field';
const TYPES: FieldType[] = ['text', 'multiline', 'checkbox', 'radio', 'dropdown'];

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={6} className="z-50 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

const btn =
  'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent';

export function Toolbar() {
  const s = useEditor();
  const [busy, setBusy] = useState<null | 'download' | 'preview'>(null);
  const zoomIdx = ZOOM_STEPS.findIndex((z) => z >= s.zoom - 1e-6);

  const run = async (kind: 'download' | 'preview') => {
    setBusy(kind);
    const err = kind === 'download' ? await downloadPdf() : await previewPdf();
    setBusy(null);
    if (err) useNotice.getState().show(err);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-3">
      <Logo size={24} className="mr-2 shrink-0" />
      <span className="mr-2 max-w-56 truncate text-sm font-medium" title={s.doc?.fileName}>
        {s.doc?.fileName}
      </span>
      <div className="mx-2 h-6 w-px bg-gray-200" />

      {TYPES.map((t) => (
        <Tip key={t} label={`Click, then click on the page — or drag onto the page`}>
          <button
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, t);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => s.setTool(s.tool === t ? null : t)}
            aria-pressed={s.tool === t}
            className={`${btn} ${s.tool === t ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' : ''}`}
          >
            <FieldIcon type={t} />
            {FIELD_LABELS[t]}
          </button>
        </Tip>
      ))}

      <div className="mx-2 h-6 w-px bg-gray-200" />
      <Tip label="Undo (Ctrl+Z)">
        <button className={btn} onClick={s.undo} disabled={s.past.length === 0} aria-label="Undo">
          ↶
        </button>
      </Tip>
      <Tip label="Redo (Ctrl+Shift+Z)">
        <button className={btn} onClick={s.redo} disabled={s.future.length === 0} aria-label="Redo">
          ↷
        </button>
      </Tip>

      <div className="mx-2 h-6 w-px bg-gray-200" />
      <button
        className={btn}
        aria-label="Zoom out"
        disabled={zoomIdx <= 0}
        onClick={() => s.setZoom(ZOOM_STEPS[Math.max(0, zoomIdx - 1)])}
      >
        −
      </button>
      <span className="w-12 text-center text-sm tabular-nums text-gray-600">{Math.round(s.zoom * 100)}%</span>
      <button
        className={btn}
        aria-label="Zoom in"
        disabled={zoomIdx >= ZOOM_STEPS.length - 1}
        onClick={() => s.setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIdx + 1)])}
      >
        +
      </button>

      <div className="flex-1" />
      <CloseButton />
      <button className={btn} onClick={() => run('preview')} disabled={busy !== null}>
        {busy === 'preview' ? 'Building…' : 'Preview'}
      </button>
      <button
        className="ml-1 inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        onClick={() => run('download')}
        disabled={busy !== null}
      >
        {busy === 'download' ? 'Building…' : 'Download PDF'}
      </button>
    </header>
  );
}

function CloseButton() {
  const close = useEditor((s) => s.closeDocument);
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className={btn}>New file</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-xl">
          <Dialog.Title className="text-base font-semibold">Close this file?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-gray-600">
            Your fields are only kept in this browser. Download the PDF first if you want to keep your work.
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className={btn}>Cancel</button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                className="inline-flex h-8 items-center rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
                onClick={() => {
                  close();
                  void clearSession();
                }}
              >
                Close file
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
