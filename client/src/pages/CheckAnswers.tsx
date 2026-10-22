import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useConfig } from '../lib/auth';
import { useTitle } from '../lib/hooks';
import type { FormAnswer } from '../lib/types';
import { AppShell } from '../components/AppShell';
import { ActionBar } from '../components/ActionBar';
import { ApprovalScreen, useApproval } from '../components/Approval';
import { BackLink, Button, ButtonLink } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useMatch } from './JobReview';

const NEEDS_ANSWER = 'Needs your answer. We could not find this in your CV.';

export default function CheckAnswers() {
  useTitle('Check your answers');
  const matchId = useParams().matchId!;
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const match = useMatch(matchId);
  const answers = useQuery({
    queryKey: ['answers', matchId],
    queryFn: () => api.get<{ company: string; answers: FormAnswer[] }>(`/matches/${matchId}/answers`),
  });
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (answers.data) setValues(Object.fromEntries(answers.data.answers.map((a) => [a.key, a.value])));
  }, [answers.data]);

  const toFinish = useCallback(() => navigate(`/jobs/${matchId}/finish`), [navigate, matchId]);
  const approval = useApproval(matchId, { kind: 'idle' }, toFinish);

  const saveAndApprove = useMutation({
    mutationFn: () => api.put(`/matches/${matchId}/answers`, { answers: Object.entries(values).map(([key, value]) => ({ key, value })) }),
    onSuccess: () => approval.approve.mutate(),
  });

  if (match.data && match.data.job.applyRoute !== 'form') return <Navigate to={`/jobs/${matchId}`} replace />;

  const company = answers.data?.company ?? match.data?.job.company ?? '';

  if (approval.phase.kind !== 'idle') {
    const appId = 'appId' in approval.phase ? approval.phase.appId : '';
    return (
      <AppShell hideTabBar>
        <ApprovalScreen
          phase={approval.phase}
          seconds={approval.seconds}
          route="form"
          company={company}
          undoWindowSeconds={config?.undoWindowSeconds ?? 10}
          undoing={approval.undo.isPending}
          onUndo={() => approval.undo.mutate(appId)}
          onRetry={() => approval.retry.mutate(appId)}
        />
      </AppShell>
    );
  }

  const list = answers.data?.answers ?? [];
  const missing = list.find((a) => !(values[a.key] ?? '').trim());
  const busy = saveAndApprove.isPending || approval.approve.isPending;
  const failure = saveAndApprove.error ?? approval.approve.error;
  const note = failure
    ? failure instanceof ApiError
      ? failure.message
      : 'Check your connection and try again.'
    : missing
      ? `Add your ${missing.label.toLowerCase()} to continue.`
      : 'Nothing is sent until you approve it.';

  return (
    <AppShell
      hideTabBar
      actionBar={
        <ActionBar
          primary={
            <Button disabled={!answers.data || Boolean(missing) || busy} onClick={() => saveAndApprove.mutate()}>
              Approve and apply
            </Button>
          }
          secondary={
            <ButtonLink variant="text" to={`/jobs/${matchId}`}>
              Back to job
            </ButtonLink>
          }
          note={note}
        />
      }
    >
      <div className="col v g32">
        <BackLink to={`/jobs/${matchId}`}>Back to job</BackLink>
        <header className="v g16">
          <h1>Check your answers</h1>
          <p className="mut">
            The {company || "employer's"} application form asks these questions. We filled them in from your CV. Check each one before you
            approve.
          </p>
        </header>
        {answers.isPending ? (
          <div className="v g24" aria-busy="true">
            <span className="sr">Loading the questions</span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="v g8" aria-hidden="true">
                <Skeleton width={140} height={14} />
                <Skeleton width="100%" height={48} />
              </div>
            ))}
          </div>
        ) : answers.isError ? (
          <ErrorState
            title="We could not load the questions."
            helper="Check your connection and try again. Nothing has been sent."
            action={
              <Button action onClick={() => answers.refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <div className="v g24">
            {list.map((a) => {
              const value = values[a.key] ?? '';
              const empty = !value.trim();
              const edited = value !== a.value;
              const props = {
                id: `q-${a.key}`,
                label: a.label,
                value,
                onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [a.key]: e.target.value })),
                warning: empty ? NEEDS_ANSWER : undefined,
                hint: empty ? undefined : edited ? 'Your answer.' : a.hint,
              };
              return a.multiline ? <Textarea key={a.key} {...props} /> : <Input key={a.key} {...props} />;
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
