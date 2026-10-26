import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EarlierItem, EarlierMatches as Data, EarlierStatus } from '../lib/types';
import { placeShort, plural } from '../lib/format';
import { formatPostedAge } from '../lib/postedAge';
import { Button } from './Button';
import { ScorePill } from './ScorePill';
import { StatusDot } from './StatusDot';
import type { StatusTone } from '../lib/format';

type Filter = 'all' | EarlierStatus;

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['not', 'Not applied'],
  ['applied', 'Applied'],
  ['started', 'Started'],
  ['skipped', 'Skipped'],
];

const STATUS: Record<EarlierStatus, { label: string; tone: StatusTone }> = {
  not: { label: 'Not applied', tone: 'grey' },
  applied: { label: 'Applied', tone: 'ok' },
  started: { label: 'Started', tone: 'acc' },
  skipped: { label: 'Skipped', tone: 'off' },
};

/** Days shown at first, and how many more each "Show earlier days" adds. */
const FIRST_DAYS = 3;
const MORE_DAYS = 7;

/** The UK calendar day as YYYY-MM-DD, matching how the server stores the day a match was found. */
export function ukDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** "Yesterday · Sunday 25 October" or "Saturday 24 October". */
export function dayLabel(date: string, today = ukDay()): string {
  const d = new Date(`${date}T12:00:00Z`);
  const label = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
  const yesterday = ukDay(new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000));
  return date === yesterday ? `Yesterday · ${label}` : label;
}

export function expiresLabel(days: number): string {
  if (days <= 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

/** "3 weeks" for 21 days, otherwise "N days". */
const periodLabel = (days: number) => (days % 7 === 0 ? `${days / 7} ${plural(days / 7, 'week', 'weeks')}` : `${days} days`);

function ClockIcon() {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14 }}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function Row({ item }: { item: EarlierItem }) {
  const s = STATUS[item.status];
  const to = item.applicationId ? `/applications/${item.applicationId}` : `/jobs/${item.id}`;
  return (
    <li>
      <Link className="erow" to={to}>
        <div className="erow-m">
          <span className="med">{item.job.title}</span>
          <span className="sm mut">
            {item.job.company} · {placeShort(item.job)}
          </span>
          <span className="xs mut h wrap" style={{ gap: '4px 12px' }}>
            {formatPostedAge(item.job.postedAt)}
            {item.expiresInDays !== null && (
              <span className="warn-t h g4 med">
                <ClockIcon />
                {expiresLabel(item.expiresInDays)}
              </span>
            )}
          </span>
        </div>
        <div className="erow-s">
          <StatusDot label={s.label} tone={s.tone} />
          <ScorePill score={item.score} />
        </div>
      </Link>
    </li>
  );
}

/**
 * Today › Earlier: every match from the retention period under the day it was found, with its status.
 * Skipped matches are folded away under each day until opened.
 */
export function EarlierMatches({ data }: { data: Data }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [daysShown, setDaysShown] = useState(FIRST_DAYS);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const period = periodLabel(data.retentionDays);

  if (data.counts.all === 0) {
    return (
      <div className="v g16 fade-in" style={{ maxWidth: 520 }}>
        <p className="t18">No earlier matches yet.</p>
        <p className="mut">Matches from previous days appear here for {period}, so you can come back to them.</p>
      </div>
    );
  }

  const groups = data.days
    .map((d) => {
      const isOpen = Boolean(opened[d.date]);
      const matching = d.items.filter((i) => filter === 'all' || i.status === filter);
      const skipped = filter === 'all' ? d.items.filter((i) => i.status === 'skipped') : [];
      const shown = filter === 'all' && !isOpen ? matching.filter((i) => i.status !== 'skipped') : matching;
      const applied = d.items.filter((i) => i.status === 'applied').length;
      return { ...d, isOpen, matching, skipped, shown, applied };
    })
    .filter((g) => g.matching.length > 0);
  const visible = groups.slice(0, daysShown);

  return (
    <div className="v g32">
      <p className="sm mut h g8" style={{ alignItems: 'flex-start' }}>
        <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
        <span>Jobs are removed automatically {period} after they were posted. Anything you applied to stays in Applications.</span>
      </p>

      <div className="h wrap g8" role="group" aria-label="Filter by status">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" className="opt chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label} <span className="num mut">{data.counts[id]}</span>
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="v g16" style={{ padding: '32px 0' }}>
          <p className="t18">No matches with this status.</p>
          <Button variant="text" className="back" onClick={() => setFilter('all')}>
            Show all matches
          </Button>
        </div>
      )}

      {visible.map((g) => {
        const label = dayLabel(g.date);
        return (
          <section key={g.date} className="eg" aria-label={label}>
            <div className="eg-h">
              <h2>{label}</h2>
              <span className="sm mut">
                {g.items.length} {plural(g.items.length, 'match', 'matches')} · {g.applied} applied
              </span>
            </div>
            <ul>
              {g.shown.map((item) => (
                <Row key={item.id} item={item} />
              ))}
            </ul>
            {g.skipped.length > 0 && (
              <Button
                variant="text"
                className="back"
                aria-expanded={g.isOpen}
                onClick={() => setOpened((o) => ({ ...o, [g.date]: !g.isOpen }))}
              >
                {g.isOpen ? 'Hide skipped' : `Show ${g.skipped.length} skipped`}
              </Button>
            )}
          </section>
        );
      })}

      {groups.length > daysShown && (
        <Button variant="outline" action onClick={() => setDaysShown((n) => n + MORE_DAYS)}>
          Show earlier days
        </Button>
      )}
    </div>
  );
}
