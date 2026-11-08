import { useState, type FormEvent } from 'react';
import { ArrowRight, Info, Plus } from 'lucide-react';
import { contactInputSchema, type Contact, type ContactInput } from '@snaprun/shared';
import { useWorkspace } from '../lib/workspace';
import { errorMessage } from '../lib/api';
import { Button, Modal } from './ui';
import { useNavigate } from 'react-router-dom';
export function ContactEditor({ contact, onClose }: { contact?: Contact; onClose: () => void }) {
  const { saveContact, settings, user } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [labels, setLabels] = useState(contact?.labelIds ?? []);
  const navigate = useNavigate();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = contactInputSchema.safeParse({
      displayName: form.get('displayName'),
      snapchatUsername: form.get('snapchatUsername'),
      notes: form.get('notes'),
      labelIds: labels,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your contact details.');
      return;
    }
    setBusy(true);
    try {
      await saveContact(parsed.data as ContactInput, contact?.id);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={contact ? 'A few finishing touches.' : 'Keep someone close.'}
      description={
        contact
          ? 'Update your locally maintained contact.'
          : 'Add a person to your own address book, not your Snapchat friends.'
      }
      onClose={onClose}
    >
      <form className="form-stack" onSubmit={submit}>
        <label className="field">
          Display name<span className="required">*</span>
          <input
            name="displayName"
            autoFocus
            placeholder="e.g. Alex Morgan"
            defaultValue={contact?.displayName}
            required
            maxLength={80}
          />
        </label>
        <label className="field">
          Snapchat username <span className="optional">optional</span>
          <div className="username-input">
            <span>@</span>
            <input
              name="snapchatUsername"
              placeholder="username"
              defaultValue={contact?.snapchatUsername}
              maxLength={32}
              pattern="[a-zA-Z0-9._-]*"
              autoCapitalize="none"
            />
          </div>
        </label>
        <div className="field">
          Labels
          <div className="label-picker">
            {settings.labels.map((label) => (
              <button
                type="button"
                key={label.id}
                className={`label-chip label-${label.color} ${labels.includes(label.id) ? 'selected' : ''}`}
                onClick={() =>
                  setLabels((prev) =>
                    prev.includes(label.id)
                      ? prev.filter((id) => id !== label.id)
                      : [...prev, label.id],
                  )
                }
              >
                {label.name}
                {labels.includes(label.id) && ' ✓'}
              </button>
            ))}
            <button
              type="button"
              className="label-chip add-label"
              onClick={() => {
                onClose();
                navigate('/settings?tab=contacts');
              }}
            >
              <Plus size={13} />
              Create labels
            </button>
          </div>
        </div>
        <label className="field">
          Private notes <span className="optional">optional</span>
          <textarea
            name="notes"
            placeholder="A shared interest, how you met, a little reminder…"
            defaultValue={contact?.notes}
            maxLength={2000}
            rows={3}
          />
        </label>
        <div className="info-note">
          <Info size={16} />
          <span>
            {user
              ? 'Contact details and notes are encrypted before they reach your companion database.'
              : 'Guest contacts are session-only. Create a companion account for encrypted persistence and sync.'}
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {contact ? 'Save changes' : 'Add contact'}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
