/**
 * Skills and terms an ATS commonly screens for. Each entry is the display name, then other spellings that count
 * as the same keyword. Matching ignores case and needs whole words.
 */
const RAW: Array<string | [string, ...string[]]> = [
  // Languages and web
  'JavaScript', 'TypeScript', 'Python', 'Java', ['C#', 'csharp', 'c sharp'], ['C++', 'cpp'], 'Go', 'Golang', 'Ruby', 'PHP',
  'Kotlin', 'Swift', 'Rust', 'Scala', 'R', 'SQL', ['HTML', 'html5'], ['CSS', 'css3'], 'Sass', 'Bash', 'PowerShell',
  'React', ['React Native'], ['Next.js', 'nextjs'], 'Vue', ['Vue.js', 'vuejs'], 'Angular', 'Svelte', 'Redux', 'jQuery',
  ['Node.js', 'nodejs', 'node'], 'Express', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring', ['Spring Boot'], 'Laravel',
  'Rails', ['.NET', 'dotnet', 'asp.net'], 'GraphQL', ['REST APIs', 'rest api', 'restful'], 'gRPC', 'WebSockets',
  ['Tailwind CSS', 'tailwind'], 'Bootstrap', 'Webpack', 'Vite', 'Storybook',
  // Data and cloud
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'SQL Server', 'Oracle', 'Snowflake', 'BigQuery',
  'AWS', 'Azure', ['Google Cloud', 'gcp'], 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Linux', 'Serverless', 'Lambda',
  ['CI/CD', 'continuous integration', 'continuous delivery', 'ci cd'], 'Jenkins', ['GitHub Actions'], 'GitLab', 'Git',
  'Microservices', 'Kafka', 'RabbitMQ', 'Spark', 'Airflow', 'dbt', 'ETL', 'Power BI', 'Tableau', 'Looker', 'Excel',
  ['Machine learning', 'ml'], ['Data analysis', 'data analytics'], 'Statistics', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch',
  ['LLMs', 'llm', 'large language models'], ['Generative AI', 'genai', 'gen ai'], ['AI', 'artificial intelligence'],
  // Testing and quality
  'Jest', 'Vitest', 'Cypress', 'Playwright', 'Selenium', ['Testing Library', 'react testing library'], 'Mocha', 'JUnit',
  'pytest', ['Unit testing', 'unit tests'], ['Test automation', 'automated testing'], 'TDD', ['Accessibility', 'a11y', 'wcag'], ['OWASP'],
  // Ways of working
  'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence', ['Code review', 'code reviews'], 'Mentoring', ['Pair programming'],
  ['Stakeholder management', 'stakeholders'], ['Project management'], ['Product management'], ['Communication skills', 'communication'],
  'Leadership', ['Problem solving', 'problem-solving'], ['Teamwork', 'team player'], ['Time management'], 'Analytics',
  ['Design systems', 'design system'], ['Component libraries', 'component library'], 'Figma', ['UX', 'user experience'],
  ['UI', 'user interface'], ['SEO'], ['Responsive design', 'responsive'], ['Mobile development', 'mobile apps'],
  'iOS', 'Android', ['Payments', 'payment'], 'Stripe', ['E-commerce', 'ecommerce'], ['SaaS'], ['Fintech'],
  // General office and business
  ['Microsoft Office', 'ms office', 'office 365', 'microsoft 365'], 'Salesforce', 'HubSpot', 'SAP', ['Customer service'],
  ['Account management'], ['Business analysis'], ['Budgeting', 'budgets'], ['Forecasting'], ['Reporting'], ['Negotiation'],
  ['Sales'], ['Marketing'], ['Social media'], ['Content writing', 'copywriting'], ['Recruitment'], ['Compliance'], ['GDPR'],
  ['Risk management'], ['Process improvement'], ['Lean'], ['Six Sigma'], ['Prince2'], ['ITIL'],
];

export interface KeywordDef {
  name: string;
  patterns: RegExp[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Whole-word, case-insensitive. Handles names ending in symbols such as C++, C# and .NET. */
function wordRegex(term: string): RegExp {
  const startsWord = /^\w/.test(term);
  const endsWord = /\w$/.test(term);
  return new RegExp(`${startsWord ? '(?<![\\w.+#])' : '(?<![\\w])'}${esc(term)}${endsWord ? '(?![\\w+#])' : '(?![\\w])'}`, 'gi');
}

export const KEYWORDS: KeywordDef[] = RAW.map((entry) => {
  const [name, ...aliases] = Array.isArray(entry) ? entry : [entry];
  return { name, patterns: [name, ...aliases].map(wordRegex) };
});

/** Single letters and very common words count only when written in capitals in the text (R, Go, AI, UI, UX). */
const CASE_SENSITIVE = new Set(['R', 'Go', 'AI', 'UI', 'UX', 'Lean', 'Sales', 'Spring', 'Express', 'Swift']);

/** How many places in the text mention the keyword. Overlapping spellings ("node" in "Node.js") count once. */
export function countKeyword(def: KeywordDef, text: string): number {
  const spans: Array<[number, number]> = [];
  for (const re of def.patterns) {
    for (const m of text.matchAll(re)) {
      if (CASE_SENSITIVE.has(def.name) && m[0] !== def.name && m[0] !== def.name.toUpperCase()) continue;
      spans.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
    }
  }
  spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let n = 0;
  let end = -1;
  for (const [s, e] of spans) {
    if (s < end) continue;
    n++;
    end = e;
  }
  return n;
}

/**
 * Keywords the job asks for, with how often each appears in the job and in the CV. Extra terms (for example the
 * person's own listed skills) are checked too, so niche skills are not missed.
 */
export function jobKeywords(jobText: string, cvText: string, extraTerms: string[] = [], limit = 15) {
  const defs = [...KEYWORDS];
  const known = new Set(defs.map((d) => d.name.toLowerCase()));
  for (const t of extraTerms) {
    const term = t.trim();
    if (term.length > 1 && term.length <= 40 && !known.has(term.toLowerCase())) {
      defs.push({ name: term, patterns: [wordRegex(term)] });
      known.add(term.toLowerCase());
    }
  }
  return defs
    .map((d) => ({ k: d.name, job: countKeyword(d, jobText), cv: countKeyword(d, cvText) }))
    .filter((w) => w.job > 0)
    .sort((a, b) => b.job - a.job || a.k.localeCompare(b.k))
    .slice(0, limit);
}
