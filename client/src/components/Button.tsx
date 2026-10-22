import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { BackIcon } from './icons';

export type ButtonVariant = 'primary' | 'outline' | 'text';

interface Common {
  variant?: ButtonVariant;
  /** Full width. */
  block?: boolean;
  /** Full width on mobile, at least 200px and left-aligned on desktop. */
  action?: boolean;
}

function classes({ variant = 'primary', block, action }: Common, extra?: string) {
  const v = { primary: 'bp', outline: 'bo', text: 'bt' }[variant];
  return ['btn', v, block && 'bw', action && 'act', extra].filter(Boolean).join(' ');
}

/** One filled primary button per screen. */
export function Button({ variant, block, action, className, type = 'button', ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes({ variant, block, action }, className)} {...rest} />;
}

/** An in-app link styled as a button. Always a real <a>. */
export function ButtonLink({ variant, block, action, className, ...rest }: Common & LinkProps) {
  return <Link className={classes({ variant, block, action }, className)} {...rest} />;
}

/** An external or download link styled as a button. */
export function ButtonA({ variant, block, action, className, ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={classes({ variant, block, action }, className)} {...rest} />;
}

/** The text "Back" link with a chevron, above page content. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="btn bt back">
      <BackIcon />
      {children}
    </Link>
  );
}

export function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="btn bt back" onClick={onClick}>
      <BackIcon />
      {children}
    </button>
  );
}
