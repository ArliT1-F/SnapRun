import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowDownAZ,
  ArrowRight,
  ContactRound,
  Ellipsis,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { filterContacts, type Contact } from '@snaprun/shared';
import { useWorkspace } from '../lib/workspace';
import { Avatar, Badge, Button, EmptyState, IconButton, Modal, PageHeader } from '../components/ui';
import { ContactEditor } from '../components/ContactEditor';
import { errorMessage } from '../lib/api';
export function Contacts() {
  const { contacts, settings, user, deleteContact, notify } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [labelId, setLabelId] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [editor, setEditor] = useState<Contact | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (params.has('new')) {
      setEditor('new');
      setParams({}, { replace: true });
    } else if (params.has('q')) setQuery(params.get('q') ?? '');
  }, [params, setParams]);
  const filtered = filterContacts(contacts, query, labelId || undefined).sort((a, b) =>
    sort === 'name'
      ? a.displayName.localeCompare(b.displayName)
      : b.createdAt.localeCompare(a.createdAt),
  );
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteContact(deleting.id);
      setDeleting(null);
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="YOUR PEOPLE, YOUR ORGANIZATION"
        title="Contacts"
        description="A little order for the people who matter. Maintained by you, stored separately."
        action={
          <Button onClick={() => setEditor('new')}>
            <Plus size={17} />
            Add contact
          </Button>
        }
      />
      <div className="contacts-info">
        <ShieldCheck size={16} />
        <span>
          This is your local address book. Snapchat friends are never imported or changed.
        </span>
        <Badge tone={user ? 'green' : 'neutral'}>
          {user ? 'Encrypted account storage' : 'Guest · session only'}
        </Badge>
      </div>
      <section className="panel contacts-panel">
        <div className="contacts-toolbar">
          <div className="input-with-icon contact-search">
            <Search size={17} />
            <input
              placeholder="Search names, usernames or notes…"
              aria-label="Search contacts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <IconButton label="Clear search" onClick={() => setQuery('')}>
                <X size={15} />
              </IconButton>
            )}
          </div>
          <div className="toolbar-right">
            <button
              className="sort-button"
              onClick={() => setSort(sort === 'recent' ? 'name' : 'recent')}
            >
              <ArrowDownAZ size={16} />
              {sort === 'recent' ? 'Recent first' : 'Name A–Z'}
            </button>
            <div className="view-toggle">
              <IconButton
                label="Grid view"
                className={view === 'grid' ? 'selected' : ''}
                onClick={() => setView('grid')}
              >
                <LayoutGrid size={16} />
              </IconButton>
              <IconButton
                label="List view"
                className={view === 'list' ? 'selected' : ''}
                onClick={() => setView('list')}
              >
                <List size={17} />
              </IconButton>
            </div>
          </div>
        </div>
        <div className="contact-filters">
          <button
            className={`filter-chip ${!labelId ? 'active' : ''}`}
            onClick={() => setLabelId('')}
          >
            All contacts<span>{contacts.length}</span>
          </button>
          {settings.labels.map((label) => (
            <button
              key={label.id}
              className={`filter-chip ${labelId === label.id ? 'active' : ''}`}
              onClick={() => setLabelId(labelId === label.id ? '' : label.id)}
            >
              <span className={`label-dot label-${label.color}`} />
              {label.name}
              <span>{contacts.filter((c) => c.labelIds.includes(label.id)).length}</span>
            </button>
          ))}
          <button
            className="filter-chip manage-labels"
            onClick={() => {
              navigate('/settings?tab=contacts');
            }}
          >
            <Tag size={13} />
            Manage labels
          </button>
        </div>
        {filtered.length ? (
          <div
            className={`contact-collection ${view === 'list' ? 'contact-list-view' : 'contact-grid-view'}`}
          >
            {filtered.map((contact, index) => (
              <article className="contact-card" key={contact.id}>
                <div className="contact-card-top">
                  <Avatar name={contact.displayName} size="large" color={index} />
                  <details className="contact-menu">
                    <summary aria-label={`Actions for ${contact.displayName}`}>
                      <Ellipsis size={19} />
                    </summary>
                    <div>
                      <button
                        onClick={(e) => {
                          setEditor(contact);
                          e.currentTarget.closest('details')?.removeAttribute('open');
                        }}
                      >
                        <Pencil size={14} />
                        Edit contact
                      </button>
                      <button
                        className="danger-text"
                        onClick={(e) => {
                          setDeleting(contact);
                          e.currentTarget.closest('details')?.removeAttribute('open');
                        }}
                      >
                        <Trash2 size={14} />
                        Remove contact
                      </button>
                    </div>
                  </details>
                </div>
                <h3>{contact.displayName}</h3>
                <span className="contact-username">
                  {contact.snapchatUsername ? `@${contact.snapchatUsername}` : 'No username added'}
                </span>
                <div className="contact-labels">
                  {contact.labelIds.map((id) => {
                    const label = settings.labels.find((l) => l.id === id);
                    return label ? (
                      <span key={id} className={`label-chip label-${label.color}`}>
                        {label.name}
                      </span>
                    ) : null;
                  })}
                </div>
                {contact.notes && <p className="contact-notes">{contact.notes}</p>}
                <div className="contact-card-footer">
                  <span>Local contact</span>
                  <button onClick={() => setEditor(contact)}>
                    View details
                    <ArrowRight size={13} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={query || labelId ? Search : UsersRound}
            title={query || labelId ? 'No one by that name. Yet.' : 'Good company starts here.'}
            description={
              query || labelId
                ? 'Try another search or clear your filters. Only contacts you add are searched.'
                : 'Add your first contact to give your workspace a little personality. No friend-list imports, no unwanted connections.'
            }
            action={
              query || labelId ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setLabelId('');
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setEditor('new')}>
                  <Plus size={16} />
                  Add your first contact
                </Button>
              )
            }
          />
        )}
        <div className="contacts-footer">
          <span>
            {filtered.length} {filtered.length === 1 ? 'contact' : 'contacts'}
            {query || labelId ? ' matching your filters' : ' in your workspace'}
          </span>
          <span>
            <ContactRound size={13} />
            Manually maintained. Always yours.
          </span>
        </div>
      </section>
      {editor && (
        <ContactEditor
          contact={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <Modal
          title="Remove this contact?"
          description={`“${deleting.displayName}” will be removed from your companion address book. Nothing changes on Snapchat.`}
          onClose={() => setDeleting(null)}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Keep contact
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>
              <Trash2 size={16} />
              Remove contact
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
