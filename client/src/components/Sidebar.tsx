import { Fragment, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme';
import { ChevronDownIcon, LogOutIcon, MoonIcon } from './icons';
import { NAV_ITEMS, TOOL_ITEMS, TOOLS, useActiveNav } from './navItems';

const TOOLS_KEY = 'shortlist-tools-open';

/** Open by default; remembered on this device. */
function useToolsOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(TOOLS_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(TOOLS_KEY, String(!o));
      } catch {
        /* remembered for this visit only */
      }
      return !o;
    });
  return [open, toggle];
}

/** Desktop only: wordmark, four links with icons, and at the bottom the dark mode switch and Log out. */
export function Sidebar() {
  const current = useActiveNav();
  const { dark, toggle } = useTheme();
  const [toolsOpen, toggleTools] = useToolsOpen();
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
      {NAV_ITEMS.map(({ to, label, Icon, prefixes }, i) => (
        <Fragment key={to}>
          <Link className="sl" to={to} aria-current={current(prefixes)}>
            <Icon />
            {label}
          </Link>
          {i === 1 && (
            <div className="sg">
              <button className="sl sg-b" type="button" aria-expanded={toolsOpen} aria-controls="nav-tools" onClick={toggleTools}>
                <TOOLS.Icon />
                {TOOLS.label}
                <ChevronDownIcon />
              </button>
              {toolsOpen && (
                <div className="sg-l" id="nav-tools">
                  {TOOL_ITEMS.map((t) => (
                    <Link key={t.to} className="sl sub" to={t.to} aria-current={current(t.prefixes)}>
                      {t.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </Fragment>
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
