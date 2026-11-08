import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useWorkspace } from '../lib/workspace';
import { errorMessage } from '../lib/api';
import { Button, IconButton, Modal } from './ui';
export function AuthDialog() {
  const { authMode, setAuthMode, authenticate } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  if (!authMode) return null;
  const register = authMode === 'register';
  const close = () => {
    if (!busy) {
      setError('');
      setAuthMode(null);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await authenticate(authMode, {
        email: String(form.get('email')),
        password: String(form.get('password')),
        ...(register ? { displayName: String(form.get('displayName')) } : {}),
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={register ? 'A space of your own.' : 'Welcome back.'}
      description={
        register
          ? 'Create a companion account to keep your workspace in sync.'
          : 'Sign in to your SnapRun companion account.'
      }
      onClose={close}
    >
      <div className="info-note">
        <LockKeyhole size={17} />
        <span>This account is for SnapRun only. We never ask for your Snapchat password.</span>
      </div>
      <form onSubmit={submit} className="form-stack">
        {register && (
          <label className="field">
            Your name
            <div className="input-with-icon">
              <UserRound size={17} />
              <input
                name="displayName"
                autoComplete="name"
                placeholder="What should we call you?"
                required
                maxLength={80}
              />
            </div>
          </label>
        )}
        <label className="field">
          Email address
          <div className="input-with-icon">
            <Mail size={17} />
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              maxLength={254}
            />
          </div>
        </label>
        <label className="field">
          Companion password
          <div className="input-with-icon">
            <LockKeyhole size={17} />
            <input
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete={register ? 'new-password' : 'current-password'}
              placeholder={register ? 'At least 12 characters' : 'Your SnapRun password'}
              minLength={register ? 12 : 1}
              maxLength={128}
              required
            />
            <IconButton
              type="button"
              label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </IconButton>
          </div>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} className="full-width">
          {register ? 'Create companion account' : 'Sign in to SnapRun'}
          <ArrowRight size={17} />
        </Button>
      </form>
      <p className="auth-switch">
        {register ? 'Already have a workspace?' : 'New to SnapRun?'}{' '}
        <button
          onClick={() => {
            setError('');
            setAuthMode(register ? 'login' : 'register');
          }}
        >
          {register ? 'Sign in' : 'Create an account'}
        </button>
      </p>
      <p className="fine-print text-center">
        Guest contacts are session-only and are not uploaded when you sign in.
      </p>
    </Modal>
  );
}
