import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  ContactRound,
  ExternalLink,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../lib/workspace';
import { Badge, Button, EmptyState, Modal, PageHeader } from '../components/ui';
import { relativeTime, errorMessage } from '../lib/api';
const icons = {
  welcome: Sparkles,
  handoff: ExternalLink,
  contact: ContactRound,
  settings: Settings2,
  security: ShieldCheck,
  connection: ShieldCheck,
};
export function Notifications() {
  const { notifications, markRead, clearNotifications, notify, settings } = useWorkspace();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const unread = notifications.filter((n) => !n.readAt).length;
  const visible = notifications.filter((n) => filter === 'all' || !n.readAt);
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      notify(errorMessage(e), 'error');
    }
  };
  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="A LITTLE LESS CATCHING UP"
        title="Notifications"
        description="Updates from your companion. Never a pretend Snapchat inbox."
        action={
          <Button variant="secondary" disabled={!unread} onClick={() => void run(() => markRead())}>
            <CheckCheck size={17} />
            Mark all as read
          </Button>
        }
      />
      <div className="notification-info">
        <Bell size={17} />
        <p>
          <strong>Just the things that happen here.</strong> Account activity, official handoffs and
          your own workspace updates. Snapchat message notifications require an authorized
          integration that is not available.
        </p>
        <Link to="/settings?tab=notifications">
          Preferences
          <ChevronRight size={15} />
        </Link>
      </div>
      <section className="panel notifications-panel">
        <div className="notifications-toolbar">
          <div className="segmented-control">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All updates<span>{notifications.length}</span>
            </button>
            <button
              className={filter === 'unread' ? 'active' : ''}
              onClick={() => setFilter('unread')}
            >
              Unread<span>{unread}</span>
            </button>
          </div>
          <button
            className="text-link muted-link"
            disabled={!notifications.length}
            onClick={() => setConfirmClear(true)}
          >
            <Trash2 size={14} />
            Clear history
          </button>
        </div>
        {visible.length ? (
          <div className="notification-list">
            {visible.map((n) => {
              const Icon = icons[n.kind];
              return (
                <article key={n.id} className={`notification-row ${!n.readAt ? 'unread' : ''}`}>
                  <span className={`activity-icon activity-${n.kind}`}>
                    <Icon size={19} />
                  </span>
                  <div className="notification-content">
                    <div>
                      <h3>{n.title}</h3>
                      {!n.readAt && <span className="unread-dot" />}
                    </div>
                    <p>{n.body}</p>
                    <span className="notification-meta">
                      {relativeTime(n.createdAt)}
                      <span>·</span>Companion activity
                    </span>
                  </div>
                  {!n.readAt ? (
                    <button
                      className="mark-read-button"
                      onClick={() => void run(() => markRead(n.id))}
                      title="Mark as read"
                      aria-label={`Mark ${n.title} as read`}
                    >
                      <CheckCheck size={17} />
                    </button>
                  ) : (
                    <span className="read-check">
                      <CheckCheck size={16} />
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={filter === 'unread' ? CheckCheck : BellRing}
            title={filter === 'unread' ? 'All caught up.' : 'Quiet is a good thing.'}
            description={
              filter === 'unread'
                ? 'No unread workspace updates. Take a breath, you’re up to date.'
                : 'Your companion activity will appear here when something happens. We don’t fill the silence with made-up updates.'
            }
            action={
              filter === 'unread' && notifications.length ? (
                <Button variant="secondary" onClick={() => setFilter('all')}>
                  View all updates
                </Button>
              ) : undefined
            }
          />
        )}
        <div className="contacts-footer">
          <span>
            {settings.notifications.inApp
              ? 'In-app indicators are on'
              : 'In-app indicators are off'}
          </span>
          <span>
            <ShieldCheck size={13} />
            No Snapchat message access
          </span>
        </div>
      </section>
      {confirmClear && (
        <Modal
          title="A clean slate?"
          description="This removes your companion notification history on all signed-in devices. Your contacts, settings and Snapchat data are not affected."
          onClose={() => setConfirmClear(false)}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Keep history
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                void run(async () => {
                  await clearNotifications();
                  setConfirmClear(false);
                })
              }
            >
              Clear history
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
