import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl } from '../lib/api';
import { useTitle } from '../lib/hooks';
import { AppShell } from '../components/AppShell';
import { Button, ButtonA, ButtonLink } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { StatusDot } from '../components/StatusDot';
import { CompanyLogo } from '../components/CompanyLogo';
import { useMatch } from './JobReview';

export default function FinishOnSite() {
  const matchId = useParams().matchId!;
  const queryClient = useQueryClient();
  const { data: match, isPending, isError, refetch } = useMatch(matchId);
  useTitle(match ? `Finish on the ${match.job.company} site` : 'Finish on their site');

  // Opening this page means the person has started applying on the employer's site: Earlier shows it as Started.
  const started = useRef(false);
  useEffect(() => {
    if (!match || started.current || match.status === 'applied') return;
    started.current = true;
    api
      .post(`/matches/${matchId}/start`)
      .then(() => queryClient.invalidateQueries({ queryKey: ['matches', 'earlier'] }))
      .catch(() => undefined);
  }, [match, matchId, queryClient]);

  const applied = useMutation({
    mutationFn: () => api.post(`/matches/${matchId}/applied-on-site`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    },
  });

  let body;
  if (isPending) {
    body = (
      <div className="v g16" aria-busy="true">
        <span className="sr">Loading</span>
        <Skeleton width="80%" height={28} />
        <Skeleton width="100%" />
        <Skeleton width="70%" />
      </div>
    );
  } else if (isError) {
    body = (
      <div className="v g32" role="alert">
        <div className="v g16">
          <h1>We could not load this job.</h1>
          <p className="mut">Check your connection and try again. Nothing has been sent.</p>
        </div>
        <Button action onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  } else if (applied.isSuccess || match.status === 'applied') {
    body = (
      <>
        <StatusDot tone="ok" label="Tracking" />
        <div className="v g16">
          <h1>Added to Applications.</h1>
          <p className="mut">We will track it from here. We did not send anything for this job.</p>
        </div>
        <div className="v g8">
          <ButtonLink action to="/today">
            Back to Today
          </ButtonLink>
          <ButtonLink variant="text" action to="/applications">
            View applications
          </ButtonLink>
        </div>
      </>
    );
  } else {
    const company = match.job.company;
    body = (
      <>
        <CompanyLogo company={company} src={match.job.logoUrl} size="lg" />
        <div className="v g16">
          <h1>Finish on the {company} site.</h1>
          <p className="mut">
            We opened their application page in a new tab. Your CV and cover letter are ready to upload. Come back and tell us when you have
            applied, so we can track it.
          </p>
        </div>
        <div className="v g8">
          <Button action disabled={applied.isPending} onClick={() => applied.mutate()}>
            I have applied
          </Button>
          <ButtonA variant="outline" action href={apiUrl(`/api/matches/${matchId}/documents/zip`)} download>
            Download CV and cover letter
          </ButtonA>
          {match.job.applyUrl && (
            <ButtonA variant="text" action href={match.job.applyUrl} target="_blank" rel="noopener noreferrer">
              Open the page again
            </ButtonA>
          )}
          {applied.isError && (
            <p className="sm err-t" role="alert">
              We could not save this. Check your connection and try again.
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <AppShell>
      <div className="v g32 narrow center-block fade-in">{body}</div>
    </AppShell>
  );
}
