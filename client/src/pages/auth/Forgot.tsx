import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useConfig } from '../../lib/auth';
import { useFocusHeading, useTitle } from '../../lib/hooks';
import { AuthLayout } from '../../components/AuthLayout';
import { Button, ButtonLink } from '../../components/Button';
import { Input } from '../../components/Input';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;

/** Forgot password. The "Check your email" state is shown whether or not the account exists. */
export default function Forgot() {
  const { data: config } = useConfig();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  useTitle(sentTo ? 'Check your email' : 'Reset your password');
  useFocusHeading(sentTo);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = useMutation({
    mutationFn: (address: string) => api.post('/auth/forgot', { email: address }),
    onSuccess: (_d, address) => {
      setSentTo(address);
      setWait(RESEND_SECONDS);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Check your connection and try again.'),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    send.mutate(address);
  };

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="v g8">
          <h1>Check your email</h1>
          <p className="mut">
            If there is an account for {sentTo}, we have sent a link to reset your password. The link expires in{' '}
            {config?.passwordResetTtlMinutes ?? 30} minutes.
          </p>
        </div>
        <div className="v g8">
          <Button variant="outline" block disabled={wait > 0 || send.isPending} onClick={() => send.mutate(sentTo)}>
            {wait > 0 ? `Send the link again in ${wait}s` : 'Send the link again'}
          </Button>
          <ButtonLink variant="text" block to="/signin">
            Back to sign in
          </ButtonLink>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="v g8">
        <h1>Reset your password</h1>
        <p className="mut">Enter your email and we will send you a link to choose a new one.</p>
      </div>
      <form className="v g24" onSubmit={onSubmit} noValidate>
        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <div className="v g8">
          <Button type="submit" block disabled={send.isPending}>
            Send reset link
          </Button>
          <ButtonLink variant="text" block to="/signin">
            Back to sign in
          </ButtonLink>
        </div>
      </form>
    </AuthLayout>
  );
}
