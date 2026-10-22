import { useRef, useState, type DragEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useConfig } from '../../lib/auth';
import { formatBytes } from '../../lib/format';
import type { CvSummary } from '../../lib/types';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';

export type CvPhase = 'cv' | 'reading' | 'found' | 'failed';

const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const READ_FAILED = 'We could not read this file. Try a PDF or Word document.';

interface Props {
  phase: CvPhase;
  setPhase: (p: CvPhase) => void;
  summary: CvSummary | null;
  setSummary: (s: CvSummary) => void;
  onConfirm: () => void;
}

function skillsLine(skills: string[]): string {
  if (!skills.length) return '';
  if (skills.length <= 4) return skills.length === 1 ? skills[0] : `${skills.slice(0, -1).join(', ')} and ${skills[skills.length - 1]}`;
  return `${skills.slice(0, 4).join(', ')} and ${skills.length - 4} more`;
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className="kv found" style={last ? { borderBottom: '1px solid var(--line)' } : undefined}>
      <dt className="sm mut">{label}</dt>
      <dd className={value ? undefined : 'mut'}>{value || 'Not found in your CV'}</dd>
    </div>
  );
}

/** Upload, reading, "Here is what we found" and failure, as one step. */
export function UploadCv({ phase, setPhase, summary, setSummary, onConfirm }: Props) {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const maxMb = config?.maxCvSizeMb ?? 5;
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [failure, setFailure] = useState(READ_FAILED);
  const [over, setOver] = useState(false);

  const upload = useMutation({
    mutationFn: (f: File) => {
      const body = new FormData();
      body.append('file', f);
      return api.post<CvSummary>('/cv', body);
    },
    onSuccess: (s) => {
      setSummary(s);
      setPhase('found');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['cv'] });
    },
    onError: (err) => {
      setFailure(err instanceof ApiError && err.status === 400 ? err.message : READ_FAILED);
      setPhase('failed');
    },
  });

  const handle = (f: File | undefined) => {
    if (!f) return;
    const okType = /\.(pdf|docx)$/i.test(f.name);
    if (!okType) {
      setFailure(READ_FAILED);
      setPhase('failed');
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      setFailure(`That file is larger than ${maxMb} MB. Try a smaller PDF or Word document.`);
      setPhase('failed');
      return;
    }
    setFile({ name: f.name, size: f.size });
    setPhase('reading');
    upload.mutate(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    handle(e.dataTransfer.files?.[0]);
  };

  const picker = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      className="sr"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        handle(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  if (phase === 'reading') {
    return (
      <>
        <div className="v g16">
          <h1>Reading your CV</h1>
          <p className="mut">This takes a few seconds.</p>
        </div>
        <div className="box v g24" aria-busy="true">
          <div className="h sp g16">
            <span className="sm med" style={{ overflowWrap: 'anywhere' }}>
              {file?.name}
            </span>
            <span className="sm mut" style={{ whiteSpace: 'nowrap' }}>
              {file ? formatBytes(file.size) : ''}
            </span>
          </div>
          <div className="v g16">
            <Skeleton width="92%" />
            <Skeleton width="74%" />
            <Skeleton width="84%" />
            <Skeleton width="52%" />
          </div>
        </div>
      </>
    );
  }

  if (phase === 'found' && summary) {
    const years = summary.yearsExperience;
    return (
      <>
        <div className="v g16">
          <h1>Here is what we found</h1>
          <p className="mut">Check this looks right. You can change any of it later in Profile.</p>
        </div>
        <dl className="v">
          <Row label="Name" value={summary.name} />
          <Row label="Latest role" value={summary.latestRole} />
          <Row label="Experience" value={years === null ? '' : years === 1 ? '1 year' : `${years} years`} />
          <Row label="Skills" value={skillsLine(summary.skills)} />
          <Row label="Education" value={summary.education} last />
        </dl>
        <div className="v g8">
          <Button action onClick={onConfirm}>
            Looks right
          </Button>
          <Button variant="text" action onClick={() => setPhase('cv')}>
            Replace CV
          </Button>
        </div>
      </>
    );
  }

  if (phase === 'failed') {
    return (
      <>
        <div className="v g16" role="alert">
          <h1>Upload your CV</h1>
          <p className="err-t">{failure}</p>
        </div>
        {picker}
        <Button variant="outline" action onClick={() => input.current?.click()}>
          Try again
        </Button>
      </>
    );
  }

  return (
    <>
      <div className="v g16">
        <h1>Upload your CV</h1>
        <p className="mut">We read it to find roles that suit you. PDF or Word, up to {maxMb} MB.</p>
      </div>
      <div
        className={over ? 'drop over' : 'drop'}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <p className="only-d">Drag your CV here</p>
        <p className="sm mut only-d">or</p>
        {picker}
        <Button variant="outline" onClick={() => input.current?.click()}>
          Browse files
        </Button>
        <p className="xs mut">PDF or DOCX</p>
      </div>
    </>
  );
}
