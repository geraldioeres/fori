import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { FIELD_LABELS, FONT_SIZES, validateFields } from '../model/fields';
import type { FieldStyle, FormField } from '../model/types';
import { useEditor } from '../state/store';
import { FieldIcon } from './FieldIcon';

const input =
  'h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-gray-200 px-4 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function ColorInput({ label, value, onChange, allowNone }: { label: string; value: string | null; onChange(v: string | null): void; allowNone: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        {allowNone && (
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input type="checkbox" checked={value === null} onChange={(e) => onChange(e.target.checked ? null : '#000000')} />
            none
          </label>
        )}
        <input
          type="color"
          aria-label={label}
          value={value ?? '#ffffff'}
          disabled={value === null}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-gray-300 disabled:opacity-30"
        />
      </div>
    </div>
  );
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function PropertiesPanel() {
  const fields = useEditor((s) => s.fields);
  const locked = useEditor((s) => s.doc!.locked);
  const selectedId = useEditor((s) => s.selectedId);
  const update = useEditor((s) => s.updateField);
  const del = useEditor((s) => s.deleteField);
  const duplicate = useEditor((s) => s.duplicate);
  const problems = useMemo(() => validateFields(fields, locked), [fields, locked]);
  const f = fields.find((x) => x.id === selectedId);

  if (!f) {
    return (
      <aside className="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4 text-sm text-gray-600">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Properties</h2>
        <p>Select a field to edit it, or pick a field type in the toolbar and click on the page.</p>
        <p className="mt-4 text-xs text-gray-500">
          {fields.length} field{fields.length === 1 ? '' : 's'}
          {locked.length > 0 && ` · ${locked.length} locked`}
          {problems.length > 0 && <span className="text-red-600"> · {problems.length} problem(s)</span>}
        </p>
        <ul className="mt-4 space-y-1 text-xs text-gray-500">
          <li>Arrow keys nudge (Shift = 10pt)</li>
          <li>Ctrl+C / Ctrl+V / Ctrl+D copy, paste, duplicate</li>
          <li>Ctrl+Z / Ctrl+Shift+Z undo, redo</li>
          <li>Hold Alt while dragging to disable snapping</li>
        </ul>
      </aside>
    );
  }

  const set = (patch: Partial<FormField>, key: string) => update(f.id, patch, `${f.id}:${key}`);
  const setStyle = (patch: Partial<FieldStyle>) => set({ style: { ...f.style, ...patch } }, `style:${Object.keys(patch)[0]}`);
  const mine = problems.filter((p) => p.fieldId === f.id);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white" aria-label="Field properties">
      <div className="flex items-center gap-2 px-4 py-3">
        <FieldIcon type={f.type} />
        <h2 className="flex-1 text-sm font-semibold">{FIELD_LABELS[f.type]} field</h2>
        <button className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" onClick={duplicate}>
          Duplicate
        </button>
        <button className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => del(f.id)}>
          Delete
        </button>
      </div>

      <section className="space-y-3 px-4 pb-4">
        <Row label={f.type === 'radio' ? 'Group name' : 'Name'} hint={f.type === 'radio' ? 'Buttons with the same group name form one choice.' : undefined}>
          <input
            className={`${input} ${mine.length ? 'border-red-500' : ''}`}
            value={f.name}
            onChange={(e) => set({ name: e.target.value }, 'name')}
            spellCheck={false}
            aria-invalid={mine.length > 0}
          />
        </Row>
        {mine.map((p, i) => (
          <p key={i} className="text-xs text-red-600">
            {p.message}
          </p>
        ))}
        <Row label="Tooltip">
          <input className={input} value={f.tooltip} onChange={(e) => set({ tooltip: e.target.value }, 'tooltip')} />
        </Row>
        <div className="flex gap-4">
          <Check label="Required" checked={f.required} onChange={(v) => set({ required: v }, 'required')} />
          <Check label="Read-only" checked={f.readOnly} onChange={(v) => set({ readOnly: v }, 'readOnly')} />
        </div>
      </section>

      {(f.type === 'text' || f.type === 'multiline') && (
        <Section title={f.type === 'multiline' ? 'Multi-line text' : 'Text'}>
          <Row label="Default value">
            {f.type === 'multiline' ? (
              <textarea
                className={`${input} h-20 py-1`}
                value={f.defaultValue}
                onChange={(e) => set({ defaultValue: e.target.value }, 'defaultValue')}
              />
            ) : (
              <input className={input} value={f.defaultValue} onChange={(e) => set({ defaultValue: e.target.value }, 'defaultValue')} />
            )}
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Font size">
              <select className={input} value={f.fontSize} onChange={(e) => set({ fontSize: num(e.target.value) }, 'fontSize')}>
                {f.type === 'text' && <option value={0}>Auto</option>}
                {FONT_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Max length">
              <input
                className={input}
                type="number"
                min={0}
                placeholder="None"
                value={f.maxLength ?? ''}
                onChange={(e) => set({ maxLength: e.target.value === '' || num(e.target.value) <= 0 ? null : Math.floor(num(e.target.value)) }, 'maxLength')}
              />
            </Row>
          </div>
          {f.type === 'multiline' && (
            <p className="text-xs text-gray-500">
              The font size stays fixed. When the box is full, the text scrolls instead of shrinking.
            </p>
          )}
        </Section>
      )}

      {f.type === 'checkbox' && (
        <Section title="Checkbox">
          <Check label="Checked by default" checked={f.checked} onChange={(v) => set({ checked: v }, 'checked')} />
        </Section>
      )}

      {f.type === 'radio' && (
        <Section title="Radio button">
          <Row label="Export value" hint="The value submitted when this button is chosen.">
            <input className={input} value={f.exportValue} onChange={(e) => set({ exportValue: e.target.value }, 'exportValue')} />
          </Row>
          <Check label="Selected by default" checked={f.checked} onChange={(v) => set({ checked: v }, 'checked')} />
          <button className="w-full rounded-md border border-gray-300 py-1.5 text-sm hover:bg-gray-50" onClick={duplicate}>
            + Add another button to this group
          </button>
          <p className="text-xs text-gray-500">
            {fields.filter((x) => x.type === 'radio' && x.name === f.name).length} button(s) in “{f.name}”
          </p>
        </Section>
      )}

      {f.type === 'dropdown' && (
        <Section title="Dropdown">
          <Row label="Options (one per line)">
            <textarea
              className={`${input} h-28 py-1`}
              value={f.options.join('\n')}
              onChange={(e) => set({ options: e.target.value.split('\n') }, 'options')}
            />
          </Row>
          <Row label="Default">
            <select className={input} value={f.defaultValue} onChange={(e) => set({ defaultValue: e.target.value }, 'defaultValue')}>
              <option value="">(none)</option>
              {f.options
                .filter((o) => o.length > 0)
                .map((o, i) => (
                  <option key={`${o}-${i}`} value={o}>
                    {o}
                  </option>
                ))}
            </select>
          </Row>
          <Row label="Font size">
            <select className={input} value={f.fontSize} onChange={(e) => set({ fontSize: num(e.target.value) }, 'fontSize')}>
              <option value={0}>Auto</option>
              {[6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Row>
        </Section>
      )}

      <Section title="Appearance">
        <ColorInput label="Border" value={f.style.borderColor} allowNone onChange={(v) => setStyle({ borderColor: v })} />
        <ColorInput label="Background" value={f.style.backgroundColor} allowNone onChange={(v) => setStyle({ backgroundColor: v })} />
        <ColorInput
          label={f.type === 'checkbox' || f.type === 'radio' ? 'Mark color' : 'Text color'}
          value={f.style.textColor}
          allowNone={false}
          onChange={(v) => setStyle({ textColor: v ?? '#000000' })}
        />
      </Section>

      <Section title="Position (pt)">
        <div className="grid grid-cols-2 gap-3">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <Row key={k} label={{ x: 'X', y: 'Y', w: 'Width', h: 'Height' }[k]}>
              <input
                className={input}
                type="number"
                step={1}
                value={Math.round(f[k] * 10) / 10}
                onChange={(e) => set({ [k]: num(e.target.value) } as Partial<FormField>, k)}
              />
            </Row>
          ))}
        </div>
        <p className="text-xs text-gray-500">Page {f.page + 1}</p>
      </Section>
    </aside>
  );
}
