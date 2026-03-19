import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { Bell, User, Moon, Trash2, ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/* ── Toggle Switch Component ────────────────────── */
function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      className={`toggle ${value ? 'on' : ''}`}
      onClick={() => onChange(!value)}
      aria-checked={value}
      role="switch"
    />
  );
}

/* ── Section Card ────────────────────────────────── */
function Section({ icon: Icon, title, iconColor = 'text-blue-600', children }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ── Row ─────────────────────────────────────────── */
function SettingRow({ label, desc, right }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
      </div>
      <div className="flex-shrink-0 flex items-center">{right}</div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────── */
export default function Settings() {
  const { dark, toggle } = useTheme();

  // State
  const [aiMonitoring, setAiMonitoring]             = useState(true);
  const [distractionAlerts, setDistractionAlerts]   = useState(true);
  const [sensitivity, setSensitivity]               = useState(75);
  const [websiteTracking, setWebsiteTracking]       = useState(true);
  const [appTracking, setAppTracking]               = useState(false);
  const [distractionAlerts2, setDistractionAlerts2] = useState(true);
  const [retention, setRetention]                   = useState('30 days');
  const [accentColor, setAccentColor]               = useState('#2563eb');

  const [name, setName]   = useState('Alex Johnson');
  const [email, setEmail] = useState('alex.j@university.edu');

  const accents = ['#2563eb', '#ef4444', '#22c55e', '#8b5cf6', '#374151'];

  return (
    <div className="flex min-h-screen page-bg">
      <Sidebar active="Settings" />

      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">

        {/* ── Top Bar ─────────────────────────── */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <nav className="breadcrumb">
            <span className="parent">Dashboard</span>
            <span className="sep">/</span>
            <span className="current">Settings</span>
          </nav>
          <div className="flex items-center gap-3">
            <button className="relative btn-ghost border-0 w-9 h-9 p-0">
              <Bell className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
              AJ
            </div>
          </div>
        </header>

        {/* ── Content ─────────────────────────── */}
        <main className="flex-1 p-6 space-y-5">

          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings & Privacy</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Manage your account preferences and productivity configurations.
            </p>
          </div>

          {/* ── Profile Settings ──────────────── */}
          <Section icon={User} title="Profile Settings">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center">
                  {/* Silhouette icon */}
                  <svg viewBox="0 0 80 80" className="w-full h-full">
                    <rect width="80" height="80" fill="transparent"/>
                    <circle cx="40" cy="30" r="16" fill="rgba(255,255,255,0.85)" />
                    <ellipse cx="40" cy="75" rx="26" ry="20" fill="rgba(255,255,255,0.7)" />
                  </svg>
                </div>
                <button className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  Upload Photo
                </button>
              </div>

              {/* Fields */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                  <input
                    className="field"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Email Address</label>
                  <input
                    className="field"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <button className="btn-ghost text-sm">Change Password</button>
                </div>
              </div>
            </div>
          </Section>

          {/* ── AI & Alerts ───────────────────── */}
          <Section icon={Bell} title="AI & Alerts" iconColor="text-blue-600">
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>

              <SettingRow
                label="Enable AI Monitoring"
                desc="Allow AI to analyse study patterns for personalised suggestions."
                right={<Toggle value={aiMonitoring} onChange={setAiMonitoring} />}
              />

              <div className="py-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Left col */}
                <div>
                  <SettingRow
                    label="Enable Distraction Alerts"
                    desc="Receive nudges when you spend too much time on non-study sites."
                    right={<Toggle value={distractionAlerts} onChange={setDistractionAlerts} />}
                  />
                </div>
                {/* Right col */}
                <div className="space-y-3">
                  <SettingRow
                    label="Enable Distraction Alerts"
                    right={<Toggle value={distractionAlerts2} onChange={setDistractionAlerts2} />}
                  />
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                      <span>Sensitivity</span>
                      <span>High</span>
                    </div>
                    <input
                      type="range" min={0} max={100} value={sensitivity}
                      onChange={e => setSensitivity(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ accentColor: '#2563eb' }}
                    />
                  </div>
                </div>
              </div>

              <div className="py-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <SettingRow
                  label="Website Tracking"
                  right={<Toggle value={websiteTracking} onChange={setWebsiteTracking} />}
                />
                <SettingRow
                  label="App Usage Tracking"
                  right={<Toggle value={appTracking} onChange={setAppTracking} />}
                />
              </div>

              <div className="py-3 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Data Retention Period</p>
                  <div className="relative w-48">
                    <select
                      value={retention}
                      onChange={e => setRetention(e.target.value)}
                      className="field appearance-none pr-8 cursor-pointer"
                    >
                      {['7 days', '14 days', '30 days', '90 days', '1 year'].map(o => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-semibold border border-red-200 dark:border-red-500/25 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                  <Trash2 className="w-4 h-4" />
                  Delete All Local Data
                </button>
              </div>
            </div>
          </Section>

          {/* ── Appearance ────────────────────── */}
          <Section icon={Moon} title="Appearance" iconColor="text-indigo-500">
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              <SettingRow
                label="Light / Dark Mode"
                right={<Toggle value={dark} onChange={toggle} />}
              />
              <div className="py-4">
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Accent Color</p>
                <div className="flex items-center gap-3">
                  {accents.map(color => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className="w-8 h-8 rounded-full transition-all hover:scale-110"
                      style={{
                        background: color,
                        outline: accentColor === color ? `3px solid ${color}` : 'none',
                        outlineOffset: 3,
                        boxShadow: accentColor === color ? `0 0 0 2px var(--bg-card)` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Save button */}
          <div className="flex justify-end pb-4">
            <button className="btn-primary px-8">Save Changes</button>
          </div>
        </main>
      </div>
    </div>
  );
}
