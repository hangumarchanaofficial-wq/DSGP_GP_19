import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap, LayoutDashboard, BarChart2,
  CheckSquare, CalendarDays, Settings,
  Sun, Moon, LogOut, ChevronRight, Zap
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Analytics',  icon: BarChart2,       path: '/analytics'  },
  { name: 'Tasks',      icon: CheckSquare,      path: '/tasks'      },
  { name: 'Calendar',   icon: CalendarDays,     path: '/calendar'   },
  { name: 'Settings',   icon: Settings,         path: '/settings'   },
];

export default function Sidebar({ active }) {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <aside className="sidebar w-[220px] min-w-[220px] flex flex-col min-h-screen">
      {/* ── Logo ────────────────────────────── */}
      <Link to="/dashboard" className="flex items-center gap-3 px-5 py-6 group">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/45 transition-shadow">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-[15px] tracking-tight" style={{ color: 'var(--text-primary)' }}>SDPPS</p>
          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Student Platform</p>
        </div>
      </Link>

      {/* ── Navigation ──────────────────────── */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ name, icon: Icon, path }) => {
          const isActive = active === name;
          return (
            <Link
              key={name}
              to={path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <div className={`icon-badge ${
                isActive
                  ? 'bg-blue-100 dark:bg-blue-500/15'
                  : 'bg-transparent'
              }`}>
                <Icon
                  className={`w-[18px] h-[18px] transition-colors ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : ''
                  }`}
                />
              </div>
              <span>{name}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Pro Plan Card ────────────────────── */}
      <div className="pro-card">
        <p className="text-[10px] font-semibold text-blue-300 mb-0.5">Pro Plan</p>
        <p className="text-[13px] font-bold text-white leading-tight">Upgrade for AI Insights</p>
        <button className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[12px] font-semibold text-white transition-colors">
          <Zap className="w-3 h-3" />
          View Plans
        </button>
      </div>

      {/* ── Theme Toggle + Logout ────────────── */}
      <div className="px-3 pb-4 space-y-1">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          {dark
            ? <Moon className="w-4 h-4 text-blue-400" />
            : <Sun  className="w-4 h-4 text-amber-500" />}
          <span>{dark ? 'Dark Mode' : 'Light Mode'}</span>
          <div className={`toggle ml-auto ${dark ? 'on' : ''}`} />
        </button>

        <button
          onClick={() => navigate('/login')}
          className="nav-item w-full text-left"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Logout
        </button>
      </div>
    </aside>
  );
}