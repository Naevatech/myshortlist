import { useLocation } from 'react-router-dom';
import { ApplicationsIcon, ProfileIcon, SettingsIcon, TodayIcon } from './icons';

export const NAV_ITEMS = [
  { to: '/today', label: 'Today', Icon: TodayIcon, prefixes: ['/today', '/jobs'] },
  { to: '/applications', label: 'Applications', Icon: ApplicationsIcon, prefixes: ['/applications'] },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon, prefixes: ['/profile'] },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, prefixes: ['/settings'] },
];

/** Job review and its steps count as part of Today. */
export function useActiveNav() {
  const { pathname } = useLocation();
  return (prefixes: string[]) => (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? 'page' : undefined);
}
