import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BareLayout } from './AppShell';

/** Sign in, sign up and account screens: wordmark top-left, one centred column of 440px, no app shell. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <BareLayout>
      <Link className="wm" to="/" style={{ alignSelf: 'flex-start' }}>
        Shortlist
      </Link>
      <div className="v center-block">
        <div className="v g32 fade-in" style={{ maxWidth: 440, width: '100%', margin: '0 auto' }}>
          {children}
        </div>
      </div>
    </BareLayout>
  );
}

/** "New to Shortlist? Create an account" style footer line. */
export function AuthFooter({ text, link, to }: { text: string; link: string; to: string }) {
  return (
    <p className="h wrap g4" style={{ justifyContent: 'center' }}>
      <span className="sm mut">{text}</span>
      <Link to={to} className="btn bt" style={{ minHeight: 44, padding: '0 8px' }}>
        {link}
      </Link>
    </p>
  );
}
