import type { ReactNode } from 'react';
import { MobileHeader } from './MobileHeader';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';

interface Props {
  children: ReactNode;
  /** A sticky ActionBar for one-task screens. It replaces the mobile tab bar. */
  actionBar?: ReactNode;
  /** Hide the mobile tab bar (Job review, Check answers). */
  hideTabBar?: boolean;
}

/** Sidebar on desktop; slim header and bottom tab bar on mobile. One breakpoint at 760px. */
export function AppShell({ children, actionBar, hideTabBar }: Props) {
  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Sidebar />
      <div className="content">
        <MobileHeader />
        <main id="main" className="main">
          {children}
        </main>
        {actionBar}
        {!hideTabBar && !actionBar && <TabBar />}
      </div>
    </div>
  );
}

/** Welcome, Verify and Onboarding: no navigation. */
export function BareLayout({ children, top }: { children: ReactNode; top?: ReactNode }) {
  return (
    <div className="shell" style={{ flexDirection: 'column' }}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {top}
      <main id="main" className="main">
        {children}
      </main>
    </div>
  );
}
