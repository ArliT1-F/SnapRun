import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../lib/workspace';
import {
  desktopAutostartEnabled,
  desktopShortcutRegistered,
  isDesktop,
  notificationPermissionState,
  type PermissionState,
} from '../lib/platform';
import { localPreferenceCachePresent, privacyDataInventory } from '../lib/privacy';
import { Badge, Button } from './ui';

type AuditState = {
  notifications: PermissionState;
  autostart: boolean | null;
  shortcut: boolean | null;
  localCache: boolean;
  checkedAt: string;
};

function permissionLabel(state: PermissionState) {
  return {
    granted: 'Granted',
    denied: 'Denied',
    default: 'Not granted yet',
    unsupported: 'Unsupported here',
    unknown: 'Could not check',
  }[state];
}

export function PrivacyAudit() {
  const { settings, user, contacts } = useWorkspace();
  const [audit, setAudit] = useState<AuditState | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [notifications, autostart, shortcut] = await Promise.all([
        notificationPermissionState(),
        desktopAutostartEnabled(),
        desktopShortcutRegistered(settings.desktop.globalShortcut),
      ]);
      setAudit({
        notifications,
        autostart,
        shortcut,
        localCache: localPreferenceCachePresent(),
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  }, [settings.desktop.globalShortcut]);
  useEffect(() => {
    void refresh();
  }, [refresh, settings.privacy.enabled]);
  const desktop = isDesktop();
  return (
    <div className="privacy-audit">
      <div className="card-title">
        <h3>
          <ShieldCheck size={16} /> Data & permissions audit
        </h3>
        <Button variant="ghost" onClick={() => void refresh()} loading={busy}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>
      <p className="card-description">
        What SnapRun collects, what it asks the system for, and what stays out of reach.
      </p>
      <div className="audit-grid">
        <div className="audit-row">
          <span>System notifications</span>
          <Badge tone={audit?.notifications === 'granted' ? 'yellow' : 'neutral'}>
            {audit ? permissionLabel(audit.notifications) : 'Checking…'}
          </Badge>
        </div>
        <div className="audit-row">
          <span>Launch at startup</span>
          <Badge>{!desktop ? 'Web app' : audit?.autostart ? 'Enabled' : 'Disabled'}</Badge>
        </div>
        <div className="audit-row">
          <span>Global desktop shortcut</span>
          <Badge>{!desktop ? 'Web app' : audit?.shortcut ? 'Registered' : 'Not registered'}</Badge>
        </div>
        <div className="audit-row">
          <span>Local preference cache</span>
          <Badge tone={settings.privacy.enabled ? 'green' : 'neutral'}>
            {settings.privacy.enabled
              ? 'Disabled by Privacy Mode'
              : audit?.localCache
                ? 'Present in this browser'
                : 'Not present'}
          </Badge>
        </div>
        <div className="audit-row">
          <span>Contact storage</span>
          <Badge tone={user ? 'green' : 'neutral'}>
            {user ? `${contacts.length} account-backed` : `${contacts.length} session-only`}
          </Badge>
        </div>
        <div className="audit-row">
          <span>Camera / microphone / location</span>
          <Badge tone="green">Not requested</Badge>
        </div>
      </div>
      <div className="audit-inventory">
        {privacyDataInventory.map((item) => (
          <details key={item.id}>
            <summary>
              <span>{item.label}</span>
              <Badge
                tone={
                  item.status.startsWith('Not') ||
                  item.status === 'Never collected' ||
                  item.status === 'None added'
                    ? 'green'
                    : 'neutral'
                }
              >
                {item.status}
              </Badge>
            </summary>
            <p>{item.detail}</p>
          </details>
        ))}
      </div>
      <p className="fine-print">
        Privacy Mode reduces what SnapRun keeps on this device. It does not make you anonymous to
        Snapchat, hide standard browser/network metadata, or bypass Snapchat security checks.
        {audit ? ` Last checked ${new Date(audit.checkedAt).toLocaleTimeString()}.` : ''}
      </p>
    </div>
  );
}
