import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTitle } from '../lib/hooks';
import { BareLayout } from '../components/AppShell';

/** Where people can write to. Set VITE_CONTACT_EMAIL in client/.env. */
const CONTACT = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || '';

function InfoLayout({ title, children }: { title: string; children: ReactNode }) {
  useTitle(title);
  return (
    <BareLayout>
      <div className="h sp" style={{ minHeight: 44 }}>
        <Link className="wm" to="/">
          Shortlist
        </Link>
        <Link className="btn bt" to="/" style={{ marginRight: -12 }}>
          Home
        </Link>
      </div>
      <article className="col v g32" style={{ padding: '48px 0 64px' }}>
        <h1>{title}</h1>
        <div className="v g24 info">{children}</div>
        <p className="sm mut">
          <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · <Link to="/cookies">Cookies</Link> ·{' '}
          <Link to="/contact">Contact</Link>
        </p>
      </article>
    </BareLayout>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="v g8">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Privacy() {
  return (
    <InfoLayout title="Privacy">
      <p className="mut">What Shortlist stores, why, and what you can do about it.</p>
      <Section title="What we store">
        <ul className="v g8" style={{ listStyle: 'disc', paddingLeft: 20 }}>
          <li>Your account: email address, name, how you sign in, and your settings.</li>
          <li>Your CV: the file you upload, its text, and the details we read from it.</li>
          <li>Your preferences: roles, location and distance, work style, minimum salary, and work authorisation.</li>
          <li>Matches and documents: jobs we matched to you, their scores and reasons, and the CV and cover letter written for each.</li>
          <li>Applications: what you approved, when, what was sent and to whom, status updates and your private notes.</li>
          <li>Security records: hashed passwords, codes and session tokens, and a log of actions such as sign-in and approval.</li>
        </ul>
      </Section>
      <Section title="How we use it">
        <p>
          We use your CV, preferences and work authorisation to find jobs and to write your CV and cover letter for each one. We never send
          an application without your approval. We do not sell your data, and employers only receive what you approve.
        </p>
      </Section>
      <Section title="Your choices">
        <p>
          You can download a copy of everything, or delete your account, at any time from Settings. Deleting your account blocks sign-in
          straight away, and your data and files are removed within 30 days.
        </p>
      </Section>
      <Section title="Services we use">
        <p>
          When they are set up: an email service to send messages, an AI service to read your CV and write documents, Google if you sign in
          with Google, and secure file storage. Each receives only what it needs for that task.
        </p>
      </Section>
    </InfoLayout>
  );
}

export function Terms() {
  return (
    <InfoLayout title="Terms">
      <p className="mut">The short version of how Shortlist works and what we each agree to.</p>
      <Section title="What Shortlist does">
        <p>
          Shortlist finds UK jobs that may suit your CV, writes a tailored CV and cover letter for each, and sends an application only when
          you approve it. Shortlist is not a recruitment agency. Employers make all hiring decisions, and we cannot promise interviews or
          offers.
        </p>
      </Section>
      <Section title="Your part">
        <p>
          Keep the information in your CV and profile accurate, and check each document and answer before you approve it. You are
          responsible for the applications you approve.
        </p>
      </Section>
      <Section title="Your account">
        <p>Keep your password private. You can close your account at any time from Settings.</p>
      </Section>
    </InfoLayout>
  );
}

export function Cookies() {
  return (
    <InfoLayout title="Cookies">
      <p className="mut">Shortlist uses only the cookies it needs to keep you signed in. No advertising or tracking cookies.</p>
      <Section title="The cookies we set">
        <ul className="v g8" style={{ listStyle: 'disc', paddingLeft: 20 }}>
          <li>
            <span className="med">sl_at</span>: keeps you signed in for a short time. It expires after 15 minutes.
          </li>
          <li>
            <span className="med">sl_rt</span>: renews your sign-in so you do not have to sign in again each visit. It is replaced each time
            it is used.
          </li>
          <li>
            <span className="med">sl_g</span>: used only while you sign in with Google, then removed.
          </li>
        </ul>
        <p>These cookies are essential for the service to work, so they do not need your consent. Signing out removes them.</p>
      </Section>
    </InfoLayout>
  );
}

export function Contact() {
  return (
    <InfoLayout title="Contact">
      <p>
        Questions about Shortlist, your account or your data?{' '}
        {CONTACT ? (
          <>
            Email us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </>
        ) : (
          'Reply to any email we have sent you and it will reach us.'
        )}
      </p>
      <p className="mut">
        Many answers are on the <Link to="/#faq">home page</Link>. You can download or delete your data at any time from Settings.
      </p>
    </InfoLayout>
  );
}
