import { Link } from 'react-router-dom';
import { NAV_ITEMS, TOOL_ITEMS, TOOLS, useActiveNav } from './navItems';

/** Mobile only: sticky bottom bar, an outline icon above a 12px label. Tools sits in the middle. */
export function TabBar() {
  const current = useActiveNav();
  const items = [...NAV_ITEMS.slice(0, 2), { to: TOOL_ITEMS[0].to, label: TOOLS.label, Icon: TOOLS.Icon, prefixes: TOOLS.prefixes }, ...NAV_ITEMS.slice(2)];
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map(({ to, label, Icon, prefixes }) => (
        <Link key={to} className="tb" to={to} aria-current={current(prefixes)}>
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}
