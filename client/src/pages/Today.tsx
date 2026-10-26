import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { firstName, greeting, plural } from '../lib/format';
import { useTitle } from '../lib/hooks';
import type { EarlierMatches as EarlierData, TodayMatches } from '../lib/types';
import { AppShell } from '../components/AppShell';
import { Button, ButtonLink } from '../components/Button';
import { JobCard } from '../components/JobCard';
import { Skeleton } from '../components/Skeleton';
import { StatusDot } from '../components/StatusDot';
import { Loader } from '../components/Loader';
import { panelId, tabId, Tabs } from '../components/Tabs';
import { EarlierMatches } from '../components/EarlierMatches';

const DEFAULT_VISIBLE = 4;

export function useTodayMatches() {
  return useQuery({ queryKey: ['matches', 'today'], queryFn: () => api.get<TodayMatches>('/matches/today') });
}

export function useEarlierMatches() {
  return useQuery({ queryKey: ['matches', 'earlier'], queryFn: () => api.get<EarlierData>('/matches/earlier') });
}

type TabId = 'today' | 'earlier';

export default function Today() {
  useTitle('Today');
  const { data: me } = useMe();
  const { data, isPending, isError, refetch, isFetching } = useTodayMatches();
  const earlier = useEarlierMatches();
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'earlier' ? 'earlier' : 'today';
  const setTab = (t: TabId) => setParams(t === 'earlier' ? { tab: 'earlier' } : {}, { replace: true });
  const [showAll, setShowAll] = useState(false);
  const name = firstName(me?.name ?? '');
  const hello = `${greeting()}${name ? `, ${name}` : ''}.`;

  if (isPending) {
    return (
      <AppShell>
        <div className="colw v g48">
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
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell>
        <div className="colw v g48">
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
        </div>
      </AppShell>
    );
  }

  const earlierCount = earlier.data?.counts.all ?? 0;
  const allReviewed = data.total === 0 && data.reviewed > 0;
  // The tabs appear whenever there is something under Earlier, even on a day with no new matches.
  const showTabs = data.total > 0 || earlierCount > 0;
  const weeks = earlier.data ? earlier.data.retentionDays / 7 : 3;
  const period = Number.isInteger(weeks) ? `${weeks} ${plural(weeks, 'week', 'weeks')}` : `${earlier.data?.retentionDays} days`;

  let header;
  if (tab === 'earlier') {
    header = (
      <header className="v g8">
        <h1>{hello}</h1>
        <p className="t18 mut">Matches from the last {period}, by the day we found them.</p>
      </header>
    );
  } else if (allReviewed) {
    header = (
      <header className="v g16">
        <StatusDot tone="ok" label="All matches reviewed" />
        <h1>You are all caught up.</h1>
        <p className="t18 mut">We will bring you new matches tomorrow morning.</p>
      </header>
    );
  } else if (data.total === 0) {
    header = (
      <header className="v g8">
        <h1>{hello}</h1>
        <p className="t18 mut">There are no new matches today.</p>
      </header>
    );
  } else {
    header = (
      <header className="v g8">
        <h1>{hello}</h1>
        <p className="t18 mut">
          {data.total} {plural(data.total, 'new match is', 'new matches are')} ready for your review.
        </p>
        <p className="sm mut">Nothing is sent until you approve it.</p>
      </header>
    );
  }

  let panel;
  if (tab === 'earlier') {
    panel = earlier.isPending ? (
      <div aria-busy="true" className="v g16">
        <span className="sr">Loading earlier matches</span>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={56} />
        ))}
      </div>
    ) : earlier.isError ? (
      <div className="v g24" style={{ maxWidth: 520 }} role="alert">
        <p className="mut">We could not load your earlier matches. Check your connection and try again.</p>
        <Button action disabled={earlier.isFetching} onClick={() => earlier.refetch()}>
          Try again
        </Button>
      </div>
    ) : (
      <EarlierMatches data={earlier.data} />
    );
  } else if (allReviewed) {
    panel = (
      <ButtonLink variant="outline" action to="/applications">
        View your applications
      </ButtonLink>
    );
  } else if (data.total === 0) {
    panel = (
      <div className="v g24" style={{ maxWidth: 520 }}>
        <p className="mut">We will look again tomorrow morning. If you want to see more roles, you can widen your search.</p>
        <ButtonLink action to="/profile">
          Review your preferences
        </ButtonLink>
      </div>
    );
  } else {
    const items = showAll ? data.items : data.items.slice(0, DEFAULT_VISIBLE);
    panel = (
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
    );
  }

  return (
    <AppShell>
      <div className="colw v g48">
        {header}
        {showTabs ? (
          <div className="v g32">
            <Tabs
              label="Matches"
              idPrefix="matches"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'today', label: <>Today <span className="mut num">{data.total}</span></> },
                { id: 'earlier', label: <>Earlier <span className="mut num">{earlierCount}</span></> },
              ]}
            />
            <div id={panelId('matches', tab)} role="tabpanel" aria-labelledby={tabId('matches', tab)}>
              {panel}
            </div>
          </div>
        ) : (
          panel
        )}
      </div>
    </AppShell>
  );
}
