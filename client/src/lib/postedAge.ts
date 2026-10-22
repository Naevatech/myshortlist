/** "Posted 2 days ago". Never a raw date or time. Jobs are at most two weeks old. */
export function formatPostedAge(postedAt: string | Date, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(postedAt).getTime()) / 86_400_000);
  if (days < 1) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 14) return 'Posted 1 week ago';
  return 'Posted 2 weeks ago';
}
