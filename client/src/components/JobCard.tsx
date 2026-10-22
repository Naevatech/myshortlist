import { Link } from 'react-router-dom';
import type { MatchListItem } from '../lib/types';
import { formatSalary, placeShort, ROUTE_CARD_LABEL } from '../lib/format';
import { CompanyLogo } from './CompanyLogo';
import { ScorePill } from './ScorePill';
import { formatPostedAge } from '../lib/postedAge';

/** The whole card is one link. The score always sits beside its one-line reason. */
export function JobCard({ match }: { match: MatchListItem }) {
  const { job } = match;
  return (
    <Link className="job with-logo" to={`/jobs/${match.id}`}>
      <CompanyLogo company={job.company} src={job.logoUrl} />
      <div className="body">
        <div className="jt">
          <h2>{job.title}</h2>
          <ScorePill score={match.score} />
        </div>
        <p className="sm mut">
          {job.company} · {placeShort(job)}
        </p>
        <p className="sm">
          {formatSalary(job.salaryMin, job.salaryMax)} <span className="mut">· {ROUTE_CARD_LABEL[job.applyRoute]}</span>
        </p>
        <p className="sm mut why">{match.reasonLine}</p>
        <p className="xs mut" style={{ marginTop: 4 }}>
          {formatPostedAge(job.postedAt)}
        </p>
      </div>
    </Link>
  );
}
