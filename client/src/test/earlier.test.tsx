import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dayLabel, expiresLabel } from '../components/EarlierMatches';
import { CONFIG, job, ME, mockApi, renderAt } from './utils';

const signedIn = { 'GET /me': ME, 'GET /config': CONFIG };
const posted = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const item = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id,
  score: 80,
  status,
  applicationId: status === 'applied' ? `app-${id}` : null,
  expiresInDays: null,
  job: { title: `Role ${id}`, company: `Company ${id}`, location: 'Belfast', workMode: 'hybrid', postedAt: posted(4) },
  ...over,
});

const EARLIER = {
  retentionDays: 21,
  counts: { all: 5, not: 2, applied: 1, started: 1, skipped: 1 },
  days: [
    { date: '2026-10-25', items: [item('a', 'not'), item('b', 'applied'), item('c', 'skipped')] },
    { date: '2026-10-22', items: [item('d', 'started'), item('e', 'not', { expiresInDays: 2 })] },
  ],
};

const TODAY = { total: 1, reviewed: 0, items: [{ id: 'm1', score: 90, reasonLine: 'Reason.', status: 'new', job: job() }] };

describe('day and expiry labels', () => {
  it('names yesterday and other days', () => {
    expect(dayLabel('2026-10-25', '2026-10-26')).toBe('Yesterday · Sunday 25 October');
    expect(dayLabel('2026-10-24', '2026-10-26')).toBe('Saturday 24 October');
  });

  it('counts down to removal', () => {
    expect(expiresLabel(0)).toBe('Expires today');
    expect(expiresLabel(1)).toBe('Expires tomorrow');
    expect(expiresLabel(3)).toBe('Expires in 3 days');
  });
});

describe('Earlier tab', () => {
  async function openEarlier() {
    mockApi({ ...signedIn, 'GET /matches/today': TODAY, 'GET /matches/earlier': EARLIER });
    renderAt('/today');
    const user = userEvent.setup();
    const earlierTab = await screen.findByRole('tab', { name: 'Earlier 5' });
    expect(screen.getByRole('tab', { name: 'Today 1' })).toHaveAttribute('aria-selected', 'true');
    await user.click(earlierTab);
    await screen.findByText('Matches from the last 3 weeks, by the day we found them.');
    return user;
  }

  it('groups matches by day with a summary, statuses and links', async () => {
    await openEarlier();
    const first = screen.getByRole('region', { name: /Sunday 25 October/ });
    expect(within(first).getByText('3 matches · 1 applied')).toBeInTheDocument();
    // Skipped is folded away at first.
    expect(within(first).queryByText('Role c')).not.toBeInTheDocument();
    expect(within(first).getByRole('link', { name: /Role b/ })).toHaveAttribute('href', '/applications/app-b');
    expect(within(first).getByRole('link', { name: /Role a/ })).toHaveAttribute('href', '/jobs/a');
    expect(within(first).getByText('Applied')).toBeInTheDocument();

    const second = screen.getByRole('region', { name: 'Thursday 22 October' });
    expect(within(second).getByText('Started')).toBeInTheDocument();
    expect(within(second).getByText('Expires in 2 days')).toBeInTheDocument();
  });

  it('shows skipped matches on request', async () => {
    const user = await openEarlier();
    const first = screen.getByRole('region', { name: /Sunday 25 October/ });
    await user.click(within(first).getByRole('button', { name: 'Show 1 skipped' }));
    expect(within(first).getByText('Role c')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Hide skipped' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('filters by status, with counts, and recovers from an empty filter', async () => {
    const user = await openEarlier();
    const chips = screen.getByRole('group', { name: 'Filter by status' });
    expect(within(chips).getByRole('button', { name: 'Applied 1' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(within(chips).getByRole('button', { name: 'Started 1' }));
    expect(screen.getByText('Role d')).toBeInTheDocument();
    expect(screen.queryByText('Role a')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Sunday 25 October/ })).not.toBeInTheDocument();

    await user.click(within(chips).getByRole('button', { name: 'Skipped 1' }));
    expect(screen.getByText('Role c')).toBeInTheDocument();
  });

  it('keeps the chosen tab in the address', async () => {
    mockApi({ ...signedIn, 'GET /matches/today': TODAY, 'GET /matches/earlier': EARLIER });
    renderAt('/today?tab=earlier');
    expect(await screen.findByRole('tab', { name: 'Earlier 5' })).toHaveAttribute('aria-selected', 'true');
  });

  it('still offers Earlier on a day with no new matches', async () => {
    mockApi({ ...signedIn, 'GET /matches/today': { total: 0, reviewed: 0, items: [] }, 'GET /matches/earlier': EARLIER });
    renderAt('/today');
    expect(await screen.findByText('There are no new matches today.')).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Earlier 5' })).toBeInTheDocument();
  });
});

describe('landing page update', () => {
  it('mentions that matches are kept for 3 weeks', async () => {
    mockApi({ 'GET /me': { status: 401, error: { code: 'unauthorized', message: 'x' } }, 'GET /config': CONFIG });
    renderAt('/');
    expect(await screen.findByText('Every match saved for 3 weeks')).toBeInTheDocument();
    expect(screen.getByText('Can I go back to jobs from earlier days?')).toBeInTheDocument();
  });
});
