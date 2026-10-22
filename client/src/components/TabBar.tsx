import { Link } from 'react-router-dom';
import { NAV_ITEMS, useActiveNav } from './navItems';

/** Mobile only: sticky bottom bar, an outline icon above a 12px label. */
export function TabBar() {
  const current = useActiveNav();
  return (
    <nav className="tabbar" aria-label="Main">
      {NAV_ITEMS.map(({ to, label, Icon, prefixes }) => (
        <Link key={to} className="tb" to={to} aria-current={current(prefixes)}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
