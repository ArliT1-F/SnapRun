import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  ExternalLink,
  Ghost,
  GlobeLock,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { capabilityLabels, officialWebCapabilities, OFFICIAL_SNAPCHAT_WEB } from '@snaprun/shared';
import { useWorkspace } from '../lib/workspace';
import { Badge, Button, ConnectionBadge, PageHeader } from '../components/ui';
import { relativeTime } from '../lib/api';
export function Messages() {
  const { connection, setHandoffPurpose, markConnection, notify } = useWorkspace();
  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="YOUR CONVERSATIONS, RESPECTED"
        title="Messages"
        description="A direct path to Snapchat. Without pretending to be it."
        action={<ConnectionBadge />}
      />
      <div className="messages-grid">
        <section className="panel messaging-panel">
          <div className="messaging-panel-top">
            <span className="official-web-label">
              <Ghost size={19} />
              Snapchat Web
            </span>
            <Badge tone="green">
              <LockKeyhole size={11} />
              Official experience
            </Badge>
          </div>
          <div className="messaging-empty">
            <div className="messaging-orbit" aria-hidden="true">
              <div className="messaging-orbit-ring" />
              <span className="large-ghost">
                <Ghost size={60} strokeWidth={1.4} />
              </span>
              <span className="message-mini">
                <MessageCircle size={21} />
              </span>
              <span className="message-lock">
                <ShieldCheck size={19} />
              </span>
            </div>
            <Badge tone="yellow">YOUR CONVERSATIONS LIVE ON SNAPCHAT</Badge>
            <h2>Right where you left them.</h2>
            <p>
              Open Snapchat’s official messaging experience to read and reply to your messages. Your
              login, security checks and conversations stay in Snapchat’s hands.
            </p>
            <Button onClick={() => setHandoffPurpose('login')}>
              <ExternalLink size={17} />
              {connection.status === 'not_connected' ? 'Connect to Snapchat' : 'Open Snapchat Web'}
              <ArrowUpRight size={16} />
            </Button>
            <span className="destination-caption">
              <GlobeLock size={13} />
              {OFFICIAL_SNAPCHAT_WEB}
            </span>
          </div>
          <div className="messaging-boundary">
            <ShieldCheck size={18} />
            <p>
              <strong>A companion, not a mirror.</strong> SnapRun opens the official website. It
              does not embed, intercept or synchronize your private conversations.
            </p>
          </div>
        </section>
        <aside className="messages-aside">
          <section className="panel connection-details">
            <div className="card-title">
              <h3>Connection details</h3>
              <CircleHelp size={16} />
            </div>
            <ConnectionBadge />
            <dl>
              <div>
                <dt>Provider</dt>
                <dd>Official Web</dd>
              </div>
              <div>
                <dt>Session verification</dt>
                <dd>Not available</dd>
              </div>
              <div>
                <dt>Last handoff</dt>
                <dd>
                  {connection.lastHandoffAt
                    ? relativeTime(connection.lastHandoffAt)
                    : 'Not yet opened'}
                </dd>
              </div>
              <div>
                <dt>Your note</dt>
                <dd>{connection.status === 'user_confirmed' ? 'Signed in' : 'Not marked'}</dd>
              </div>
            </dl>
            <p className="fine-print">
              A handoff or your own confirmation never proves that a Snapchat session is active.
            </p>
            {connection.status === 'user_confirmed' && (
              <Button
                variant="secondary"
                className="full-width"
                onClick={() =>
                  void markConnection('not_connected').catch(() =>
                    notify('Could not update your connection note.', 'error'),
                  )
                }
              >
                Clear signed-in note
              </Button>
            )}
            <button className="text-link" onClick={() => setHandoffPurpose('login')}>
              Connection & recovery help
              <ArrowRight size={14} />
            </button>
          </section>
          <section className="panel capability-card">
            <div className="card-title">
              <h3>What’s supported</h3>
            </div>
            <div className="capability-list">
              {Object.entries(officialWebCapabilities).map(([key, supported]) => (
                <div key={key}>
                  <span className={supported ? 'capability-yes' : 'capability-no'}>
                    {supported ? <Check size={13} /> : <X size={13} />}
                  </span>
                  <span>{capabilityLabels[key as keyof typeof capabilityLabels]}</span>
                </div>
              ))}
            </div>
            <p className="fine-print">
              Private messaging access requires a future authorized integration. No unofficial API
              is used.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
