import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { OptionToggle } from '../../components/OptionToggle';
import { Select } from '../../components/Select';
import type { Preferences, WorkMode } from '../../lib/types';

export const DISTANCES = [5, 10, 15, 25, 50].map((n) => ({ value: n, label: `Within ${n} miles` }));
export const WORK_STYLES: Array<{ value: WorkMode; label: string }> = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

export interface WhereDraft {
  location: string;
  radiusMiles: Preferences['radiusMiles'];
  workStyles: WorkMode[];
  salary: string;
}

export function toggleStyle(list: WorkMode[], v: WorkMode): WorkMode[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function WhereFields({ draft, onChange }: { draft: WhereDraft; onChange: (d: WhereDraft) => void }) {
  return (
    <div className="v g32">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '24px 16px' }}>
        <Input label="Location" autoComplete="address-level2" value={draft.location} onChange={(e) => onChange({ ...draft, location: e.target.value })} />
        <Select
          label="Distance"
          value={draft.radiusMiles}
          options={DISTANCES}
          onChange={(e) => onChange({ ...draft, radiusMiles: Number(e.target.value) as Preferences['radiusMiles'] })}
        />
      </div>
      <OptionToggle label="Work style" options={WORK_STYLES} value={draft.workStyles} onChange={(v) => onChange({ ...draft, workStyles: toggleStyle(draft.workStyles, v) })} />
      <Input
        label="Minimum salary per year"
        inputMode="numeric"
        placeholder="£45,000"
        value={draft.salary}
        onChange={(e) => onChange({ ...draft, salary: e.target.value })}
      />
    </div>
  );
}

export function WhereHow({ draft, onChange, onContinue, busy }: { draft: WhereDraft; onChange: (d: WhereDraft) => void; onContinue: () => void; busy: boolean }) {
  return (
    <>
      <div className="v g16">
        <h1>Where and how?</h1>
        <p className="mut">We only show roles that fit these.</p>
      </div>
      <WhereFields draft={draft} onChange={onChange} />
      <Button action disabled={busy} onClick={onContinue}>
        Continue
      </Button>
    </>
  );
}
