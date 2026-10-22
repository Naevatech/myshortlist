import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusHeading, useTitle } from '../../lib/hooks';
import type { CvSummary } from '../../lib/types';
import { AppShell } from '../../components/AppShell';
import { BackButton, BackLink } from '../../components/Button';
import { UploadCv, type CvPhase } from './UploadCv';

/** Profile › Replace CV: the same upload and "Here is what we found" screens as onboarding. */
export default function ReplaceCv() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<CvPhase>('cv');
  const [summary, setSummary] = useState<CvSummary | null>(null);
  useTitle(phase === 'found' ? 'Here is what we found' : 'Replace your CV');
  useFocusHeading(phase);

  return (
    <AppShell>
      <div className="v g32 narrow">
        {phase === 'found' ? <BackButton onClick={() => setPhase('cv')}>Back</BackButton> : <BackLink to="/profile">Profile</BackLink>}
        <div className="v g48 fade-in" key={phase}>
          <UploadCv phase={phase} setPhase={setPhase} summary={summary} setSummary={setSummary} onConfirm={() => navigate('/profile')} />
        </div>
      </div>
    </AppShell>
  );
}
