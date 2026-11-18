import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFName,
  PDFRadioGroup,
  PDFRef,
  PDFTextField,
} from 'pdf-lib';
import type { PDFWidgetAnnotation } from 'pdf-lib';

export class EncryptedPdfError extends Error {
  constructor() {
    super('This PDF is password-protected or encrypted. Remove the protection and try again.');
    this.name = 'EncryptedPdfError';
  }
}

export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  if (doc.isEncrypted) throw new EncryptedPdfError();
  return doc;
}

/**
 * True when the editor can round-trip this field. Text-like fields with several widgets
 * (one value shown in several places) are not supported in v1 and stay locked.
 */
export function isEditable(field: PDFField): boolean {
  if (field instanceof PDFRadioGroup) return true;
  if (field instanceof PDFTextField || field instanceof PDFCheckBox || field instanceof PDFDropdown) {
    return field.acroField.getWidgets().length === 1;
  }
  return false;
}

export function lockedKind(field: PDFField): string {
  const ctor = field.constructor.name.replace(/^PDF/, '');
  if (isEditable(field)) return ctor;
  if (field instanceof PDFTextField || field instanceof PDFCheckBox || field instanceof PDFDropdown) {
    return `${ctor} (multiple widgets)`;
  }
  return ctor;
}

/** Map of annotation ref → page index, for locating widgets without a /P entry. */
export function annotPageMap(doc: PDFDocument): Map<string, number> {
  const map = new Map<string, number>();
  doc.getPages().forEach((page, i) => {
    const annots = page.node.Annots();
    if (!annots) return;
    for (let k = 0; k < annots.size(); k++) {
      const ref = annots.get(k);
      if (ref instanceof PDFRef) map.set(ref.toString(), i);
    }
  });
  return map;
}

export function widgetRef(doc: PDFDocument, widget: PDFWidgetAnnotation): PDFRef | undefined {
  return doc.context.getObjectRef(widget.dict);
}

export function widgetPageIndex(
  doc: PDFDocument,
  widget: PDFWidgetAnnotation,
  map: Map<string, number>,
): number {
  const ref = widgetRef(doc, widget);
  if (ref && map.has(ref.toString())) return map.get(ref.toString())!;
  const p = widget.P();
  if (p) {
    const idx = doc.getPages().findIndex((pg) => pg.ref === p);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Remove a field and all its widgets. pdf-lib's own `removeField` leaves kid widget
 * references in page /Annots, so we do it ourselves.
 */
export function removeFieldCompletely(doc: PDFDocument, field: PDFField): void {
  const refs = new Set<string>();
  for (const w of field.acroField.getWidgets()) {
    const r = widgetRef(doc, w);
    if (r) refs.add(r.toString());
  }
  refs.add(field.ref.toString());
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let k = annots.size() - 1; k >= 0; k--) {
      const a = annots.get(k);
      if (a instanceof PDFRef && refs.has(a.toString())) annots.remove(k);
    }
  }
  const form = doc.getForm();
  try {
    form.acroForm.removeField(field.acroField);
  } catch {
    // Field was not reachable from /Fields; nothing else to detach.
  }
  const kids = field.acroField.dict.lookup(PDFName.of('Kids'));
  if (kids && 'size' in kids) {
    const arr = kids as unknown as { size(): number; get(i: number): unknown };
    for (let i = 0; i < arr.size(); i++) {
      const kid = arr.get(i);
      if (kid instanceof PDFRef) doc.context.delete(kid);
    }
  }
  doc.context.delete(field.ref);
}
