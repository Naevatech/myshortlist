import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatMoney, parseSalary, workModeLabel } from '../lib/format';
import { useTitle } from '../lib/hooks';
import type { Education, Experience, Preferences, ProfileData } from '../lib/types';
import { AppShell } from '../components/AppShell';
import { Button, ButtonLink } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { Input, Textarea } from '../components/Input';
import { OptionToggle } from '../components/OptionToggle';
import { RoleEditor } from '../components/RoleEditor';
import { Select } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { Tag } from '../components/Tag';
import { DISTANCES, toggleStyle, WORK_STYLES } from './onboarding/WhereHow';

type RowKey = 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'roles' | 'location' | 'salary';

interface RowProps {
  label: string;
  editing: boolean;
  onEdit: () => void;
  view: ReactNode;
  form: () => ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error?: boolean;
}

/** A label, its content and an Edit button. Edit opens the row in place with Save and Cancel. */
function Row({ label, editing, onEdit, view, form, onSave, onCancel, saving, error }: RowProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };
  if (editing) {
    return (
      <form className="kv" onSubmit={submit} aria-label={`Edit ${label.toLowerCase()}`}>
        <h3 className="sm med">{label}</h3>
        <div className="v g24">
          {form()}
          {error && (
            <p className="sm err-t" role="alert">
              We could not save this. Check your connection and try again.
            </p>
          )}
          <div className="h wrap g8">
            <Button type="submit" variant="outline" disabled={saving}>
              Save
            </Button>
            <Button variant="text" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
        <span />
      </form>
    );
  }
  return (
    <div className="kv">
      <h3 className="sm med">{label}</h3>
      <div>{view}</div>
      <Button variant="text" onClick={onEdit} aria-label={`Edit ${label.toLowerCase()}`}>
        Edit
      </Button>
    </div>
  );
}

const dates = (a: string, b: string) => [a, b].filter(Boolean).join(' to ');
const emptyRole: Experience = { title: '', company: '', start: '', end: '', bullets: [] };
const emptyEdu: Education = { qualification: '', institution: '', start: '', end: '' };

function ExperienceForm({ items, onChange }: { items: Experience[]; onChange: (x: Experience[]) => void }) {
  const set = (i: number, patch: Partial<Experience>) => onChange(items.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <div className="v g32">
      {items.map((e, i) => (
        <fieldset key={i} className="v g16" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr">Role {i + 1}</legend>
          <Input label="Job title" value={e.title} onChange={(ev) => set(i, { title: ev.target.value })} />
          <Input label="Employer" value={e.company} onChange={(ev) => set(i, { company: ev.target.value })} />
          <div className="h g16">
            <Input label="From" value={e.start} onChange={(ev) => set(i, { start: ev.target.value })} />
            <Input label="To" value={e.end} onChange={(ev) => set(i, { end: ev.target.value })} />
          </div>
          <Textarea
            label="What you did"
            hint="One point per line."
            value={e.bullets.join('\n')}
            onChange={(ev) => set(i, { bullets: ev.target.value.split('\n') })}
          />
          <Button variant="text" className="back" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            Remove this role
          </Button>
        </fieldset>
      ))}
      <Button variant="text" className="back" onClick={() => onChange([...items, { ...emptyRole }])}>
        Add a role
      </Button>
    </div>
  );
}

function EducationForm({ items, onChange }: { items: Education[]; onChange: (x: Education[]) => void }) {
  const set = (i: number, patch: Partial<Education>) => onChange(items.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <div className="v g32">
      {items.map((e, i) => (
        <fieldset key={i} className="v g16" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr">Qualification {i + 1}</legend>
          <Input label="Qualification" value={e.qualification} onChange={(ev) => set(i, { qualification: ev.target.value })} />
          <Input label="Where" value={e.institution} onChange={(ev) => set(i, { institution: ev.target.value })} />
          <div className="h g16">
            <Input label="From" value={e.start} onChange={(ev) => set(i, { start: ev.target.value })} />
            <Input label="To" value={e.end} onChange={(ev) => set(i, { end: ev.target.value })} />
          </div>
          <Button variant="text" className="back" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            Remove this qualification
          </Button>
        </fieldset>
      ))}
      <Button variant="text" className="back" onClick={() => onChange([...items, { ...emptyEdu }])}>
        Add a qualification
      </Button>
    </div>
  );
}

export default function Profile() {
  useTitle('Profile');
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.get<ProfileData>('/profile') });
  const prefs = useQuery({ queryKey: ['preferences'], queryFn: () => api.get<Preferences | null>('/preferences') });
  const [editing, setEditing] = useState<RowKey | null>(null);
  const [draft, setDraft] = useState<Partial<ProfileData & Preferences & { salaryText: string; skillsText: string }>>({});

  const saveProfile = useMutation({
    mutationFn: (body: Partial<ProfileData>) => api.patch<ProfileData>('/profile', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setEditing(null);
    },
  });
  const savePrefs = useMutation({
    mutationFn: (body: Partial<Preferences>) => api.put<Preferences>('/preferences', body),
    onSuccess: (p) => {
      queryClient.setQueryData(['preferences'], p);
      setEditing(null);
    },
  });

  if (profile.isPending || prefs.isPending) {
    return (
      <AppShell>
        <div className="col v g32" aria-busy="true">
          <span className="sr">Loading your profile</span>
          <Skeleton width={160} height={28} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={16} />
          ))}
        </div>
      </AppShell>
    );
  }
  if (profile.isError || prefs.isError) {
    return (
      <AppShell>
        <div className="col v g32">
          <h1>Profile</h1>
          <ErrorState
            title="We could not load your profile."
            helper="Check your connection and try again."
            action={
              <Button
                action
                onClick={() => {
                  profile.refetch();
                  prefs.refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  const p = profile.data;
  const pr: Preferences = prefs.data ?? { roles: [], location: '', radiusMiles: 15, workStyles: [], minSalary: null, rightToWorkUk: true, needsSponsorship: false };

  const start = (key: RowKey) => {
    saveProfile.reset();
    savePrefs.reset();
    setDraft({
      ...p,
      ...pr,
      experience: p.experience.map((e) => ({ ...e, bullets: [...e.bullets] })),
      education: p.education.map((e) => ({ ...e })),
      salaryText: pr.minSalary ? formatMoney(pr.minSalary) : '',
      skillsText: p.skills.join(', '),
    });
    setEditing(key);
  };
  const cancel = () => setEditing(null);
  const up = (patch: typeof draft) => setDraft((d) => ({ ...d, ...patch }));

  const row = (key: RowKey, label: string, view: ReactNode, form: () => ReactNode, save: () => void, kind: 'profile' | 'prefs') => (
    <Row
      key={key}
      label={label}
      editing={editing === key}
      onEdit={() => start(key)}
      view={view}
      form={form}
      onSave={save}
      onCancel={cancel}
      saving={kind === 'profile' ? saveProfile.isPending : savePrefs.isPending}
      error={kind === 'profile' ? saveProfile.isError : savePrefs.isError}
    />
  );
  const none = <p className="mut">Not added yet</p>;

  return (
    <AppShell>
      <div className="col v g64">
        <header className="h sp wrap g24">
          <h1>Profile</h1>
          <ButtonLink variant="outline" to="/profile/cv">
            Replace CV
          </ButtonLink>
        </header>

        <section className="v g16" aria-labelledby="pf-cv">
          <div className="v g8">
            <h2 id="pf-cv">Your CV</h2>
            <p className="sm mut">
              {p.cvFileName ? `Read from ${p.cvFileName}. Edit anything that looks wrong.` : 'Edit anything that looks wrong.'}
            </p>
          </div>
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            {row(
              'contact',
              'Contact',
              <div>
                <p>{p.fullName || 'Your name'}</p>
                <p className="mut">{p.email}</p>
                {p.phone && <p className="mut">{p.phone}</p>}
                {p.location && <p className="mut">{p.location}</p>}
              </div>,
              () => (
                <>
                  <Input label="Full name" autoComplete="name" value={draft.fullName ?? ''} onChange={(e) => up({ fullName: e.target.value })} />
                  <Input label="Email address" type="email" autoComplete="email" value={draft.email ?? ''} onChange={(e) => up({ email: e.target.value })} />
                  <Input label="Phone number" type="tel" autoComplete="tel" value={draft.phone ?? ''} onChange={(e) => up({ phone: e.target.value })} />
                  <Input label="Location" value={draft.location ?? ''} onChange={(e) => up({ location: e.target.value })} />
                </>
              ),
              () => saveProfile.mutate({ fullName: draft.fullName, email: draft.email, phone: draft.phone || null, location: draft.location }),
              'profile',
            )}
            {row(
              'summary',
              'Summary',
              p.summary ? <p>{p.summary}</p> : none,
              () => <Textarea label="Summary" value={draft.summary ?? ''} onChange={(e) => up({ summary: e.target.value })} />,
              () => saveProfile.mutate({ summary: draft.summary }),
              'profile',
            )}
            {row(
              'experience',
              'Experience',
              p.experience.length ? (
                <div className="v g16">
                  {p.experience.map((e, i) => (
                    <div key={i}>
                      <p>{[e.title, e.company].filter(Boolean).join(', ')}</p>
                      <p className="sm mut">{dates(e.start, e.end)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                none
              ),
              () => <ExperienceForm items={draft.experience ?? []} onChange={(experience) => up({ experience })} />,
              () =>
                saveProfile.mutate({
                  experience: (draft.experience ?? [])
                    .map((e) => ({ ...e, bullets: e.bullets.map((b) => b.trim()).filter(Boolean) }))
                    .filter((e) => e.title.trim() || e.company.trim()),
                }),
              'profile',
            )}
            {row(
              'education',
              'Education',
              p.education.length ? (
                <div className="v g16">
                  {p.education.map((e, i) => (
                    <div key={i}>
                      <p>{[e.qualification, e.institution].filter(Boolean).join(', ')}</p>
                      {dates(e.start, e.end) && <p className="sm mut">{dates(e.start, e.end)}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                none
              ),
              () => <EducationForm items={draft.education ?? []} onChange={(education) => up({ education })} />,
              () => saveProfile.mutate({ education: (draft.education ?? []).filter((e) => e.qualification.trim() || e.institution.trim()) }),
              'profile',
            )}
            {row(
              'skills',
              'Skills',
              p.skills.length ? (
                <ul className="h wrap g8" aria-label="Skills">
                  {p.skills.map((s) => (
                    <li key={s}>
                      <Tag name={s} />
                    </li>
                  ))}
                </ul>
              ) : (
                none
              ),
              () => (
                <Input label="Skills" hint="Separate skills with commas." value={draft.skillsText ?? ''} onChange={(e) => up({ skillsText: e.target.value })} />
              ),
              () =>
                saveProfile.mutate({
                  skills: (draft.skillsText ?? '')
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }),
              'profile',
            )}
          </div>
        </section>

        <section className="v g16" aria-labelledby="pf-pref">
          <div className="v g8">
            <h2 id="pf-pref">Preferences</h2>
            <p className="sm mut">We use these to choose which roles to show you.</p>
          </div>
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            {row(
              'roles',
              'Roles',
              pr.roles.length ? (
                <ul className="h wrap g8" aria-label="Roles">
                  {pr.roles.map((r) => (
                    <li key={r}>
                      <Tag name={r} />
                    </li>
                  ))}
                </ul>
              ) : (
                none
              ),
              () => <RoleEditor roles={draft.roles ?? []} onChange={(roles) => up({ roles })} />,
              () => savePrefs.mutate({ roles: draft.roles }),
              'prefs',
            )}
            {row(
              'location',
              'Location',
              <div>
                <p>{pr.location ? `${pr.location}, within ${pr.radiusMiles} miles` : `Within ${pr.radiusMiles} miles`}</p>
                <p className="sm mut">{pr.workStyles.length ? pr.workStyles.map(workModeLabel).join(', ') : 'Any work style'}</p>
              </div>,
              () => (
                <>
                  <Input label="Location" value={draft.location ?? ''} onChange={(e) => up({ location: e.target.value })} />
                  <Select
                    label="Distance"
                    value={draft.radiusMiles ?? 15}
                    options={DISTANCES}
                    onChange={(e) => up({ radiusMiles: Number(e.target.value) as Preferences['radiusMiles'] })}
                  />
                  <OptionToggle
                    label="Work style"
                    options={WORK_STYLES}
                    value={draft.workStyles ?? []}
                    onChange={(v) => up({ workStyles: toggleStyle(draft.workStyles ?? [], v) })}
                  />
                </>
              ),
              () => savePrefs.mutate({ location: (draft.location ?? '').trim(), radiusMiles: draft.radiusMiles, workStyles: draft.workStyles }),
              'prefs',
            )}
            {row(
              'salary',
              'Minimum salary',
              pr.minSalary ? <p>{formatMoney(pr.minSalary)} a year</p> : none,
              () => (
                <Input
                  label="Minimum salary per year"
                  inputMode="numeric"
                  placeholder="£45,000"
                  value={draft.salaryText ?? ''}
                  onChange={(e) => up({ salaryText: e.target.value })}
                />
              ),
              () => savePrefs.mutate({ minSalary: parseSalary(draft.salaryText ?? '') }),
              'prefs',
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
