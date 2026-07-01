import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/add', label: 'Add Application', end: false },
  { to: '/applications', label: 'Application Manager', end: false },
  { to: '/search', label: 'JD Details', end: false },
  { to: '/interview-notes', label: 'Interview Notes', end: false },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-menu-open', menuOpen);
    return () => document.body.classList.remove('nav-menu-open');
  }, [menuOpen]);

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <h1 className="header__title">Job Application Tracker</h1>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            <span
              className={`nav-toggle__icon${menuOpen ? ' nav-toggle__icon--open' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        <nav id="site-navigation" className={`nav${menuOpen ? ' nav--open' : ''}`}>
          <ThemeToggle />
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav__link${isActive ? ' nav__link--active' : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
