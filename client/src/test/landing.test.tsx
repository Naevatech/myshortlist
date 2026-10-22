import { describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CONFIG, mockApi, renderAt } from './utils';

const signedOut = { 'GET /me': { status: 401, error: { code: 'unauthorized', message: 'x' } }, 'GET /config': CONFIG };

async function openLanding() {
  mockApi(signedOut);
  renderAt('/');
  await screen.findByRole('heading', { level: 1, name: /Apply to the right jobs/ });
}

describe('landing page', () => {
  it('points every link at a real place: a section on the page or an app route', async () => {
    await openLanding();
    const links = screen.getAllByRole('link');
    const sections = new Set(Array.from(document.querySelectorAll('[id]')).map((el) => `#${el.id}`));
    const routes = new Set(['/signup', '/signin', '/privacy', '/terms', '/cookies', '/contact']);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href, `"${link.textContent}" has no destination`).not.toBe('#');
      if (href.startsWith('#')) expect(sections.has(href), `${href} does not exist on the page`).toBe(true);
      else expect(routes.has(href), `${href} is not a route`).toBe(true);
    }
    expect(screen.getAllByRole('link', { name: /^Get started/ }).every((a) => a.getAttribute('href') === '/signup')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Sign in' }).every((a) => a.getAttribute('href') === '/signin')).toBe(true);
  });

  it('opens Create account from Get started and Sign in from Sign in', async () => {
    await openLanding();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('link', { name: /^Get started/ })[0]);
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  });

  it('opens the footer pages', async () => {
    await openLanding();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Cookies' }));
    expect(await screen.findByRole('heading', { name: 'Cookies' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Terms' }));
    expect(await screen.findByRole('heading', { name: 'Terms' })).toBeInTheDocument();
  });

  it('steps through How it works with tabs and arrows', async () => {
    await openLanding();
    const user = userEvent.setup();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText("Today's matches")).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Approve, and we apply' }));
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to the first step' }));
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('expands a different way to apply when its tab is chosen', async () => {
    await openLanding();
    const user = userEvent.setup();
    const formTab = screen.getByRole('button', { name: 'Form filled for you' });
    expect(formTab).toHaveAttribute('aria-expanded', 'false');
    await user.click(formTab);
    expect(formTab).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Sent by email' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('runs the approve demo: countdown, undo, skip and sent', async () => {
    await openLanding();
    const card = screen.getByRole('heading', { name: 'Nothing leaves without you.' }).closest('article')!;
    const user = userEvent.setup();

    await user.click(within(card).getByRole('button', { name: 'Approve and apply' }));
    expect(within(card).getByRole('status')).toHaveTextContent('Approved. You can undo for 10 seconds.');
    await user.click(within(card).getByRole('button', { name: 'Undo' }));
    expect(within(card).getByRole('button', { name: 'Approve and apply' })).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Skip' }));
    expect(within(card).getByText('Skipped. Nothing was sent.')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Show it again' }));

    vi.useFakeTimers();
    try {
      act(() => within(card).getByRole('button', { name: 'Approve and apply' }).click());
      act(() => vi.advanceTimersByTime(10_000));
      expect(within(card).getByText('Application sent.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
