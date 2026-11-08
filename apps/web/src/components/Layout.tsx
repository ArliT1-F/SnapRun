import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
  Command,
  Ghost,
  LayoutDashboard,
  LogIn,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  UsersRound,
  WifiOff,
  X,
} from 'lucide-react';
import { useWorkspace } from '../lib/workspace';
import { isDesktop } from '../lib/platform';
import { Avatar, Badge, Brand, IconButton } from './ui';
import { CommandPalette } from './CommandPalette';
const nav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/messages', label: 'Messages', icon: MessageCircle },
  { path: '/contacts', label: 'Contacts', icon: UsersRound },
  { path: '/notifications', label: 'Notifications', icon: Bell },
];
export function matchesShortcut(event: KeyboardEvent, binding: string) {
  const parts = binding.toLowerCase().split('+');
  const key = parts.at(-1);
  return (
    event.key.toLowerCase() === key &&
    parts.includes('mod') === (event.ctrlKey || event.metaKey) &&
    parts.includes('shift') === event.shiftKey &&
    parts.includes('alt') === event.altKey
  );
}
export function Layout() {
  const {
    user,
    settings,
    notifications,
    syncState,
    online,
    setAuthMode,
    updateSettings,
    setHandoffPurpose,
  } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.readAt).length;
  const page = nav.find((n) => n.path === location.pathname)?.label ?? 'Settings';
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      const shortcuts = settings.shortcuts;
      if (
        shortcuts.commandPalette.enabled &&
        matchesShortcut(event, shortcuts.commandPalette.binding)
      ) {
        event.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if (typing || document.querySelector('dialog[open]')) return;
      if (
        shortcuts.openMessages.enabled &&
        matchesShortcut(event, shortcuts.openMessages.binding)
      ) {
        event.preventDefault();
        navigate('/messages');
      }
      if (shortcuts.newContact.enabled && matchesShortcut(event, shortcuts.newContact.binding)) {
        event.preventDefault();
        navigate('/contacts?new=1');
      }
      if (shortcuts.toggleTheme.enabled && matchesShortcut(event, shortcuts.toggleTheme.binding)) {
        event.preventDefault();
        void updateSettings((s) => ({
          ...s,
          theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',
        }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settings.shortcuts, navigate, updateSettings]);
  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <NavLink to="/" className="brand-link" aria-label="SnapRun dashboard">
          <Brand />
        </NavLink>
        <button className="workspace-selector" onClick={() => navigate('/settings?tab=account')}>
          <span className="workspace-symbol">
            <Ghost size={17} />
          </span>
          <span>
            Personal workspace<small>{user ? 'Companion account' : 'Local workspace'}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {nav.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {label === 'Messages' && <ArrowUpRight size={13} className="nav-end" />}
              {label === 'Notifications' && unread > 0 && settings.notifications.inApp && (
                <span className="nav-count">{unread > 99 ? '99+' : unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings2 size={19} strokeWidth={1.7} />
          <span>Settings</span>
        </NavLink>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon">
              <ShieldCheck size={20} />
            </span>
            <h4>Your space. Your privacy.</h4>
            <p>Your Snapchat credentials never enter SnapRun.</p>
            <button onClick={() => navigate('/settings?tab=privacy')}>
              How we keep it that way
              <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="help-link" onClick={() => setHandoffPurpose('login')}>
            <CircleHelp size={17} />
            Connection help
            <ArrowUpRight size={13} />
          </button>
          <button
            className="profile-button"
            onClick={() => (user ? navigate('/settings?tab=account') : setAuthMode('login'))}
          >
            <Avatar name={user?.displayName ?? 'Guest'} size="small" />
            <span>
              {user?.displayName ?? 'Your workspace'}
              <small>{user ? 'Signed in to SnapRun' : 'Sign in to sync'}</small>
            </span>
            {user ? <ChevronRight size={16} /> : <LogIn size={16} />}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              label="Open navigation"
              className="mobile-menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </IconButton>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              <span>Search anything…</span>
              <kbd>
                <Command size={10} /> K
              </kbd>
            </button>
            <span className="topbar-divider" />
            <IconButton
              label="Toggle color theme"
              onClick={() =>
                void updateSettings((s) => ({
                  ...s,
                  theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',
                }))
              }
            >
              {document.documentElement.dataset.theme === 'dark' ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </IconButton>
            <IconButton
              label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              className="notification-button"
              onClick={() => navigate('/notifications')}
            >
              <Bell size={18} />
              {unread > 0 && settings.notifications.inApp && <span className="notification-dot" />}
            </IconButton>
            <button
              className="topbar-avatar"
              aria-label={user ? 'Account settings' : 'Sign in'}
              onClick={() => (user ? navigate('/settings?tab=account') : setAuthMode('login'))}
            >
              <Avatar name={user?.displayName ?? 'Guest'} size="small" />
            </button>
          </div>
        </header>
        {(!online || syncState === 'error') && (
          <div className="connection-banner">
            <WifiOff size={15} />
            {!online
              ? 'You’re offline. Account changes cannot sync until your connection returns.'
              : 'Your last change could not sync. Reconnect and try again.'}
          </div>
        )}
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            <span className={`status-dot ${syncState === 'error' || !online ? 'offline' : ''}`} />
            {!online
              ? 'Offline'
              : syncState === 'saving'
                ? 'Saving changes…'
                : syncState === 'synced'
                  ? 'Workspace in sync'
                  : syncState === 'error'
                    ? 'Sync needs attention'
                    : 'Local workspace'}
            <span className="footer-separator">·</span>
            {isDesktop() ? 'Desktop' : 'Web app'}
            {settings.privacy.enabled && (
              <>
                <span className="footer-separator">·</span>
                <span className="privacy-mode-indicator">
                  <ShieldCheck size={12} />
                  Privacy Mode
                </span>
              </>
            )}
          </span>
          <span>
            Made for your space, not your data.<span className="footer-version">v0.1.0</span>
          </span>
        </footer>
      </div>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
