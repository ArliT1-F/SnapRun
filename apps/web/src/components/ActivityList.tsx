import {
  ArrowUpRight,
  Bell,
  ContactRound,
  ExternalLink,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NotificationKind } from '@snaprun/shared';
import { useWorkspace } from '../lib/workspace';
import { relativeTime } from '../lib/api';
import { EmptyState } from './ui';
const icons = {
  welcome: Sparkles,
  handoff: ExternalLink,
  contact: ContactRound,
  settings: Settings2,
  security: ShieldCheck,
  connection: ShieldCheck,
};
export function ActivityList({ limit = 4 }: { limit?: number }) {
  const { notifications } = useWorkspace();
  if (!notifications.length)
    return (
      <EmptyState
        compact
        icon={Bell}
        title="A fresh start"
        description="Your workspace activity will appear here. No invented updates, just the real ones."
      />
    );
  return (
    <div className="activity-list">
      {notifications.slice(0, limit).map((n) => {
        const Icon = icons[n.kind as NotificationKind] ?? Bell;
        return (
          <div className="activity-item" key={n.id}>
            <span className={`activity-icon activity-${n.kind}`}>
              <Icon size={17} />
            </span>
            <div>
              <h4>{n.title}</h4>
              <p>{n.body}</p>
            </div>
            <time dateTime={n.createdAt}>{relativeTime(n.createdAt)}</time>
          </div>
        );
      })}
      {limit === 4 && (
        <Link className="card-bottom-link" to="/notifications">
          View all activity
          <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  );
}
