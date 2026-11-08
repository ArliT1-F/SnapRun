import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  defaultSettings,
  effectiveNotificationRedaction,
  initialConnection,
  localPreferencePersistence,
  mergeSettings,
  type AppNotification,
  type ConnectionState,
  type Contact,
  type ContactInput,
  type NotificationKind,
  type Settings,
  type User,
  type WorkspaceData,
} from '@snaprun/shared';
import { api, ApiError, clientId, errorMessage } from './api';
import {
  applyDesktopBehavior,
  cacheDesktopSettings,
  clearDesktopPreferencesCache,
  desktopNotify,
} from './platform';
import { wipeBrowserCompanionData } from './privacy';
import { snapchatProvider } from '../integrations/snapchat/OfficialWebProvider';
import type { HandoffPurpose } from '../integrations/snapchat/types';

type Toast = { id: string; message: string; tone: 'success' | 'error' | 'info' };
type AuthMode = 'login' | 'register' | null;
type WorkspaceContextValue = {
  ready: boolean;
  user: User | null;
  settings: Settings;
  contacts: Contact[];
  notifications: AppNotification[];
  connection: ConnectionState;
  syncState: 'local' | 'synced' | 'saving' | 'error';
  online: boolean;
  toasts: Toast[];
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  handoffPurpose: HandoffPurpose | null;
  setHandoffPurpose: (purpose: HandoffPurpose | null) => void;
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  updateSettings: (updater: (current: Settings) => Settings) => Promise<void>;
  authenticate: (
    mode: 'login' | 'register',
    input: { email: string; password: string; displayName?: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  wipeThisDevice: () => Promise<void>;
  refresh: () => Promise<void>;
  saveContact: (input: ContactInput, id?: string) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  markRead: (id?: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  openSnapchat: (purpose?: HandoffPurpose) => Promise<void>;
  markConnection: (status: 'user_confirmed' | 'not_connected') => Promise<void>;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
function localSettings() {
  try {
    return mergeSettings(JSON.parse(localStorage.getItem('snaprun.preferences') ?? 'null'));
  } catch {
    return structuredClone(defaultSettings);
  }
}
function localEvent(kind: NotificationKind, title: string, body: string): AppNotification {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    body,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
}
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings>(localSettings);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [connection, setConnection] = useState<ConnectionState>({ ...initialConnection });
  const [syncState, setSyncState] = useState<WorkspaceContextValue['syncState']>('local');
  const [online, setOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [handoffPurpose, setHandoffPurpose] = useState<HandoffPurpose | null>(null);
  const settingsRef = useRef(settings);
  const revision = useRef(0);
  const userRef = useRef(user);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const writeGeneration = useRef(0);
  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5500);
  }, []);
  const applySettings = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
    try {
      if (localPreferencePersistence(next))
        localStorage.setItem('snaprun.preferences', JSON.stringify(next));
      else localStorage.removeItem('snaprun.preferences');
    } catch {
      /* Nonessential appearance cache. */
    }
    void cacheDesktopSettings(next).catch(() => undefined);
  }, []);
  const applyBootstrap = useCallback(
    (data: WorkspaceData) => {
      userRef.current = data.user;
      setUser(data.user);
      applySettings(data.settings);
      revision.current = data.revision;
      setContacts(data.contacts);
      setNotifications(data.notifications);
      setConnection(data.connection);
      setSyncState('synced');
    },
    [applySettings],
  );
  const reset = useCallback(() => {
    userRef.current = null;
    setUser(null);
    setContacts([]);
    setNotifications([]);
    setConnection({ ...initialConnection });
    setSyncState('local');
    revision.current = 0;
  }, []);
  const refresh = useCallback(async () => {
    if (!userRef.current) return;
    try {
      applyBootstrap(await api<WorkspaceData>('/bootstrap'));
    } catch (error) {
      setSyncState('error');
      if (!(error instanceof ApiError && error.status === 401))
        notify(errorMessage(error), 'error');
    }
  }, [applyBootstrap, notify]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await api<{ user: User | null }>('/auth/session');
        if (session.user && active) {
          userRef.current = session.user;
          const data = await api<WorkspaceData>('/bootstrap');
          if (active) applyBootstrap(data);
        }
      } catch {
        if (active) setSyncState('local');
      } finally {
        if (active) setReady(true);
      }
    })();
    const onOnline = () => {
      setOnline(true);
      void refresh();
    };
    const onOffline = () => {
      setOnline(false);
      setSyncState('error');
    };
    const onExpired = () => {
      reset();
      setAuthMode('login');
      notify('Your session expired. Sign in again to continue.', 'info');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('snaprun:session-expired', onExpired);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('snaprun:session-expired', onExpired);
    };
  }, [applyBootstrap, refresh, reset, notify]);
  useEffect(() => {
    if (!user || !online) return;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;
    let attempts = 0;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/sync`,
      );
      socket.onopen = () => {
        attempts = 0;
        void refresh();
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ready') {
            socket?.send(JSON.stringify({ type: 'hello', clientId }));
            return;
          }
          if (message.type === 'session-revoked' && message.source !== clientId) {
            window.dispatchEvent(new Event('snaprun:session-expired'));
            return;
          }
          if (message.source !== clientId) void refresh();
        } catch {
          /* Ignore malformed realtime hints; REST remains authoritative. */
        }
      };
      socket.onclose = (event) => {
        if (!closed) {
          if (event.code === 1008) {
            void api<{ user: User | null }>('/auth/session')
              .then((s) => {
                if (!s.user) window.dispatchEvent(new Event('snaprun:session-expired'));
              })
              .catch(() => undefined);
            return;
          }
          retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempts++));
        }
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [user?.id, online, refresh]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme, settings.reducedMotion]);
  const updateSettings = useCallback(
    (updater: (current: Settings) => Settings) => {
      const next = updater(settingsRef.current);
      const previous = settingsRef.current;
      const previousRevision = revision.current;
      const generation = writeGeneration.current;
      applySettings(next);
      if (!userRef.current) return Promise.resolve();
      setSyncState('saving');
      const task = queue.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== writeGeneration.current) return;
          try {
            const result = await api<{ revision: number }>('/settings', {
              method: 'PUT',
              body: { settings: next, revision: revision.current },
            });
            revision.current = result.revision;
            setSyncState('synced');
          } catch (error) {
            writeGeneration.current += 1;
            if (error instanceof ApiError && error.code === 'REVISION_CONFLICT') {
              applySettings(mergeSettings(error.details?.settings));
              revision.current = Number(error.details?.revision ?? 1);
              setSyncState('synced');
            } else {
              applySettings(previous);
              revision.current = previousRevision;
              setSyncState('error');
            }
            notify(errorMessage(error), 'error');
          }
        });
      queue.current = task;
      return task;
    },
    [applySettings, notify],
  );
  const authenticate = useCallback(
    async (
      mode: 'login' | 'register',
      input: { email: string; password: string; displayName?: string },
    ) => {
      await api(`/auth/${mode}`, { method: 'POST', body: input });
      applyBootstrap(await api<WorkspaceData>('/bootstrap'));
      setAuthMode(null);
      notify(
        mode === 'register'
          ? 'Your companion account is ready.'
          : 'Welcome back. Your workspace is in sync.',
      );
    },
    [applyBootstrap, notify],
  );
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', body: {} });
    reset();
    notify('Signed out of your companion account.', 'info');
  }, [reset, notify]);
  const deleteAccount = useCallback(
    async (password: string) => {
      await api('/account', { method: 'DELETE', body: { password, confirmation: 'DELETE' } });
      reset();
      notify('Your companion account and server data were deleted.', 'info');
    },
    [reset, notify],
  );
  const wipeThisDevice = useCallback(async () => {
    writeGeneration.current += 1;
    await queue.current.catch(() => undefined);
    let signedOut = true;
    if (userRef.current) {
      try {
        await api('/auth/logout', { method: 'POST', body: {} });
      } catch {
        signedOut = false;
      }
    }
    wipeBrowserCompanionData();
    await clearDesktopPreferencesCache().catch(() => false);
    const next: Settings = {
      ...structuredClone(defaultSettings),
      privacy: { enabled: true, redactNotifications: true },
    };
    reset();
    applySettings(next);
    setAuthMode(null);
    setHandoffPurpose(null);
    await applyDesktopBehavior(next).catch(() => undefined);
    if (signedOut)
      notify('Local SnapRun data wiped. You’re now in a session-only guest workspace.', 'info');
    else
      notify(
        'Local data cleared, but the server session could not be revoked. Reconnect and sign out again.',
        'error',
      );
  }, [reset, notify, applySettings]);
  const saveContact = useCallback(
    async (input: ContactInput, id?: string) => {
      if (userRef.current) {
        const saved = await api<Contact>(id ? `/contacts/${id}` : '/contacts', {
          method: id ? 'PATCH' : 'POST',
          body: input,
        });
        setContacts((prev) => (id ? prev.map((c) => (c.id === id ? saved : c)) : [saved, ...prev]));
        if (!id)
          setNotifications((prev) => [
            localEvent(
              'contact',
              'Contact added to your workspace',
              'Your encrypted contact is saved to your companion account.',
            ),
            ...prev,
          ]);
      } else {
        const now = new Date().toISOString();
        const saved: Contact = {
          ...input,
          id: id ?? crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        };
        setContacts((prev) =>
          id
            ? prev.map((c) => (c.id === id ? { ...saved, createdAt: c.createdAt } : c))
            : [saved, ...prev],
        );
        if (!id)
          setNotifications((prev) => [
            localEvent(
              'contact',
              'Contact added to this session',
              'Guest contacts stay in memory and are lost when this page is closed.',
            ),
            ...prev,
          ]);
      }
      notify(id ? 'Contact updated.' : 'Contact added to your workspace.');
      if (
        settingsRef.current.notifications.desktop &&
        settingsRef.current.notifications.onContactChange
      )
        void desktopNotify(
          'SnapRun · Contact saved',
          'Your local contact list has been updated.',
          effectiveNotificationRedaction(settingsRef.current),
        ).catch(() => undefined);
    },
    [notify],
  );
  const deleteContact = useCallback(
    async (id: string) => {
      if (userRef.current) await api(`/contacts/${id}`, { method: 'DELETE' });
      setContacts((prev) => prev.filter((c) => c.id !== id));
      notify('Contact removed. Your Snapchat friends are unchanged.', 'info');
    },
    [notify],
  );
  const markRead = useCallback(async (id?: string) => {
    if (userRef.current)
      await api(id ? `/notifications/${id}/read` : '/notifications/read-all', {
        method: id ? 'PATCH' : 'POST',
        body: {},
      });
    setNotifications((prev) =>
      prev.map((n) =>
        !id || n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
      ),
    );
  }, []);
  const clearNotifications = useCallback(async () => {
    if (userRef.current) await api('/notifications', { method: 'DELETE' });
    setNotifications([]);
    notify('Notification history cleared.', 'info');
  }, [notify]);
  const openSnapchat = useCallback(
    async (purpose: HandoffPurpose = 'login') => {
      try {
        await snapchatProvider.handoff(purpose, { connectionStatus: connection.status });
        const title =
          purpose === 'register' ? 'Snapchat registration opened' : 'Snapchat Web opened';
        const body =
          'Continue in Snapchat’s official interface. SnapRun cannot verify your login or read your messages.';
        if (userRef.current) {
          const result = await api<{ connection: ConnectionState }>(
            '/integrations/snapchat/handoff',
            { method: 'POST', body: { purpose } },
          );
          setConnection(result.connection);
          setNotifications((prev) => [localEvent('handoff', title, body), ...prev]);
        } else {
          setConnection((prev) => ({
            ...prev,
            status: 'handoff_opened',
            lastHandoffAt: new Date().toISOString(),
            confirmedAt: null,
          }));
          setNotifications((prev) => [localEvent('handoff', title, body), ...prev]);
        }
        if (
          settingsRef.current.notifications.desktop &&
          settingsRef.current.notifications.onHandoff
        )
          void desktopNotify(
            'SnapRun · Snapchat opened',
            body,
            effectiveNotificationRedaction(settingsRef.current),
          ).catch(() => undefined);
      } catch (error) {
        notify(errorMessage(error), 'error');
        throw error;
      }
    },
    [connection.status, notify],
  );
  const markConnection = useCallback(
    async (status: 'user_confirmed' | 'not_connected') => {
      if (userRef.current) {
        const result = await api<{ connection: ConnectionState }>('/integrations/snapchat/status', {
          method: 'PUT',
          body: { status },
        });
        setConnection(result.connection);
      } else
        setConnection((prev) => ({
          ...prev,
          status,
          confirmedAt: status === 'user_confirmed' ? new Date().toISOString() : null,
        }));
      setNotifications((prev) => [
        localEvent(
          'connection',
          'Connection note updated',
          status === 'user_confirmed'
            ? 'You marked Snapchat as signed in. This has not been verified by SnapRun.'
            : 'Your connection note was cleared.',
        ),
        ...prev,
      ]);
      notify(
        status === 'user_confirmed'
          ? 'Saved as self-reported. No Snapchat session was verified.'
          : 'Connection note cleared.',
        'info',
      );
    },
    [notify],
  );
  return (
    <WorkspaceContext.Provider
      value={{
        ready,
        user,
        settings,
        contacts,
        notifications,
        connection,
        syncState,
        online,
        toasts,
        authMode,
        setAuthMode,
        handoffPurpose,
        setHandoffPurpose,
        notify,
        dismissToast: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
        updateSettings,
        authenticate,
        logout,
        deleteAccount,
        wipeThisDevice,
        refresh,
        saveContact,
        deleteContact,
        markRead,
        clearNotifications,
        openSnapchat,
        markConnection,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('WorkspaceProvider is missing');
  return context;
}
