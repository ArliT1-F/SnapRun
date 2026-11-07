import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
import { WorkspaceProvider, useWorkspace } from './lib/workspace';
import { applyDesktopBehavior, isDesktop } from './lib/platform';
import { Layout } from './components/Layout';
import { AuthDialog } from './components/AuthDialog';
import { HandoffDialog } from './components/HandoffDialog';
import { Button, EmptyState, LoadingScreen } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { Messages } from './pages/Messages';
import { Contacts } from './pages/Contacts';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
function Overlays() {
  const { toasts, dismissToast, handoffPurpose, authMode, settings, notify } = useWorkspace();
  useEffect(() => {
    if (handoffPurpose || authMode) return;
    void applyDesktopBehavior(settings).catch(() =>
      notify(
        'A desktop preference could not be applied. Check system permissions or shortcut availability.',
        'error',
      ),
    );
  }, [settings.desktop, handoffPurpose, authMode, notify]);
  return (
    <>
      <AuthDialog />
      {handoffPurpose && <HandoffDialog key={handoffPurpose} />}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            {toast.tone === 'success' ? (
              <CheckCircle2 size={19} />
            ) : toast.tone === 'error' ? (
              <XCircle size={19} />
            ) : (
              <Info size={19} />
            )}
            <span>{toast.message}</span>
            <button aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
function App() {
  const { ready } = useWorkspace();
  if (!ready) return <LoadingScreen />;
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="messages" element={<Messages />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route
            path="*"
            element={
              <EmptyState
                icon={Info}
                title="A little off the beaten path."
                description="That page doesn’t exist. Your workspace is right where you left it."
                action={
                  <Link to="/">
                    <Button>Back to dashboard</Button>
                  </Link>
                }
              />
            }
          />
        </Route>
      </Routes>
      <Overlays />
    </BrowserRouter>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </React.StrictMode>,
);
