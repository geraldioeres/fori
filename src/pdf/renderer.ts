import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

let current: { bytes: Uint8Array; task: PDFDocumentLoadingTask; doc: Promise<PDFDocumentProxy> } | null = null;

/** One pdf.js document per loaded file. pdf.js may detach the buffer it gets, so pass a copy. */
export function getPdfJsDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  if (current?.bytes === bytes) return current.doc;
  const old = current;
  const base = `${import.meta.env.BASE_URL}pdfjs/`;
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    standardFontDataUrl: `${base}standard_fonts/`,
    cMapUrl: `${base}cmaps/`,
    wasmUrl: `${base}wasm/`,
    iccUrl: `${base}iccs/`,
  });
  current = { bytes, task, doc: task.promise };
  old?.task.destroy().catch(() => {});
  return current.doc;
}

/**
 * Render a page into `canvas` at `scale` CSS px per PDF point. Returns a cancel function.
 * Annotations (existing form widgets) are not drawn; the editor overlays its own boxes.
 */
export function renderPage(
  bytes: Uint8Array,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
): () => void {
  let task: RenderTask | null = null;
  let cancelled = false;
  (async () => {
    const doc = await getPdfJsDocument(bytes);
    if (cancelled) return;
    const page = await doc.getPage(pageIndex + 1);
    if (cancelled) return;
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr });
    const off = document.createElement('canvas');
    off.width = Math.floor(viewport.width);
    off.height = Math.floor(viewport.height);
    task = page.render({ canvas: off, viewport, annotationMode: pdfjs.AnnotationMode.DISABLE });
    await task.promise;
    if (cancelled) return;
    // Swap in the finished bitmap at once to avoid flashing blank while zooming.
    canvas.width = off.width;
    canvas.height = off.height;
    canvas.getContext('2d')!.drawImage(off, 0, 0);
  })().catch((err: unknown) => {
    if ((err as { name?: string })?.name !== 'RenderingCancelledException') console.error(err);
  });
  return () => {
    cancelled = true;
    task?.cancel();
  };
}
