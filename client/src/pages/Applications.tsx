import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { applicationStatus, formatDate } from '../lib/format';
import { useTitle } from '../lib/hooks';
import type { ApplicationListItem } from '../lib/types';
import { AppShell } from '../components/AppShell';
import { Button, ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Skeleton } from '../components/Skeleton';
import { StatusDot } from '../components/StatusDot';
import { CompanyLogo } from '../components/CompanyLogo';
import { panelId, tabId, Tabs } from '../components/Tabs';

type Filter = 'all' | 'active' | 'closed';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'closed', label: 'Closed' },
];

function Rows({ rows }: { rows: ApplicationListItem[] }) {
  return (
    <>
      <div className="only-d">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col" style={{ width: '34%' }}>
                Role
              </th>
              <th scope="col" style={{ width: '28%' }}>
                Company
              </th>
              <th scope="col" style={{ width: '18%' }}>
                Date
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = applicationStatus(r);
              return (
                <tr key={r.id}>
                  <td>
                    <span className="co">
                      <CompanyLogo company={r.job.company} src={r.job.logoUrl} />
                      <Link to={`/applications/${r.id}`}>{r.job.title}</Link>
                    </span>
                  </td>
                  <td>{r.job.company}</td>
                  <td className="num mut">{formatDate(r.approvedAt)}</td>
                  <td>
                    <StatusDot label={s.label} tone={s.tone} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="only-m" aria-label="Applications">
        {rows.map((r) => {
          const s = applicationStatus(r);
          return (
            <li key={r.id}>
              <Link className="rowl with-logo" to={`/applications/${r.id}`}>
                <CompanyLogo company={r.job.company} src={r.job.logoUrl} />
                <span className="v g4" style={{ minWidth: 0 }}>
                  <span className="med" style={{ color: 'var(--ink)' }}>
                    {r.job.title}
                  </span>
                  <span className="sm mut num">
                    {r.job.company} · {formatDate(r.approvedAt)}
                  </span>
                  <StatusDot label={s.label} tone={s.tone} className="mt-1" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function Applications() {
  useTitle('Applications');
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['applications', filter],
    queryFn: () => api.get<ApplicationListItem[]>(`/applications?filter=${filter}`),
  });

  let body;
  if (isPending) {
    body = (
      <div aria-busy="true">
        <span className="sr">Loading your applications</span>
        <ul aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="rowl" style={{ gap: 12, padding: '28px 0' }}>
              <Skeleton width="46%" height={14} />
              <Skeleton width="30%" />
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (isError) {
    body = (
      <ErrorState
        title="We could not load your applications."
        helper="Check your connection and try again."
        action={
          <Button action disabled={isFetching} onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (data.length === 0 && filter === 'all') {
    body = (
      <EmptyState
        title="You have not applied to anything yet."
        helper="When you approve an application, you can follow it here."
        action={
          <ButtonLink action to="/today">
            Review today's matches
          </ButtonLink>
        }
      />
    );
  } else if (data.length === 0) {
    body = <EmptyState title={filter === 'active' ? 'You have no active applications.' : 'You have no closed applications.'} />;
  } else {
    body = <Rows rows={data} />;
  }

  return (
    <AppShell>
      <div className="colw v g32">
        <h1>Applications</h1>
        <div className="v g8">
          <Tabs label="Filter applications" idPrefix="apps" tabs={FILTERS} value={filter} onChange={setFilter} />
          <div id={panelId('apps', filter)} role="tabpanel" aria-labelledby={tabId('apps', filter)}>
            {body}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
