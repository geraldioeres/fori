import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { openFile } from '../actions';
import { useNotice } from '../state/notice';
import { Logo } from './Logo';

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

export function UploadScreen() {
  const input = useRef<HTMLInputElement>(null);
  // Counts nested dragenter/dragleave pairs so the highlight doesn't flicker over child elements.
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const err = await openFile(file);
    setBusy(false);
    if (err) useNotice.getState().show(err);
  };

  return (
    // The whole page is the drop zone.
    <div
      className="relative flex h-full flex-col bg-white"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        void handle(e.dataTransfer.files[0]);
      }}
    >
      <header className="flex items-center gap-2 px-8 py-5">
        <Logo size={28} />
        <span className="text-lg font-semibold tracking-tight text-gray-900">Fori</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">Want to make a fillable PDF?</h1>
        <p className="mt-3 text-xl font-medium text-brand-600 sm:text-2xl">Don’t worry, we gotcha!</p>

        <button
          className="mt-10 inline-flex items-center gap-3 rounded-xl bg-brand-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 active:bg-brand-800 disabled:opacity-60"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 16V4M7 9l5-5 5 5" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          {busy ? 'Opening…' : 'Upload PDF'}
        </button>
        <p className="mt-4 text-sm text-gray-500">or drop a PDF anywhere on this page</p>

        <p className="mt-16 max-w-md text-sm text-gray-500">
          Add text, multi-line, checkbox, radio and dropdown fields, then download a PDF anyone can fill in. Your file never
          leaves your browser.
        </p>

        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </main>

      {over && (
        <div className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/95 backdrop-blur-sm">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600" aria-hidden>
            <path d="M12 16V4M7 9l5-5 5 5" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <p className="text-2xl font-semibold text-brand-700">Drop your PDF to start</p>
        </div>
      )}
    </div>
  );
}
