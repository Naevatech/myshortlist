import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, ApiError } from '../../lib/api';
import { rememberEmail, safeNext, useConfig } from '../../lib/auth';
import { useTitle } from '../../lib/hooks';
import type { Me } from '../../lib/types';
import { AuthFooter, AuthLayout } from '../../components/AuthLayout';
import { Button, ButtonA } from '../../components/Button';
import { Divider } from '../../components/Divider';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';

const WRONG = 'That email or password is not right. Try again.';

interface SigninResult {
  user: Me;
  needsVerify: boolean;
  needsOnboarding: boolean;
}

export default function SignIn() {
  useTitle('Sign in');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { data: config } = useConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('google') === 'failed' ? 'We could not sign you in with Google. Try again.' : '');
  const [invalid, setInvalid] = useState(false);

  const signin = useMutation({
    mutationFn: () => api.post<SigninResult>('/auth/signin', { email: email.trim(), password }),
    onSuccess: async (res) => {
      if (res.needsVerify) {
        rememberEmail(res.user.email);
        await api.post('/auth/resend-code', { email: res.user.email }).catch(() => undefined);
      }
      // Navigate before storing the user: this page sends signed-in users to Today, which would override `next`.
      navigate(res.needsVerify ? '/verify' : res.needsOnboarding ? '/onboarding' : (next ?? '/today'), {
        replace: true,
        state: res.needsVerify ? { email: res.user.email } : undefined,
      });
      queryClient.setQueryData(['me'], res.user);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'invalid_credentials') {
        setError(WRONG);
        setInvalid(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Check your connection and try again.');
        setInvalid(false);
      }
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(WRONG);
      setInvalid(true);
      return;
    }
    signin.mutate();
  };

  const google = apiUrl(`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`);

  return (
    <AuthLayout>
      <h1>Sign in</h1>
      <form className="v g24" onSubmit={onSubmit} noValidate>
        {error && (
          <p className="sm err-t" role="alert">
            {error}
          </p>
        )}
        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={invalid || undefined}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          invalid={invalid}
          labelAside={
            <Link to="/forgot" className="btn bt" style={{ minHeight: 44, margin: '-8px -12px -8px 0' }}>
              Forgot password?
            </Link>
          }
        />
        <div className="v g16">
          <Button type="submit" block disabled={signin.isPending}>
            Sign in
          </Button>
          {config?.googleEnabled && (
            <>
              <Divider />
              <ButtonA variant="outline" block href={google}>
                Continue with Google
              </ButtonA>
            </>
          )}
        </div>
      </form>
      <AuthFooter text="New to Shortlist?" link="Create an account" to="/signup" />
    </AuthLayout>
  );
}
