import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, apiUrl, ApiError } from '../../lib/api';
import { rememberEmail, useConfig } from '../../lib/auth';
import { useTitle } from '../../lib/hooks';
import { AuthFooter, AuthLayout } from '../../components/AuthLayout';
import { Button, ButtonA } from '../../components/Button';
import { Divider } from '../../components/Divider';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  useTitle('Create your account');
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const min = config?.minPasswordLength ?? 8;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');

  const signup = useMutation({
    mutationFn: (address: string) => api.post('/auth/signup', { email: address, password }),
    onSuccess: (_d, address) => {
      rememberEmail(address);
      navigate('/verify', { state: { email: address } });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'weak_password') setPasswordError(err.message);
      else setFormError(err instanceof ApiError ? err.message : 'Check your connection and try again.');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    const eErr = EMAIL_RE.test(address) ? '' : 'Enter a valid email address.';
    const pErr = password.length >= min ? '' : `Use at least ${min} characters.`;
    setEmailError(eErr);
    setPasswordError(pErr);
    setFormError('');
    if (!eErr && !pErr) signup.mutate(address);
  };

  return (
    <AuthLayout>
      <div className="v g8">
        <h1>Create your account</h1>
        <p className="mut">Use your email or Google. Next, you will upload your CV.</p>
      </div>
      <form className="v g24" onSubmit={onSubmit} noValidate>
        {formError && (
          <p className="sm err-t" role="alert">
            {formError}
          </p>
        )}
        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`At least ${min} characters.`}
          error={passwordError}
        />
        <div className="v g16">
          <Button type="submit" block disabled={signup.isPending}>
            Create account
          </Button>
          {config?.googleEnabled && (
            <>
              <Divider />
              <ButtonA variant="outline" block href={apiUrl('/api/auth/google')}>
                Continue with Google
              </ButtonA>
            </>
          )}
        </div>
      </form>
      <AuthFooter text="Already have an account?" link="Sign in" to="/signin" />
    </AuthLayout>
  );
}
