import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultiProvider } from '../src/services/jobs/multi.js';
import { createJobProvider } from '../src/services/jobs/index.js';
import type { JobProvider, RawJob } from '../src/services/jobs/types.js';
import { AdzunaProvider, mapAdzunaJob } from '../src/services/jobs/adzuna.js';
import { mapReedJob, ReedProvider } from '../src/services/jobs/reed.js';
import { inferWorkMode, stripHtml } from '../src/services/jobs/util.js';

const search = { roles: ['Frontend Engineer', 'React Developer'], location: 'Belfast', radiusMiles: 15, workModes: ['hybrid'], minSalary: 45000, limit: 10, postedAfter: new Date(Date.now() - 14 * 86_400_000), postedBefore: new Date() };

function stubFetch(body: unknown) {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init?: RequestInit) => {
      calls.push({ url: new URL(url), init });
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('listing text helpers', () => {
  it('strips HTML and entities', () => {
    expect(stripHtml('<p>React &amp; TypeScript</p><ul><li>Hybrid</li></ul>')).toBe('React & TypeScript\n• Hybrid');
  });

  it('reads the work mode from the text', () => {
    expect(inferWorkMode('Hybrid role, two days in the office')).toBe('hybrid');
    expect(inferWorkMode('Fully remote within the UK')).toBe('remote');
    expect(inferWorkMode('Based in our Belfast office')).toBe('onsite');
  });
});

describe('Adzuna', () => {
  const result = {
    id: 4321,
    title: '<strong>Frontend</strong> Engineer',
    description: 'Join our hybrid team building React apps&hellip;',
    created: '2026-10-19T08:00:00Z',
    redirect_url: 'https://www.adzuna.co.uk/jobs/land/ad/4321',
    salary_min: 48000,
    salary_max: 58000,
    salary_is_predicted: '0',
    company: { display_name: 'Acme Ltd' },
    location: { display_name: 'Belfast, County Antrim', area: ['UK', 'Northern Ireland', 'County Antrim', 'Belfast'] },
  };

  it('maps a result to a job finished on their site', () => {
    expect(mapAdzunaJob(result)).toMatchObject({
      externalId: '4321',
      title: 'Frontend Engineer',
      company: 'Acme Ltd',
      location: 'Belfast',
      workMode: 'hybrid',
      salaryMin: 48000,
      salaryMax: 58000,
      applyRoute: 'site',
      applyUrl: 'https://www.adzuna.co.uk/jobs/land/ad/4321',
    });
  });

  it('drops salaries Adzuna estimated', () => {
    const job = mapAdzunaJob({ ...result, salary_is_predicted: '1' });
    expect(job.salaryMin).toBeUndefined();
    expect(job.salaryMax).toBeUndefined();
  });

  it('searches each role near the location and removes duplicates', async () => {
    const calls = stubFetch({ results: [result] });
    const jobs = await new AdzunaProvider({ appId: 'id', appKey: 'key' }).search(search);
    expect(calls).toHaveLength(2);
    const u = calls[0].url;
    expect(u.pathname).toBe('/v1/api/jobs/gb/search/1');
    expect(u.searchParams.get('what')).toBe('Frontend Engineer');
    expect(u.searchParams.get('where')).toBe('Belfast');
    expect(u.searchParams.get('distance')).toBe('24');
    expect(u.searchParams.get('salary_min')).toBe('45000');
    expect(jobs).toHaveLength(1);
  });
});

describe('Reed', () => {
  const result = {
    jobId: 5555,
    employerName: 'Beta Systems',
    jobTitle: 'React Developer',
    locationName: 'Lisburn',
    minimumSalary: 42000,
    maximumSalary: 50000,
    date: '18/10/2026',
    jobDescription: 'Remote-first team. React and Node.js.',
    jobUrl: 'https://www.reed.co.uk/jobs/react-developer/5555',
  };

  it('maps a result and converts the date', () => {
    expect(mapReedJob(result)).toMatchObject({
      externalId: '5555',
      company: 'Beta Systems',
      location: 'Lisburn',
      workMode: 'remote',
      salaryMin: 42000,
      applyRoute: 'site',
      postedAt: '2026-10-18T09:00:00.000Z',
    });
  });

  it('ignores day and hour rates', () => {
    expect(mapReedJob({ ...result, minimumSalary: 450, maximumSalary: 550 }).salaryMin).toBeUndefined();
  });

  it('sends the key with basic auth and searches in miles', async () => {
    const calls = stubFetch({ results: [result] });
    await new ReedProvider('secret').search(search);
    const { url, init } = calls[0];
    expect(url.searchParams.get('keywords')).toBe('Frontend Engineer');
    expect(url.searchParams.get('distanceFromLocation')).toBe('15');
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('secret:').toString('base64')}`);
  });

  it('does not limit remote-only searches to a town', async () => {
    const calls = stubFetch({ results: [] });
    await new ReedProvider('secret').search({ ...search, workModes: ['remote'] });
    expect(calls[0].url.searchParams.has('locationName')).toBe(false);
  });
});

describe('several sources together', () => {
  const job = (id: string, title: string, company = 'Acme'): RawJob => ({
    externalId: id, title, company, location: 'Belfast', workMode: 'hybrid', description: '', requirements: [],
    postedAt: '2026-10-20T00:00:00Z', applyRoute: 'site', applyUrl: 'https://example.com',
  });
  const source = (name: string, jobs: RawJob[] | Error): JobProvider => ({
    name,
    search: async () => {
      if (jobs instanceof Error) throw jobs;
      return jobs;
    },
  });

  it('is chosen with a comma-separated JOB_PROVIDER', () => {
    expect(createJobProvider('adzuna,reed').name).toBe('adzuna+reed');
  });

  it('alternates sources, tags each job with its source and drops the same job listed twice', async () => {
    const p = new MultiProvider([
      source('adzuna', [job('1', 'Frontend Engineer'), job('2', 'React Developer')]),
      source('reed', [job('1', 'Front-end Engineer!', 'Other'), job('9', 'React developer')]),
    ]);
    const jobs = await p.search(search);
    expect(jobs.map((j) => `${j.provider}:${j.title}`)).toEqual([
      'adzuna:Frontend Engineer',
      'reed:Front-end Engineer!',
      'adzuna:React Developer',
    ]);
  });

  it('keeps going when one source fails, and fails only when all do', async () => {
    const ok = await new MultiProvider([source('adzuna', new Error('down')), source('reed', [job('5', 'Web Developer')])]).search(search);
    expect(ok).toHaveLength(1);
    await expect(
      new MultiProvider([source('adzuna', new Error('down')), source('reed', new Error('also down'))]).search(search),
    ).rejects.toThrow('down');
  });
});

describe('full job descriptions', () => {
  it('keeps headings and bullet points from the advert HTML', () => {
    const text = stripHtml('<p><strong>About us</strong></p><p>We build tools.</p><h3>What you will do</h3><ul><li>Build features</li><li>Review code</li></ul>');
    expect(text.split('\n')).toEqual(['## About us', 'We build tools.', '## What you will do', '• Build features', '• Review code']);
  });

  it('reads the contract type and reference from each source', async () => {
    const { jobFacts } = await import('../src/services/jobs/details.js');
    const base = { externalId: '42', rawJson: {} } as never;
    expect(jobFacts({ ...(base as object), provider: 'adzuna', rawJson: { contract_type: 'permanent', contract_time: 'full_time' } } as never)).toMatchObject({
      contract: 'Permanent, full time',
      reference: 'Adzuna 42',
      partial: true,
    });
    expect(jobFacts({ ...(base as object), provider: 'reed', rawJson: { contractType: 'Contract', partTime: true, __full: true } } as never)).toMatchObject({
      contract: 'Contract, part time',
      reference: 'Reed 42',
      partial: false,
    });
    expect(jobFacts({ ...(base as object), provider: 'placeholder', rawJson: { contract: 'Permanent, full time', reference: 'HM-1' } } as never)).toMatchObject({
      contract: 'Permanent, full time',
      reference: 'HM-1',
      partial: false,
    });
  });

  it('asks Reed for the full advert', async () => {
    const calls = stubFetch({ jobDescription: '<p><strong>The role</strong></p><p>Full text here.</p>', contractType: 'Permanent', fullTime: true });
    const d = await new ReedProvider('secret').details('5555');
    expect(calls[0].url.pathname).toBe('/api/1.0/jobs/5555');
    expect(d?.description).toBe('## The role\nFull text here.');
    expect(d?.raw).toMatchObject({ contractType: 'Permanent', fullTime: true });
  });
});
