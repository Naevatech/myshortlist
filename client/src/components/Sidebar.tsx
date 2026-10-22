import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme';
import { LogOutIcon, MoonIcon } from './icons';
import { NAV_ITEMS, useActiveNav } from './navItems';

/** Desktop only: wordmark, four links with icons, and at the bottom the dark mode switch and Log out. */
export function Sidebar() {
  const current = useActiveNav();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logOut = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      navigate('/signed-out', { replace: true });
      queryClient.clear();
    },
  });

  return (
    <nav className="side" aria-label="Main">
      <Link className="wm" to="/today">
        Shortlist
      </Link>
      {NAV_ITEMS.map(({ to, label, Icon, prefixes }) => (
        <Link key={to} className="sl" to={to} aria-current={current(prefixes)}>
          <Icon />
          {label}
        </Link>
      ))}
      <div className="side-foot">
        <button className="sl" type="button" role="switch" aria-checked={dark} onClick={toggle}>
          <MoonIcon />
          Dark mode
          <span className="sw" data-on={dark} aria-hidden="true">
            <i />
          </span>
        </button>
        <button className="sl" type="button" disabled={logOut.isPending} onClick={() => logOut.mutate()}>
          <LogOutIcon />
          Log out
        </button>
      </div>
    </nav>
  );
}
