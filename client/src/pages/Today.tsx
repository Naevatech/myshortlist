import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { firstName, greeting, plural } from '../lib/format';
import { useTitle } from '../lib/hooks';
import type { TodayMatches } from '../lib/types';
import { AppShell } from '../components/AppShell';
import { Button, ButtonLink } from '../components/Button';
import { JobCard } from '../components/JobCard';
import { Skeleton } from '../components/Skeleton';
import { StatusDot } from '../components/StatusDot';
import { Loader } from '../components/Loader';

const DEFAULT_VISIBLE = 4;

export function useTodayMatches() {
  return useQuery({ queryKey: ['matches', 'today'], queryFn: () => api.get<TodayMatches>('/matches/today') });
}

export default function Today() {
  useTitle('Today');
  const { data: me } = useMe();
  const { data, isPending, isError, refetch, isFetching } = useTodayMatches();
  const [showAll, setShowAll] = useState(false);
  const name = firstName(me?.name ?? '');
  const hello = `${greeting()}${name ? `, ${name}` : ''}.`;

  let body;
  if (isPending) {
    body = (
      <>
        <header className="v g16" aria-busy="true">
          <Skeleton width={220} height={24} />
          <Skeleton width={300} />
        </header>
        <Loader label="Loading your matches" steps={['Looking for your matches', 'Putting the best fits first', 'Almost there']} />
        <ul className="v g16" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="job" style={{ gap: 12 }}>
              <Skeleton width="55%" height={16} />
              <Skeleton width="38%" />
              <Skeleton width="28%" />
              <Skeleton width="80%" />
            </li>
          ))}
        </ul>
      </>
    );
  } else if (isError) {
    body = (
      <>
        <header className="v g8">
          <h1>{hello}</h1>
          <p className="t18 mut">We could not load your matches.</p>
        </header>
        <div className="v g24" style={{ maxWidth: 520 }} role="alert">
          <p className="mut">Check your connection and try again. Your applications are safe.</p>
          <Button action disabled={isFetching} onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </>
    );
  } else if (data.total === 0 && data.reviewed > 0) {
    body = (
      <>
        <header className="v g16">
          <StatusDot tone="ok" label="All matches reviewed" />
          <h1>You are all caught up.</h1>
          <p className="t18 mut">We will bring you new matches tomorrow morning.</p>
        </header>
        <ButtonLink variant="outline" action to="/applications">
          View your applications
        </ButtonLink>
      </>
    );
  } else if (data.total === 0) {
    body = (
      <>
        <header className="v g8">
          <h1>{hello}</h1>
          <p className="t18 mut">There are no new matches today.</p>
        </header>
        <div className="v g24" style={{ maxWidth: 520 }}>
          <p className="mut">We will look again tomorrow morning. If you want to see more roles, you can widen your search.</p>
          <ButtonLink action to="/profile">
            Review your preferences
          </ButtonLink>
        </div>
      </>
    );
  } else {
    const items = showAll ? data.items : data.items.slice(0, DEFAULT_VISIBLE);
    body = (
      <>
        <header className="v g8">
          <h1>{hello}</h1>
          <p className="t18 mut">
            {data.total} {plural(data.total, 'new match is', 'new matches are')} ready for your review.
          </p>
          <p className="sm mut">Nothing is sent until you approve it.</p>
        </header>
        <div className="v g16">
          <ul className="v g16" aria-label="New matches">
            {items.map((m) => (
              <li key={m.id}>
                <JobCard match={m} />
              </li>
            ))}
          </ul>
          {data.total > DEFAULT_VISIBLE && (
            <Button variant="text" className="back" aria-expanded={showAll} onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Show fewer' : `See all ${data.total} matches`}
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <AppShell>
      <div className="colw v g48">{body}</div>
    </AppShell>
  );
}
