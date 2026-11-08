import { useState } from 'react';
import {
  ArrowRight,
  Bell,
  LayoutDashboard,
  MessageCircle,
  Search,
  Settings2,
  UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../lib/workspace';
import { filterContacts } from '@snaprun/shared';
import { Avatar, Modal } from './ui';
const destinations = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Messages', path: '/messages', icon: MessageCircle },
  { name: 'Contacts', path: '/contacts', icon: UsersRound },
  { name: 'Notifications', path: '/notifications', icon: Bell },
  { name: 'Settings', path: '/settings', icon: Settings2 },
];
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { contacts } = useWorkspace();
  const go = (path: string) => {
    navigate(path);
    onClose();
  };
  const pages = destinations.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));
  const people = query ? filterContacts(contacts, query).slice(0, 5) : [];
  return (
    <Modal title="Find your way" onClose={onClose}>
      <div className="input-with-icon command-input">
        <Search size={19} />
        <input
          autoFocus
          placeholder="Search pages and local contacts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search pages and contacts"
        />
      </div>
      <div className="command-results">
        {pages.length > 0 && <div className="section-kicker">WORKSPACE</div>}
        {pages.map(({ name, path, icon: Icon }) => (
          <button key={path} onClick={() => go(path)}>
            <Icon size={19} />
            <span>{name}</span>
            <ArrowRight size={16} />
          </button>
        ))}
        {people.length > 0 && <div className="section-kicker">LOCAL CONTACTS</div>}
        {people.map((c) => (
          <button key={c.id} onClick={() => go(`/contacts?q=${encodeURIComponent(c.displayName)}`)}>
            <Avatar name={c.displayName} size="small" />
            <span>
              {c.displayName}
              <small>
                {c.snapchatUsername ? `@${c.snapchatUsername}` : 'Locally maintained contact'}
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
        ))}
        {!pages.length && !people.length && (
          <p className="command-empty">No matches. Try a different name or page.</p>
        )}
      </div>
      <div className="command-footer">
        <span>
          <kbd>esc</kbd> to close
        </span>
        <span>Only your workspace. Never Snapchat data.</span>
      </div>
    </Modal>
  );
}
