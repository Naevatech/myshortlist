import { useId, useState } from 'react';
import { Tag } from './Tag';

/** Job title field with an outline Add button (Enter also adds) and removable tags below. */
export function RoleEditor({ roles, onChange }: { roles: string[]; onChange: (roles: string[]) => void }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (!roles.some((r) => r.toLowerCase() === v.toLowerCase())) onChange([...roles, v]);
    setDraft('');
  };
  return (
    <div className="v g24">
      <div className="fld">
        <label className="lbl" htmlFor={id}>
          Job title
        </label>
        <div className="h g8">
          <input
            id={id}
            className="in"
            placeholder="For example, Backend Developer"
            value={draft}
            maxLength={120}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="btn bo" onClick={add}>
            Add
          </button>
        </div>
      </div>
      {roles.length > 0 && (
        <ul className="h wrap g8" aria-label="Job titles">
          {roles.map((r) => (
            <li key={r}>
              <Tag name={r} onRemove={() => onChange(roles.filter((x) => x !== r))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
