import { useRef, useState } from 'react';
import { openFile } from '../actions';
import { useNotice } from '../state/notice';

export function UploadScreen() {
  const input = useRef<HTMLInputElement>(null);
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
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl text-center">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">PDF Form Builder</h1>
        <p className="mb-8 text-gray-600">
          Turn any PDF into a fillable form. Add text fields, checkboxes, radio buttons and dropdowns. Your file never leaves this
          browser.
        </p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void handle(e.dataTransfer.files[0]);
          }}
          className={`rounded-xl border-2 border-dashed bg-white p-12 transition ${
            over ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <button
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {busy ? 'Opening…' : 'Upload PDF'}
          </button>
          <p className="mt-3 text-sm text-gray-500">or drop a PDF file here</p>
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
        </div>
      </div>
    </div>
  );
}
