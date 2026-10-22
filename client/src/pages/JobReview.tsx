import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useConfig } from '../lib/auth';
import { formatSalary, placeLong, ROUTE_INFO } from '../lib/format';
import { useTitle } from '../lib/hooks';
import type { DocumentData, MatchDetail } from '../lib/types';
import { AppShell } from '../components/AppShell';
import { ActionBar } from '../components/ActionBar';
import { ApprovalScreen, phaseFor, useApproval } from '../components/Approval';
import { BackLink, Button, ButtonA, ButtonLink } from '../components/Button';
import { DocumentPreview, type DocumentPreviewHandle } from '../components/DocumentPreview';
import { Skeleton } from '../components/Skeleton';
import { CompanyLogo } from '../components/CompanyLogo';
import { Loader } from '../components/Loader';
import { ScorePill } from '../components/ScorePill';
import { formatPostedAge } from '../lib/postedAge';
import { JobDescription } from '../components/JobDescription';
import { panelId, tabId, Tabs } from '../components/Tabs';

export function useMatch(matchId: string) {
  return useQuery({ queryKey: ['match', matchId], queryFn: () => api.get<MatchDetail>(`/matches/${matchId}`) });
}

type DocTab = 'cv' | 'cover_letter';

function Documents({ match }: { match: MatchDetail }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DocTab>('cv');
  const [editing, setEditing] = useState(false);
  const sheet = useRef<DocumentPreviewHandle>(null);
  const doc = match.documents.find((d) => d.type === tab);
  const locked = match.status === 'applied';

  const save = useMutation({
    mutationFn: (d: DocumentData) => api.put<DocumentData>(`/documents/${d.id}`, { blocks: sheet.current!.getBlocks() }),
    onSuccess: (updated) => {
      queryClient.setQueryData<MatchDetail>(['match', match.id], (m) =>
        m ? { ...m, documents: m.documents.map((d) => (d.id === updated.id ? updated : d)) } : m,
      );
      setEditing(false);
    },
  });

  const finishEditing = () => (doc && editing ? save.mutate(doc) : setEditing(false));
  const changeTab = (t: DocTab) => {
    if (editing && doc) save.mutate(doc);
    setTab(t);
  };

  return (
    <section className="v g16" aria-labelledby="docs-h">
      <h2 id="docs-h">Your documents</h2>
      <Tabs
        label="Documents"
        idPrefix="docs"
        value={tab}
        onChange={changeTab}
        tabs={[
          { id: 'cv', label: 'CV' },
          { id: 'cover_letter', label: 'Cover letter' },
        ]}
        aside={
          !locked && (
            <Button variant="text" disabled={save.isPending} onClick={() => (editing ? finishEditing() : setEditing(true))}>
              {editing ? 'Done' : 'Edit'}
            </Button>
          )
        }
      />
      {doc ? (
        <DocumentPreview
          key={`${doc.id}-${doc.version}-${editing}`}
          ref={sheet}
          id={panelId('docs', tab)}
          labelledBy={tabId('docs', tab)}
          label={tab === 'cv' ? 'CV' : 'Cover letter'}
          blocks={doc.blocks}
          editing={editing}
        />
      ) : (
        <p className="mut" id={panelId('docs', tab)} role="tabpanel">
          This document is not ready yet.
        </p>
      )}
      {save.isError && (
        <p className="sm err-t" role="alert">
          We could not save your changes. Try again.
        </p>
      )}
      <p className="xs mut">Written from your CV. Please check before sending. Underlined text was adjusted for this role.</p>
    </section>
  );
}

function JobInfo({ match }: { match: MatchDetail }) {
  const [open, setOpen] = useState(false);
  const { job } = match;
  const route = ROUTE_INFO[job.applyRoute];
  return (
    <section className="v g48" aria-label="Job">
      <header className="v g8">
        <h1>{job.title}</h1>
        <div className="co" style={{ marginTop: 4 }}>
          <CompanyLogo company={job.company} src={job.logoUrl} />
          <p className="t18">{job.company}</p>
        </div>
        <p className="mut">{placeLong(job)}</p>
        <p className="xs mut">{formatPostedAge(job.postedAt)}</p>
        <p>{formatSalary(job.salaryMin, job.salaryMax)}</p>
        <div className="v g4" style={{ marginTop: 16 }}>
          <p className="sm med">{route.label}</p>
          <p className="sm mut">{route.note}</p>
        </div>
      </header>
      <div className="v g16">
        <h2>Why this matches</h2>
        <p className="h g8">
          <span className="sm mut">Match score</span>
          <ScorePill score={match.score} />
        </p>
        <ul className="v g16">
          {match.reasons.slice(0, 3).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="v g16">
        <Button variant="text" className="back" aria-expanded={open} aria-controls="job-desc" onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide full description' : 'Read full description'}
        </Button>
        {open && <JobDescription job={job} />}
      </div>
    </section>
  );
}

function LoadingReview() {
  return (
    <AppShell
      hideTabBar
      actionBar={
        <ActionBar
          primary={
            <Button disabled>
              Approve and apply
            </Button>
          }
          secondary={
            <>
              <Button variant="text" disabled>
                Skip
              </Button>
              <Button variant="text" disabled>
                Save for later
              </Button>
            </>
          }
          note="Nothing is sent until you approve it."
        />
      }
    >
      <div className="colw v g32" aria-busy="true">
        <Loader
          label="Loading this job"
          steps={['Opening this job', 'Checking it against your CV', 'Getting your CV and cover letter ready', 'Almost there']}
        />
        <div className="rv" aria-hidden="true">
          <section className="v g48">
            <div className="v g16">
              <Skeleton width="70%" height={28} />
              <Skeleton width="40%" />
              <Skeleton width="55%" />
              <Skeleton width="30%" />
            </div>
            <div className="v g16">
              <Skeleton width="36%" height={16} />
              <Skeleton width="92%" />
              <Skeleton width="84%" />
              <Skeleton width="76%" />
            </div>
          </section>
          <section className="v g16">
            <Skeleton width="40%" height={16} />
            <div className="doc v g16" style={{ padding: '32px 24px' }}>
              {['40%', '90%', '80%', '86%', '60%', '88%', '72%'].map((w, i) => (
                <Skeleton key={i} width={w} height={i === 0 ? 16 : 12} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export default function JobReview() {
  const matchId = useParams().matchId!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data: match, isPending, isError, refetch, isFetching } = useMatch(matchId);
  useTitle(match ? `${match.job.title}, ${match.job.company}` : 'Job review');

  const toFinish = useCallback(() => navigate(`/jobs/${matchId}/finish`), [navigate, matchId]);
  const approval = useApproval(matchId, { kind: 'idle' }, toFinish);
  const resumed = useRef(false);
  const { setPhase } = approval;
  useEffect(() => {
    if (!match || resumed.current) return;
    resumed.current = true;
    setPhase(phaseFor(match.application));
  }, [match, setPhase]);

  const setStatus = useMutation({
    mutationFn: (action: 'skip' | 'save') => api.post(`/matches/${matchId}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      navigate('/today');
    },
  });

  if (isPending) return <LoadingReview />;

  if (isError) {
    return (
      <AppShell>
        <div className="v g32 narrow center-block" role="alert">
          <div className="v g16">
            <h1>We could not load this job.</h1>
            <p className="mut">Check your connection and try again. Nothing has been sent.</p>
          </div>
          <div className="v g8">
            <Button action disabled={isFetching} onClick={() => refetch()}>
              Try again
            </Button>
            <ButtonLink variant="text" action to="/today">
              Back to Today
            </ButtonLink>
          </div>
        </div>
      </AppShell>
    );
  }

  const { job } = match;
  const route = ROUTE_INFO[job.applyRoute];

  if (approval.phase.kind !== 'idle') {
    const appId = 'appId' in approval.phase ? approval.phase.appId : '';
    return (
      <AppShell hideTabBar>
        <ApprovalScreen
          phase={approval.phase}
          seconds={approval.seconds}
          route={job.applyRoute}
          company={job.company}
          undoWindowSeconds={config?.undoWindowSeconds ?? 10}
          undoing={approval.undo.isPending}
          onUndo={() =>
            approval.undo.mutate(appId, {
              onSuccess: () => job.applyRoute === 'form' && navigate(`/jobs/${matchId}/answers`),
            })
          }
          onRetry={() => approval.retry.mutate(appId)}
        />
      </AppShell>
    );
  }

  const app = match.application;
  let primary;
  let note: string = 'Nothing is sent until you approve it.';
  let secondary = true;
  if (match.status === 'applied' && app) {
    primary = (
      <ButtonLink to={`/applications/${app.id}`}>
        View application
      </ButtonLink>
    );
    note = 'You have applied to this job.';
    secondary = false;
  } else if (app?.sendError === 'not_supported') {
    primary = <ButtonLink to={`/jobs/${matchId}/finish`}>Finish on their site</ButtonLink>;
    note = 'We cannot submit this form for you yet. Nothing was sent.';
  } else if (job.applyRoute === 'email') {
    primary = (
      <Button disabled={approval.approve.isPending} onClick={() => approval.approve.mutate()}>
        {route.primary}
      </Button>
    );
    if (approval.approve.error) note = approval.approve.error instanceof ApiError ? approval.approve.error.message : 'Check your connection and try again.';
  } else if (job.applyRoute === 'form') {
    primary = <ButtonLink to={`/jobs/${matchId}/answers`}>{route.primary}</ButtonLink>;
  } else {
    primary = (
      <ButtonA href={job.applyUrl ?? '#'} target="_blank" rel="noopener noreferrer" onClick={toFinish}>
        {route.primary}
      </ButtonA>
    );
  }

  return (
    <AppShell
      hideTabBar
      actionBar={
        <ActionBar
          primary={primary}
          secondary={
            secondary && (
              <>
                <Button variant="text" disabled={setStatus.isPending} onClick={() => setStatus.mutate('skip')}>
                  Skip
                </Button>
                <Button variant="text" disabled={setStatus.isPending} onClick={() => setStatus.mutate('save')}>
                  Save for later
                </Button>
              </>
            )
          }
          note={note}
        />
      }
    >
      <div className="colw v g32">
        <BackLink to="/today">Today</BackLink>
        <div className="rv">
          <JobInfo match={match} />
          <Documents match={match} />
        </div>
      </div>
    </AppShell>
  );
}
