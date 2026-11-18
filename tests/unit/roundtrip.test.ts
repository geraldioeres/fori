import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { createField, readingOrder, validateFields } from '../../src/model/fields';
import { displayRectToPdf, pageInfo, pdfRectToDisplay } from '../../src/model/coords';
import { exportPdf } from '../../src/pdf/exportPdf';
import { importPdf } from '../../src/pdf/importPdf';
import { EncryptedPdfError } from '../../src/pdf/pdfForm';
import type { FormField } from '../../src/model/types';

/** Page 0: plain Letter. Page 1: rotated 90°. Page 2: crop box offset + rotated 270°. */
async function makePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  const p1 = doc.addPage([612, 792]);
  p1.setRotation(degrees(90));
  const p2 = doc.addPage([600, 800]);
  p2.setCropBox(50, 100, 400, 500);
  p2.setRotation(degrees(270));
  return doc.save();
}

const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.01);

describe('coords', () => {
  for (const rot of [0, 90, 180, 270]) {
    it(`display ↔ pdf round-trips at ${rot}°`, () => {
      const info = pageInfo([50, 100, 450, 600], rot);
      const r = { x: 30, y: 40, w: 120, h: 20 };
      const back = pdfRectToDisplay(displayRectToPdf(r, info), info);
      near(back.x, r.x);
      near(back.y, r.y);
      near(back.w, r.w);
      near(back.h, r.h);
    });
  }

  it('top-left of an unrotated page maps to top of the crop box', () => {
    const info = pageInfo([0, 0, 612, 792], 0);
    const pdf = displayRectToPdf({ x: 10, y: 10, w: 100, h: 20 }, info);
    expect(pdf).toEqual({ x: 10, y: 762, width: 100, height: 20 });
  });
});

describe('export → import round trip', () => {
  it('keeps every field type, property and position, including rotated pages', async () => {
    const src = await makePdf();
    const { pages } = await importPdf(src);
    expect(pages.map((p) => [p.width, p.height, p.rotation])).toEqual([
      [612, 792, 0],
      [792, 612, 90],
      [500, 400, 270],
    ]);

    const names: string[] = [];
    const add = <T extends FormField>(f: T): T => {
      names.push(f.name);
      return f;
    };
    const text = add({
      ...(createField('text', 0, { x: 50, y: 60, w: 200, h: 24 }, names) as Extract<FormField, { type: 'text' }>),
      name: 'full_name',
      defaultValue: 'Jane',
      fontSize: 12,
      maxLength: 40,
      required: true,
      tooltip: 'Your full name',
      style: { borderColor: '#ff0000', backgroundColor: '#eeeeee', textColor: '#0000ff' },
    });
    const multi = add({
      ...(createField('multiline', 1, { x: 100, y: 120, w: 300, h: 80 }, names) as Extract<FormField, { type: 'multiline' }>),
      fontSize: 10,
      readOnly: true,
    });
    const check = add({
      ...(createField('checkbox', 2, { x: 20, y: 30, w: 14, h: 14 }, names) as Extract<FormField, { type: 'checkbox' }>),
      checked: true,
    });
    const r1 = add({
      ...(createField('radio', 0, { x: 50, y: 200, w: 14, h: 14 }, names) as Extract<FormField, { type: 'radio' }>),
      name: 'size',
      exportValue: 'S',
    });
    const r2 = { ...r1, id: 'r2', x: 100, exportValue: 'M', checked: true };
    const dd = add({
      ...(createField('dropdown', 1, { x: 300, y: 300, w: 150, h: 22 }, names) as Extract<FormField, { type: 'dropdown' }>),
      options: ['Red', 'Green', 'Blue'],
      defaultValue: 'Green',
    });
    const fields: FormField[] = [text, multi, check, r1, r2, dd];
    expect(validateFields(fields, [])).toEqual([]);

    const out = await exportPdf(src, fields);
    const back = await importPdf(out);
    expect(back.locked).toEqual([]);
    expect(back.fields).toHaveLength(6);

    const byKey = (f: FormField) => (f.type === 'radio' ? `${f.name}:${f.exportValue}` : f.name);
    const got = new Map(back.fields.map((f) => [byKey(f), f]));
    for (const want of fields) {
      const f = got.get(byKey(want))!;
      expect(f, byKey(want)).toBeDefined();
      expect(f.type).toBe(want.type);
      expect(f.page).toBe(want.page);
      near(f.x, want.x);
      near(f.y, want.y);
      near(f.w, want.w);
      near(f.h, want.h);
      expect(f.required).toBe(want.required);
      expect(f.readOnly).toBe(want.readOnly);
      expect(f.tooltip).toBe(want.tooltip);
    }

    const t = got.get('full_name') as Extract<FormField, { type: 'text' }>;
    expect(t.defaultValue).toBe('Jane');
    expect(t.fontSize).toBe(12);
    expect(t.maxLength).toBe(40);
    expect(t.style).toEqual({ borderColor: '#ff0000', backgroundColor: '#eeeeee', textColor: '#0000ff' });
    const m = got.get(multi.name) as Extract<FormField, { type: 'multiline' }>;
    expect(m.type).toBe('multiline');
    expect(m.fontSize).toBe(10);
    expect((got.get(check.name) as Extract<FormField, { type: 'checkbox' }>).checked).toBe(true);
    expect((got.get('size:M') as Extract<FormField, { type: 'radio' }>).checked).toBe(true);
    expect((got.get('size:S') as Extract<FormField, { type: 'radio' }>).checked).toBe(false);
    const d = got.get(dd.name) as Extract<FormField, { type: 'dropdown' }>;
    expect(d.options).toEqual(['Red', 'Green', 'Blue']);
    expect(d.defaultValue).toBe('Green');

    // Re-exporting the re-imported model is stable (edit → download → re-upload → edit works).
    const again = await importPdf(await exportPdf(out, back.fields));
    expect(again.fields).toHaveLength(6);
  });

  it('removes deleted fields and leaves no dangling widgets', async () => {
    const src = await makePdf();
    const a = createField('text', 0, { x: 10, y: 10, w: 100, h: 20 }, []);
    const b = createField('radio', 0, { x: 10, y: 50, w: 14, h: 14 }, [a.name]);
    const once = await exportPdf(src, [a, b]);
    const twice = await exportPdf(once, [a]);
    const doc = await PDFDocument.load(twice);
    expect(doc.getForm().getFields().map((f) => f.getName())).toEqual([a.name]);
    expect(doc.getPage(0).node.Annots()?.size()).toBe(1);
  });

  it('gives multi-line fields a fixed font size so readers do not shrink the text', async () => {
    // A multi-line field created elsewhere with "auto" (0) font size.
    const d = await PDFDocument.create();
    const p = d.addPage([612, 792]);
    const tf = d.getForm().createTextField('notes');
    tf.enableMultiline();
    tf.addToPage(p, { x: 50, y: 500, width: 300, height: 100 });
    tf.acroField.setDefaultAppearance('/Helv 0 Tf 0 g');
    const src = await d.save({ updateFieldAppearances: false });

    const imported = await importPdf(src);
    const notes = imported.fields[0];
    expect(notes.type).toBe('multiline');
    expect((notes as Extract<FormField, { type: 'multiline' }>).fontSize).toBe(12);

    // Even a model that somehow holds 0 must never be written as "auto".
    const out = await exportPdf(src, [{ ...(notes as Extract<FormField, { type: 'multiline' }>), fontSize: 0 }]);
    const doc = await PDFDocument.load(out);
    const field = doc.getForm().getTextField('notes');
    expect(field.isMultiline()).toBe(true);
    expect(field.acroField.getDefaultAppearance()).toMatch(/\/Helv 12 Tf/);
  });

  it('keeps single-line text fields on auto size by default', async () => {
    const src = await makePdf();
    const t = createField('text', 0, { x: 10, y: 10, w: 100, h: 20 }, []);
    const doc = await PDFDocument.load(await exportPdf(src, [t]));
    const field = doc.getForm().getTextField(t.name);
    expect(field.isMultiline()).toBe(false);
    expect(field.acroField.getDefaultAppearance()).toMatch(/\/Helv 0 Tf/);
  });

  it('rejects encrypted PDFs', async () => {
    const src = await makePdf();
    // Simulate encryption by adding an /Encrypt entry to the trailer.
    const doc = await PDFDocument.load(src);
    doc.context.trailerInfo.Encrypt = doc.context.obj({ Filter: 'Standard' });
    const enc = await doc.save();
    await expect(importPdf(enc)).rejects.toBeInstanceOf(EncryptedPdfError);
  });
});

describe('model helpers', () => {
  it('orders fields page → row → left to right', () => {
    const f = (page: number, x: number, y: number) => ({ page, x, y, h: 20, id: `${page}-${x}-${y}` });
    const order = readingOrder([f(1, 0, 0), f(0, 200, 102), f(0, 10, 100), f(0, 0, 300)]).map((x) => x.id);
    expect(order).toEqual(['0-10-100', '0-200-102', '0-0-300', '1-0-0']);
  });

  it('flags duplicate names and allows shared radio group names', () => {
    const a = { ...createField('text', 0, { x: 0, y: 0, w: 1, h: 1 }, []), name: 'x' };
    const b = { ...createField('text', 0, { x: 0, y: 0, w: 1, h: 1 }, []), name: 'x' };
    const r1 = { ...createField('radio', 0, { x: 0, y: 0, w: 1, h: 1 }, []), name: 'g' };
    const r2 = { ...r1, id: 'other', exportValue: 'Choice2' };
    const problems = validateFields([a, b, r1, r2], []);
    expect(problems.map((p) => p.fieldId).sort()).toEqual([a.id, b.id].sort());
  });
});
