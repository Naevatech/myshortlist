import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUrl, ApiError } from '../../lib/api';
import { useTitle } from '../../lib/hooks';
import type { AtsArea, AtsCheckItem, AtsResult } from '../../lib/types';
import { AppShell } from '../../components/AppShell';
import { Button, ButtonA, ButtonLink } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Skeleton } from '../../components/Skeleton';
import { AtsHeader } from './AtsSetup';
import '../../styles/ats.css';

const CIRC = 2 * Math.PI * 58;
const ICON = { pass: '✓', warn: '!', fail: '×' } as const;

type Action = { action: 'fix' | 'undo' | 'ignore' | 'unignore' | 'add' | 'remove'; id?: string; keyword?: string };

function statusText(c: AtsCheckItem): string {
  if (c.fixed) return 'Fixed in your tailored copy';
  if (c.ignored) return 'Ignored';
  if (c.fix === 'keywords' && c.resolved && c.sev !== 'pass') return 'Keywords added';
  if (c.sev === 'pass') return 'Passed';
  return c.sev === 'fail' ? 'Likely to cause problems' : 'Worth fixing';
}

function Ring({ score }: { score: number }) {
  return (
    <div className="score-ring" role="img" aria-label={`ATS score ${score} out of 100`}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="tr" cx="70" cy="70" r="58" />
        <circle className="fg" cx="70" cy="70" r="58" style={{ strokeDasharray: `${((score / 100) * CIRC).toFixed(1)} ${CIRC.toFixed(1)}` }} />
      </svg>
      <div className="val" aria-hidden="true">
        <b>{score}</b>
        <span className="xs mut">out of 100</span>
      </div>
    </div>
  );
}

function CheckRow({ c, onAction, busy }: { c: AtsCheckItem; onAction: (a: Action) => void; busy: boolean }) {
  const [open, setOpen] = useState(!c.resolved);
  const sev = c.resolved ? 'pass' : c.sev;
  const bodyId = `chk-${c.id}`;
  return (
    <div className="chk">
      <button className="chk-h" type="button" aria-expanded={open || c.fixed} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
        <span className={`ico ${sev}`} aria-hidden="true">
          {ICON[sev]}
        </span>
        <span className="v g4" style={{ flex: 1, minWidth: 0 }}>
          <span className="med">{c.title}</span>
          <span className="sm mut">{statusText(c)}</span>
        </span>
        {!c.resolved && c.points > 0 && <span className="pts">+{c.points} pts</span>}
      </button>
      {(open || c.fixed) && (
        <div className="chk-b" id={bodyId}>
          <p className="sm">{c.detail}</p>
          {c.fixed && <p className="xs mut">Your original file is unchanged. The fix is in the copy Shortlist writes for you.</p>}
          <div className="chk-a">
            {!c.resolved && c.fix === 'copy' && (
              <Button className="sm2" disabled={busy} onClick={() => onAction({ action: 'fix', id: c.id })}>
                {c.fixLabel ?? 'Fix'}
              </Button>
            )}
            {!c.resolved && c.fix === 'keywords' && (
              <a className="btn bo sm2" href="#keywords">
                Open keyword tool
              </a>
            )}
            {c.fixed && (
              <Button variant="text" className="sm2" disabled={busy} onClick={() => onAction({ action: 'undo', id: c.id })}>
                Undo
              </Button>
            )}
            {!c.resolved && (
              <Button variant="text" className="sm2" disabled={busy} onClick={() => onAction({ action: 'ignore', id: c.id })}>
                Ignore
              </Button>
            )}
            {c.ignored && (
              <Button variant="text" className="sm2" disabled={busy} onClick={() => onAction({ action: 'unignore', id: c.id })}>
                Undo
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadsPanel({ r }: { r: AtsResult }) {
  const [tab, setTab] = useState<'fields' | 'text'>('fields');
  return (
    <section className="panel" aria-labelledby="ats-view">
      <div className="h sp wrap g8">
        <h2 id="ats-view">How the ATS reads you</h2>
        <div className="seg2" role="group" aria-label="ATS view">
          <button type="button" aria-pressed={tab === 'fields'} onClick={() => setTab('fields')}>
            Fields
          </button>
          <button type="button" aria-pressed={tab === 'text'} onClick={() => setTab('text')}>
            Text
          </button>
        </div>
      </div>
      {tab === 'fields' ? (
        <div>
          {r.fields.map((f) => (
            <div className="fl" key={f.label}>
              <span className="mut">{f.label}</span>
              <span className={f.ok ? 'sm' : 'sm err-t'}>{f.value}</span>
              <span className={f.ok ? 'ico pass' : 'ico fail'} aria-label={f.ok ? (f.fixed ? 'Fixed in your copy' : 'Read correctly') : 'Problem'}>
                {f.ok ? '✓' : '×'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="xs mut">
            Plain text the software pulls from your CV. Red marks show where it goes wrong; green shows what your fixed copy changes.
          </p>
          <div className="txt">
            {r.text.map((l, i) => (
              <span key={i}>
                {l.mark === 'bad' ? <mark>{l.text}</mark> : l.mark === 'good' ? <span className="gd">{l.text}</span> : l.text}
                {'\n'}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function KeywordTool({ r, onAction, busy }: { r: AtsResult; onAction: (a: Action) => void; busy: boolean }) {
  const [filter, setFilter] = useState<'all' | 'missing' | 'matched'>('all');
  const isMissing = (w: AtsResult['keywords'][number]) => w.cv === 0 && !w.added;
  const missing = r.keywords.filter(isMissing).length;
  const top = Math.max(1, ...r.keywords.map((w) => w.job));
  const shown = r.keywords.filter((w) => filter === 'all' || (filter === 'missing' ? isMissing(w) : !isMissing(w)));
  return (
    <section className="panel" id="keywords" aria-labelledby="ats-kw">
      <div className="h sp wrap g16">
        <div className="v g4">
          <h2 id="ats-kw">Keyword tool</h2>
          <p className="sm mut">
            {r.keywords.length - missing} of {r.keywords.length} job keywords are in your CV
          </p>
        </div>
        <div className="seg2" role="group" aria-label="Filter keywords">
          {(
            [
              ['all', 'All', r.keywords.length],
              ['missing', 'Missing', missing],
              ['matched', 'Matched', r.keywords.length - missing],
            ] as const
          ).map(([id, label, n]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label} <span className="mut num">{n}</span>
            </button>
          ))}
        </div>
      </div>
      {r.keywords.length === 0 ? (
        <p className="sm mut">We did not find specific skills or tools in this job advert.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="kw">
            <thead>
              <tr>
                <th scope="col">Keyword</th>
                <th scope="col" className="only-wide">
                  In the job
                </th>
                <th scope="col">In your CV</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => {
                const miss = isMissing(w);
                const low = !miss && !w.added && w.cv === 1 && w.job >= 3;
                return (
                  <tr key={w.k}>
                    <td className="med">{w.k}</td>
                    <td className="only-wide">
                      <span className="kwbar" aria-hidden="true">
                        <i style={{ width: `${Math.round((w.job / top) * 100)}%` }} />
                      </span>
                      <span className="num sm">{w.job}×</span>
                    </td>
                    <td className="num sm">{w.added ? 'Added' : w.cv ? `${w.cv}×` : '0'}</td>
                    <td>
                      <span className="kchip">
                        <span className={miss ? 'dot d-off' : low ? 'dot d-warn' : 'dot d-ok'} aria-hidden="true" />
                        {miss ? 'Missing' : w.added ? 'Added' : low ? 'Too few' : 'Matched'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {miss && (
                        <Button variant="outline" className="sm2" disabled={busy} onClick={() => onAction({ action: 'add', keyword: w.k })}>
                          I have this: add<span className="sr"> {w.k}</span>
                        </Button>
                      )}
                      {w.added && (
                        <Button variant="text" className="sm2" disabled={busy} onClick={() => onAction({ action: 'remove', keyword: w.k })}>
                          Undo<span className="sr"> adding {w.k}</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="xs mut">
        Only add skills you really have. We add them to the Skills section of your {r.copy === 'match' ? 'tailored CV for this job' : 'fixed copy'}.
      </p>
    </section>
  );
}

export default function AtsResults() {
  const id = useParams().checkId!;
  const queryClient = useQueryClient();
  const [area, setArea] = useState<AtsArea | 'all'>('all');
  const [actionError, setActionError] = useState('');
  const check = useQuery({ queryKey: ['ats', 'check', id], queryFn: () => api.get<AtsResult>(`/tools/ats/checks/${id}`) });
  useTitle('ATS checker');

  const act = useMutation({
    mutationFn: (a: Action) => api.post<AtsResult>(`/tools/ats/checks/${id}/actions`, a),
    onSuccess: (r) => {
      setActionError('');
      queryClient.setQueryData(['ats', 'check', id], r);
      if (r.job?.matchId) queryClient.invalidateQueries({ queryKey: ['match', r.job.matchId] });
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Check your connection and try again.'),
  });
  const rescan = useMutation({
    mutationFn: () => api.post<AtsResult>(`/tools/ats/checks/${id}/rescan`),
    onSuccess: (r) => queryClient.setQueryData(['ats', 'check', id], r),
  });

  let body;
  if (check.isPending) {
    body = (
      <div className="v g16" aria-busy="true">
        <span className="sr">Loading your results</span>
        <Skeleton width="100%" height={180} />
        <Skeleton width="100%" height={90} />
      </div>
    );
  } else if (check.isError) {
    body = (
      <ErrorState
        title="We could not load this check."
        helper="Check your connection and try again."
        action={
          <ButtonLink action to="/tools/ats">
            Start a new check
          </ButtonLink>
        }
      />
    );
  } else {
    const r = check.data;
    const delta = r.score - r.initialScore;
    const shown = r.checks
      .filter((c) => area === 'all' || c.area === area)
      .sort((a, b) => Number(a.resolved) - Number(b.resolved));
    const areaLabel = r.areas.find((a) => a.id === area)?.label;
    body = (
      <>
        <section className="ats-hero" aria-label="ATS score">
          <Ring score={r.score} />
          <div className="v g8">
            <div className="h wrap g8">
              <h2 style={{ fontSize: 22 }}>{r.verdict}</h2>
              {delta > 0 && <span className="delta">+{delta} since you started</span>}
            </div>
            <p className="mut">{r.job ? [r.job.title || 'Pasted job', r.job.company].filter(Boolean).join(' · ') : 'General check, no job'}</p>
            <p className="sm" role="status">
              {r.remaining
                ? `${r.remaining} ${r.remaining === 1 ? 'issue' : 'issues'} to fix${r.potential > r.score ? ` · fixing them could raise your score to ${r.potential}` : ''}`
                : 'No issues left. Your CV reads cleanly.'}
            </p>
          </div>
          <div className="v g8">
            {r.copy === 'match' && r.job?.matchId ? (
              <ButtonLink to={`/jobs/${r.job.matchId}`}>Use fixed CV for this job</ButtonLink>
            ) : (
              <ButtonA href={apiUrl(`/api/tools/ats/checks/${r.id}/pdf`)} download>
                Download fixed CV
              </ButtonA>
            )}
            <div className="h g8">
              <Button variant="outline" className="sm2" disabled={rescan.isPending} onClick={() => rescan.mutate()}>
                Re-scan
              </Button>
              <ButtonLink variant="text" className="sm2" to="/tools/ats">
                New check
              </ButtonLink>
            </div>
          </div>
        </section>

        <div className="cats" role="group" aria-label="Filter checks by area" style={{ ['--areas' as string]: r.areas.length }}>
          {r.areas.map((a) => (
            <button key={a.id} className="cat" type="button" aria-pressed={area === a.id} onClick={() => setArea(area === a.id ? 'all' : a.id)}>
              <span className="h sp">
                <span className="sm med">{a.label}</span>
                <span className="sm num">{a.score}</span>
              </span>
              <span className="bar3" aria-hidden="true">
                <i style={{ width: `${a.score}%` }} />
              </span>
              <span className="xs mut">{a.left ? `${a.left} to fix` : 'All good'}</span>
            </button>
          ))}
        </div>

        {actionError && (
          <p className="sm err-t" role="alert">
            {actionError}
          </p>
        )}

        <div className="res">
          <section className="v g16" aria-labelledby="ats-checks">
            <div className="h sp wrap g8">
              <h2 id="ats-checks">{area === 'all' ? 'Checks' : `${areaLabel} checks`}</h2>
              {area !== 'all' && (
                <Button variant="text" className="sm2" onClick={() => setArea('all')}>
                  Show all checks
                </Button>
              )}
            </div>
            <div>
              {shown.map((c) => (
                <CheckRow key={c.id} c={c} busy={act.isPending} onAction={(a) => act.mutate(a)} />
              ))}
            </div>
          </section>
          <aside className="side-sticky v g16">
            <ReadsPanel r={r} />
          </aside>
        </div>

        {r.job && <KeywordTool r={r} busy={act.isPending} onAction={(a) => act.mutate(a)} />}

        <p className="xs mut">
          Checked {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} using {r.cvFileName}.{' '}
          <Link to="/tools/ats">Run another check</Link>
        </p>
      </>
    );
  }

  return (
    <AppShell>
      <div className="colw v g32 ats" style={{ maxWidth: 1120 }}>
        <AtsHeader />
        {body}
      </div>
    </AppShell>
  );
}
