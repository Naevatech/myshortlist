import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useTitle } from '../../lib/hooks';
import type { AtsResult, AtsSetup as Setup } from '../../lib/types';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ScorePill } from '../../components/ScorePill';
import { Skeleton } from '../../components/Skeleton';
import '../../styles/ats.css';

type JobMode = 'match' | 'paste' | 'none';
const STEP_MS = 550;

export function AtsHeader() {
  return (
    <header className="v g8">
      <p className="sm mut">Tools</p>
      <h1>ATS checker</h1>
      <p className="t18 mut">See your CV the way application software reads it, then fix what blocks you.</p>
    </header>
  );
}

function foundWhen(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(Date.now() - days * 86_400_000));
  return `${days} days ago`;
}

/** Live steps while the check runs. The last step waits for the server. */
function Scanning({ title, withJob, done }: { title: string; withJob: boolean; done: boolean }) {
  const steps = ['Reading your CV', 'Finding sections and fields', 'Checking formatting', ...(withJob ? ['Matching keywords to the job'] : []), 'Scoring'];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, done ? steps.length : steps.length - 1)), STEP_MS);
    return () => clearInterval(t);
  }, [done, steps.length]);
  return (
    <section className="at-card" aria-busy="true" style={{ maxWidth: 640 }}>
      <h2>{title}</h2>
      <p className="sr" role="status">
        Checking your CV.
      </p>
      <ul className="scan" aria-hidden="true">
        {steps.map((label, i) => (
          <li key={label}>
            <span className={i < step ? 'sdot ok' : i === step ? 'sdot on' : 'sdot'} />
            <span className={i <= step ? undefined : 'mut'}>{label}</span>
          </li>
        ))}
      </ul>
      <div className="prog" aria-hidden="true" style={{ position: 'static' }}>
        <i style={{ width: `${Math.round((step / steps.length) * 100)}%` }} />
      </div>
    </section>
  );
}

export default function AtsSetup() {
  useTitle('ATS checker');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setup = useQuery({ queryKey: ['ats', 'setup'], queryFn: () => api.get<Setup>('/tools/ats/setup') });
  const [cvSource, setCvSource] = useState<'current' | 'upload'>('current');
  const [file, setFile] = useState<File | null>(null);
  const [jobMode, setJobMode] = useState<JobMode>('match');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [jobText, setJobText] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState<{ title: string; withJob: boolean } | null>(null);
  const [result, setResult] = useState<AtsResult | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Sensible defaults once we know what there is.
  useEffect(() => {
    if (!setup.data) return;
    if (!setup.data.cv) setCvSource('upload');
    if (!setup.data.jobs.length) setJobMode('paste');
    else setMatchId((m) => m ?? setup.data.jobs[0].matchId);
  }, [setup.data]);

  const run = useMutation({
    mutationFn: () => {
      const body = new FormData();
      body.append('cvSource', cvSource);
      body.append('jobSource', jobMode);
      if (jobMode === 'match' && matchId) body.append('matchId', matchId);
      if (jobMode === 'paste') body.append('jobText', jobText);
      if (cvSource === 'upload' && file) body.append('file', file);
      return api.post<AtsResult>('/tools/ats/checks', body);
    },
    onSuccess: (r) => {
      queryClient.setQueryData(['ats', 'check', r.id], r);
      setResult(r);
    },
    onError: (err) => {
      setScanning(null);
      setError(err instanceof ApiError ? err.message : 'Check your connection and try again.');
    },
  });

  // Move to the results once the steps have played and the check is back.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => navigate(`/tools/ats/${result.id}`), STEP_MS * 2);
    return () => clearTimeout(t);
  }, [result, navigate]);

  const start = () => {
    const job = setup.data?.jobs.find((j) => j.matchId === matchId);
    if (cvSource === 'upload' && !file) return setError('Choose a CV to check.');
    if (jobMode === 'match' && !job) return setError('Choose a job, or switch to a general check.');
    if (jobMode === 'paste' && jobText.trim().split(/\s+/).length < 30) return setError('Paste the full job advert, at least a few sentences.');
    setError('');
    setScanning({
      title: jobMode === 'match' && job ? `Checking your CV against ${job.title}, ${job.company}` : jobMode === 'paste' ? 'Checking your CV against the job' : 'Checking your CV',
      withJob: jobMode !== 'none',
    });
    run.mutate();
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const maxMb = setup.data?.maxCvSizeMb ?? 5;
    if (!/\.(pdf|docx)$/i.test(f.name)) return setError('Choose a PDF or Word document.');
    if (f.size > maxMb * 1024 * 1024) return setError(`That file is larger than ${maxMb} MB.`);
    setError('');
    setFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  let body;
  if (scanning) {
    body = <Scanning title={scanning.title} withJob={scanning.withJob} done={Boolean(result)} />;
  } else if (setup.isPending) {
    body = (
      <div className="at-steps" aria-busy="true">
        <span className="sr">Loading</span>
        {[0, 1].map((i) => (
          <div key={i} className="at-card">
            <Skeleton width="40%" height={18} />
            <Skeleton width="100%" height={64} />
            <Skeleton width="100%" height={64} />
          </div>
        ))}
      </div>
    );
  } else if (setup.isError) {
    body = (
      <div className="v g24" style={{ maxWidth: 520 }} role="alert">
        <p className="mut">We could not load the checker. Check your connection and try again.</p>
        <Button action onClick={() => setup.refetch()}>
          Try again
        </Button>
      </div>
    );
  } else {
    const data = setup.data;
    body = (
      <>
        <div className="at-steps">
          <section className="at-card" aria-labelledby="ats-s1">
            <div className="h g8">
              <span className="at-n" aria-hidden="true">
                1
              </span>
              <h2 id="ats-s1">Your CV</h2>
            </div>
            <div className="v g8" role="radiogroup" aria-labelledby="ats-s1">
              {data.cv && (
                <button className="pick" type="button" role="radio" aria-checked={cvSource === 'current'} onClick={() => setCvSource('current')}>
                  <span className="rd" aria-hidden="true" />
                  <span className="v">
                    <span className="med">{data.cv.fileName}</span>
                    <span className="sm mut">Your current CV · updated {formatDate(data.cv.updatedAt)}</span>
                  </span>
                </button>
              )}
              <button className="pick" type="button" role="radio" aria-checked={cvSource === 'upload'} onClick={() => setCvSource('upload')}>
                <span className="rd" aria-hidden="true" />
                <span className="v">
                  <span className="med">Upload a different CV</span>
                  <span className="sm mut">PDF or Word, up to {data.maxCvSizeMb} MB. Used for this check only.</span>
                </span>
              </button>
            </div>
            {cvSource === 'upload' && (
              <div
                className={over ? 'drop over' : 'drop'}
                style={{ padding: '32px 16px' }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
              >
                <p className="sm mut">{file ? file.name : 'Drag your CV here or'}</p>
                <input
                  ref={input}
                  type="file"
                  accept=".pdf,.docx"
                  className="sr"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <Button variant="outline" onClick={() => input.current?.click()}>
                  {file ? 'Choose another file' : 'Browse files'}
                </Button>
              </div>
            )}
          </section>

          <section className="at-card" aria-labelledby="ats-s2">
            <div className="h g8">
              <span className="at-n" aria-hidden="true">
                2
              </span>
              <h2 id="ats-s2">The job</h2>
            </div>
            <div className="seg2" role="group" aria-label="Choose the job">
              {(
                [
                  ['match', 'From your matches'],
                  ['paste', 'Paste a job description'],
                  ['none', 'General check'],
                ] as Array<[JobMode, string]>
              ).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={jobMode === id} onClick={() => setJobMode(id)}>
                  {label}
                </button>
              ))}
            </div>
            {jobMode === 'match' &&
              (data.jobs.length ? (
                <div className="v g8" role="radiogroup" aria-label="Your matches">
                  {data.jobs.map((j) => (
                    <button key={j.matchId} className="pick" type="button" role="radio" aria-checked={matchId === j.matchId} onClick={() => setMatchId(j.matchId)}>
                      <span className="rd" aria-hidden="true" />
                      <span className="v" style={{ flex: 1, minWidth: 0 }}>
                        <span className="med">{j.title}</span>
                        <span className="sm mut">
                          {j.company} · {foundWhen(j.foundDaysAgo)}
                        </span>
                      </span>
                      <ScorePill score={j.score} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="sm mut">You have no recent matches. Paste a job description instead, or run a general check.</p>
              ))}
            {jobMode === 'paste' && (
              <div className="fld">
                <label className="lbl" htmlFor="ats-jd">
                  Job description
                </label>
                <textarea
                  className="in"
                  id="ats-jd"
                  value={jobText}
                  maxLength={50_000}
                  onChange={(e) => setJobText(e.target.value)}
                  placeholder="Paste the full job advert. The more detail, the better the keyword check."
                />
              </div>
            )}
            {jobMode === 'none' && <p className="sm mut">Checks formatting, sections, contact details and readability only. Add a job to also check keywords.</p>}
          </section>
        </div>
        {error && (
          <p className="sm err-t" role="alert">
            {error}
          </p>
        )}
        <div className="h wrap g16">
          <Button onClick={start} disabled={run.isPending}>
            Check my CV
          </Button>
          <p className="sm mut">Your CV stays private. We only use it for this check.</p>
        </div>
      </>
    );
  }

  return (
    <AppShell>
      <div className="colw v g32 ats" style={{ maxWidth: 1120 }}>
        <AtsHeader />
        {body}
      </div>
    </AppShell>
  );
}
