import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import { useAgent } from '../hooks/useAgent';
import { User, Shield, Sliders, Moon } from 'lucide-react';

function Section({ icon: Icon, title, children }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-bg)' }}>
          <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        </div>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" className={`theme-toggle ${value ? 'on' : ''}`}
      onClick={() => onChange(!value)} role="switch" aria-checked={value} />
  );
}

function Row({ label, desc, right }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export default function Settings() {
  const { dark, toggle } = useTheme();
  const { connected, blocker, toggleBlocking } = useAgent(5000);
  const [alerts, setAlerts] = useState(true);
  const [autoBlock, setAutoBlock] = useState(true);
  const [name, setName] = useState('Hanguan');
  const [email, setEmail] = useState('hanguan@university.edu');

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar active="Settings" />
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center px-8 py-4"
          style={{
            background: dark ? 'rgba(12,14,20,0.85)' : 'rgba(248,249,252,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          }}>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        </header>

        <div className="p-6 space-y-5 max-w-3xl">
          <Section icon={User} title="Profile">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }} />
              </div>
            </div>
          </Section>

          <Section icon={Shield} title="Blocker">
            <Row label="Auto-block distractions" desc="Automatically block when distraction > 70%"
              right={<Toggle value={autoBlock} onChange={setAutoBlock} />} />
            <Row label="Manual override" desc={`Currently ${blocker?.is_blocking ? 'blocking' : 'not blocking'}`}
              right={
                <button onClick={toggleBlocking} disabled={!connected}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
                  style={{
                    background: blocker?.is_blocking ? 'var(--danger-bg)' : 'var(--success-bg)',
                    color: blocker?.is_blocking ? 'var(--danger)' : 'var(--success)',
                    border: `1px solid ${blocker?.is_blocking ? 'var(--danger)' : 'var(--success)'}`,
                  }}>
                  {blocker?.is_blocking ? 'Disable' : 'Enable'}
                </button>
              } />
            <Row label="Admin status" desc={blocker?.is_admin ? 'Running as admin — hosts file editable' : 'Not admin — app killing only'}
              right={
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: blocker?.is_admin ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: blocker?.is_admin ? 'var(--success)' : 'var(--warning)',
                  }}>
                  {blocker?.is_admin ? 'Admin' : 'Limited'}
                </span>
              } />
          </Section>

          <Section icon={Sliders} title="Notifications">
            <Row label="Distraction alerts" desc="Show notification when distracted"
              right={<Toggle value={alerts} onChange={setAlerts} />} />
          </Section>

          <Section icon={Moon} title="Appearance">
            <Row label="Dark mode" right={<Toggle value={dark} onChange={toggle} />} />
          </Section>
        </div>
        <Footer />
      </main>
    </div>
  );
}
