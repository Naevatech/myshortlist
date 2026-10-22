import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CONFIG, job, ME, mockApi, renderAt } from './utils';

const signedOut = { 'GET /me': { status: 401, error: { code: 'unauthorized', message: 'Please sign in.' } }, 'GET /config': CONFIG };
const signedIn = { 'GET /me': ME, 'GET /config': CONFIG };

describe('sign in', () => {
  it('shows one message above both fields and marks both red', async () => {
    mockApi({
      ...signedOut,
      'POST /auth/signin': { status: 401, error: { code: 'invalid_credentials', message: 'That email or password is not right. Try again.' } },
    });
    renderAt('/signin');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email address'), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That email or password is not right. Try again.');
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    // The message comes before the fields.
    expect(alert.compareDocumentPosition(screen.getByLabelText('Email address')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the lockout message after too many attempts', async () => {
    mockApi({ ...signedOut, 'POST /auth/signin': { status: 429, error: { code: 'locked', message: 'Too many attempts. Try again in 15 minutes.' } } });
    renderAt('/signin');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email address'), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 15 minutes.');
  });

  it('shows and hides the password', async () => {
    mockApi(signedOut);
    renderAt('/signin');
    const user = userEvent.setup();
    const toggle = await screen.findByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('returns the user to the page they asked for', async () => {
    let signedInNow = false;
    mockApi({
      'GET /config': CONFIG,
      'GET /me': () => (signedInNow ? ME : { status: 401, error: { code: 'unauthorized', message: 'x' } }),
      'POST /auth/signin': () => {
        signedInNow = true;
        return { user: ME, needsVerify: false, needsOnboarding: false };
      },
      'GET /applications?filter=all': [],
    });
    renderAt('/applications');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email address'), 'sam@example.com');
    await user.type(screen.getByLabelText('Password'), 'Correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument();
  });
});

describe('route guards', () => {
  it('sends a signed-out visitor to sign in', async () => {
    mockApi(signedOut);
    renderAt('/today');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it.each(['/', '/signin', '/signup', '/forgot', '/signed-out'])('sends a signed-in user away from %s', async (path) => {
    mockApi({ ...signedIn, 'GET /matches/today': { total: 0, reviewed: 0, items: [] } });
    renderAt(path);
    expect(await screen.findByText('There are no new matches today.')).toBeInTheDocument();
  });

  it('sends an unverified account to Check your email', async () => {
    mockApi({ ...signedIn, 'GET /me': { ...ME, emailVerified: false } });
    renderAt('/today');
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/sam.carter@example.com/)).toBeInTheDocument();
  });
});

describe('forgot and reset password', () => {
  it('always shows Check your email after sending', async () => {
    mockApi({ ...signedOut, 'POST /auth/forgot': { ok: true } });
    renderAt('/forgot');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email address'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/If there is an account for nobody@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send the link again/ })).toBeDisabled();
  });

  it('shows Expired straight away for a bad link', async () => {
    mockApi({ ...signedOut, 'GET /auth/reset/validate': { status: 410, error: { code: 'link_expired', message: 'x' } } });
    renderAt('/reset?token=old-token-123');
    expect(await screen.findByRole('heading', { name: 'This link has expired.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('href', '/forgot');
  });

  it('checks the passwords match, then shows Done', async () => {
    mockApi({ ...signedOut, 'GET /auth/reset/validate': { ok: true }, 'POST /auth/reset': { ok: true } });
    renderAt('/reset?token=good-token-123');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('New password'), 'Brand-new-pass-7');
    await user.type(screen.getByLabelText('Confirm new password'), 'Something-else-7');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByText('The passwords do not match.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'Brand-new-pass-7');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByRole('heading', { name: 'You can sign in now.' })).toBeInTheDocument();
    expect(screen.getByText('Password updated')).toBeInTheDocument();
  });
});

describe('settings', () => {
  const settings = {
    email: 'sam.carter@example.com',
    signInMethod: 'password',
    hasPassword: true,
    passwordChangedAt: '2026-09-03T10:00:00Z',
    notifyNewMatches: true,
    notifyAppUpdates: true,
    matchesPerDay: 5,
    matchesPerDayOptions: [3, 5, 10, 15, 20, 25, 30],
  };

  it('offers seven matches-per-day options and sends a password link', async () => {
    const { calls } = mockApi({
      ...signedIn,
      'GET /settings': settings,
      'POST /me/password/reset-link': { ok: true, email: 'sam.carter@example.com', expiresInMinutes: 30 },
    });
    renderAt('/settings');
    const user = userEvent.setup();
    const group = await screen.findByRole('group', { name: 'Matches per day' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['3', '5', '10', '15', '20', '25', '30']);
    expect(screen.getByText('Last changed 3 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('Email and password')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('We have sent a link to sam.carter@example.com. It expires in 30 minutes.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/me/password/reset-link')).toBe(true);
  });

  it('hides the password row for Google-only accounts', async () => {
    mockApi({ ...signedIn, 'GET /settings': { ...settings, signInMethod: 'google', hasPassword: false, passwordChangedAt: null } });
    renderAt('/settings');
    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
  });

  it('asks before signing out, then shows Signed out', async () => {
    let out = false;
    const { calls } = mockApi({
      'GET /config': CONFIG,
      'GET /me': () => (out ? { status: 401, error: { code: 'unauthorized', message: 'x' } } : ME),
      'GET /settings': settings,
      'POST /auth/logout': () => {
        out = true;
        return { ok: true };
      },
    });
    renderAt('/settings');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign out of Shortlist?' });
    expect(within(dialog).getByText('You can sign back in at any time.')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path === '/auth/logout')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'You have signed out.' })).toBeInTheDocument();
  });
});

describe('accessibility', () => {
  it('hides sidebar icons from screen readers and labels the score pill', async () => {
    mockApi({
      ...signedIn,
      'GET /matches/today': { total: 1, reviewed: 0, items: [{ id: 'm1', score: 94, reasonLine: 'Reason.', status: 'new', job: job() }] },
    });
    renderAt('/today');
    await screen.findByText('Reason.');
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0];
    const icons = nav.querySelectorAll('svg');
    expect(icons.length).toBe(6); // four links, dark mode and log out
    icons.forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
    await waitFor(() => expect(screen.getByText('94%').textContent).toBe('94% match score'));
  });
});
