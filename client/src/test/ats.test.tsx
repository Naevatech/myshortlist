import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CONFIG, ME, mockApi, renderAt } from './utils';

const signedIn = { 'GET /me': ME, 'GET /config': CONFIG };

const SETUP = {
  cv: { fileName: 'sam-carter-cv.pdf', updatedAt: '2026-10-12T10:00:00Z' },
  maxCvSizeMb: 5,
  jobs: [
    { matchId: 'm1', title: 'Frontend Engineer', company: 'Halden & Moore', score: 94, foundDaysAgo: 0 },
    { matchId: 'm2', title: 'Full-Stack Developer', company: 'Northfield Labs', score: 91, foundDaysAgo: 1 },
  ],
};

const check = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  area: 'basic',
  sev: 'pass',
  title: 'Name found',
  detail: 'Your name was read.',
  fix: null,
  fixLabel: null,
  points: 4,
  fixed: false,
  ignored: false,
  resolved: true,
  ...over,
});

const RESULT = {
  id: 'ats1',
  createdAt: '2026-11-09T10:00:00Z',
  cvFileName: 'sam-carter-cv.pdf',
  job: { title: 'Frontend Engineer', company: 'Halden & Moore', matchId: 'm1' },
  jobSource: 'match',
  score: 72,
  initialScore: 72,
  verdict: 'Needs work before you apply.',
  remaining: 2,
  potential: 96,
  areas: [
    { id: 'kw', label: 'Keywords', score: 50, left: 1 },
    { id: 'sec', label: 'Sections', score: 80, left: 1 },
    { id: 'fmt', label: 'Formatting', score: 100, left: 0 },
    { id: 'read', label: 'Readability', score: 100, left: 0 },
    { id: 'basic', label: 'Contact and basics', score: 100, left: 0 },
  ],
  checks: [
    check({ id: 'b_name' }),
    check({
      id: 's_exp',
      area: 'sec',
      sev: 'warn',
      title: 'Heading "My Journey" may not be recognised',
      detail: 'Rename it.',
      fix: 'copy',
      fixLabel: 'Rename to Experience',
      points: 8,
      resolved: false,
    }),
    check({ id: 'k_missing', area: 'kw', sev: 'fail', title: '2 keywords are missing', detail: 'Add them.', fix: 'keywords', points: 12, resolved: false }),
  ],
  keywords: [
    { k: 'React', job: 6, cv: 8, added: false },
    { k: 'Jest', job: 2, cv: 0, added: false },
    { k: 'CI/CD', job: 2, cv: 0, added: false },
  ],
  fields: [{ label: 'Name', value: 'Sam Carter', ok: true }],
  text: [{ text: 'SAM CARTER' }, { text: 'My Journey', mark: 'bad' }],
  copy: 'match',
};

describe('ATS checker set-up', () => {
  it('defaults to the current CV and the first match, and runs the check', async () => {
    const { calls } = mockApi({ ...signedIn, 'GET /tools/ats/setup': SETUP, 'POST /tools/ats/checks': RESULT, 'GET /tools/ats/checks/ats1': RESULT });
    renderAt('/tools/ats');
    const user = userEvent.setup();
    expect(await screen.findByRole('radio', { name: /sam-carter-cv.pdf/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Frontend Engineer/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Northfield Labs · Yesterday/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Check my CV' }));
    expect(screen.getByRole('heading', { name: 'Checking your CV against Frontend Engineer, Halden & Moore' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'ATS score 72 out of 100' }, { timeout: 8000 })).toBeInTheDocument();
    const body = calls.find((c) => c.path === '/tools/ats/checks')!.body as FormData;
    expect(body.get('cvSource')).toBe('current');
    expect(body.get('jobSource')).toBe('match');
    expect(body.get('matchId')).toBe('m1');
  });

  it('asks for a fuller job advert when the pasted one is too short', async () => {
    mockApi({ ...signedIn, 'GET /tools/ats/setup': SETUP });
    renderAt('/tools/ats');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Paste a job description' }));
    await user.type(screen.getByLabelText('Job description'), 'Too short.');
    await user.click(screen.getByRole('button', { name: 'Check my CV' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Paste the full job advert, at least a few sentences.');
  });
});

describe('ATS checker results', () => {
  it('shows the score, fixes an issue and adds a keyword', async () => {
    const fixed = {
      ...RESULT,
      score: 80,
      remaining: 1,
      checks: RESULT.checks.map((c) => (c.id === 's_exp' ? { ...c, fixed: true, resolved: true } : c)),
    };
    const added = { ...fixed, score: 86, keywords: RESULT.keywords.map((w) => (w.k === 'Jest' ? { ...w, added: true } : w)) };
    let state = RESULT;
    const { calls } = mockApi({
      ...signedIn,
      'GET /tools/ats/checks/ats1': () => state,
      'POST /tools/ats/checks/ats1/actions': (b: unknown) => {
        state = (b as { action: string }).action === 'fix' ? fixed : added;
        return state;
      },
    });
    renderAt('/tools/ats/ats1');
    const user = userEvent.setup();
    expect(await screen.findByText('Needs work before you apply.')).toBeInTheDocument();
    expect(screen.getByText('2 issues to fix · fixing them could raise your score to 96')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Use fixed CV for this job' })).toHaveAttribute('href', '/jobs/m1');

    await user.click(screen.getByRole('button', { name: 'Rename to Experience' }));
    expect(await screen.findByText('+8 since you started')).toBeInTheDocument();
    expect(screen.getByText('Fixed in your tailored copy')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/tools/ats/checks/ats1/actions')?.body).toEqual({ action: 'fix', id: 's_exp' });

    const kw = screen.getByRole('region', { name: 'Keyword tool' });
    expect(within(kw).getByText('1 of 3 job keywords are in your CV')).toBeInTheDocument();
    await user.click(within(kw).getByRole('button', { name: 'I have this: add Jest' }));
    expect(await within(kw).findByRole('button', { name: 'Undo adding Jest' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'ATS score 86 out of 100' })).toBeInTheDocument();
  });

  it('filters the checks by area', async () => {
    mockApi({ ...signedIn, 'GET /tools/ats/checks/ats1': RESULT });
    renderAt('/tools/ats/ats1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Sections 80/ }));
    expect(screen.getByRole('heading', { name: 'Sections checks' })).toBeInTheDocument();
    expect(screen.queryByText('2 keywords are missing')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all checks' }));
    expect(screen.getByText('2 keywords are missing')).toBeInTheDocument();
  });

  it('offers a download when the check has no match', async () => {
    mockApi({ ...signedIn, 'GET /tools/ats/checks/ats1': { ...RESULT, job: null, jobSource: 'none', copy: 'download', keywords: [] } });
    renderAt('/tools/ats/ats1');
    expect(await screen.findByRole('link', { name: 'Download fixed CV' })).toHaveAttribute('href', expect.stringContaining('/api/tools/ats/checks/ats1/pdf'));
    expect(screen.queryByRole('region', { name: 'Keyword tool' })).not.toBeInTheDocument();
  });
});

describe('Tools in the navigation', () => {
  it('links the ATS checker from the sidebar group and the mobile tab bar', async () => {
    mockApi({ ...signedIn, 'GET /tools/ats/setup': SETUP });
    renderAt('/tools/ats');
    const user = userEvent.setup();
    const [sidebar, tabbar] = await screen.findAllByRole('navigation', { name: 'Main' });
    const group = within(sidebar).getByRole('button', { name: 'Tools' });
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(within(sidebar).getByRole('link', { name: 'ATS checker' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabbar).getByRole('link', { name: 'Tools' })).toHaveAttribute('aria-current', 'page');
    await user.click(group);
    expect(within(sidebar).queryByRole('link', { name: 'ATS checker' })).not.toBeInTheDocument();
  });
});
