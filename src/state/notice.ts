import { create } from 'zustand';

interface NoticeState {
  message: string | null;
  kind: 'error' | 'info';
  show(message: string, kind?: 'error' | 'info'): void;
  clear(): void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useNotice = create<NoticeState>((set) => ({
  message: null,
  kind: 'info',
  show(message, kind = 'error') {
    clearTimeout(timer);
    set({ message, kind });
    timer = setTimeout(() => set({ message: null }), 6000);
  },
  clear() {
    set({ message: null });
  },
}));
