import type { JobDetail } from '../lib/types';
import { formatSalary, placeLong } from '../lib/format';
import { formatPostedAge } from '../lib/postedAge';

/** A short, capitalised line with no end punctuation, as many adverts write their headings ("The Role"). */
function looksLikeHeading(line: string): boolean {
  return line.length <= 40 && /^[A-Z0-9]/.test(line) && !/[.,;:!?)]$/.test(line) && line.split(/\s+/).length <= 6;
}

export interface DescSection {
  title?: string;
  blocks: Array<{ kind: 'p'; text: string } | { kind: 'ul'; items: string[] }>;
}

/**
 * Turns the stored advert text into sections. "## " lines are headings, "• " (or "- ", "* ") lines are bullet
 * points, a short line ending in ":" is a heading, and everything else is a paragraph.
 */
export function parseDescription(text: string): DescSection[] {
  const sections: DescSection[] = [{ blocks: [] }];
  const cur = () => sections[sections.length - 1];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^##\s+(.+)$/.exec(line)?.[1] ?? (line.length <= 60 && /:$/.test(line) ? line.slice(0, -1) : looksLikeHeading(line) ? line : null);
    if (heading) {
      sections.push({ title: heading.trim(), blocks: [] });
      continue;
    }
    const bullet = /^[•\-*]\s+(.+)$/.exec(line)?.[1];
    if (bullet) {
      const last = cur().blocks[cur().blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(bullet);
      else cur().blocks.push({ kind: 'ul', items: [bullet] });
      continue;
    }
    cur().blocks.push({ kind: 'p', text: line });
  }
  return sections.filter((s) => s.title || s.blocks.length);
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The complete advert: key facts, then every section of the description. */
export function JobDescription({ job }: { job: JobDetail }) {
  const sections = parseDescription(job.description);
  const hasRequirements = sections.some((s) => /looking for|requirements|you will need|skills/i.test(s.title ?? ''));
  if (job.requirements.length && !hasRequirements) {
    sections.push({ title: 'What they are looking for', blocks: [{ kind: 'ul', items: job.requirements }] });
  }
  const salary = job.salaryMin || job.salaryMax ? `${formatSalary(job.salaryMin, job.salaryMax)} a year` : 'Not given';
  const facts: Array<[string, string]> = [
    ['Job title', job.title],
    ['Company', job.company],
    ['Location', job.location],
    ['Work pattern', placeLong({ ...job, location: '' }).replace(/^ · | · $/g, '')],
    ['Salary', salary],
    ...(job.facts.contract ? ([['Contract', job.facts.contract]] as Array<[string, string]>) : []),
    ['Posted', capFirst(formatPostedAge(job.postedAt).replace(/^Posted /, ''))],
    ...(job.facts.reference ? ([['Reference', job.facts.reference]] as Array<[string, string]>) : []),
  ];

  return (
    <article id="job-desc" className="v g24 jd fade-in" aria-label="Full job description">
      <dl className="jd-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {sections.map((s, i) => (
        <section key={i} className="v g8">
          {s.title && <h3>{s.title}</h3>}
          {s.blocks.map((b, j) =>
            b.kind === 'p' ? (
              <p key={j}>{b.text}</p>
            ) : (
              <ul key={j} className="jd-list">
                {b.items.map((it, k) => (
                  <li key={k}>{it}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
      {job.facts.partial && job.applyUrl && (
        <p className="sm mut">
          {job.facts.sourceName ?? 'The job site'} shares only the start of this advert.{' '}
          <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
            Read the full advert on {job.facts.sourceName ?? 'their site'}
          </a>
        </p>
      )}
    </article>
  );
}
