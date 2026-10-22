import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useConfig } from '../../lib/auth';
import { useFocusHeading, useTitle } from '../../lib/hooks';
import { AuthLayout } from '../../components/AuthLayout';
import { Button, ButtonLink } from '../../components/Button';
import { PasswordInput } from '../../components/PasswordInput';
import { StatusDot } from '../../components/StatusDot';

/** Choose a new password from an emailed link. Shows Expired straight away if the link cannot be used. */
export default function Reset() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const min = config?.minPasswordLength ?? 8;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const valid = useQuery({
    queryKey: ['reset-validate', token],
    queryFn: () => api.get(`/auth/reset/validate?token=${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  const reset = useMutation({
    mutationFn: () => api.post('/auth/reset', { token, password }),
    // The server ends every session, including this one.
    onSuccess: () => queryClient.setQueryData(['me'], null),
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'weak_password') setPasswordError(err.message);
      else if (!(err instanceof ApiError && err.status === 410)) setPasswordError('Check your connection and try again.');
    },
  });

  const expired = !token || valid.isError || (reset.error instanceof ApiError && reset.error.status === 410);
  const view = expired ? 'expired' : reset.isSuccess ? 'done' : valid.isSuccess ? 'form' : 'loading';
  useTitle(view === 'expired' ? 'This link has expired' : view === 'done' ? 'Password updated' : 'Choose a new password');
  useFocusHeading(view);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const pErr = password.length >= min ? '' : `Use at least ${min} characters.`;
    const cErr = !pErr && confirm !== password ? 'The passwords do not match.' : '';
    setPasswordError(pErr);
    setConfirmError(cErr);
    if (!pErr && !cErr) reset.mutate();
  };

  if (view === 'loading') return <AuthLayout>{null}</AuthLayout>;

  if (view === 'expired') {
    return (
      <AuthLayout>
        <div className="v g8">
          <h1>This link has expired.</h1>
          <p className="mut">Reset links work once and expire after {config?.passwordResetTtlMinutes ?? 30} minutes. Request a new one.</p>
        </div>
        <ButtonLink block to="/forgot">
          Send a new link
        </ButtonLink>
      </AuthLayout>
    );
  }

  if (view === 'done') {
    return (
      <AuthLayout>
        <div className="v g16">
          <StatusDot tone="ok" label="Password updated" />
          <h1>You can sign in now.</h1>
          <p className="mut">Your password has been changed. For your security, you have been signed out on your other devices.</p>
        </div>
        <ButtonLink block to="/signin">
          Sign in
        </ButtonLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="v g8">
        <h1>Choose a new password</h1>
        <p className="mut">Use at least {min} characters.</p>
      </div>
      <form className="v g24" onSubmit={onSubmit} noValidate>
        <PasswordInput
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
        />
        <PasswordInput
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirmError}
        />
        <Button type="submit" block disabled={reset.isPending}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
