import { validateFields } from './model/fields';
import { exportPdf, outputFileName } from './pdf/exportPdf';
import { importPdf } from './pdf/importPdf';
import { EncryptedPdfError } from './pdf/pdfForm';
import { useEditor } from './state/store';

export async function openFile(file: File): Promise<string | null> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return 'Please choose a PDF file.';
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const result = await importPdf(bytes);
    useEditor
      .getState()
      .openDocument({ fileName: file.name, bytes, pages: result.pages, locked: result.locked }, result.fields, result.warnings);
    return null;
  } catch (err) {
    if (err instanceof EncryptedPdfError) return err.message;
    console.error(err);
    return 'This file could not be read as a PDF.';
  }
}

async function build(): Promise<{ bytes: Uint8Array; name: string } | { error: string }> {
  const { doc, fields } = useEditor.getState();
  if (!doc) return { error: 'No document open.' };
  const problems = validateFields(fields, doc.locked);
  if (problems.length > 0) {
    useEditor.getState().select(problems[0].fieldId);
    return { error: `Fix ${problems.length} field problem(s) first: ${problems[0].message}` };
  }
  try {
    return { bytes: await exportPdf(doc.bytes, fields), name: outputFileName(doc.fileName) };
  } catch (err) {
    console.error(err);
    return { error: `Could not build the PDF: ${(err as Error).message}` };
  }
}

function toBlobUrl(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
}

export async function downloadPdf(): Promise<string | null> {
  const out = await build();
  if ('error' in out) return out.error;
  const url = toBlobUrl(out.bytes);
  const a = document.createElement('a');
  a.href = url;
  a.download = out.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return null;
}

export async function previewPdf(): Promise<string | null> {
  // Open the tab synchronously so popup blockers allow it, then point it at the PDF.
  const win = window.open('', '_blank');
  const out = await build();
  if ('error' in out) {
    win?.close();
    return out.error;
  }
  const url = toBlobUrl(out.bytes);
  if (win) win.location.href = url;
  else return 'Your browser blocked the preview tab. Allow pop-ups for this site.';
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  return null;
}
