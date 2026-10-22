import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney, parseSalary } from '../../lib/format';
import { useFocusHeading, useTitle } from '../../lib/hooks';
import type { CvSummary, Preferences } from '../../lib/types';
import { BareLayout } from '../../components/AppShell';
import { BackButton } from '../../components/Button';
import { UploadCv, type CvPhase } from './UploadCv';
import { Roles } from './Roles';
import { WhereHow, type WhereDraft } from './WhereHow';
import { WorkAuth } from './WorkAuth';
import { Ready } from './Ready';

type Step = 'cv' | 'roles' | 'where' | 'auth' | 'ready';
const STEP_NUMBER: Record<Step, number> = { cv: 1, roles: 2, where: 3, auth: 4, ready: 4 };
const TITLES: Record<string, string> = {
  cv: 'Upload your CV',
  reading: 'Reading your CV',
  found: 'Here is what we found',
  failed: 'Upload your CV',
  roles: 'Roles',
  where: 'Where and how',
  auth: 'Work authorisation',
  ready: 'You are ready',
};

/** Four steps, one question per screen. */
export default function Onboarding() {
  const [step, setStep] = useState<Step>('cv');
  const [cvPhase, setCvPhase] = useState<CvPhase>('cv');
  const [summary, setSummary] = useState<CvSummary | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [where, setWhere] = useState<WhereDraft>({ location: '', radiusMiles: 15, workStyles: [], salary: '' });
  const [auth, setAuth] = useState({ rightToWork: true, sponsorship: false });
  const [loaded, setLoaded] = useState(false);

  const screen = step === 'cv' ? cvPhase : step;
  useTitle(TITLES[screen]);
  useFocusHeading(screen);

  const cv = useQuery({ queryKey: ['cv', 'active'], queryFn: () => api.get<CvSummary | null>('/cv/active') });
  const prefs = useQuery({ queryKey: ['preferences'], queryFn: () => api.get<Preferences | null>('/preferences') });

  // Resume where the user left off: an uploaded CV goes straight to the confirmation.
  useEffect(() => {
    if (loaded || cv.isPending || prefs.isPending) return;
    setLoaded(true);
    if (cv.data) {
      setSummary(cv.data);
      setCvPhase('found');
    }
    const p = prefs.data;
    if (p) {
      setRoles(p.roles);
      setWhere({ location: p.location, radiusMiles: p.radiusMiles, workStyles: p.workStyles, salary: p.minSalary ? formatMoney(p.minSalary) : '' });
      setAuth({ rightToWork: p.rightToWorkUk, sponsorship: p.needsSponsorship });
    }
  }, [loaded, cv.isPending, prefs.isPending, cv.data, prefs.data]);

  const save = useMutation({
    mutationFn: (body: Partial<Preferences>) => api.put<Preferences>('/preferences', body),
  });

  const confirmCv = () => {
    // Suggest the latest roles from the CV, and the town, if nothing is set yet.
    if (summary && roles.length === 0) setRoles(summary.suggestedRoles);
    if (summary && !where.location) setWhere((w) => ({ ...w, location: summary.location.split(',')[0]?.trim() ?? '' }));
    setStep('roles');
  };

  const back: Partial<Record<string, () => void>> = {
    found: () => setCvPhase('cv'),
    roles: () => setStep('cv'),
    where: () => setStep('roles'),
    auth: () => setStep('where'),
  };

  const n = STEP_NUMBER[step];

  return (
    <BareLayout
      top={
        <div className="prog" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={n * 25}>
          <i style={{ width: `${n * 25}%` }} />
        </div>
      }
    >
      <header className="v g16">
        <div className="h sp" style={{ minHeight: 44 }}>
          <span className="wm">Shortlist</span>
          {step !== 'ready' && <span className="sm mut">Step {n} of 4</span>}
        </div>
        <div style={{ minHeight: 44 }}>{back[screen] && <BackButton onClick={back[screen]!}>Back</BackButton>}</div>
      </header>

      <div className="v" style={{ flex: 1, justifyContent: 'center', padding: '32px 0 48px' }}>
        <div className="v g48 narrow fade-in" key={screen}>
          {!loaded ? (
            <div aria-busy="true" />
          ) : step === 'cv' ? (
            <UploadCv phase={cvPhase} setPhase={setCvPhase} summary={summary} setSummary={setSummary} onConfirm={confirmCv} />
          ) : step === 'roles' ? (
            <Roles roles={roles} onChange={setRoles} busy={save.isPending} onContinue={() => save.mutate({ roles }, { onSuccess: () => setStep('where') })} />
          ) : step === 'where' ? (
            <WhereHow
              draft={where}
              onChange={setWhere}
              busy={save.isPending}
              onContinue={() =>
                save.mutate(
                  { location: where.location.trim(), radiusMiles: where.radiusMiles, workStyles: where.workStyles, minSalary: parseSalary(where.salary) },
                  { onSuccess: () => setStep('auth') },
                )
              }
            />
          ) : step === 'auth' ? (
            <WorkAuth
              rightToWork={auth.rightToWork}
              sponsorship={auth.sponsorship}
              onChange={setAuth}
              busy={save.isPending}
              onContinue={() =>
                save.mutate({ rightToWorkUk: auth.rightToWork, needsSponsorship: auth.sponsorship }, { onSuccess: () => setStep('ready') })
              }
            />
          ) : (
            <Ready />
          )}
          {save.isError && (
            <p className="err-t" role="alert">
              We could not save this. Check your connection and try again.
            </p>
          )}
        </div>
      </div>
    </BareLayout>
  );
}
