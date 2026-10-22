import type { FormQuestion } from '../../types/domain.js';
import type { JobProvider, JobSearch, RawJob } from './types.js';

/** The default questions for a "form" route when the provider gives none. */
export function defaultFormSchema(company: string): FormQuestion[] {
  return [
    { key: 'full_name', label: 'Full name', kind: 'name' },
    { key: 'email', label: 'Email address', kind: 'email' },
    { key: 'phone', label: 'Phone number', kind: 'phone' },
    { key: 'right_to_work', label: 'Do you have the right to work in the UK?', kind: 'right_to_work' },
    { key: 'notice_period', label: 'Notice period', kind: 'notice_period' },
    { key: 'motivation', label: `Why do you want to work at ${company}?`, kind: 'motivation', multiline: true },
    { key: 'salary_expectation', label: 'Salary expectation', kind: 'salary' },
  ];
}

/** Ages in days for jobs 1 to 6, so the samples always fall inside the job window. */
const AGES_IN_DAYS = [2, 1, 5, 7, 3, 14];

/** The six sample jobs, dated relative to `now`. */
export function placeholderJobs(now = new Date()): RawJob[] {
  return PLACEHOLDER_JOBS.map((job, i) => ({ ...job, postedAt: new Date(now.getTime() - AGES_IN_DAYS[i] * 86_400_000).toISOString() }));
}

const PLACEHOLDER_JOBS: RawJob[] = [
  {
    externalId: 'ph-1',
    title: 'Frontend Engineer',
    company: 'Halden & Moore',
    location: 'Belfast',
    workMode: 'hybrid',
    workModeDetail: 'three days in the office',
    salaryMin: 48000,
    salaryMax: 58000,
    description: [
      '## About us',
      'Halden & Moore builds scheduling software for care providers across the UK and Ireland. Our tools help care coordinators plan visits, manage staff rotas and keep families informed. More than 400 care organisations use our platform every day, so a clear, reliable interface makes a real difference to the people they look after.',
      '## The role',
      'You will join a team of six engineers working on the customer web app, the product our clients use to plan and track care visits. You will work closely with our product designer and product manager, and you will have a real say in how features are shaped and built.',
      'This is a hands-on role. Most of your time will be spent building and improving features in React and TypeScript, reviewing code and helping the team keep the app fast and accessible.',
      '## What you will do',
      '• Build and maintain features in React and TypeScript for the customer web app.',
      '• Work with designers to turn new screens and flows into clean, reusable components.',
      '• Contribute to and look after our shared component library.',
      '• Integrate with our REST APIs and work with backend engineers on new endpoints.',
      '• Improve performance, accessibility (WCAG 2.2 AA) and test coverage across the app.',
      '• Take part in code reviews, planning and team retrospectives.',
      '• Help support the app in production as part of a light, shared support rota during working hours.',
      '## What we are looking for',
      '• Two or more years of professional experience building web apps with React.',
      '• Confident with TypeScript and modern JavaScript.',
      '• Experience working with REST APIs and handling loading, error and empty states well.',
      '• A good eye for detail and an interest in accessible, easy-to-use interfaces.',
      '• Comfortable writing tests (for example with Jest or Vitest and Testing Library).',
      '• Happy working in a hybrid team, three days a week in our Belfast office.',
      '## Nice to have',
      '• Experience with a design system or component library.',
      '• Some Node.js or backend experience.',
      '• Experience with scheduling, booking or healthcare products.',
      '## What we offer',
      '• Salary of £48,000 to £58,000, depending on experience.',
      '• 28 days of annual leave plus bank holidays.',
      '• Pension with a 6% employer contribution.',
      '• Private health insurance.',
      '• £1,000 a year learning budget.',
      '• Flexible start and finish times around core hours of 10am to 4pm.',
      '## Right to work',
      'You must have the right to work in the UK. We are not able to offer visa sponsorship for this role.',
      '## How to apply',
      'Apply with your CV and a short cover letter through our application form. The process is a 30-minute call with the hiring manager, a take-home exercise of no more than two hours, and a final interview with the team in Belfast.',
      'Halden & Moore is an equal opportunities employer. If you need any adjustments during the process, tell us and we will make them.',
    ].join('\n'),
    raw: { contract: 'Permanent, full time (37.5 hours a week)', reference: 'HM-FE-2026-14' },
    requirements: [
      'Two or more years of professional React experience',
      'Confident with TypeScript',
      'Experience working with REST APIs',
      'Comfortable in a hybrid team, three days a week in Belfast',
    ],
    postedAt: '', // set by placeholderJobs()
    applyRoute: 'form',
    applyUrl: 'https://example.com/halden-moore/careers/frontend-engineer',
    formSchema: defaultFormSchema('Halden & Moore'),
  },
  {
    externalId: 'ph-2',
    title: 'Full-Stack Developer',
    company: 'Northfield Labs',
    location: 'UK',
    workMode: 'remote',
    salaryMin: 50000,
    salaryMax: 60000,
    description:
      'Northfield Labs makes stock and ordering tools for independent shops. You will work across a Node.js and MongoDB back end and a React front end, shipping small improvements every week. The team is fully remote, with one meet-up each quarter.',
    requirements: [
      'Experience building APIs with Node.js',
      'Working knowledge of MongoDB or another document database',
      'Comfortable building React interfaces',
      'Able to work independently in a remote team',
    ],
    postedAt: '', // set by placeholderJobs()
    raw: { contract: 'Permanent, full time' },
    applyRoute: 'email',
    applyEmail: 'careers@northfield-labs.example',
  },
  {
    externalId: 'ph-3',
    title: 'Software Engineer, Payments',
    company: 'Kestrel Payments',
    location: 'Belfast',
    workMode: 'onsite',
    salaryMin: 52000,
    salaryMax: 62000,
    description:
      'Kestrel Payments processes card and bank payments for UK charities. You will help build the services that take donations and reconcile them each night. The work involves Stripe integrations, TypeScript services and careful testing.',
    requirements: [
      'Experience with payment providers such as Stripe',
      'Strong TypeScript or JavaScript',
      'Care for testing and reliability',
      'Able to work on-site in Belfast five days a week',
    ],
    postedAt: '', // set by placeholderJobs()
    raw: { contract: 'Permanent, full time' },
    applyRoute: 'site',
    applyUrl: 'https://example.com/kestrel-payments/jobs/software-engineer-payments',
  },
  {
    externalId: 'ph-4',
    title: 'React Developer',
    company: 'Ashgrove Digital',
    location: 'Lisburn',
    workMode: 'hybrid',
    salaryMin: 42000,
    salaryMax: 50000,
    description:
      'Ashgrove Digital is a small agency building websites and web apps for local councils and charities. You will build React interfaces from Figma designs and work directly with clients. Most weeks you will be in the Lisburn office two days.',
    requirements: [
      'Professional experience with React',
      'Able to turn Figma designs into accessible interfaces',
      'Good written communication with clients',
      'Comfortable with Git and code review',
    ],
    postedAt: '', // set by placeholderJobs()
    raw: { contract: 'Permanent, full time' },
    applyRoute: 'email',
    applyEmail: 'jobs@ashgrove-digital.example',
  },
  {
    externalId: 'ph-5',
    title: 'Web Developer',
    company: 'Lumen Transport',
    location: 'UK',
    workMode: 'remote',
    salaryMin: 44000,
    salaryMax: 52000,
    description:
      'Lumen Transport runs journey planning for regional bus operators. You will maintain the public website and the timetable tools used by staff. The stack is React, Node.js and PostgreSQL.',
    requirements: [
      'Experience with React and modern JavaScript',
      'Some back-end experience with Node.js',
      'Interest in accessibility and public services',
      'Able to work remotely within the UK',
    ],
    postedAt: '', // set by placeholderJobs()
    raw: { contract: 'Permanent, full time' },
    applyRoute: 'form',
    applyUrl: 'https://example.com/lumen-transport/careers/web-developer',
    formSchema: defaultFormSchema('Lumen Transport'),
  },
  {
    externalId: 'ph-6',
    title: 'Frontend Developer',
    company: 'Carrick Data',
    location: 'Belfast',
    workMode: 'hybrid',
    salaryMin: 46000,
    salaryMax: 54000,
    description:
      'Carrick Data builds dashboards that help water companies track leaks and usage. You will build charts and data views in React, working closely with the data team. The role is hybrid, with two office days in Belfast.',
    requirements: [
      'Experience building dashboards or data-heavy interfaces',
      'Strong React and JavaScript',
      'Some TypeScript is helpful',
      'Comfortable in a hybrid team in Belfast',
    ],
    postedAt: '', // set by placeholderJobs()
    raw: { contract: 'Permanent, full time' },
    applyRoute: 'site',
    applyUrl: 'https://example.com/carrick-data/jobs/frontend-developer',
  },
];

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2);

/** Fixed listings for development. Filters loosely, but always returns at least six so the UI is never empty. */
export class PlaceholderProvider implements JobProvider {
  name = 'placeholder';

  async search(q: JobSearch): Promise<RawJob[]> {
    const roleWords = new Set(q.roles.flatMap(words));
    const loc = q.location.toLowerCase();
    const scored = placeholderJobs().map((job) => {
      let s = words(job.title).filter((w) => roleWords.has(w)).length;
      if (job.workMode === 'remote' || (loc && job.location.toLowerCase().includes(loc))) s += 1;
      return { job, s };
    }).sort((a, b) => b.s - a.s);
    return scored.slice(0, Math.max(6, q.limit)).map((x) => x.job);
  }
}
