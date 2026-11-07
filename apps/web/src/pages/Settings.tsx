import { useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  ContactRound,
  ExternalLink,
  Globe,
  Keyboard,
  Laptop,
  LockKeyhole,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Plus,
  ShieldCheck,
  Smartphone,
  Sun,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {
  defaultSettings,
  OFFICIAL_SNAPCHAT_HELP,
  type Label,
  type Settings as SettingsType,
} from '@snaprun/shared';
import { useWorkspace } from '../lib/workspace';
import { api, errorMessage } from '../lib/api';
import { applyDesktopBehavior, isDesktop, requestNotificationPermission } from '../lib/platform';
import {
  Avatar,
  Badge,
  Button,
  ConnectionBadge,
  EmptyState,
  IconButton,
  Modal,
  PageHeader,
  Switch,
} from '../components/ui';
const tabs = [
  { id: 'appearance', name: 'Appearance', icon: Palette },
  { id: 'language', name: 'Language', icon: Globe },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'shortcuts', name: 'Keyboard shortcuts', icon: Keyboard },
  { id: 'desktop', name: 'Desktop', icon: Laptop },
  { id: 'contacts', name: 'Contact labels', icon: Tag },
  { id: 'services', name: 'Connected services', icon: ExternalLink },
  { id: 'privacy', name: 'Privacy & security', icon: ShieldCheck },
  { id: 'account', name: 'Your account', icon: UserRound },
];
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function LabelsEditor() {
  const { settings, updateSettings, contacts, notify } = useWorkspace();
  const [name, setName] = useState('');
  const [color, setColor] = useState<Label['color']>('yellow');
  const [editing, setEditing] = useState<string | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (
      settings.labels.some((l) => l.name.toLowerCase() === clean.toLowerCase() && l.id !== editing)
    ) {
      notify('A label with that name already exists.', 'error');
      return;
    }
    const label: Label = { id: editing ?? crypto.randomUUID(), name: clean, color };
    try {
      await updateSettings((s) => ({
        ...s,
        labels: editing
          ? s.labels.map((l) => (l.id === editing ? label : l))
          : [...s.labels, label],
      }));
      setName('');
      setEditing(null);
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };
  return (
    <>
      <SettingRow
        title="Your own filing system"
        description="Create up to 40 labels. Apply them to contacts your way; Snapchat is never changed."
      >
        <Badge>{settings.labels.length}/40</Badge>
      </SettingRow>
      <form className="label-editor-form" onSubmit={save}>
        <input
          aria-label="Label name"
          placeholder={editing ? 'Edit label name' : 'e.g. Close friends'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          required
        />
        <div className="color-picker" aria-label="Label color">
          {(['yellow', 'blue', 'green', 'purple', 'rose'] as const).map((c) => (
            <button
              type="button"
              key={c}
              aria-label={`${c} label color`}
              aria-pressed={color === c}
              className={`color-swatch label-${c} ${color === c ? 'selected' : ''}`}
              onClick={() => setColor(c)}
            >
              {color === c && <Check size={13} />}
            </button>
          ))}
        </div>
        <Button type="submit" disabled={settings.labels.length >= 40 && !editing}>
          <Plus size={15} />
          {editing ? 'Save' : 'Add label'}
        </Button>
        {editing && (
          <IconButton
            type="button"
            label="Cancel editing"
            onClick={() => {
              setEditing(null);
              setName('');
            }}
          >
            <X size={16} />
          </IconButton>
        )}
      </form>
      <div className="labels-list">
        {settings.labels.length ? (
          settings.labels.map((label) => {
            const count = contacts.filter((c) => c.labelIds.includes(label.id)).length;
            return (
              <div key={label.id}>
                <span className={`label-chip label-${label.color}`}>
                  <Tag size={12} />
                  {label.name}
                </span>
                <span>
                  {count} {count === 1 ? 'contact' : 'contacts'}
                </span>
                <button
                  onClick={() => {
                    setEditing(label.id);
                    setName(label.name);
                    setColor(label.color);
                  }}
                >
                  Rename
                </button>
                <IconButton
                  label={`Delete ${label.name}`}
                  disabled={count > 0}
                  onClick={() =>
                    void updateSettings((s) => ({
                      ...s,
                      labels: s.labels.filter((l) => l.id !== label.id),
                    }))
                  }
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            );
          })
        ) : (
          <EmptyState
            compact
            icon={Tag}
            title="Labels, your way"
            description="Try “Close friends”, “Work” or “Weekend people”. Add a label above to get started."
          />
        )}
      </div>
      <p className="fine-print">
        Labels in use must be removed from their contacts before deletion. Label changes sync with
        your companion account.
      </p>
    </>
  );
}
function ShortcutEditor() {
  const { settings, updateSettings } = useWorkspace();
  const [recording, setRecording] = useState<keyof SettingsType['shortcuts'] | null>(null);
  const names = {
    commandPalette: 'Find your way',
    openMessages: 'Go to messages',
    newContact: 'Add a contact',
    toggleTheme: 'Switch color theme',
  };
  return (
    <>
      <SettingRow
        title="A faster way around"
        description="Shortcuts work while you’re in the workspace, not inside forms or Snapchat."
      >
        <Keyboard size={20} />
      </SettingRow>
      <div className="shortcut-list">
        {Object.entries(settings.shortcuts).map(([key, shortcut]) => (
          <SettingRow
            key={key}
            title={names[key as keyof typeof names]}
            description={
              key === 'newContact'
                ? 'Opens your local contact editor'
                : 'Available throughout your companion'
            }
          >
            <div className="shortcut-controls">
              <button
                className={`shortcut-key ${recording === key ? 'recording' : ''}`}
                aria-label={`Change shortcut for ${names[key as keyof typeof names]}`}
                onClick={() => setRecording(key as keyof typeof settings.shortcuts)}
                onKeyDown={(event) => {
                  if (recording !== key) return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.key === 'Escape') {
                    setRecording(null);
                    return;
                  }
                  if (['Control', 'Meta', 'Shift', 'Alt'].includes(event.key)) return;
                  const parts = [
                    ...(event.ctrlKey || event.metaKey ? ['Mod'] : []),
                    ...(event.shiftKey ? ['Shift'] : []),
                    ...(event.altKey ? ['Alt'] : []),
                    event.key.length === 1 ? event.key.toLowerCase() : event.key,
                  ];
                  void updateSettings((s) => ({
                    ...s,
                    shortcuts: {
                      ...s.shortcuts,
                      [key]: {
                        ...s.shortcuts[key as keyof typeof names],
                        binding: parts.join('+'),
                      },
                    },
                  }));
                  setRecording(null);
                }}
              >
                {recording === key
                  ? 'Press keys…'
                  : shortcut.binding
                      .replace('Mod', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
                      .split('+')
                      .join(' + ')}
              </button>
              <Switch
                label={`Enable ${names[key as keyof typeof names]}`}
                checked={shortcut.enabled}
                onChange={(enabled) =>
                  void updateSettings((s) => ({
                    ...s,
                    shortcuts: { ...s.shortcuts, [key]: { ...shortcut, enabled } },
                  }))
                }
              />
            </div>
          </SettingRow>
        ))}
      </div>
      <div className="settings-bottom-action">
        <p className="fine-print">
          Click a shortcut, then press your new key combination. Escape cancels.
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            void updateSettings((s) => ({
              ...s,
              shortcuts: structuredClone(defaultSettings.shortcuts),
            }))
          }
        >
          Restore defaults
        </Button>
      </div>
    </>
  );
}
export function Settings() {
  const workspace = useWorkspace();
  const {
    user,
    settings,
    updateSettings,
    notify,
    setAuthMode,
    setHandoffPurpose,
    logout,
    deleteAccount,
    syncState,
  } = workspace;
  const [params, setParams] = useSearchParams();
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'appearance';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [permissionBusy, setPermissionBusy] = useState(false);
  const desktop = isDesktop();
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };
  const notification = (key: keyof SettingsType['notifications'], value: boolean) =>
    void updateSettings((s) => ({ ...s, notifications: { ...s.notifications, [key]: value } }));
  const desktopSetting = (
    key: 'launchAtStartup' | 'minimizeToTray' | 'closeToTray',
    value: boolean,
  ) =>
    void run(async () => {
      const next = { ...settings.desktop, [key]: value };
      await updateSettings((s) => ({ ...s, desktop: next }));
      await applyDesktopBehavior({ ...settings, desktop: next });
    });
  const enableNotifications = async (value: boolean) => {
    if (!value) {
      notification('desktop', false);
      return;
    }
    setPermissionBusy(true);
    try {
      const granted = await requestNotificationPermission();
      notification('desktop', granted);
      if (!granted)
        notify(
          'Notification permission was not granted. You can change it in system settings.',
          'info',
        );
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setPermissionBusy(false);
    }
  };
  const exportData = async () => {
    if (!user) {
      const blob = new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              settings,
              contacts: workspace.contacts,
              notifications: workspace.notifications,
              connection: workspace.connection,
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'snaprun-local-export.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const response = await fetch('/api/account/export', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Could not export your data. Sign in again and retry.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snaprun-export.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const removeAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('confirmation') !== 'DELETE') return;
    setBusy(true);
    setDeleteError('');
    try {
      await deleteAccount(String(data.get('password')));
      setDeleteOpen(false);
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="THE DETAILS MAKE IT YOURS"
        title="Settings"
        description="A workspace that fits the way you move through your day."
        action={
          <Badge tone={user ? 'green' : 'neutral'}>
            <Cloud size={13} />
            {user
              ? syncState === 'saving'
                ? 'Saving…'
                : 'Account-backed preferences'
              : 'Saved on this device'}
          </Badge>
        }
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              onClick={() => setParams({ tab: id }, { replace: true })}
            >
              <Icon size={17} />
              <span>{name}</span>
              {tab === id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <section className="panel settings-content" key={tab}>
          <div className="settings-section-heading">
            <h2>{tabs.find((t) => t.id === tab)?.name}</h2>
            <p>
              {
                {
                  appearance: 'Set the mood. Keep the focus.',
                  language: 'The words that feel like home.',
                  notifications: 'Stay informed, without the noise.',
                  shortcuts: 'Your most common actions, a little closer.',
                  desktop: 'At home on your desktop.',
                  contacts: 'A system that makes sense to you.',
                  services: 'Clear connections. No hidden access.',
                  privacy: 'Know what stays, what syncs, and what never leaves.',
                  account: 'Your own corner of SnapRun.',
                }[tab]
              }
            </p>
          </div>
          {tab === 'appearance' && (
            <>
              <div className="theme-options">
                {(
                  [
                    { id: 'dark', name: 'After hours', subtitle: 'Dark theme', icon: Moon },
                    { id: 'light', name: 'Daylight', subtitle: 'Light theme', icon: Sun },
                    {
                      id: 'system',
                      name: 'Go with the flow',
                      subtitle: 'Match your system',
                      icon: Monitor,
                    },
                  ] as const
                ).map((theme) => (
                  <button
                    key={theme.id}
                    className={`theme-option ${settings.theme === theme.id ? 'selected' : ''}`}
                    onClick={() => void updateSettings((s) => ({ ...s, theme: theme.id }))}
                  >
                    <div className={`theme-preview preview-${theme.id}`}>
                      <span className="preview-sidebar" />
                      <div>
                        <span className="preview-heading" />
                        <span className="preview-card" />
                        <span className="preview-line" />
                      </div>
                      <span className="theme-check">
                        {settings.theme === theme.id && <Check size={12} />}
                      </span>
                    </div>
                    <strong>
                      <theme.icon size={15} />
                      {theme.name}
                    </strong>
                    <small>{theme.subtitle}</small>
                  </button>
                ))}
              </div>
              <SettingRow
                title="A little less motion"
                description="Reduce decorative animations and transitions throughout the workspace."
              >
                <Switch
                  label="Reduce motion"
                  checked={settings.reducedMotion}
                  onChange={(value) => void updateSettings((s) => ({ ...s, reducedMotion: value }))}
                />
              </SettingRow>
              <div className="info-note">
                <Palette size={17} />
                <span>
                  Dark is the default. Your choice is remembered on this device and synced when
                  you’re signed in.
                </span>
              </div>
            </>
          )}
          {tab === 'language' && (
            <>
              <SettingRow
                title="Workspace language"
                description="Choose the language used by your companion. Snapchat controls its own language."
              >
                <select
                  aria-label="Workspace language"
                  value={settings.language}
                  onChange={(e) =>
                    void updateSettings((s) => ({ ...s, language: e.target.value as 'en' }))
                  }
                >
                  <option value="en">English</option>
                </select>
              </SettingRow>
              <div className="info-note">
                <Globe size={18} />
                <span>
                  English is fully supported. We only list languages that are actually translated.
                  Your preference is ready to sync as more languages become available.
                </span>
              </div>
            </>
          )}
          {tab === 'notifications' && (
            <>
              <SettingRow
                title="In-app indicators"
                description="Show unread badges in navigation. Your activity history is always available."
              >
                <Switch
                  label="In-app indicators"
                  checked={settings.notifications.inApp}
                  onChange={(v) => notification('inApp', v)}
                />
              </SettingRow>
              <SettingRow
                title="System notifications"
                description={
                  desktop
                    ? 'Use native desktop notifications for companion events.'
                    : 'Allow browser notifications for companion events while this app is open.'
                }
              >
                <div className={permissionBusy ? 'busy-control' : ''}>
                  <Switch
                    label="System notifications"
                    checked={settings.notifications.desktop}
                    onChange={(v) => void enableNotifications(v)}
                    disabled={permissionBusy}
                  />
                </div>
              </SettingRow>
              <div className="settings-subheading">WHAT WOULD YOU LIKE TO HEAR ABOUT?</div>
              <SettingRow
                title="Official Snapchat handoffs"
                description="A gentle reminder when you continue to Snapchat."
              >
                <Switch
                  label="Handoff notifications"
                  checked={settings.notifications.onHandoff}
                  onChange={(v) => notification('onHandoff', v)}
                />
              </SettingRow>
              <SettingRow
                title="Contact updates"
                description="Notify when you add or edit a local contact."
              >
                <Switch
                  label="Contact notifications"
                  checked={settings.notifications.onContactChange}
                  onChange={(v) => notification('onContactChange', v)}
                />
              </SettingRow>
              <div className="info-note">
                <Bell size={17} />
                <span>
                  These preferences control companion events only. SnapRun cannot receive or deliver
                  private Snapchat message notifications.
                </span>
              </div>
            </>
          )}
          {tab === 'shortcuts' && <ShortcutEditor />}
          {tab === 'desktop' && (
            <>
              {!desktop && (
                <div className="info-note">
                  <Laptop size={18} />
                  <span>
                    You’re using the web app. These preferences sync to the SnapRun desktop app;
                    native controls are available there.
                  </span>
                </div>
              )}
              <SettingRow
                title="Start with your system"
                description="Launch SnapRun when you sign in to your computer."
              >
                <Switch
                  label="Launch at startup"
                  checked={settings.desktop.launchAtStartup}
                  disabled={!desktop}
                  onChange={(v) => desktopSetting('launchAtStartup', v)}
                />
              </SettingRow>
              <SettingRow
                title="Minimize to the system tray"
                description="Keep your workspace close without taking up taskbar space."
              >
                <Switch
                  label="Minimize to tray"
                  checked={settings.desktop.minimizeToTray}
                  disabled={!desktop}
                  onChange={(v) => desktopSetting('minimizeToTray', v)}
                />
              </SettingRow>
              <SettingRow
                title="Close to the system tray"
                description="Closing the window keeps SnapRun running. Use Quit in the tray to exit."
              >
                <Switch
                  label="Close to tray"
                  checked={settings.desktop.closeToTray}
                  disabled={!desktop}
                  onChange={(v) => desktopSetting('closeToTray', v)}
                />
              </SettingRow>
              <SettingRow
                title="Bring SnapRun forward"
                description="A system-wide shortcut to show and focus your workspace."
              >
                <select
                  aria-label="Global desktop shortcut"
                  disabled={!desktop}
                  value={settings.desktop.globalShortcut}
                  onChange={(e) =>
                    void run(async () => {
                      const next = { ...settings.desktop, globalShortcut: e.target.value };
                      await updateSettings((s) => ({ ...s, desktop: next }));
                      await applyDesktopBehavior({ ...settings, desktop: next });
                    })
                  }
                >
                  <option>CommandOrControl+Shift+S</option>
                  <option>CommandOrControl+Alt+S</option>
                  <option>CommandOrControl+Shift+Space</option>
                </select>
              </SettingRow>
              <p className="fine-print">
                Linux tray support depends on your desktop environment’s StatusNotifier support.
                Native settings contain no passwords or Snapchat tokens.
              </p>
            </>
          )}
          {tab === 'contacts' && <LabelsEditor />}
          {tab === 'services' && (
            <>
              <div className="service-card">
                <span className="service-icon">
                  <Smartphone size={25} />
                </span>
                <div>
                  <h3>Snapchat Web</h3>
                  <p>Official authentication and messaging handoff</p>
                  <ConnectionBadge />
                </div>
                <Button variant="secondary" onClick={() => setHandoffPurpose('login')}>
                  Manage
                  <ArrowRight size={15} />
                </Button>
              </div>
              <div className="service-boundaries">
                <span>
                  <Check size={15} />
                  Opens Snapchat’s official website
                </span>
                <span>
                  <X size={15} />
                  No access to private conversations
                </span>
                <span>
                  <X size={15} />
                  No password or token collection
                </span>
                <span>
                  <X size={15} />
                  No automated registration or restriction bypass
                </span>
              </div>
              <SettingRow
                title="Google sign-in"
                description="Optional companion authentication. No Google OAuth application is configured in this installation."
              >
                <Badge>Not configured</Badge>
              </SettingRow>
              <div className="info-note">
                <ShieldCheck size={17} />
                <span>
                  Snap Kit login is not a private messaging API. Any future provider must declare
                  only the access it actually implements and is authorized to use.
                </span>
              </div>
            </>
          )}
          {tab === 'privacy' && (
            <>
              <div className="privacy-promise">
                <ShieldCheck size={28} />
                <div>
                  <h3>Your Snapchat credentials are none of our business.</h3>
                  <p>
                    Authentication happens on Snapchat. We never ask for, collect or store your
                    Snapchat password.
                  </p>
                </div>
              </div>
              <SettingRow
                title="Encrypted companion data"
                description="Signed-in contacts, notes, labels, preferences and activity payloads use authenticated AES-256-GCM encryption before database storage."
              >
                <Badge tone="green">Enabled</Badge>
              </SettingRow>
              <SettingRow
                title="Secure, expiring sessions"
                description="HttpOnly cookies, hashed session tokens, origin checks and server-enforced expiration. HTTPS is required in production."
              >
                <LockKeyhole size={19} />
              </SettingRow>
              <SettingRow
                title="A clear separation"
                description="No Snapchat message archives, friends imports, private tokens, device spoofing or security-check bypasses."
              >
                <ShieldCheck size={19} />
              </SettingRow>
              <SettingRow
                title="Take your data with you"
                description={
                  user
                    ? 'Download your companion account data as JSON. Credentials and session tokens are excluded.'
                    : 'Download this guest session’s contacts and preferences before closing the page.'
                }
              >
                <Button variant="secondary" onClick={() => void run(exportData)}>
                  <ArrowDownToLine size={15} />
                  Export data
                </Button>
              </SettingRow>
              <p className="fine-print">
                Encryption protects application payloads, not a compromised signed-in device.
                Database backups and disk encryption are deployment responsibilities. See the
                repository security assessment for the full threat model.
              </p>
            </>
          )}
          {tab === 'account' && (
            <>
              {user ? (
                <>
                  <div className="account-profile">
                    <Avatar name={user.displayName} size="large" />
                    <div>
                      <h3>{user.displayName}</h3>
                      <p>{user.email}</p>
                      <Badge tone="green">Companion account</Badge>
                    </div>
                  </div>
                  <SettingRow
                    title="Workspace sync"
                    description="Your preferences, labels and manually added contacts follow your companion account."
                  >
                    <Badge tone={syncState === 'synced' ? 'green' : 'yellow'}>
                      {syncState === 'synced' ? 'Connected' : 'Needs attention'}
                    </Badge>
                  </SettingRow>
                  <SettingRow
                    title="Sign out on this device"
                    description="Your account data stays safe. Other sessions remain signed in."
                  >
                    <Button variant="secondary" onClick={() => void run(logout)}>
                      <LogOut size={15} />
                      Sign out
                    </Button>
                  </SettingRow>
                  <div className="danger-zone">
                    <h4>Delete companion account</h4>
                    <p>
                      Permanently remove your account, sessions, contacts, preferences and activity
                      from the server. Your Snapchat account is not affected.
                    </p>
                    <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                      <Trash2 size={15} />
                      Delete account
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <EmptyState
                    icon={UserRound}
                    title="Make this space yours."
                    description="Create a companion account for encrypted contact storage and settings that follow you between web and desktop."
                    action={
                      <div className="flex gap-3">
                        <Button onClick={() => setAuthMode('register')}>
                          Create an account
                          <ArrowRight size={16} />
                        </Button>
                        <Button variant="secondary" onClick={() => setAuthMode('login')}>
                          Sign in
                        </Button>
                      </div>
                    }
                  />
                  <div className="info-note">
                    <LockKeyhole size={17} />
                    <span>
                      This is a SnapRun account, not a Snapchat account. Guest contacts are
                      session-only and are not silently uploaded when you sign in.
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
      {deleteOpen && (
        <Modal
          title="Delete your companion account?"
          description="This cannot be undone. Export your data first if you want a copy. Your Snapchat account will not be changed."
          onClose={() => setDeleteOpen(false)}
        >
          <form className="form-stack" onSubmit={removeAccount}>
            <label className="field">
              Confirm your companion password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <label className="field">
              Type DELETE to confirm
              <input name="confirmation" placeholder="DELETE" pattern="DELETE" required />
            </label>
            {deleteError && (
              <p className="form-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
                Keep my account
              </Button>
              <Button variant="danger" type="submit" loading={busy}>
                Permanently delete
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
