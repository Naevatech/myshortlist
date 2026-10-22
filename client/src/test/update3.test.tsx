import { afterEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseDescription } from '../components/JobDescription';
import { setTheme } from '../lib/theme';
import { CONFIG, job, ME, mockApi, renderAt } from './utils';

const signedIn = { 'GET /me': ME, 'GET /config': CONFIG };

describe('parseDescription', () => {
  it('splits headings, paragraphs and bullet points into sections', () => {
    const sections = parseDescription('Intro line.\n## The role\nYou will build.\n• React\n• TypeScript\nBenefits:\n- Pension');
    expect(sections).toEqual([
      { blocks: [{ kind: 'p', text: 'Intro line.' }] },
      { title: 'The role', blocks: [{ kind: 'p', text: 'You will build.' }, { kind: 'ul', items: ['React', 'TypeScript'] }] },
      { title: 'Benefits', blocks: [{ kind: 'ul', items: ['Pension'] }] },
    ]);
  });
});

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  score: 91,
  reasons: ['One.', 'Two.', 'Three.'],
  reasonLine: 'Line.',
  status: 'viewed',
  job: {
    ...job({ title: 'Frontend Engineer', company: 'Ocho', location: 'Belfast', workMode: 'hybrid', applyRoute: 'site' }),
    description: '## About us\nWe build tools.\n## What you will do\n• Build features\n• Review code',
    requirements: [],
    applyUrl: 'https://www.adzuna.co.uk/jobs/details/1',
    facts: { contract: 'Permanent, full time', reference: 'Adzuna 1', partial: true, sourceName: 'Adzuna' },
    ...over,
  },
  documents: [],
  application: null,
});

describe('full job description', () => {
  it('shows the key facts and every section, with a note when the advert is partial', async () => {
    mockApi({ ...signedIn, 'GET /matches/m1': detail() });
    renderAt('/jobs/m1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Read full description' }));
    const desc = screen.getByRole('article', { name: 'Full job description' });
    expect(within(desc).getByText('Contract').nextSibling).toHaveTextContent('Permanent, full time');
    expect(within(desc).getByText('Reference').nextSibling).toHaveTextContent('Adzuna 1');
    expect(within(desc).getByText('Posted').nextSibling).toHaveTextContent('2 days ago');
    expect(within(desc).getByRole('heading', { name: 'What you will do' })).toBeInTheDocument();
    expect(within(desc).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Build features', 'Review code']);
    expect(within(desc).getByRole('link', { name: 'Read the full advert on Adzuna' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('button', { name: 'Hide full description' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('adds the listed requirements when the advert has no such section', async () => {
    mockApi({
      ...signedIn,
      'GET /matches/m1': detail({ description: 'A short advert.', requirements: ['React', 'TypeScript'], facts: { contract: null, reference: null, partial: false, sourceName: null } }),
    });
    renderAt('/jobs/m1');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Read full description' }));
    expect(screen.getByRole('heading', { name: 'What they are looking for' })).toBeInTheDocument();
    expect(screen.queryByText(/shares only the start/)).not.toBeInTheDocument();
  });
});

describe('dark mode and log out', () => {
  afterEach(() => setTheme('light'));

  it('switches the theme from the sidebar and remembers it', async () => {
    mockApi({ ...signedIn, 'GET /matches/today': { total: 0, reviewed: 0, items: [] } });
    renderAt('/today');
    const user = userEvent.setup();
    const sw = await screen.findByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('dk');
    expect(localStorage.getItem('shortlist-theme')).toBe('dark');
    // The mobile header button offers the way back.
    await user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement).not.toHaveClass('dk');
  });

  it('logs out from the sidebar and shows Signed out', async () => {
    let out = false;
    const { calls } = mockApi({
      'GET /config': CONFIG,
      'GET /me': () => (out ? { status: 401, error: { code: 'unauthorized', message: 'x' } } : ME),
      'GET /matches/today': { total: 0, reviewed: 0, items: [] },
      'POST /auth/logout': () => {
        out = true;
        return { ok: true };
      },
    });
    renderAt('/today');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'You have signed out.' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/auth/logout')).toBe(true);
  });
});

describe('plain-text headings', () => {
  it('treats a short capitalised line as a heading, but not a sentence', () => {
    const sections = parseDescription('The Role\nYou will build things.\nWhat we offer\n• Pension');
    expect(sections.map((s) => s.title)).toEqual(['The Role', 'What we offer']);
    expect(parseDescription('Join us.')[0]).toEqual({ blocks: [{ kind: 'p', text: 'Join us.' }] });
  });
});
