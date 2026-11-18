import type { FieldType, FormField, LockedField, Rect } from './types';

export const FIELD_LABELS: Record<FieldType, string> = {
  text: 'Text',
  multiline: 'Multi-line',
  checkbox: 'Checkbox',
  radio: 'Radio',
  dropdown: 'Dropdown',
};

export const DEFAULT_SIZE: Record<FieldType, { w: number; h: number }> = {
  text: { w: 160, h: 22 },
  multiline: { w: 220, h: 72 },
  checkbox: { w: 14, h: 14 },
  radio: { w: 14, h: 14 },
  dropdown: { w: 140, h: 22 },
};

export const MIN_SIZE = 6;

/** Fixed font size for new multi-line fields (and imported ones that used "auto"). */
export const MULTILINE_DEFAULT_FONT_SIZE = 12;
export const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `f${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Next free auto name like `text_3`, avoiding every name already in use. */
export function nextName(type: FieldType, taken: Iterable<string>): string {
  const used = new Set(taken);
  let i = 1;
  while (used.has(`${type}_${i}`)) i += 1;
  return `${type}_${i}`;
}

export function createField(
  type: FieldType,
  page: number,
  rect: Rect,
  takenNames: Iterable<string>,
): FormField {
  const base = {
    id: newId(),
    name: nextName(type, takenNames),
    page,
    ...rect,
    required: false,
    readOnly: false,
    tooltip: '',
    style: { borderColor: '#1f2937', backgroundColor: null, textColor: '#000000' },
  };
  switch (type) {
    case 'text':
      return { ...base, type, defaultValue: '', fontSize: 0, maxLength: null };
    case 'multiline':
      return { ...base, type, defaultValue: '', fontSize: MULTILINE_DEFAULT_FONT_SIZE, maxLength: null };
    case 'checkbox':
      return { ...base, type, checked: false };
    case 'radio':
      return { ...base, type, exportValue: 'Choice1', checked: false };
    case 'dropdown':
      return { ...base, type, options: ['Option 1', 'Option 2'], defaultValue: '', fontSize: 0 };
  }
}

/** Export value not yet used inside the radio group `name`. */
export function nextRadioValue(fields: FormField[], name: string): string {
  const used = new Set(fields.filter((f) => f.type === 'radio' && f.name === name).map((f) => (f as { exportValue: string }).exportValue));
  let i = 1;
  while (used.has(`Choice${i}`)) i += 1;
  return `Choice${i}`;
}

export interface NameProblem {
  fieldId: string;
  message: string;
}

/**
 * Validate field names. Rules:
 * - non-empty, no leading/trailing dots or `..`
 * - unique across non-radio fields; radio buttons may share a name only with other radio buttons
 * - must not collide with a locked (preserved) field
 * - radio export values must be unique within a group
 */
export function validateFields(fields: FormField[], locked: LockedField[]): NameProblem[] {
  const problems: NameProblem[] = [];
  const lockedNames = new Set(locked.map((l) => l.name));
  const byName = new Map<string, FormField[]>();
  for (const f of fields) {
    const list = byName.get(f.name) ?? [];
    list.push(f);
    byName.set(f.name, list);
  }
  for (const f of fields) {
    const n = f.name.trim();
    if (!n) {
      problems.push({ fieldId: f.id, message: 'Name is required.' });
      continue;
    }
    if (n !== f.name || n.startsWith('.') || n.endsWith('.') || n.includes('..')) {
      problems.push({ fieldId: f.id, message: 'Name has invalid spaces or dots.' });
      continue;
    }
    if (lockedNames.has(f.name)) {
      problems.push({ fieldId: f.id, message: 'Name is used by a locked field.' });
      continue;
    }
    const same = byName.get(f.name)!;
    if (f.type === 'radio') {
      if (same.some((o) => o.type !== 'radio')) {
        problems.push({ fieldId: f.id, message: 'Name is used by a non-radio field.' });
      } else if (same.some((o) => o.id !== f.id && o.type === 'radio' && o.exportValue === f.exportValue)) {
        problems.push({ fieldId: f.id, message: 'Export value is duplicated in this group.' });
      }
    } else if (same.length > 1) {
      problems.push({ fieldId: f.id, message: 'Duplicate name.' });
    }
    // A name that is a prefix "parent" of another (a vs a.b) cannot be both a field and a container.
    if (fields.some((o) => o.name.startsWith(`${f.name}.`))) {
      problems.push({ fieldId: f.id, message: 'Name conflicts with a nested field name.' });
    }
  }
  return problems;
}

/**
 * Sort fields into reading order: page, then rows (tops within a tolerance), then left to right.
 */
export function readingOrder<T extends { page: number; x: number; y: number; h: number }>(fields: T[]): T[] {
  const byPage = new Map<number, T[]>();
  for (const f of fields) {
    const list = byPage.get(f.page) ?? [];
    list.push(f);
    byPage.set(f.page, list);
  }
  const out: T[] = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const list = [...byPage.get(page)!].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: T[][] = [];
    for (const f of list) {
      const row = rows[rows.length - 1];
      const tolerance = Math.max(4, Math.min(f.h, row?.[0].h ?? f.h) / 2);
      if (row && Math.abs(f.y - row[0].y) <= tolerance) row.push(f);
      else rows.push([f]);
    }
    for (const row of rows) out.push(...row.sort((a, b) => a.x - b.x));
  }
  return out;
}
