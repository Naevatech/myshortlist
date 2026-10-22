import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl } from '../lib/api';
import { applicationStatus, formatDate } from '../lib/format';
import { useTitle } from '../lib/hooks';
import type { ApplicationDetailData } from '../lib/types';
import { AppShell } from '../components/AppShell';
import { BackLink, Button, ButtonA, ButtonLink } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { Skeleton } from '../components/Skeleton';
import { StatusDot } from '../components/StatusDot';
import { CompanyLogo } from '../components/CompanyLogo';
import { Textarea } from '../components/Input';

/** Event details stored by the system are shown in plain words. */
function detailText(detail: string | null): string | null {
  if (detail === 'dryRun') return 'Development mode: the email service is not set up, so no email left Shortlist.';
  return detail;
}

function Notes({ app }: { app: ApplicationDetailData }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(app.notes);
  const [saved, setSaved] = useState(false);
  useEffect(() => setNotes(app.notes), [app.notes]);
  const save = useMutation({
    mutationFn: () => api.patch(`/applications/${app.id}/notes`, { notes }),
    onSuccess: () => {
      setSaved(true);
      queryClient.setQueryData<ApplicationDetailData>(['application', app.id], (a) => (a ? { ...a, notes } : a));
    },
  });
  return (
    <section className="v g16" aria-labelledby="ad-notes">
      <h2 id="ad-notes">Notes</h2>
      <Textarea
        label="Only you can see your notes"
        placeholder="Add a note about this application"
        value={notes}
        maxLength={10000}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
      />
      <div className="h wrap g16">
        <Button variant="outline" action disabled={save.isPending || notes === app.notes} onClick={() => save.mutate()}>
          Save note
        </Button>
        <p className="sm mut" role="status">
          {saved ? 'Saved.' : save.isError ? 'We could not save your note. Try again.' : ''}
        </p>
      </div>
    </section>
  );
}

export default function ApplicationDetail() {
  const id = useParams().id!;
  const queryClient = useQueryClient();
  const { data: app, isPending, isError, refetch } = useQuery({
    queryKey: ['application', id],
    queryFn: () => api.get<ApplicationDetailData>(`/applications/${id}`),
  });
  useTitle(app ? `${app.job.title}, ${app.job.company}` : 'Application');

  const retry = useMutation({
    mutationFn: () => api.post(`/applications/${id}/retry`),
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['application', id] }), 1500);
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  let header;
  let body;
  if (isPending) {
    body = (
      <div className="v g16" aria-busy="true">
        <span className="sr">Loading this application</span>
        <Skeleton width="60%" height={28} />
        <Skeleton width="40%" />
        <Skeleton width="30%" />
      </div>
    );
  } else if (isError) {
    body = (
      <ErrorState
        title="We could not load this application."
        helper="Check your connection and try again."
        action={
          <Button action onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else {
    const status = applicationStatus(app);
    const sent = Boolean(app.sentAt);
    const place = app.job.workMode === 'remote' ? `Remote, ${app.job.location}` : app.job.location;
    header = (
        <header className="v g8">
          <h1>{app.job.title}</h1>
          <div className="co" style={{ marginTop: 4 }}>
            <CompanyLogo company={app.job.company} src={app.job.logoUrl} />
            <p className="t18">{app.job.company}</p>
          </div>
          <p className="mut num">
            {place} · {app.status === 'approved' ? 'Approved' : 'Applied'} {formatDate(app.approvedAt)}
          </p>
          <StatusDot label={status.label} tone={status.tone} className="mt-2" />
        </header>
    );
    body = (
      <>

        {app.sendError === 'failed' && (
          <div className="box v g16" role="alert">
            <p>We could not send this application. Nothing was sent.</p>
            <Button variant="outline" action disabled={retry.isPending || retry.isSuccess} onClick={() => retry.mutate()}>
              {retry.isSuccess ? 'Sending' : 'Try again'}
            </Button>
          </div>
        )}
        {app.sendError === 'not_supported' && app.matchId && (
          <div className="box v g16">
            <p>We cannot submit this form for you yet. Nothing was sent. You can finish on the employer's site.</p>
            <ButtonLink variant="outline" action to={`/jobs/${app.matchId}/finish`}>
              Finish on their site
            </ButtonLink>
          </div>
        )}

        <section className="v g16" aria-labelledby="ad-tl">
          <h2 id="ad-tl">Timeline</h2>
          {app.events.length === 0 ? (
            <p className="mut">Nothing has happened yet.</p>
          ) : (
            <ol className="tl" style={{ borderBottom: '1px solid var(--line)' }}>
              {app.events.map((e, i) => (
                <li key={e.id}>
                  <span className="sm mut num">{formatDate(e.occurredAt)}</span>
                  <div>
                    <p className={i === 0 ? 'med' : undefined}>{e.label}</p>
                    {detailText(e.detail) && <p className="sm mut">{detailText(e.detail)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {app.documents.length > 0 && (
          <section className="v g16" aria-labelledby="ad-docs">
            <h2 id="ad-docs">{sent ? 'Documents sent' : 'Your documents'}</h2>
            <ul style={{ borderBottom: '1px solid var(--line)' }}>
              {app.documents.map((d) => {
                const name = d.type === 'cv' ? 'CV' : 'Cover letter';
                return (
                  <li key={d.id} className="h sp g16" style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                    <div>
                      <p>{name}</p>
                      <p className="sm mut num">
                        PDF · {sent ? `Sent ${formatDate(app.sentAt!)}` : `Prepared ${formatDate(d.updatedAt)}`}
                      </p>
                    </div>
                    <ButtonA
                      variant="text"
                      href={apiUrl(`/api/documents/${d.id}/pdf`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View the ${name.toLowerCase()}${sent ? ' that was sent' : ''}`}
                    >
                      View
                    </ButtonA>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <Notes app={app} />
      </>
    );
  }

  return (
    <AppShell>
      <div className="col v g64">
        <div className="v g32">
          <BackLink to="/applications">Applications</BackLink>
          {header ?? body}
        </div>
        {header && body}
      </div>
    </AppShell>
  );
}
