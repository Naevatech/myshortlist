import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { rememberedEmail, useConfig, useMe } from '../lib/auth';
import { useTitle } from '../lib/hooks';
import type { Me } from '../lib/types';
import { AuthLayout } from '../components/AuthLayout';
import { Button, ButtonLink } from '../components/Button';
import { Input } from '../components/Input';

const RESEND_SECONDS = 30;

/** Verify email: the 6-digit code sent at sign up. */
export default function VerifyCode() {
  useTitle('Check your email');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data: me, isPending } = useMe();
  const email = (location.state as { email?: string } | null)?.email ?? me?.email ?? rememberedEmail();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = useMutation({
    mutationFn: () => api.post<{ user: Me; needsOnboarding: boolean }>('/auth/verify-code', { email, code }),
    onSuccess: (res) => {
      navigate(res.needsOnboarding ? '/onboarding' : '/today', { replace: true });
      queryClient.setQueryData(['me'], res.user);
    },
    onError: (err) => {
      setCode('');
      setError(err instanceof ApiError ? err.message : 'Check your connection and try again.');
      if (err instanceof ApiError && err.code === 'code_expired') setWait(RESEND_SECONDS);
    },
  });

  const resend = useMutation({
    mutationFn: () => api.post('/auth/resend-code', { email }),
    onSuccess: () => {
      setError('');
      setNotice('We sent you a new code.');
      setWait(RESEND_SECONDS);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Check your connection and try again.'),
  });

  if (isPending) return null;
  if (me?.emailVerified) return <Navigate to="/today" replace />;
  if (!email) return <Navigate to="/signup" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setNotice('');
    verify.mutate();
  };

  return (
    <AuthLayout>
      <div className="v g8">
        <h1>Check your email</h1>
        <p className="mut">
          We sent a 6-digit code to {email}. It expires in {config?.otpTtlMinutes ?? 10} minutes.
        </p>
      </div>
      <form className="v g24" onSubmit={onSubmit} noValidate>
        <Input
          label="6-digit code"
          className="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          error={error}
        />
        <Button type="submit" block disabled={verify.isPending}>
          Continue
        </Button>
      </form>
      <div className="v g4" style={{ alignItems: 'center' }}>
        <Button variant="text" disabled={wait > 0 || resend.isPending} onClick={() => resend.mutate()}>
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </Button>
        <ButtonLink variant="text" to="/signup">
          Use a different email
        </ButtonLink>
        <p className="sr" role="status">
          {notice}
        </p>
      </div>
    </AuthLayout>
  );
}
