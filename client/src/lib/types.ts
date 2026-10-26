export type ApplyRoute = 'email' | 'form' | 'site';
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type MatchStatus = 'new' | 'viewed' | 'skipped' | 'saved' | 'applied';
export type ApplicationStatus = 'approved' | 'applied' | 'viewed' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

export type SignInMethod = 'password' | 'google' | 'both';

export interface Me {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  onboardingComplete: boolean;
  signInMethod: SignInMethod;
  hasPassword: boolean;
  passwordChangedAt: string | null;
}

export interface AppConfig {
  googleEnabled: boolean;
  undoWindowSeconds: number;
  otpTtlMinutes: number;
  maxCvSizeMb: number;
  minPasswordLength: number;
  passwordResetTtlMinutes: number;
}

export interface JobSummary {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: WorkMode;
  workModeDetail: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  applyRoute: ApplyRoute;
  /** Only when the job source provides one. */
  logoUrl?: string | null;
  /** ISO date. Shown only as "Posted 2 days ago". */
  postedAt: string;
}

export interface JobDetail extends JobSummary {
  description: string;
  requirements: string[];
  applyUrl: string | null;
  facts: {
    contract: string | null;
    reference: string | null;
    /** The job site shares only the start of the advert. */
    partial: boolean;
    sourceName: string | null;
  };
}

export interface MatchListItem {
  id: string;
  score: number;
  reasonLine: string;
  status: MatchStatus;
  job: JobSummary;
}

export interface TodayMatches {
  total: number;
  reviewed: number;
  items: MatchListItem[];
}

export interface Segment {
  text: string;
  changed: boolean;
}

export type Block =
  | { type: 'heading' | 'meta' | 'section' | 'paragraph'; segments: Segment[] }
  | { type: 'entry'; segments: Segment[]; aside?: string }
  | { type: 'bullets'; items: Segment[][] };

export interface DocumentData {
  id: string;
  type: 'cv' | 'cover_letter';
  blocks: Block[];
  editedByUser: boolean;
  version: number;
  updatedAt: string;
}

export interface ApplicationBrief {
  id: string;
  status: ApplicationStatus;
  route: ApplyRoute;
  scheduledSendAt: string | null;
  sentAt: string | null;
  undoneAt: string | null;
  sendError: 'not_supported' | 'failed' | null;
}

export interface MatchDetail {
  id: string;
  score: number;
  reasons: string[];
  reasonLine: string;
  status: MatchStatus;
  job: JobDetail;
  documents: DocumentData[];
  application: ApplicationBrief | null;
}

export interface FormAnswer {
  id: string;
  key: string;
  label: string;
  value: string;
  source: 'cv' | 'profile' | 'ai' | 'user';
  needsAttention: boolean;
  multiline: boolean;
  hint: string;
}

export interface ApprovalResult {
  applicationId: string;
  scheduledSendAt: string;
  status: ApplicationStatus;
  sentAt: string | null;
  undoWindowSeconds: number;
}

export interface ApplicationListItem extends ApplicationBrief {
  approvedAt: string;
  matchId: string | null;
  job: JobSummary;
}

export interface ApplicationEvent {
  id: string;
  type: string;
  label: string;
  detail: string | null;
  occurredAt: string;
}

export interface ApplicationDetailData extends ApplicationListItem {
  notes: string;
  events: ApplicationEvent[];
  documents: Array<{ id: string; type: 'cv' | 'cover_letter'; sent: boolean; updatedAt: string }>;
}

export interface Experience {
  title: string;
  company: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface Education {
  qualification: string;
  institution: string;
  start: string;
  end: string;
}

export interface ProfileData {
  fullName: string;
  email: string;
  phone: string | null;
  location: string;
  headline: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  cvFileName: string | null;
}

export interface Preferences {
  roles: string[];
  location: string;
  radiusMiles: 5 | 10 | 15 | 25 | 50;
  workStyles: WorkMode[];
  minSalary: number | null;
  rightToWorkUk: boolean;
  needsSponsorship: boolean;
}

export interface CvSummary {
  fileName: string;
  name: string;
  latestRole: string;
  yearsExperience: number | null;
  skills: string[];
  education: string;
  suggestedRoles: string[];
  location: string;
  size?: number;
}

export interface Settings {
  email: string;
  signInMethod: SignInMethod;
  hasPassword: boolean;
  passwordChangedAt: string | null;
  notifyNewMatches: boolean;
  notifyAppUpdates: boolean;
  matchesPerDay: number;
  matchesPerDayOptions: number[];
}

export type EarlierStatus = 'not' | 'applied' | 'started' | 'skipped';

export interface EarlierItem {
  id: string;
  score: number;
  status: EarlierStatus;
  /** Set for applied matches: the row opens the application. */
  applicationId: string | null;
  /** Days until the match is removed, only in its last few days (and never for applied or started ones). */
  expiresInDays: number | null;
  job: Pick<JobSummary, 'title' | 'company' | 'location' | 'workMode' | 'postedAt'>;
}

export interface EarlierMatches {
  retentionDays: number;
  counts: Record<'all' | EarlierStatus, number>;
  /** Newest day first. `date` is the UK calendar day the matches were found (YYYY-MM-DD). */
  days: Array<{ date: string; items: EarlierItem[] }>;
}
