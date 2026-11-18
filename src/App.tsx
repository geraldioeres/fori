import { useEffect, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEditor } from './state/store';
import { loadSession, startAutosave } from './state/autosave';
import { useNotice } from './state/notice';
import { UploadScreen } from './components/UploadScreen';
import { Toolbar } from './components/Toolbar';
import { Viewer } from './components/Viewer';
import { Thumbnails } from './components/Thumbnails';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Warnings } from './components/Warnings';
import { useKeyboard } from './components/useKeyboard';
import { Logo } from './components/Logo';

const MIN_DESKTOP_WIDTH = 900;

function useIsDesktop() {
  const [ok, setOk] = useState(() => window.innerWidth >= MIN_DESKTOP_WIDTH);
  useEffect(() => {
    const onResize = () => setOk(window.innerWidth >= MIN_DESKTOP_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return ok;
}

export default function App() {
  const doc = useEditor((s) => s.doc);
  const notice = useNotice();
  const isDesktop = useIsDesktop();
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let stop: (() => void) | undefined;
    loadSession().then((saved) => {
      if (saved) {
        useEditor
          .getState()
          .openDocument(
            { fileName: saved.fileName, bytes: saved.bytes, pages: saved.pages, locked: saved.locked },
            saved.fields,
            [],
          );
        useNotice.getState().show(`Restored your last session (${saved.fileName}).`, 'info');
      }
      setRestoring(false);
      stop = startAutosave();
    });
    return () => stop?.();
  }, []);

  useKeyboard(!!doc);

  if (!isDesktop) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <Logo size={56} className="mx-auto mb-3" />
          <h1 className="mb-2 text-xl font-semibold">Fori PDF Form Builder</h1>
          <p className="text-gray-600">Please open this page on a desktop or laptop computer. Form editing isn’t supported on small screens.</p>
        </div>
      </div>
    );
  }

  if (restoring) return null;

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="flex h-full flex-col">
        {doc ? (
          <>
            <Toolbar />
            <Warnings />
            <div className="flex min-h-0 flex-1">
              <Thumbnails />
              <Viewer />
              <PropertiesPanel />
            </div>
          </>
        ) : (
          <UploadScreen />
        )}
        {notice.message && (
          <div
            role="status"
            className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm shadow-lg ${
              notice.kind === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
            }`}
          >
            {notice.message}
            <button className="ml-3 opacity-70 hover:opacity-100" onClick={notice.clear} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}
