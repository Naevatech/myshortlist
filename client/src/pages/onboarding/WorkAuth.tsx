import { Button } from '../../components/Button';
import { OptionToggle } from '../../components/OptionToggle';

const YES_NO = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'no' as const, label: 'No' },
];

interface Props {
  rightToWork: boolean;
  sponsorship: boolean;
  onChange: (v: { rightToWork: boolean; sponsorship: boolean }) => void;
  onContinue: () => void;
  busy: boolean;
}

export function WorkAuth({ rightToWork, sponsorship, onChange, onContinue, busy }: Props) {
  return (
    <>
      <div className="v g16">
        <h1>Work authorisation</h1>
        <p className="mut">We use this only to filter roles. You can change it later.</p>
      </div>
      <div className="v g32">
        <OptionToggle
          label="Do you have the right to work in the UK?"
          options={YES_NO}
          value={rightToWork ? 'yes' : 'no'}
          onChange={(v) => onChange({ rightToWork: v === 'yes', sponsorship })}
        />
        <OptionToggle
          label="Will you need visa sponsorship?"
          options={YES_NO}
          value={sponsorship ? 'yes' : 'no'}
          onChange={(v) => onChange({ rightToWork, sponsorship: v === 'yes' })}
        />
      </div>
      <Button action disabled={busy} onClick={onContinue}>
        Continue
      </Button>
    </>
  );
}
