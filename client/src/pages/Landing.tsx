import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTitle } from '../lib/hooks';
import '../styles/landing.css';

/* ---------- small inline icons (decorative) ---------- */
const Arrow = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Tick = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const Plus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const Download = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
const Shield = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5l7 3v5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9v-5z" />
  </svg>
);

/* ---------- content ---------- */
const ROLES = [
  'Frontend Engineer',
  'Data Analyst',
  'Product Designer',
  'Software Engineer',
  'Marketing Executive',
  'Project Manager',
  'Business Analyst',
  'DevOps Engineer',
  'UX Researcher',
  'Account Manager',
];

type RouteKind = 'email' | 'form' | 'site';
/** Each card's button jumps to the part of this page that shows that kind of application. */
const ROUTES: Array<{ kind: RouteKind; label: string; title: string; text: string; cta: string; href: string; step?: number }> = [
  {
    kind: 'email',
    label: 'Sent by email',
    title: 'We send it for you.',
    text: "Your CV and cover letter go straight to the employer's inbox, with your name on them and your email as the reply address.",
    cta: 'See an email application',
    href: '#control',
  },
  {
    kind: 'form',
    label: 'Form filled for you',
    title: 'We fill it. You check it.',
    text: "We complete the employer's application form from your CV and profile. You review every answer before anything is submitted.",
    cta: 'See a form application',
    href: '#how',
    step: 2,
  },
  {
    kind: 'site',
    label: 'You finish on their site',
    title: 'Ready to upload.',
    text: 'When an employer only accepts applications on their own site, your documents are ready to upload and we track it once you apply.',
    cta: 'See how it works',
    href: '#how',
    step: 0,
  },
];

const STEPS = [
  { title: 'Upload your CV', big: 'Upload your CV once.', text: 'We read your experience, skills and the roles you want. Check and change anything.' },
  {
    title: 'Review your matches',
    big: 'Wake up to your best matches.',
    text: 'Each morning, the best new UK jobs from the last two weeks, each with a score and a reason.',
  },
  {
    title: 'Approve, and we apply',
    big: 'Approve, and it is on its way.',
    text: 'We write a CV and cover letter for the role. Read them, edit if you like, then approve.',
  },
];

const DEMO_JOBS = [
  { title: 'Frontend Engineer', company: 'Halden & Moore', posted: '2 days ago', score: 94 },
  { title: 'Full-Stack Developer', company: 'Northfield Labs', posted: '1 day ago', score: 91 },
  { title: 'Software Engineer, Payments', company: 'Kestrel Payments', posted: '5 days ago', score: 87 },
  { title: 'React Developer', company: 'Ashgrove Digital', posted: '1 week ago', score: 82 },
];

const FAQ = [
  ['Does Shortlist apply without asking me?', 'No. Every application waits for your approval. After you approve, you have 10 seconds to undo before it is sent.'],
  [
    'Which jobs will I see?',
    'UK jobs that match your CV and preferences, posted within the last two weeks. You choose how many matches you see each day, from 3 to 30.',
  ],
  ['Can I edit the CV and cover letter?', 'Yes. You can edit both before you approve. Anything we changed for the role is underlined.'],
  [
    'What if an employer only takes applications on their site?',
    'We open their application page and have your CV and cover letter ready to upload. Tell us when you have applied and we track it for you.',
  ],
  [
    'What happens to my data?',
    'We use your CV and preferences only to find jobs and write your applications. You can download or delete your data at any time from Settings.',
  ],
];

/* ---------- route card artwork ---------- */
function RouteArt({ kind }: { kind: RouteKind }) {
  if (kind === 'email') {
    return (
      <div className="art-stack">
        <div className="env e3">
          <div className="ln" />
          <div className="ln" />
        </div>
        <div className="env e2">
          <div className="ln" />
          <div className="ln" />
        </div>
        <div className="env e1">
          <div className="h sp" style={{ marginBottom: 6 }}>
            <div className="ln a" />
            <span className="tick" />
          </div>
          <div className="ln" />
          <div className="ln" />
          <div className="ln" style={{ width: '70%' }} />
          <div className="att">
            <i />
            CV.pdf
          </div>
          <div className="att">
            <i />
            Cover-letter.pdf
          </div>
        </div>
      </div>
    );
  }
  if (kind === 'form') {
    return (
      <div className="frm big">
        <div className="ln a" style={{ marginBottom: 6 }} />
        {['100%', '100%', '60%', '100%'].map((w, i) => (
          <div className="fr" key={i}>
            <i />
            <div className="ln" style={{ width: w === '100%' ? undefined : w }} />
          </div>
        ))}
        <div className="fr">
          <i style={{ background: '#FDECC8' }} />
          <div className="ln" style={{ width: '75%' }} />
        </div>
      </div>
    );
  }
  return (
    <div className="brw big">
      <div className="brw-t">
        <i />
        <i />
        <i />
        <span className="url" />
      </div>
      <div className="brw-b">
        <div className="ln a" />
        <div className="ln" />
        <div className="ln" style={{ width: '50%' }} />
        <div className="upl">
          <span />
          Upload CV
        </div>
        <div className="upl">
          <span />
          Upload cover letter
        </div>
      </div>
    </div>
  );
}

/* ---------- live approval demo (nothing is sent; it shows how approval works) ---------- */
function ApproveDemo() {
  const [state, setState] = useState<'idle' | 'counting' | 'sent' | 'skipped'>('idle');
  const [left, setLeft] = useState(10);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const approve = () => {
    stop();
    setLeft(10);
    setState('counting');
    timer.current = window.setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          stop();
          setState('sent');
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };
  const reset = (next: 'idle' | 'skipped') => {
    stop();
    setLeft(10);
    setState(next);
  };

  if (state === 'counting') {
    return (
      <div className="bn-mini">
        <div className="row">
          <span className="med">Approved</span>
          <span className="cd" style={{ fontSize: 40 }} aria-hidden="true">
            {left}s
          </span>
        </div>
        <div className="bar2" aria-hidden="true">
          <i style={{ width: `${Math.round(((10 - left) / 10) * 100)}%` }} />
        </div>
        <p className="xs mtl" style={{ margin: 0 }}>
          Sending to Northfield Labs. You can still change your mind.
        </p>
        <span className="sr" role="status">
          Approved. You can undo for 10 seconds.
        </span>
        <div className="acts">
          <button className="b b-sm b-gl" type="button" onClick={() => reset('idle')}>
            Undo
          </button>
        </div>
      </div>
    );
  }
  if (state === 'sent') {
    return (
      <div className="bn-mini">
        <div className="h g16">
          <span className="okc" aria-hidden="true">
            <Tick />
          </span>
          <span className="med" role="status">
            Application sent.
          </span>
        </div>
        <p className="xs mtl" style={{ margin: 0 }}>
          Your CV and cover letter went to Northfield Labs.
        </p>
        <div className="acts">
          <button className="b b-ink b-sm" type="button" onClick={() => reset('idle')}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (state === 'skipped') {
    return (
      <div className="bn-mini">
        <span className="med" role="status">
          Skipped. Nothing was sent.
        </span>
        <div className="acts">
          <button className="b b-ink b-sm" type="button" onClick={() => reset('idle')}>
            Show it again
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="bn-mini">
      <div className="row">
        <span className="med">Full-Stack Developer</span>
        <span className="score">91%</span>
      </div>
      <p className="xs mtl" style={{ margin: 0 }}>
        Northfield Labs · Remote, UK · Sent by email
      </p>
      <div className="acts">
        <button className="b b-ink b-sm" type="button" onClick={approve}>
          Approve and apply
        </button>
        <button className="b b-sm b-gl" type="button" onClick={() => reset('skipped')}>
          Skip
        </button>
      </div>
    </div>
  );
}

/* ---------- page ---------- */
export default function Landing() {
  useTitle('');
  const [route, setRoute] = useState(0);
  const [step, setStep] = useState(0);

  // Arriving from another page with a section in the address (for example /#faq): scroll to it.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  // Smooth scrolling for the in-page links, only while this page is open.
  useEffect(() => {
    document.documentElement.classList.add('lp-smooth');
    return () => document.documentElement.classList.remove('lp-smooth');
  }, []);

  return (
    <div className="lp-cq">
      <div className="lp">
        <a className="skip" href="#top">
          Skip to content
        </a>

        <header className="fh">
          <div className="nav">
            <a className="lp-logo" href="#top">
              <i aria-hidden="true">S</i>Shortlist
            </a>
            <nav className="navl" aria-label="Main">
              <a href="#how">How it works</a>
              <a href="#routes">Ways to apply</a>
              <a href="#control">Your control</a>
              <a href="#faq">Questions</a>
            </nav>
            <div className="h g8">
              <Link className="signin" to="/signin">
                Sign in
              </Link>
              <Link className="b b-w b-sm" to="/signup">
                Get started
              </Link>
            </div>
          </div>
        </header>

        <main id="top">
          {/* ============ HERO ============ */}
          <div className="herowrap">
            <div className="dark hero">
              <section className="w" aria-labelledby="lp-title" style={{ position: 'relative' }}>
                <div className="hg">
                  <span className="lp-pill">
                    <b aria-hidden="true" />
                    New UK matches every morning
                  </span>
                  <h1 className="h1" id="lp-title">
                    Apply to the right jobs. <span>Approve every one.</span>
                  </h1>
                  <p className="lead">
                    Shortlist finds UK jobs that match your CV and writes a tailored CV and cover letter for each one. Nothing is sent until
                    you approve it.
                  </p>
                  <div className="ctas">
                    <Link className="b b-w" to="/signup">
                      Get started
                      <Arrow />
                    </Link>
                    <a className="b b-ow" href="#how">
                      See how it works
                    </a>
                  </div>
                </div>
              </section>
              <div className="mq" aria-hidden="true">
                <div className="mq-t">
                  {[...ROLES, ...ROLES].map((r, i) => (
                    <span className="mq-i" key={i}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ============ FACTS ============ */}
          <section className="w" aria-labelledby="facts-t">
            <h2 className="sr" id="facts-t">
              Shortlist in numbers
            </h2>
            <div className="facts">
              <div className="fact">
                <strong>14 days</strong>
                <span>Only jobs posted in the last two weeks. Fresh roles, newest first.</span>
              </div>
              <div className="fact">
                <strong>3–30</strong>
                <span>New matches a day. You choose how many.</span>
              </div>
              <div className="fact">
                <strong>10 sec</strong>
                <span>To undo after you approve, before anything is sent.</span>
              </div>
              <div className="fact">
                <strong>0</strong>
                <span>Applications sent without your approval. Ever.</span>
              </div>
            </div>
            <ul className="badges" aria-label="What you can count on" style={{ listStyle: 'none', margin: 0 }}>
              <li className="badge">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
                UK jobs only
              </li>
              <li className="badge">
                <Shield />
                Built for UK GDPR
              </li>
              <li className="badge">
                <Tick />
                You approve every application
              </li>
              <li className="badge">
                <Download />
                Download or delete your data
              </li>
            </ul>
          </section>

          {/* ============ WAYS TO APPLY ============ */}
          <section className="sec rt" id="routes" aria-labelledby="routes-t" style={{ paddingTop: 0 }}>
            <div className="shead">
              <p className="eyebrow">One assistant, every kind of application</p>
              <h2 className="h2" id="routes-t">
                However they hire, you are covered.
              </h2>
              <p className="mtl">
                Employers take applications in different ways. Shortlist handles each one and tells you which it is before you approve.
              </p>
            </div>
            <div className="xc">
              {ROUTES.map((c, i) => (
                <article key={c.kind} className={`xc-card c${i}${route === i ? ' on' : ''}`} onMouseEnter={() => setRoute(i)}>
                  <div className="xc-art" aria-hidden="true">
                    <RouteArt kind={c.kind} />
                  </div>
                  <div className="xc-shade" aria-hidden="true" />
                  <button
                    className="xc-tab"
                    type="button"
                    aria-expanded={route === i}
                    aria-controls={`route-panel-${i}`}
                    onClick={() => setRoute(i)}
                    onFocus={() => setRoute(i)}
                  >
                    {c.label}
                  </button>
                  <div className="xc-body" id={`route-panel-${i}`}>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                    <a className="b b-w b-sm" href={c.href} onClick={() => c.step !== undefined && setStep(c.step)}>
                      {c.cta}
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ============ HOW IT WORKS ============ */}
          <section className="sec hw-sec" id="how" aria-labelledby="how-t">
            <div className="hw-head">
              <div className="v g16">
                <p className="eyebrow">How it works</p>
                <h2 className="h2" id="how-t">
                  Three steps. You decide every one.
                </h2>
              </div>
              <p className="mtl">
                Upload your CV once. We bring you fresh UK matches every morning and write each application. Nothing goes out until you
                say so.
              </p>
            </div>

            <div className="hw">
              <div className="hw-tabs" role="tablist" aria-label="Steps">
                {STEPS.map((s, i) => (
                  <button
                    key={s.title}
                    className="hw-tab"
                    type="button"
                    role="tab"
                    id={`step-tab-${i}`}
                    aria-controls="step-panel"
                    aria-selected={step === i}
                    tabIndex={step === i ? 0 : -1}
                    onClick={() => setStep(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') setStep((step + 1) % 3);
                      if (e.key === 'ArrowLeft') setStep((step + 2) % 3);
                    }}
                  >
                    {s.title}
                  </button>
                ))}
              </div>

              <div className="hw-panel" role="tabpanel" id="step-panel" aria-labelledby={`step-tab-${step}`}>
                <div className="hw-vis">
                  {step === 0 && (
                    <div className="paper" key="s0">
                      <p className="eyebrow">Upload your CV</p>
                      <div className="lp-drop">
                        <Download />
                        <p className="med" style={{ margin: 0 }}>
                          sam-carter-cv.pdf
                        </p>
                        <p className="xs mtl" style={{ margin: 0 }}>
                          Read in a few seconds. PDF or Word.
                        </p>
                      </div>
                      <div className="h sp">
                        <span className="sm mtl">Latest role</span>
                        <span className="sm med">Frontend Developer</span>
                      </div>
                      <div className="h sp">
                        <span className="sm mtl">Skills</span>
                        <span className="sm med">React, TypeScript, Node.js and 9 more</span>
                      </div>
                    </div>
                  )}
                  {step === 1 && (
                    <div className="paper" key="s1" style={{ gap: 10 }}>
                      <p className="eyebrow">Today's matches</p>
                      {DEMO_JOBS.map((j) => (
                        <div
                          key={j.title}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid #E6E6E6' }}
                        >
                          <div className="v">
                            <span className="med">{j.title}</span>
                            <span className="xs mtl">
                              {j.company} · Posted {j.posted}
                            </span>
                          </div>
                          <span className="score">{j.score}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {step === 2 && (
                    <div className="paper" key="s2">
                      <p className="eyebrow">Your cover letter</p>
                      <p className="sm" style={{ margin: 0, lineHeight: 1.75 }}>
                        Dear Hiring Team, I am applying for the Frontend Engineer role.{' '}
                        <span className="u">I have spent three years building React and TypeScript apps</span> for scheduling and booking,{' '}
                        <span className="u">which is close to the care scheduling work your team does</span>.
                      </p>
                      <p className="xs mtl" style={{ margin: 0 }}>
                        Underlined text was adjusted for this role.
                      </p>
                      <Link className="b b-ink" to="/signup" style={{ alignSelf: 'flex-start' }}>
                        See it in the app
                      </Link>
                    </div>
                  )}
                </div>

                <div className="hw-foot">
                  <div className="hw-copy">
                    <p className="hw-step">Step {step + 1} of 3</p>
                    <h3 className="hw-big">{STEPS[step].big}</h3>
                    <p className="hw-txt">{STEPS[step].text}</p>
                  </div>
                  <div className="hw-nav">
                    <div className="hw-prog" aria-hidden="true">
                      {STEPS.map((s, i) => (
                        <i key={s.title} className={step === i ? 'on' : undefined} />
                      ))}
                    </div>
                    <button className="hw-arrow" type="button" aria-label="Previous step" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M19 12H5M11 6l-6 6 6 6" />
                      </svg>
                    </button>
                    <button
                      className="hw-arrow hw-next"
                      type="button"
                      aria-label={step === 2 ? 'Back to the first step' : 'Next step'}
                      onClick={() => setStep(step === 2 ? 0 : step + 1)}
                    >
                      <Arrow />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ============ YOU STAY IN CONTROL ============ */}
          <section className="sec ct-sec" id="control" aria-labelledby="control-t" style={{ paddingTop: 0 }}>
            <div className="hw-head">
              <div className="v g16">
                <p className="eyebrow">You stay in control</p>
                <h2 className="h2" id="control-t">
                  It does the work. You make the call.
                </h2>
              </div>
              <p className="mtl">
                Shortlist writes and prepares every application. You see everything first, and nothing leaves without your say.
              </p>
            </div>

            <div className="bn">
              <article className="bn-c bn-dark bn-a">
                <div className="bn-txt">
                  <span className="bn-k">Approval</span>
                  <h3>Nothing leaves without you.</h3>
                  <p>Every application waits for your one-tap approval. Changed your mind? You have 10 seconds to undo. Try it.</p>
                </div>
                <div className="bn-demo">
                  <ApproveDemo />
                </div>
              </article>

              <article className="bn-c bn-light bn-b">
                <div className="bn-txt">
                  <span className="bn-k">Match score</span>
                  <h3>Every score has a reason.</h3>
                  <p>No black box. You see exactly why each job made your list.</p>
                </div>
                <div className="bn-card">
                  <div className="row">
                    <span className="med">Why this matches</span>
                    <span className="score">94%</span>
                  </div>
                  <ul className="bn-list">
                    <li>
                      <Tick />
                      Your React and TypeScript experience matches the main requirements.
                    </li>
                    <li>
                      <Tick />
                      Hybrid in Belfast fits your location and work style.
                    </li>
                    <li>
                      <Tick />
                      The salary range is above your minimum.
                    </li>
                  </ul>
                </div>
              </article>

              <article className="bn-c bn-light bn-c3">
                <div className="bn-txt">
                  <span className="bn-k">Your documents</span>
                  <h3>See what we changed.</h3>
                  <p>Every phrase we adjust for a role is underlined. We only use what is in your CV.</p>
                </div>
                <div className="bn-card">
                  <p className="sm" style={{ margin: 0, lineHeight: 1.8 }}>
                    I am applying for the Frontend Engineer role. <span className="u">I have spent three years building React and TypeScript apps</span>
                    , <span className="u">close to the scheduling work your team does</span>.
                  </p>
                  <p className="xs mtl" style={{ margin: 0 }}>
                    Underlined text was adjusted for this role.
                  </p>
                </div>
              </article>

              <article className="bn-c bn-navy bn-d">
                <div className="bn-txt">
                  <span className="bn-k">Your data</span>
                  <h3>Yours to keep, or delete.</h3>
                  <p>
                    We use your CV only to find jobs and write your applications. Download everything or delete your account at any time.
                  </p>
                </div>
                <div className="bn-pills">
                  <span className="bn-pill">
                    <Download />
                    Download my data
                  </span>
                  <span className="bn-pill">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                    Delete my account
                  </span>
                  <span className="bn-pill">
                    <Shield />
                    Built for UK GDPR
                  </span>
                </div>
              </article>
            </div>
          </section>

          {/* ============ FAQ ============ */}
          <section className="w" id="faq" aria-labelledby="faq-t" style={{ paddingBottom: 96 }}>
            <div className="faq">
              <div className="v g16">
                <p className="eyebrow">Questions</p>
                <h2 className="h2" id="faq-t">
                  Good to know.
                </h2>
              </div>
              <div>
                {FAQ.map(([q, a], i) => (
                  <details key={q} open={i === 0}>
                    <summary>
                      {q}
                      <i>
                        <Plus />
                      </i>
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ============ CLOSING ============ */}
          <section className="endwrap" aria-labelledby="end-t">
            <div className="end">
              <span className="lp-pill">
                <b aria-hidden="true" />
                Start today
              </span>
              <h2 className="h2" id="end-t">
                Your next role. <span>Your call.</span>
              </h2>
              <p className="lead">Upload your CV and see today's matches. Every application waits for your approval.</p>
              <div className="ctas">
                <Link className="b b-w" to="/signup">
                  Get started
                  <Arrow />
                </Link>
                <Link className="b b-ow" to="/signin">
                  Sign in
                </Link>
              </div>
              <ul className="end-ticks">
                <li>
                  <Tick />
                  UK jobs from the last two weeks
                </li>
                <li>
                  <Tick />
                  You approve every application
                </li>
                <li>
                  <Tick />
                  10 seconds to undo
                </li>
              </ul>
            </div>
          </section>
        </main>

        {/* ============ FOOTER ============ */}
        <footer className="ftwrap">
          <div className="ft dark">
            <div className="ft-top">
              <div className="ft-brand">
                <a className="lp-logo" href="#top">
                  <i aria-hidden="true">S</i>Shortlist
                </a>
                <p>Find UK jobs that match your CV. Approve every application.</p>
                <Link className="b b-w b-sm" to="/signup" style={{ alignSelf: 'flex-start' }}>
                  Get started
                </Link>
              </div>
              <div className="fcols">
                <div>
                  <h4>Product</h4>
                  <ul>
                    <li>
                      <a href="#how">How it works</a>
                    </li>
                    <li>
                      <a href="#routes">Ways to apply</a>
                    </li>
                    <li>
                      <a href="#control">Your control</a>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4>Account</h4>
                  <ul>
                    <li>
                      <Link to="/signup">Create account</Link>
                    </li>
                    <li>
                      <Link to="/signin">Sign in</Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4>Help</h4>
                  <ul>
                    <li>
                      <a href="#faq">Questions</a>
                    </li>
                    <li>
                      <Link to="/contact">Contact</Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4>Legal</h4>
                  <ul>
                    <li>
                      <Link to="/privacy">Privacy</Link>
                    </li>
                    <li>
                      <Link to="/terms">Terms</Link>
                    </li>
                    <li>
                      <Link to="/cookies">Cookies</Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="ft-mark" aria-hidden="true">
              {'Shortlist'.split('').map((c, i) => (
                <span key={i} style={{ animationDelay: `${(i * 0.12).toFixed(2)}s` }}>
                  {c}
                </span>
              ))}
            </p>
            <div className="fbot">
              <p>© {new Date().getFullYear()} Shortlist. All rights reserved.</p>
              <p>Shortlist is not a recruitment agency. Employers make all hiring decisions.</p>
              <a href="#top" className="ft-up">
                Back to top
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 19V5M6 11l6-6 6 6" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
