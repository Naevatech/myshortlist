import { Button } from '../../components/Button';
import { RoleEditor } from '../../components/RoleEditor';

export function Roles({ roles, onChange, onContinue, busy }: { roles: string[]; onChange: (r: string[]) => void; onContinue: () => void; busy: boolean }) {
  return (
    <>
      <div className="v g16">
        <h1>What roles are you looking for?</h1>
        <p className="mut">Add job titles. We will also look at close matches.</p>
      </div>
      <RoleEditor roles={roles} onChange={onChange} />
      <Button action disabled={roles.length === 0 || busy} onClick={onContinue}>
        Continue
      </Button>
    </>
  );
}
