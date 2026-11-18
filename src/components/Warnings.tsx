import { useEditor } from '../state/store';

export function Warnings() {
  const warnings = useEditor((s) => s.warnings);
  const dismiss = useEditor((s) => s.dismissWarning);
  if (warnings.length === 0) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900">
      {warnings.map((w, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-1.5">
          <span aria-hidden>⚠</span>
          <span className="flex-1">{w}</span>
          <button className="opacity-60 hover:opacity-100" onClick={() => dismiss(i)} aria-label="Dismiss warning">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
