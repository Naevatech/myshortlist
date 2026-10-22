import { Link } from 'react-router-dom';
import { useTheme } from '../lib/theme';
import { MoonIcon, SunIcon } from './icons';

/** Mobile only: slim header with the wordmark linking to Today, and the light/dark switch. */
export function MobileHeader() {
  const { dark, toggle } = useTheme();
  return (
    <header className="mhead">
      <Link className="wm" to="/today">
        Shortlist
      </Link>
      <button className="mth" type="button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  );
}
