import { PDFButton, PDFCheckBox, PDFDropdown, PDFHexString, PDFName, PDFRadioGroup, PDFString, PDFTextField } from 'pdf-lib';
import type { PDFField } from 'pdf-lib';
import { componentsToHex, parseDA } from '../model/color';
import { pageInfo, pdfRectToDisplay } from '../model/coords';
import { MULTILINE_DEFAULT_FONT_SIZE, newId } from '../model/fields';
import type { FieldStyle, FormField, ImportResult, LockedField, PageInfo } from '../model/types';
import { annotPageMap, isEditable, loadPdf, lockedKind, widgetPageIndex } from './pdfForm';

export const SIZE_WARN_BYTES = 50 * 1024 * 1024;
export const SIZE_WARN_PAGES = 200;

function decodeTooltip(field: PDFField): string {
  const tu = field.acroField.dict.lookup(PDFName.of('TU'));
  return tu instanceof PDFString || tu instanceof PDFHexString ? tu.decodeText() : '';
}

/** Read page geometry and form fields from PDF bytes. */
export async function importPdf(bytes: Uint8Array): Promise<ImportResult> {
  const doc = await loadPdf(bytes);
  const warnings: string[] = [];

  const pages: PageInfo[] = doc.getPages().map((p) => {
    const cb = p.getCropBox();
    return pageInfo([cb.x, cb.y, cb.x + cb.width, cb.y + cb.height], p.getRotation().angle);
  });

  if (bytes.byteLength > SIZE_WARN_BYTES) {
    warnings.push(`This file is ${(bytes.byteLength / 1024 / 1024).toFixed(0)} MB; editing may be slow.`);
  }
  if (pages.length > SIZE_WARN_PAGES) {
    warnings.push(`This file has ${pages.length} pages; editing may be slow.`);
  }

  const form = doc.getForm();
  if (form.hasXFA()) {
    warnings.push('This PDF contains an XFA (dynamic) form. It will be removed on download; regular form fields are kept.');
  }

  const map = annotPageMap(doc);
  const fields: FormField[] = [];
  const locked: LockedField[] = [];

  for (const field of form.getFields()) {
    const name = field.getName();
    const da = parseDA(field.acroField.getDefaultAppearance());
    const common = {
      name,
      required: field.isRequired(),
      readOnly: field.isReadOnly(),
      tooltip: decodeTooltip(field),
    };
    const editable = isEditable(field);

    // Radio on-values may be indices into /Opt; getOptions() resolves them in widget order.
    const radioOptions = field instanceof PDFRadioGroup ? field.getOptions() : [];
    const widgets = field.acroField.getWidgets();
    for (let wi = 0; wi < widgets.length; wi++) {
      const widget = widgets[wi];
      const pageIdx = widgetPageIndex(doc, widget, map);
      if (pageIdx < 0) continue; // orphan widget, not visible anywhere
      const rect = pdfRectToDisplay(widget.getRectangle(), pages[pageIdx]);
      const mk = widget.getAppearanceCharacteristics();
      const style: FieldStyle = {
        borderColor: componentsToHex(mk?.getBorderColor()),
        backgroundColor: componentsToHex(mk?.getBackgroundColor()),
        textColor: da.textColor,
      };
      const base = { id: newId(), page: pageIdx, ...rect, ...common, style };

      if (!editable) {
        locked.push({ id: base.id, name, page: pageIdx, ...rect, kind: lockedKind(field) });
      } else if (field instanceof PDFTextField) {
        const text = { defaultValue: field.getText() ?? '', maxLength: field.getMaxLength() ?? null };
        if (field.isMultiline()) {
          // "Auto" size makes readers shrink the text as lines are added; pin it to a fixed size.
          const fontSize = da.fontSize > 0 ? da.fontSize : MULTILINE_DEFAULT_FONT_SIZE;
          fields.push({ ...base, ...text, type: 'multiline', fontSize });
        } else {
          fields.push({ ...base, ...text, type: 'text', fontSize: da.fontSize });
        }
      } else if (field instanceof PDFCheckBox) {
        fields.push({ ...base, type: 'checkbox', checked: field.isChecked() });
      } else if (field instanceof PDFRadioGroup) {
        const on = radioOptions[wi] ?? widget.getOnValue()?.decodeText() ?? `Choice${wi + 1}`;
        fields.push({ ...base, type: 'radio', exportValue: on, checked: field.getSelected() === on });
      } else if (field instanceof PDFButton) {
        fields.push({ ...base, type: 'image' });
      } else if (field instanceof PDFDropdown) {
        fields.push({
          ...base,
          type: 'dropdown',
          options: field.getOptions(),
          defaultValue: field.getSelected()[0] ?? '',
          fontSize: da.fontSize,
        });
      }
    }
  }

  if (locked.length > 0) {
    warnings.push(
      `${locked.length} existing field widget(s) use types this editor can't change (e.g. signatures, buttons). They are kept as-is.`,
    );
  }

  return { pages, fields, locked, warnings };
}
