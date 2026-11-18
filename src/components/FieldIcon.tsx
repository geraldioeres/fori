import type { FieldType } from '../model/types';

export function FieldIcon({ type }: { type: FieldType }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 };
  switch (type) {
    case 'text':
      return (
        <svg {...common} aria-hidden>
          <rect x="1.5" y="4" width="13" height="8" rx="1" />
          <path d="M4 6.5v3M3.2 6.5h1.6M3.2 9.5h1.6" />
        </svg>
      );
    case 'multiline':
      return (
        <svg {...common} aria-hidden>
          <rect x="1.5" y="2" width="13" height="12" rx="1" />
          <path d="M4 5.5h8M4 8h8M4 10.5h5" />
        </svg>
      );
    case 'checkbox':
      return (
        <svg {...common} aria-hidden>
          <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
          <path d="M5 8.2l2 2 4-4.4" />
        </svg>
      );
    case 'radio':
      return (
        <svg {...common} aria-hidden>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'dropdown':
      return (
        <svg {...common} aria-hidden>
          <rect x="1.5" y="4" width="13" height="8" rx="1" />
          <path d="M10 7l1.5 1.5L13 7" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common} aria-hidden>
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
          <circle cx="5.5" cy="6" r="1.3" />
          <path d="M2 12l4-3.5 3 2.5 2-1.5 3.5 2.5" />
        </svg>
      );
  }
}
