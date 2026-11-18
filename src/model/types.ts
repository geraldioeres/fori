export type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown';

export interface FieldStyle {
  /** Hex color like `#000000`, or null for none. */
  borderColor: string | null;
  backgroundColor: string | null;
  textColor: string;
}

/** Rectangle in display space: points at scale 1, top-left origin, page rotation applied. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BaseField extends Rect {
  id: string;
  /** Fully qualified field name. For radio buttons this is the group name. */
  name: string;
  page: number;
  required: boolean;
  readOnly: boolean;
  tooltip: string;
  style: FieldStyle;
}

export interface TextField extends BaseField {
  type: 'text';
  defaultValue: string;
  /** 0 = auto size. */
  fontSize: number;
  maxLength: number | null;
  multiline: boolean;
}

export interface CheckboxField extends BaseField {
  type: 'checkbox';
  checked: boolean;
}

export interface RadioField extends BaseField {
  type: 'radio';
  exportValue: string;
  /** Whether this button is the group's default selection. */
  checked: boolean;
}

export interface DropdownField extends BaseField {
  type: 'dropdown';
  options: string[];
  defaultValue: string;
  fontSize: number;
}

export type FormField = TextField | CheckboxField | RadioField | DropdownField;

/** An existing field of a type the editor does not support. Shown, never modified. */
export interface LockedField extends Rect {
  id: string;
  name: string;
  page: number;
  kind: string;
}

export interface PageInfo {
  /** Display size at scale 1 (rotation applied). */
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  /** Crop box in PDF user space: [x0, y0, x1, y1]. */
  box: [number, number, number, number];
}

export interface ImportResult {
  pages: PageInfo[];
  fields: FormField[];
  locked: LockedField[];
  warnings: string[];
}
