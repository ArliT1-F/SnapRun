import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  GlobeLock,
  Info,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { OFFICIAL_SNAPCHAT_HELP, OFFICIAL_SNAPCHAT_WEB } from '@snaprun/shared';
import { useWorkspace } from '../lib/workspace';
import { restrictionGuidance } from '../integrations/snapchat/IntegrationStatus';
import { Badge, Button, Modal } from './ui';
import { errorMessage } from '../lib/api';
import { openExternal } from '../lib/platform';
export function HandoffDialog() {
  const { handoffPurpose, setHandoffPurpose, openSnapchat, markConnection, connection, notify } =
    useWorkspace();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<keyof typeof restrictionGuidance>('unknown');
  if (!handoffPurpose) return null;
  const register = handoffPurpose === 'register';
  const steps = register
    ? [
        'Open Snapchat Web and review the account options Snapchat offers.',
        'For Google account creation, choose “Sign in with Google” and follow Snapchat’s prompts. If directed to the app, use its Sign Up flow.',
        'Complete any verification with Snapchat, then return here. SnapRun never creates an account for you.',
      ]
    : [
        'Open Snapchat Web in a new tab or your system browser.',
        'Sign in directly with Snapchat and complete any security checks there.',
        'Keep your conversations in Snapchat. SnapRun does not receive your credentials.',
      ];
  const launch = async () => {
    setBusy(true);
    try {
      await openSnapchat(handoffPurpose);
      setOpened(true);
    } catch {
      /* Workspace displays the actionable error. */
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      await markConnection('user_confirmed');
      setHandoffPurpose(null);
    } catch {
      /* Error toast is already visible. */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={register ? 'Start your Snapchat story.' : 'Continue on Snapchat.'}
      description={
        register
          ? 'Create your account in Snapchat’s own supported experience.'
          : 'Your conversations live there. Your credentials stay there.'
      }
      onClose={() => setHandoffPurpose(null)}
    >
      <div className="handoff-visual">
        <span className="handoff-app">
          <LockKeyhole size={26} />
        </span>
        <span className="handoff-dots">•••</span>
        <span className="handoff-snap">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <path
              d="M20 5c-7 0-11 5-11 12v6l-4 4 7 1 3 5 5-3 5 3 3-5 7-1-4-4v-6c0-7-4-12-11-12Z"
              fill="currentColor"
            />
          </svg>
        </span>
      </div>
      <div className="official-destination">
        <GlobeLock size={16} />
        <span>{OFFICIAL_SNAPCHAT_WEB.replace('https://', '').replace(/\/$/, '')}</span>
        <Badge tone="green">Official website</Badge>
      </div>
      <ol className="handoff-steps">
        {steps.map((step, i) => (
          <li key={step}>
            <span>{i + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      {register && (
        <button
          className="text-link official-help-link"
          onClick={() =>
            void openExternal(
              'https://help.snapchat.com/hc/en-us/articles/38493581005332-How-do-I-sign-in-to-Snapchat-with-Apple-or-Google',
            ).catch((e) => notify(errorMessage(e), 'error'))
          }
        >
          Snapchat’s official account-creation guide
          <ArrowRight size={13} />
        </button>
      )}
      <div className="info-note">
        <Info size={17} />
        <span>
          {register
            ? 'Registration, eligibility and device support are controlled by Snapchat. Success is not guaranteed.'
            : 'Opening a website is not a verified connection. Snapchat messages and notifications are not synchronized.'}
        </span>
      </div>
      <Button
        className="full-width"
        loading={busy}
        onClick={opened ? () => void confirm() : () => void launch()}
      >
        {opened ? (
          <>
            <Check size={17} />I signed in on Snapchat
          </>
        ) : (
          <>
            {register ? <UserPlus size={17} /> : <ExternalLink size={17} />}
            {opened
              ? 'Save as self-reported'
              : register
                ? 'Continue to Snapchat registration'
                : 'Open Snapchat Web'}
            <ArrowRight size={17} />
          </>
        )}
      </Button>
      {opened && (
        <div className="handoff-after">
          <span>
            Self-reported only · {connection.status === 'user_confirmed' ? 'saved' : 'not verified'}
          </span>
          <button onClick={() => void launch()}>Open again</button>
        </div>
      )}
      <details className="help-details">
        <summary>
          <ShieldCheck size={16} />
          Having trouble?
          <ChevronDown size={15} />
        </summary>
        <label className="field">
          What did Snapchat report?
          <select
            value={issue}
            onChange={(e) => setIssue(e.target.value as keyof typeof restrictionGuidance)}
          >
            {Object.entries(restrictionGuidance).map(([key, value]) => (
              <option key={key} value={key}>
                {value.title}
              </option>
            ))}
          </select>
        </label>
        <p>{restrictionGuidance[issue].body}</p>
        <Button
          variant="secondary"
          onClick={() =>
            void openExternal(OFFICIAL_SNAPCHAT_HELP).catch((e) => notify(errorMessage(e), 'error'))
          }
        >
          Snapchat Support
          <ArrowRight size={15} />
        </Button>
        <span className="fine-print">
          Restrictions and security checks must be resolved by Snapchat.
        </span>
      </details>
    </Modal>
  );
}
