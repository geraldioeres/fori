import {
  PDFBool,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib';
import type { PDFField, PDFPage, PDFWidgetAnnotation } from 'pdf-lib';
import { hexToRgb01 } from '../model/color';
import { displayRectToPdf, pageInfo } from '../model/coords';
import { readingOrder } from '../model/fields';
import type { FieldStyle, FormField, PageInfo, RadioField } from '../model/types';
import { isEditable, loadPdf, removeFieldCompletely } from './pdfForm';

const FONT_KEY = 'Helv';

function color(hex: string | null) {
  if (!hex) return undefined;
  const [r, g, b] = hexToRgb01(hex);
  return rgb(r, g, b);
}

function appearanceOpts(page: PDFPage, info: PageInfo, style: FieldStyle, font: PDFFont) {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotate: degrees(info.rotation),
    borderColor: color(style.borderColor),
    backgroundColor: color(style.backgroundColor),
    borderWidth: style.borderColor ? 1 : 0,
    textColor: color(style.textColor),
    font,
    page,
  };
}

function setDA(field: PDFField, fontSize: number, textColor: string) {
  const [r, g, b] = hexToRgb01(textColor);
  const n = (v: number) => Number(v.toFixed(3));
  field.acroField.setDefaultAppearance(`/${FONT_KEY} ${n(fontSize)} Tf ${n(r)} ${n(g)} ${n(b)} rg`);
}

/** Field-level /DA only: drop widget-level overrides so readers use the field's value. */
function resetDA(field: PDFField, fontSize: number, textColor: string) {
  setDA(field, fontSize, textColor);
  for (const w of field.acroField.getWidgets()) w.dict.delete(PDFName.of('DA'));
}

function setCommon(field: PDFField, f: FormField) {
  if (f.required) field.enableRequired();
  if (f.readOnly) field.enableReadOnly();
  if (f.tooltip) field.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(f.tooltip));
}

/** pdf-lib computes the widget rect from x/y/width/height and rotation; we set the exact rect afterwards. */
function placeWidget(widget: PDFWidgetAnnotation, f: FormField, info: PageInfo) {
  widget.setRectangle(displayRectToPdf(f, info));
}

function lastWidget(field: PDFField): PDFWidgetAnnotation {
  const ws = field.acroField.getWidgets();
  return ws[ws.length - 1];
}

/**
 * Write the editor's fields into the original PDF.
 * Every existing editable field is removed and recreated from the model; locked fields are untouched.
 */
export async function exportPdf(original: Uint8Array, fields: FormField[]): Promise<Uint8Array> {
  const doc: PDFDocument = await loadPdf(original);
  const form = doc.getForm();
  if (form.hasXFA()) form.deleteXFA();

  for (const field of form.getFields()) {
    if (isEditable(field)) removeFieldCompletely(doc, field);
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const infos = pages.map((p) => {
    const cb = p.getCropBox();
    return pageInfo([cb.x, cb.y, cb.x + cb.width, cb.y + cb.height], p.getRotation().angle);
  });

  // Make sure the font named in every DA string exists in the form's default resources.
  const acro = form.acroForm.dict;
  let dr = acro.lookup(PDFName.of('DR'));
  if (!(dr instanceof PDFDict)) {
    dr = doc.context.obj({});
    acro.set(PDFName.of('DR'), dr);
  }
  let drFonts = (dr as PDFDict).lookup(PDFName.of('Font'));
  if (!(drFonts instanceof PDFDict)) {
    drFonts = doc.context.obj({});
    (dr as PDFDict).set(PDFName.of('Font'), drFonts);
  }
  (drFonts as PDFDict).set(PDFName.of(FONT_KEY), font.ref);

  const radioGroups = new Map<string, ReturnType<typeof form.createRadioGroup>>();
  const radioDefaults = new Map<string, string>();
  /** Created fields and the default appearance (font size, color) they should end up with. */
  const created = new Map<PDFField, { size: number; color: string }>();

  for (const f of readingOrder(fields)) {
    const page = pages[f.page];
    const info = infos[f.page];
    if (!page || !info) continue;
    const opts = appearanceOpts(page, info, f.style, font);

    switch (f.type) {
      case 'text': {
        const tf = form.createTextField(f.name);
        if (f.multiline) tf.enableMultiline();
        if (f.maxLength && f.maxLength > 0) tf.setMaxLength(f.maxLength);
        if (f.defaultValue) tf.setText(f.maxLength ? f.defaultValue.slice(0, f.maxLength) : f.defaultValue);
        setDA(tf, f.fontSize, f.style.textColor);
        tf.addToPage(page, opts);
        placeWidget(lastWidget(tf), f, info);
        setCommon(tf, f);
        created.set(tf, { size: f.fontSize, color: f.style.textColor });
        break;
      }
      case 'checkbox': {
        const cb = form.createCheckBox(f.name);
        setDA(cb, 0, f.style.textColor);
        cb.addToPage(page, opts);
        placeWidget(lastWidget(cb), f, info);
        if (f.checked) cb.check();
        setCommon(cb, f);
        created.set(cb, { size: 0, color: f.style.textColor });
        break;
      }
      case 'radio': {
        let group = radioGroups.get(f.name);
        if (!group) {
          group = form.createRadioGroup(f.name);
          setDA(group, 0, f.style.textColor);
          setCommon(group, f);
          radioGroups.set(f.name, group);
          created.set(group, { size: 0, color: f.style.textColor });
        }
        group.addOptionToPage(f.exportValue, page, opts);
        placeWidget(lastWidget(group), f, info);
        if ((f as RadioField).checked && !radioDefaults.has(f.name)) radioDefaults.set(f.name, f.exportValue);
        break;
      }
      case 'dropdown': {
        const dd = form.createDropdown(f.name);
        const options = f.options.filter((o) => o.length > 0);
        dd.setOptions(options);
        if (f.defaultValue && options.includes(f.defaultValue)) dd.select(f.defaultValue);
        setDA(dd, f.fontSize, f.style.textColor);
        dd.addToPage(page, opts);
        placeWidget(lastWidget(dd), f, info);
        setCommon(dd, f);
        created.set(dd, { size: f.fontSize, color: f.style.textColor });
        break;
      }
    }
  }

  for (const [name, value] of radioDefaults) radioGroups.get(name)?.select(value);

  // Widgets were created with placeholder rects; regenerate every appearance at its final rect.
  // pdf-lib's appearance providers rewrite /DA (freezing auto font size and using the font's
  // PostScript name), so restore the intended /DA before and after generating.
  for (const [field, da] of created) {
    resetDA(field, da.size, da.color);
    if (field instanceof PDFTextField || field instanceof PDFDropdown) field.updateAppearances(font);
    else if (field instanceof PDFCheckBox || field instanceof PDFRadioGroup) field.updateAppearances();
    resetDA(field, da.size, da.color);
  }
  acro.set(PDFName.of('NeedAppearances'), PDFBool.True);

  return doc.save({ updateFieldAppearances: false });
}

export function outputFileName(input: string): string {
  const base = input.replace(/\.pdf$/i, '');
  return `${base}-form.pdf`;
}
