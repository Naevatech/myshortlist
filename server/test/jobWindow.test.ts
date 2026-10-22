import { describe, expect, it } from 'vitest';
import { ageInDays, jobWindow, withinWindow } from '../src/services/jobs/index.js';
import { placeholderJobs } from '../src/services/jobs/placeholder.js';
import type { RawJob } from '../src/services/jobs/types.js';
import { mapAdzunaJob } from '../src/services/jobs/adzuna.js';
import { mapReedJob } from '../src/services/jobs/reed.js';

const now = new Date('2026-10-21T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const job = (id: string, postedAt: string): RawJob => ({
  externalId: id, title: id, company: 'Acme', location: 'Belfast', workMode: 'hybrid', description: '',
  requirements: [], postedAt, applyRoute: 'site',
});

describe('job window', () => {
  it('drops jobs older than the maximum, newer than the minimum, or without a date, and sorts newest first', () => {
    const jobs = [job('old', daysAgo(15)), job('edge', daysAgo(14)), job('mid', daysAgo(6)), job('today', daysAgo(0)), job('nodate', ''), job('bad', 'not a date')];
    expect(withinWindow(jobs, now, jobWindow(now, 14, 0)).map((j) => j.externalId)).toEqual(['today', 'mid', 'edge']);
    expect(withinWindow(jobs, now, jobWindow(now, 14, 1)).map((j) => j.externalId)).toEqual(['mid', 'edge']);
    expect(withinWindow(jobs, now, jobWindow(now, 7, 0)).map((j) => j.externalId)).toEqual(['today', 'mid']);
  });

  it('counts whole days', () => {
    expect(ageInDays(daysAgo(0.5), now)).toBe(0);
    expect(ageInDays(daysAgo(13.9), now)).toBe(13);
    expect(ageInDays('', now)).toBeNull();
  });

  it('keeps every placeholder job inside the default window', () => {
    const sample = placeholderJobs(now);
    expect(sample.map((j) => ageInDays(j.postedAt, now))).toEqual([2, 1, 5, 7, 3, 14]);
    expect(withinWindow(sample, now, jobWindow(now, 14, 0))).toHaveLength(6);
  });

  it('never guesses a date for listings without one', () => {
    expect(mapAdzunaJob({ id: 1, title: 'x', redirect_url: 'https://a.example' }).postedAt).toBe('');
    expect(mapReedJob({ jobId: 1, jobTitle: 'x', jobUrl: 'https://r.example', date: '' }).postedAt).toBe('');
  });
});
