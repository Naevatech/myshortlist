import { describe, expect, it } from 'vitest';
import { formatPostedAge } from '../lib/postedAge';

const now = new Date('2026-10-21T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('formatPostedAge', () => {
  it.each([
    [0, 'Posted today'],
    [1, 'Posted 1 day ago'],
    [2, 'Posted 2 days ago'],
    [6, 'Posted 6 days ago'],
    [7, 'Posted 1 week ago'],
    [13, 'Posted 1 week ago'],
    [14, 'Posted 2 weeks ago'],
  ])('%i days → %s', (days, text) => {
    expect(formatPostedAge(daysAgo(days), now)).toBe(text);
  });

  it('counts part days as whole days', () => {
    expect(formatPostedAge(daysAgo(0.9), now)).toBe('Posted today');
    expect(formatPostedAge(daysAgo(1.5), now).toString()).toBe('Posted 1 day ago');
  });
});
