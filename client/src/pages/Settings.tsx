import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, ApiError } from '../lib/api';
import { useTitle } from '../lib/hooks';
import type { Settings as SettingsData } from '../lib/types';
import { AppShell } from '../components/AppShell';
import { Button, ButtonA } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { ErrorState } from '../components/ErrorState';
import { Input } from '../components/Input';
import { OptionToggle } from '../components/OptionToggle';
import { Skeleton } from '../components/Skeleton';
import { Switch } from '../components/Switch';
import { logosEnabled } from '../components/CompanyLogo';
import { formatDate } from '../lib/format';

const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Check your connection and try again.');

/** Change of email: a code is sent to the new address and the change happens once it is entered. */
function EmailRow({ email }: { email: string }) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<'view' | 'enter' | 'code'>('view');
  const [next, setNext] = useState('');
  const [code, setCode] = useState('');
  const request = useMutation({ mutationFn: () => api.post('/me/email/request', { email: next.trim() }), onSuccess: () => setStage('code') });
  const verify = useMutation({
    mutationFn: () => api.post('/me/email/verify', { email: next.trim(), code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setStage('view');
      setCode('');
    },
  });
  const cancel = () => {
    setStage('view');
    request.reset();
    verify.reset();
  };

  if (stage === 'view') {
    return (
      <div className="kv">
        <h3 className="sm med">Email</h3>
        <p style={{ overflowWrap: 'anywhere' }}>{email}</p>
        <Button variant="text" aria-label="Change email" onClick={() => setStage('enter')}>
          Change
        </Button>
      </div>
    );
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (stage === 'enter') request.mutate();
    else verify.mutate();
  };
  return (
    <form className="kv" onSubmit={submit}>
      <h3 className="sm med">Email</h3>
      <div className="v g24">
        {stage === 'enter' ? (
          <Input
            label="New email address"
            type="email"
            autoComplete="email"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={request.error ? errText(request.error) : undefined}
          />
        ) : (
          <Input
            label={`Code sent to ${next.trim()}`}
            className="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={verify.error ? errText(verify.error) : undefined}
          />
        )}
        <div className="h wrap g8">
          <Button type="submit" variant="outline" disabled={request.isPending || verify.isPending}>
            {stage === 'enter' ? 'Send code' : 'Confirm'}
          </Button>
          <Button variant="text" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
      <span />
    </form>
  );
}

const SIGN_IN_WITH: Record<SettingsData['signInMethod'], string> = {
  password: 'Email and password',
  google: 'Google',
  both: 'Email and password, or Google',
};

/** "Change" emails a reset link to the user's own address. Hidden for Google-only accounts. */
function PasswordRow({ data }: { data: SettingsData }) {
  const send = useMutation({ mutationFn: () => api.post<{ email: string; expiresInMinutes: number }>('/me/password/reset-link') });
  return (
    <div className="kv">
      <h3 className="sm med">Password</h3>
      <div className="v g8">
        <p>{data.passwordChangedAt ? `Last changed ${formatDate(data.passwordChangedAt)}` : 'Not set yet'}</p>
        <p className="sm mut" role="status">
          {send.isSuccess
            ? `We have sent a link to ${send.data.email}. It expires in ${send.data.expiresInMinutes} minutes.`
            : send.isError
              ? errText(send.error)
              : ''}
        </p>
      </div>
      <Button variant="text" aria-label="Change password" disabled={send.isPending} onClick={() => send.mutate()}>
        Change
      </Button>
    </div>
  );
}

export default function Settings() {
  useTitle('Settings');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<SettingsData>('/settings') });

  const update = useMutation({
    mutationFn: (patch: Partial<SettingsData>) => api.patch<SettingsData>('/settings', patch),
    onMutate: (patch) => {
      const prev = queryClient.getQueryData<SettingsData>(['settings']);
      if (prev) queryClient.setQueryData(['settings'], { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && queryClient.setQueryData(['settings'], ctx.prev),
    onSuccess: (s) => queryClient.setQueryData(['settings'], s),
  });

  const signOut = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      queryClient.clear();
      navigate('/signed-out', { replace: true });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete('/me', { confirm: true }),
    onSuccess: () => {
      queryClient.clear();
      navigate('/', { replace: true });
    },
  });

  let body;
  if (isPending) {
    body = (
      <div className="v g16" aria-busy="true">
        <span className="sr">Loading your settings</span>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={16} />
        ))}
      </div>
    );
  } else if (isError) {
    body = (
      <ErrorState
        title="We could not load your settings."
        helper="Check your connection and try again."
        action={
          <Button action onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <section className="v g16" aria-labelledby="st-acc">
          <h2 id="st-acc">Account</h2>
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            <EmailRow email={data.email} />
            {data.signInMethod !== 'google' && <PasswordRow data={data} />}
            <div className="kv">
              <h3 className="sm med">Sign in with</h3>
              <p>{SIGN_IN_WITH[data.signInMethod]}</p>
              <span />
            </div>
          </div>
          <Button variant="text" className="back" onClick={() => setSigningOut(true)}>
            Sign out
          </Button>
        </section>

        <section className="v g16" aria-labelledby="st-mail">
          <h2 id="st-mail">Email notifications</h2>
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            {(
              [
                ['notifyNewMatches', 'New matches', 'One short email each morning when new matches are ready.'],
                ['notifyAppUpdates', 'Application updates', 'When an employer views or replies to an application.'],
              ] as const
            ).map(([key, label, help]) => (
              <div key={key} className="h sp g24" style={{ padding: '20px 0', borderTop: '1px solid var(--line)' }}>
                <div>
                  <p id={`st-${key}`}>{label}</p>
                  <p className="sm mut" id={`st-${key}-h`}>
                    {help}
                  </p>
                </div>
                <Switch
                  checked={data[key]}
                  labelledBy={`st-${key}`}
                  describedBy={`st-${key}-h`}
                  onChange={(v) => update.mutate({ [key]: v })}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="v g16" aria-labelledby="st-perday">
          <h2 id="st-perday">Matches per day</h2>
          <OptionToggle
            label="Matches per day"
            hideLabel
            compact
            hint="How many new matches we show you each day. Fewer is calmer."
            options={(data.matchesPerDayOptions ?? [3, 5, 10, 15, 20, 25, 30]).map((n) => ({ value: n, label: String(n) }))}
            value={data.matchesPerDay}
            onChange={(v) => update.mutate({ matchesPerDay: v })}
          />
          {update.isError && (
            <p className="sm err-t" role="alert">
              We could not save this. Check your connection and try again.
            </p>
          )}
        </section>

        <section className="v g24" aria-labelledby="st-data">
          <h2 id="st-data">Data and privacy</h2>
          <div className="v g8" style={{ alignItems: 'flex-start' }}>
            <ButtonA variant="outline" href={apiUrl('/api/me/export')} download aria-describedby="st-dl">
              Download my data
            </ButtonA>
            <p className="sm mut" id="st-dl">
              A copy of your CV, documents and application history.
            </p>
          </div>
          <div className="v g8" style={{ alignItems: 'flex-start' }}>
            <Button variant="text" className="back" aria-describedby="st-del" onClick={() => setConfirming(true)}>
              Delete my account
            </Button>
            <p className="sm mut" id="st-del">
              This removes your CV, documents and application history. It cannot be undone.
            </p>
          </div>
        </section>

        <section className="v g16" aria-labelledby="st-note">
          <h2 id="st-note">How Shortlist uses your data</h2>
          <div className="v g16 sur box">
            <p className="sm">We use your CV, preferences and work authorisation to find jobs and to write your CV and cover letter for each one.</p>
            <p className="sm">We never send an application without your approval. We do not sell your data, and employers only receive what you approve.</p>
            <p className="sm">You can download or delete everything at any time.</p>
          </div>
          {logosEnabled && (
            <p className="xs mut">
              Company logos by{' '}
              <a href="https://www.logo.dev" target="_blank" rel="noopener noreferrer">
                Logo.dev
              </a>
            </p>
          )}
        </section>
      </>
    );
  }

  return (
    <AppShell>
      <div className="col v g64">
        <h1>Settings</h1>
        {body}
      </div>
      {signingOut && (
        <Dialog title="Sign out of Shortlist?" onClose={() => setSigningOut(false)}>
          <p className="mut">You can sign back in at any time.</p>
          <div className="v g8">
            <Button block disabled={signOut.isPending} onClick={() => signOut.mutate()}>
              Sign out
            </Button>
            <Button variant="text" block onClick={() => setSigningOut(false)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
      {confirming && (
        <Dialog title="Delete your account?" onClose={() => setConfirming(false)}>
          <div className="v g16">
            <p>This removes your CV, your profile and preferences, every tailored CV and cover letter, and your application history.</p>
            <p className="mut">You will be signed out straight away and cannot sign back in. It cannot be undone.</p>
            {remove.isError && (
              <p className="sm err-t" role="alert">
                {errText(remove.error)}
              </p>
            )}
          </div>
          <div className="h wrap g8">
            <Button disabled={remove.isPending} onClick={() => remove.mutate()}>
              Delete my account
            </Button>
            <Button variant="text" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </AppShell>
  );
}
