import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  CircleCheck,
  ContactRound,
  ExternalLink,
  Ghost,
  LockKeyhole,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../lib/workspace';
import { Badge, Button, ConnectionBadge } from '../components/ui';
import { ActivityList } from '../components/ActivityList';
export function Dashboard() {
  const { user, contacts, notifications, connection, setHandoffPurpose, setAuthMode, settings } =
    useWorkspace();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.readAt).length;
  const steps = [
    {
      title: 'Create your companion account',
      subtitle: 'A private home for your preferences',
      done: !!user,
      action: () => setAuthMode('register'),
      link: '/settings?tab=account',
    },
    {
      title: 'Add your first contact',
      subtitle: 'Organize people on your terms',
      done: contacts.length > 0,
      action: () => navigate('/contacts?new=1'),
      link: '/contacts',
    },
    {
      title: 'Connect with Snapchat',
      subtitle: 'Continue in the official experience',
      done: connection.status !== 'not_connected',
      action: () => setHandoffPurpose('login'),
      link: '/messages',
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const date = new Date().toLocaleDateString('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return (
    <div className="dashboard page-enter">
      <header className="dashboard-heading">
        <div>
          <div className="dashboard-date">
            {date}
            <span className="tiny-sun">
              <Sparkles size={13} />
            </span>
          </div>
          <h1>
            {user ? `Welcome back, ${user.displayName.split(' ')[0]}.` : 'Your space, in sync.'}
          </h1>
          <p>A calmer companion for your Snapchat world.</p>
        </div>
        <Badge tone="neutral">
          <span className="small-yellow-dot" />
          {user ? 'Personal workspace' : 'Let’s make it yours'}
        </Badge>
      </header>
      <div className="dashboard-top-grid">
        <section className="connection-hero">
          <div className="hero-grain" />
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="status-dot" />
              YOUR SNAPCHAT, ON YOUR TERMS
            </div>
            <h2>
              Less noise.
              <br />
              More connection<span>.</span>
            </h2>
            <p>
              Your conversations stay on Snapchat.
              <br />
              Your workspace comes together here.
            </p>
            <div className="hero-buttons">
              {connection.status === 'not_connected' ? (
                <>
                  <Button onClick={() => setHandoffPurpose('login')}>
                    I already have an account
                    <ArrowUpRight size={16} />
                  </Button>
                  <button className="hero-secondary" onClick={() => setHandoffPurpose('register')}>
                    Create a Snapchat account
                    <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <>
                  <Button onClick={() => setHandoffPurpose('login')}>
                    <ExternalLink size={16} />
                    Open Snapchat Web
                  </Button>
                  <button className="hero-secondary" onClick={() => navigate('/messages')}>
                    View connection details
                    <ArrowRight size={14} />
                  </button>
                </>
              )}
            </div>
            <div className="hero-trust">
              <LockKeyhole size={12} />
              Official handoff. No Snapchat passwords. Ever.
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="orbit-dot dot-one" />
            <div className="orbit-dot dot-two" />
            <div className="art-message">
              <MessageCircle size={31} strokeWidth={1.5} />
            </div>
            <div className="art-ghost">
              <Ghost size={67} strokeWidth={1.45} />
              <span className="art-check">
                <Check size={13} strokeWidth={3} />
              </span>
            </div>
            <div className="art-lock">
              <LockKeyhole size={19} />
            </div>
            <span className="art-spark spark-one">✦</span>
            <span className="art-spark spark-two">✦</span>
          </div>
        </section>
        <section className="panel setup-card">
          <div className="card-title">
            <h3>A little setup, a lot of you</h3>
            <span className="subtle-icon">
              <Sparkles size={17} />
            </span>
          </div>
          <p className="card-description">Three small steps. One happier workspace.</p>
          <div className="setup-progress">
            <div
              className="progress-ring"
              style={{ '--progress': `${(completed / 3) * 100}%` } as React.CSSProperties}
            >
              <span>
                {completed}
                <small>/3</small>
              </span>
            </div>
            <div>
              <strong>{completed === 3 ? 'Looking good!' : 'Make yourself at home'}</strong>
              <span>
                {completed === 3
                  ? 'Your essentials are in place'
                  : 'Your workspace is taking shape'}
              </span>
            </div>
          </div>
          <div className="setup-steps">
            {steps.map((step, i) => (
              <button
                key={step.title}
                className={`setup-step ${step.done ? 'done' : ''}`}
                onClick={step.done ? () => navigate(step.link) : step.action}
              >
                <span className="step-check">
                  {step.done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.subtitle}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="stats-grid">
        <button className="stat-card" onClick={() => navigate('/contacts')}>
          <span className="stat-icon stat-yellow">
            <UsersRound size={20} />
          </span>
          <div>
            <span>Local contacts</span>
            <strong>
              {contacts.length}
              <small>organized your way</small>
            </strong>
          </div>
          <ArrowUpRight size={17} className="stat-arrow" />
        </button>
        <button className="stat-card" onClick={() => navigate('/notifications')}>
          <span className="stat-icon stat-blue">
            <Bell size={20} />
          </span>
          <div>
            <span>Workspace updates</span>
            <strong>
              {unread}
              <small>{unread === 1 ? 'unread notification' : 'unread notifications'}</small>
            </strong>
          </div>
          <ArrowUpRight size={17} className="stat-arrow" />
        </button>
        <button className="stat-card" onClick={() => navigate('/messages')}>
          <span className="stat-icon stat-purple">
            <MessageCircle size={20} />
          </span>
          <div>
            <span>Snapchat connection</span>
            <strong className="connection-stat">
              {connection.status === 'not_connected'
                ? 'Not connected'
                : connection.status === 'handoff_opened'
                  ? 'Handoff opened'
                  : 'Self-reported'}
              <small>
                {connection.status === 'not_connected'
                  ? 'ready when you are'
                  : 'not verified by SnapRun'}
              </small>
            </strong>
          </div>
          <ArrowUpRight size={17} className="stat-arrow" />
        </button>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="panel activity-card">
          <div className="card-title">
            <h3>Recent activity</h3>
            <Link to="/notifications" className="text-link">
              View all
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <p className="card-description">A little history of your workspace.</p>
          <ActivityList />
        </section>
        <section className="panel quick-card">
          <div className="card-title">
            <h3>A shortcut to your day</h3>
            <span className="subtle-icon">
              <Sparkles size={16} />
            </span>
          </div>
          <p className="card-description">Less clicking. More doing.</p>
          <div className="quick-actions">
            <button onClick={() => navigate('/contacts?new=1')}>
              <span className="quick-icon">
                <ContactRound size={19} />
              </span>
              <span>
                Add a contact<small>Keep your people close</small>
              </span>
              <Plus size={17} />
            </button>
            <button onClick={() => navigate('/settings')}>
              <span className="quick-icon">
                <Sparkles size={19} />
              </span>
              <span>
                Make it feel like you<small>Themes, shortcuts & more</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="privacy-inline">
            <ShieldCheck size={16} />
            <span>Private by design. Clear by default.</span>
          </div>
        </section>
      </div>
      <div className="dashboard-note">
        <ShieldCheck size={15} />
        <span>
          SnapRun is an independent companion, not affiliated with Snapchat. Messages are never
          copied, simulated or stored here.
        </span>
        <Link to="/settings?tab=privacy">
          Our boundaries
          <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
