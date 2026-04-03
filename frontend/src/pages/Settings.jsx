import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import { useAgent } from '../hooks/useAgent';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Sliders, AlertTriangle, Sparkles } from 'lucide-react';

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
    <button
      type="button"
      className={`theme-toggle ${value ? 'on' : ''}`}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
    />
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

function AppActionButton({ isBlocked, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40"
      style={{
        background: isBlocked ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
        color: isBlocked ? 'var(--danger)' : 'var(--success)',
        border: `1px solid ${isBlocked ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)'}`,
      }}
    >
      {isBlocked ? 'Unblock' : 'Block'}
    </button>
  );
}

export default function Settings() {
  const { dark } = useTheme();
  const { user } = useAuth();
  const { connected, blocker, blockerApps, toggleBlocking, updateBlockedApp, updateBlockerSettings } = useAgent(5000);
  const [alerts, setAlerts] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pendingApp, setPendingApp] = useState('');
  const [updatingAutoBlock, setUpdatingAutoBlock] = useState(false);

  const detectedDistractedApps = blockerApps?.distracted_apps ?? [];
  const blockedApps = blockerApps?.blocked_apps ?? blocker?.blocked_apps ?? [];
  const autoBlock = blocker?.auto_block_enabled ?? true;

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user]);

  const blockerSummary = useMemo(() => {
    if (!detectedDistractedApps.length) {
      return 'No distracted apps identified yet. Keep the agent running to build suggestions.';
    }
    const totalHits = detectedDistractedApps.reduce((sum, item) => sum + (item.count || 0), 0);
    return `${detectedDistractedApps.length} apps identified from ${totalHits} distracted predictions.`;
  }, [detectedDistractedApps]);

  const handleAppToggle = async (appName, isBlocked) => {
    setPendingApp(appName);
    try {
      await updateBlockedApp(appName, isBlocked ? 'unblock' : 'block');
    } finally {
      setPendingApp('');
    }
  };

  const handleAutoBlockToggle = async (nextValue) => {
    if (!connected || updatingAutoBlock) return;
    setUpdatingAutoBlock(true);
    try {
      await updateBlockerSettings({ auto_block_enabled: nextValue });
    } finally {
      setUpdatingAutoBlock(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar active="Settings" />
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <header
          className="sticky top-0 z-30 flex items-center px-8 py-4"
          style={{
            background: dark ? 'rgba(12,14,20,0.85)' : 'rgba(248,249,252,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        </header>

        <div className="flex-1 p-6 lg:p-8 space-y-5">
          <Section icon={User} title="Profile">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Name</label>
                <input
                  value={name}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input
                  value={email}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1.5px solid var(--border)' }}
                />
              </div>
            </div>
            {user && (
              <div
                className="mt-4 rounded-2xl p-4 flex flex-wrap gap-5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Member since</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {user.created_at ? new Date(user.created_at).toLocaleString() : 'Available after sync'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Last login</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Current session'}
                  </p>
                </div>
              </div>
            )}
          </Section>

          <Section icon={Shield} title="Blocker">
            <Row
              label="Auto-block distractions"
              desc="Automatically block when distraction > 70%"
              right={<Toggle value={autoBlock} onChange={handleAutoBlockToggle} />}
            />
            <Row
              label="Manual override"
              desc={`Currently ${blocker?.manual_override_enabled ? 'forcing blocker on' : 'following live auto-block state'}`}
              right={(
                <button
                  onClick={toggleBlocking}
                  disabled={!connected}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
                  style={{
                    background: blocker?.is_blocking ? 'var(--danger-bg)' : 'var(--success-bg)',
                    color: blocker?.is_blocking ? 'var(--danger)' : 'var(--success)',
                    border: `1px solid ${blocker?.is_blocking ? 'var(--danger)' : 'var(--success)'}`,
                  }}
                >
                  {blocker?.manual_override_enabled ? 'Disable' : 'Enable'}
                </button>
              )}
            />
            <Row
              label="Admin status"
              desc={blocker?.is_admin ? 'Running as admin — hosts file editable' : 'Not admin — app killing only'}
              right={(
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: blocker?.is_admin ? 'var(--success-bg)' : 'var(--warning-bg)',
                    color: blocker?.is_admin ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {blocker?.is_admin ? 'Admin' : 'Limited'}
                </span>
              )}
            />

            <div className="pt-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Distracted apps detected</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{blockerSummary}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Manual list</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{blockedApps.length}</p>
                </div>
              </div>

              {detectedDistractedApps.length > 0 ? (
                <div className="space-y-3">
                  {detectedDistractedApps.map((app) => (
                    <div
                      key={app.app_name}
                      className="rounded-2xl p-4"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{app.display_name}</p>
                            {app.is_manual_blocked && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}
                              >
                                blocked
                              </span>
                            )}
                            {!app.is_manual_blocked && app.is_auto_blocked && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}
                              >
                                auto-blocked
                              </span>
                            )}
                            {!app.is_blocked && app.protection_reason === 'browser_exempt' && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: 'rgba(148,163,184,0.12)', color: 'var(--text-muted)' }}
                              >
                                browser exempt
                              </span>
                            )}
                            {!app.is_blocked && app.protection_reason === 'productive_exempt' && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}
                              >
                                study-safe
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Flagged {app.count} times · peak confidence {Math.round((app.latest_confidence || 0) * 100)}%
                            {app.last_seen ? ` · last seen ${app.last_seen}` : ''}
                            {app.is_auto_blocked && app.auto_block_reason ? ` · ${app.auto_block_reason.replaceAll('_', ' ')}` : ''}
                          </p>
                        </div>
                        <AppActionButton
                          isBlocked={app.is_manual_blocked}
                          disabled={!connected || pendingApp === app.app_name}
                          onClick={() => handleAppToggle(app.app_name, app.is_manual_blocked)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-2xl p-5 flex items-start gap-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                >
                  <Sparkles className="w-4 h-4 mt-0.5" style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Waiting for distracted app history</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Once the predictor marks sessions as distracted, the dominant apps will appear here for one-click blocking.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </Section>

          <Section icon={Sliders} title="Notifications">
            <Row
              label="Distraction alerts"
              desc="Show notification when distracted"
              right={<Toggle value={alerts} onChange={setAlerts} />}
            />
          </Section>

          <Section icon={AlertTriangle} title="How It Works">
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Distracted apps are discovered from live prediction history.
              </p>
              <p className="text-xs mt-2 leading-6" style={{ color: 'var(--text-muted)' }}>
                Each time the agent predicts a distracted state, it records the dominant app for that snapshot.
                This screen aggregates those apps, shows how often they were involved, and lets you manually add or
                remove them from the blocker list. While the blocker is active, blocked apps are re-checked on every
                collection cycle, so reopening them will be closed again.
              </p>
            </div>
          </Section>
        </div>
        <Footer />
      </main>
    </div>
  );
}
