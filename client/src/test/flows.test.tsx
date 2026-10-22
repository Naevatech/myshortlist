import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CONFIG, job, ME, mockApi, renderAt } from './utils';

const signedOut = { 'GET /me': { status: 401, error: { code: 'unauthorized', message: 'Please sign in.' } }, 'GET /config': CONFIG };
const signedIn = { 'GET /me': ME, 'GET /config': CONFIG };

describe('Landing, sign up and verify', () => {
  it('goes from Get started to Create account to Check your email', async () => {
    const { calls } = mockApi({ ...signedOut, 'POST /auth/signup': { ok: true } });
    renderAt('/');
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole('link', { name: /^Get started/ }))[0]);
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email address'), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'Correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/We sent a 6-digit code to sam@example.com/)).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/auth/signup')?.body).toEqual({ email: 'sam@example.com', password: 'Correct-horse-9' });
    expect(screen.getByRole('button', { name: /Send a new code/ })).toBeDisabled();
  });

  it('shows the server message for a wrong code', async () => {
    mockApi({
      ...signedOut,
      'POST /auth/signup': { ok: true },
      'POST /auth/verify-code': { status: 400, error: { code: 'code_invalid', message: 'That code is not right. Try again.' } },
    });
    renderAt('/signup');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email address'), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'Correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('That code is not right. Try again.')).toBeInTheDocument();
  });
});

describe('Onboarding', () => {
  it('keeps Continue disabled until at least one role is added', async () => {
    mockApi({
      'GET /me': { ...ME, onboardingComplete: false },
      'GET /config': CONFIG,
      'GET /cv/active': {
        fileName: 'cv.pdf',
        name: 'Sam Carter',
        latestRole: 'Developer, Studio',
        yearsExperience: 3,
        skills: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'Git', 'Jest'],
        education: 'BSc Computing',
        suggestedRoles: [],
        location: 'Belfast',
      },
      'GET /preferences': null,
      'PUT /preferences': (b: unknown) => b,
    });
    renderAt('/onboarding');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Here is what we found' })).toBeInTheDocument();
    expect(screen.getByText('React, TypeScript, Node.js, MongoDB and 2 more')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Looks right' }));

    expect(await screen.findByRole('heading', { name: 'What roles are you looking for?' })).toBeInTheDocument();
    const cont = screen.getByRole('button', { name: 'Continue' });
    expect(cont).toBeDisabled();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

    await user.type(screen.getByLabelText('Job title'), 'Frontend Engineer{Enter}');
    expect(screen.getByRole('button', { name: 'Remove Frontend Engineer' })).toBeInTheDocument();
    expect(cont).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Remove Frontend Engineer' }));
    expect(cont).toBeDisabled();
  });
});

describe('Today', () => {
  const items = [0, 1, 2, 3, 4].map((i) => ({
    id: `m${i}`,
    score: 90 - i,
    reasonLine: `Reason ${i}.`,
    status: 'new',
    job: job({ id: `j${i}`, title: `Role ${i}` }),
  }));

  it('lists matches with score and reason, four at first', async () => {
    mockApi({ ...signedIn, 'GET /matches/today': { total: 5, reviewed: 0, items } });
    renderAt('/today');
    expect(await screen.findByText('5 new matches are ready for your review.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Role \d/ })).toHaveLength(4);
    expect(screen.getByText('Reason 0.')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getAllByText('Posted 2 days ago')).toHaveLength(4);

    const more = screen.getByRole('button', { name: 'See all 5 matches' });
    await userEvent.setup().click(more);
    expect(screen.getAllByRole('link', { name: /Role \d/ })).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the loading state', async () => {
    mockApi({ ...signedIn, 'GET /matches/today': () => new Promise(() => {}) });
    renderAt('/today');
    expect(await screen.findByText('Loading your matches')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    mockApi({ ...signedIn, 'GET /matches/today': { total: 0, reviewed: 0, items: [] } });
    renderAt('/today');
    expect(await screen.findByText('There are no new matches today.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review your preferences' })).toHaveAttribute('href', '/profile');
  });

  it('shows the all reviewed state', async () => {
    mockApi({ ...signedIn, 'GET /matches/today': { total: 0, reviewed: 3, items: [] } });
    renderAt('/today');
    expect(await screen.findByRole('heading', { name: 'You are all caught up.' })).toBeInTheDocument();
    expect(screen.getByText('All matches reviewed')).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    let fail = true;
    mockApi({
      ...signedIn,
      'GET /matches/today': () => (fail ? { status: 500, error: { code: 'server_error', message: 'x' } } : { total: 1, reviewed: 0, items: items.slice(0, 1) }),
    });
    renderAt('/today');
    expect(await screen.findByText('We could not load your matches.')).toBeInTheDocument();
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 new match is ready for your review.')).toBeInTheDocument();
  });
});

const matchDetail = (route: 'email' | 'form') => ({
  id: 'm1',
  score: 91,
  reasons: ['Skills reason.', 'Location reason.', 'Salary reason.'],
  reasonLine: 'Line.',
  status: 'viewed',
  job: {
    ...job({ applyRoute: route }),
    description: 'Northfield Labs makes tools.',
    requirements: ['Node.js'],
    applyUrl: null,
  },
  documents: [
    { id: 'd1', type: 'cv', version: 1, editedByUser: false, updatedAt: '', blocks: [{ type: 'heading', segments: [{ text: 'Sam Carter', changed: false }] }, { type: 'paragraph', segments: [{ text: 'Built ', changed: false }, { text: 'React apps', changed: true }] }] },
    { id: 'd2', type: 'cover_letter', version: 1, editedByUser: false, updatedAt: '', blocks: [{ type: 'paragraph', segments: [{ text: 'Dear Hiring Team,', changed: false }] }] },
  ],
  application: null,
});

describe('Job review', () => {
  it('approves, counts down, and undoes', async () => {
    const { calls } = mockApi({
      ...signedIn,
      'GET /matches/m1': matchDetail('email'),
      'POST /matches/m1/approve': () => ({
        applicationId: 'a1',
        scheduledSendAt: new Date(Date.now() + 10_000).toISOString(),
        status: 'approved',
        sentAt: null,
        undoWindowSeconds: 10,
      }),
      'POST /applications/a1/undo': { ok: true },
    });
    renderAt('/jobs/m1');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Full-Stack Developer' })).toBeInTheDocument();
    expect(screen.getByText('Match score')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('Posted 2 days ago')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((li) => li.textContent?.endsWith('reason.'))).toHaveLength(3);
    expect(screen.getByText('React apps')).toHaveClass('t');
    expect(screen.getByText('Nothing is sent until you approve it.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve and apply' }));
    expect(await screen.findByRole('heading', { name: 'Your application is on its way.' })).toBeInTheDocument();
    expect(screen.getByText(/We will send your CV and cover letter to Northfield Labs in \d+ seconds/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Approved. You can undo for 10 seconds.');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('button', { name: 'Approve and apply' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/applications/a1/undo')).toBe(true);
    expect(calls.find((c) => c.path === '/matches/m1/approve')?.body).toHaveProperty('idempotencyKey');
  });

  it('switches documents with the tabs', async () => {
    mockApi({ ...signedIn, 'GET /matches/m1': matchDetail('email') });
    renderAt('/jobs/m1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Cover letter' }));
    expect(screen.getByRole('tab', { name: 'Cover letter' })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('tabpanel')).getByText('Dear Hiring Team,')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'CV' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Check answers', () => {
  it('keeps Approve disabled until every answer is filled in', async () => {
    mockApi({
      ...signedIn,
      'GET /matches/m1': matchDetail('form'),
      'GET /matches/m1/answers': {
        company: 'Northfield Labs',
        answers: [
          { id: 'f1', key: 'full_name', label: 'Full name', value: 'Sam Carter', source: 'cv', needsAttention: false, multiline: false, hint: 'From your CV.' },
          { id: 'f2', key: 'notice_period', label: 'Notice period', value: '', source: 'profile', needsAttention: true, multiline: false, hint: 'Needs your answer.' },
        ],
      },
    });
    renderAt('/jobs/m1/answers');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Check your answers' })).toBeInTheDocument();
    const approve = screen.getByRole('button', { name: 'Approve and apply' });
    await waitFor(() => expect(screen.getByLabelText('Notice period')).toBeInTheDocument());
    expect(approve).toBeDisabled();
    expect(screen.getByText('Add your notice period to continue.')).toBeInTheDocument();
    expect(screen.getByText('Needs your answer. We could not find this in your CV.')).toBeInTheDocument();
    expect(screen.getByLabelText('Notice period')).toHaveClass('warn');

    await user.type(screen.getByLabelText('Notice period'), 'One month');
    expect(approve).toBeEnabled();
    expect(screen.getByText('Nothing is sent until you approve it.')).toBeInTheDocument();
  });
});

describe('Applications', () => {
  const rows = [
    { id: 'a1', status: 'applied', route: 'email', scheduledSendAt: null, sentAt: '2026-10-12', undoneAt: null, sendError: null, approvedAt: '2026-10-12T10:00:00Z', matchId: 'm1', job: job({ title: 'Full-Stack Developer', company: 'Ferngate Systems' }) },
    { id: 'a2', status: 'rejected', route: 'email', scheduledSendAt: null, sentAt: '2026-09-28', undoneAt: null, sendError: null, approvedAt: '2026-09-28T10:00:00Z', matchId: 'm2', job: job({ title: 'Frontend Developer', company: 'Brightwater Health' }) },
  ];

  it('filters with the tabs', async () => {
    const { calls } = mockApi({
      ...signedIn,
      'GET /applications?filter=all': rows,
      'GET /applications?filter=active': rows.slice(0, 1),
      'GET /applications?filter=closed': rows.slice(1),
    });
    renderAt('/applications');
    const user = userEvent.setup();

    expect((await screen.findAllByText('Ferngate Systems')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('12 Oct 2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Closed' }));
    await waitFor(() => expect(screen.queryAllByText('Ferngate Systems')).toHaveLength(0));
    expect(screen.getAllByText('Brightwater Health').length).toBeGreaterThan(0);
    expect(calls.some((c) => c.path === '/applications?filter=closed')).toBe(true);

    await user.click(screen.getByRole('tab', { name: 'Active' }));
    await waitFor(() => expect(screen.queryAllByText('Brightwater Health')).toHaveLength(0));
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the empty state', async () => {
    mockApi({ ...signedIn, 'GET /applications?filter=all': [] });
    renderAt('/applications');
    expect(await screen.findByText('You have not applied to anything yet.')).toBeInTheDocument();
  });
});
