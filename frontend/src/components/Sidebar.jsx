import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, CalendarCheck, Settings,
  LogOut, GraduationCap,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Analytics', icon: BarChart3, path: '/analytics' },
  { name: 'Planner', icon: CalendarCheck, path: '/planner' },
  { name: 'Settings', icon: Settings, path: '/settings' },
];

export default function Sidebar({ active }) {
  const location = useLocation();

  return (
    <aside className="sidebar" style={{
      width: 220,
      minHeight: '100vh',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent)' }}>
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          SDPPS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2 space-y-1">
        {navItems.map(({ name, icon: Icon, path }) => {
          const isActive = active === name || location.pathname === path;
          return (
            <NavLink key={name} to={path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200"
              style={{
                background: isActive ? 'var(--accent-bg)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
              <Icon className="w-[18px] h-[18px]" />
              {name}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom — just logout */}
      <div className="px-3 pb-5 space-y-2">
        <NavLink to="/login"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
          style={{ color: 'var(--text-muted)' }}>
          <LogOut className="w-[18px] h-[18px]" />
          Logout
        </NavLink>
      </div>
    </aside>
  );
}
