import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import { useTheme } from "../context/ThemeContext";
import { useAgent } from "../hooks/useAgent";
import { useAuth } from "../context/AuthContext";
import {
  AlertTriangle,
  BellRing,
  Shield,
  Sliders,
  Sparkles,
  User,
} from "lucide-react";

function Surface({ children, className = "", glow = null }) {
  return (
    <section
      className={`rounded-[28px] bg-gradient-to-b from-[#0d1426] to-[#080d18] ${className}`}
      style={{
        boxShadow: glow
          ? `0 0 42px ${glow}18, 0 18px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)`
          : "0 18px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </section>
  );
}

function PanelHeading({ icon: Icon, title, subtitle, tint = "#8b5cf6", action = null }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: `${tint}14`,
            boxShadow: `inset 0 1px 0 ${tint}24, 0 12px 28px rgba(0,0,0,0.18)`,
          }}
        >
          <Icon className="h-4 w-4" style={{ color: tint }} />
        </div>
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-serif text-[1.1rem] text-white lg:text-[1.35rem]">{title}</h2>
          {subtitle ? <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="flex-shrink-0 self-start sm:mt-1">{action}</div> : null}
    </div>
  );
}

function StatusPill({ label, tone = "neutral" }) {
  const tones = {
    success: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.22)", color: "#6ee7b7" },
    warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.22)", color: "#fcd34d" },
    danger: { bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.22)", color: "#fda4af" },
    info: { bg: "rgba(34,211,238,0.12)", border: "rgba(34,211,238,0.22)", color: "#67e8f9" },
    neutral: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.08)", color: "#cbd5e1" },
  };
  const style = tones[tone] || tones.neutral;
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
      }}
    >
      {label}
    </span>
  );
}

function StatBlock({ label, value, accent = "#8b5cf6" }) {
  return (
    <div
      className="rounded-[24px] p-5"
      style={{
        background: `linear-gradient(135deg, ${accent}12 0%, rgba(8,11,20,0.96) 100%)`,
        boxShadow: `inset 0 1px 0 ${accent}20, 0 18px 36px rgba(0,0,0,0.18)`,
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Toggle({ value, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className="relative h-8 w-14 rounded-full transition-all disabled:opacity-40"
      style={{
        background: value
          ? "linear-gradient(135deg, rgba(52,211,153,0.95), rgba(20,184,166,0.8))"
          : "rgba(255,255,255,0.08)",
        boxShadow: value
          ? "0 0 20px rgba(52,211,153,0.2), inset 0 1px 0 rgba(255,255,255,0.18)"
          : "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
      role="switch"
      aria-checked={value}
    >
      <span
        className="absolute top-1 h-6 w-6 rounded-full transition-all"
        style={{
          left: value ? "calc(100% - 28px)" : "4px",
          background: "#fff",
          boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
        }}
      />
    </button>
  );
}

function InfoRow({ label, desc, right, border = true }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      style={{ borderBottom: border ? "1px solid rgba(255,255,255,0.05)" : "none" }}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {desc ? <p className="mt-1 text-sm text-slate-500">{desc}</p> : null}
      </div>
      <div className="justify-self-start sm:justify-self-end">{right}</div>
    </div>
  );
}

function AppActionButton({ isBlocked, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl px-3.5 py-2 text-[11px] font-semibold transition-all disabled:opacity-40"
      style={{
        background: isBlocked ? "rgba(244,63,94,0.12)" : "rgba(16,185,129,0.12)",
        color: isBlocked ? "#fda4af" : "#6ee7b7",
        border: `1px solid ${isBlocked ? "rgba(244,63,94,0.22)" : "rgba(16,185,129,0.22)"}`,
      }}
    >
      {isBlocked ? "Unblock" : "Block"}
    </button>
  );
}

export default function Settings() {
  const { dark } = useTheme();
  const { user } = useAuth();
  const {
    connected,
    blocker,
    blockerApps,
    toggleBlocking,
    updateBlockedApp,
    updateBlockerSettings,
  } = useAgent(5000);

  const [alerts, setAlerts] = useState(true);
  const [name, setName] = useState("");
  const [pendingApp, setPendingApp] = useState("");
  const [updatingAutoBlock, setUpdatingAutoBlock] = useState(false);

  const detectedDistractedApps = blockerApps?.distracted_apps ?? [];
  const manualBlockedApps = blockerApps?.blocked_apps ?? blocker?.blocked_apps ?? [];
  const autoBlockedApps = blockerApps?.auto_blocked_apps ?? blocker?.auto_blocked_apps ?? [];
  const effectiveBlockedApps = blockerApps?.effective_blocked_apps ?? blocker?.effective_blocked_apps ?? [];
  const autoBlock = blocker?.auto_block_enabled ?? true;

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user]);

  const blockerSummary = useMemo(() => {
    if (!detectedDistractedApps.length) {
      return "No distracted apps identified yet. Keep the agent running to build suggestions.";
    }
    const totalHits = detectedDistractedApps.reduce((sum, item) => sum + (item.count || 0), 0);
    return `${detectedDistractedApps.length} apps identified from ${totalHits} distracted predictions.`;
  }, [detectedDistractedApps]);

  const handleAppToggle = async (appName, isBlocked) => {
    setPendingApp(appName);
    try {
      await updateBlockedApp(appName, isBlocked ? "unblock" : "block");
    } finally {
      setPendingApp("");
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
    <div className="flex min-h-screen bg-[#040816] text-white">
      <Sidebar active="Settings" />

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto">
        <header
          className="sticky top-0 z-30 px-8 py-4 backdrop-blur-xl"
          style={{
            background: dark ? "rgba(2,5,13,0.92)" : "rgba(248,249,252,0.88)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="mx-auto flex w-full max-w-7xl items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Control Center</p>
              <h1 className="mt-2 font-serif text-2xl text-white lg:text-3xl">Settings</h1>
              <p className="mt-1 text-sm text-slate-500">
                Account details, blocker controls, and session preferences.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={connected ? "Agent connected" : "Agent offline"} tone={connected ? "success" : "warning"} />
              <StatusPill label={blocker?.is_blocking ? "Blocking active" : "Blocking idle"} tone={blocker?.is_blocking ? "danger" : "neutral"} />
              <StatusPill label={blocker?.is_admin ? "Admin access" : "Limited access"} tone={blocker?.is_admin ? "info" : "warning"} />
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6 lg:px-8">
          <Surface glow="#7c3aed" className="overflow-hidden">
            <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.95fr] lg:p-8">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Workspace</p>
                  <h2 className="mt-3 max-w-xl font-serif text-[2rem] leading-[1] tracking-[-0.02em] text-white lg:text-[2.8rem]">
                    Tune the system without breaking your flow.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400 lg:text-base">
                    Keep blocker rules, alerts, and account details aligned with the same live monitoring used across the dashboard.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatBlock label="Blocked Apps" value={String(effectiveBlockedApps.length)} accent="#8b5cf6" />
                  <StatBlock label="Detected Apps" value={String(detectedDistractedApps.length)} accent="#22d3ee" />
                  <StatBlock label="Auto-block" value={autoBlock ? "On" : "Off"} accent={autoBlock ? "#34d399" : "#f59e0b"} />
                </div>
              </div>

              <div
                className="flex flex-col justify-between rounded-[34px] p-6"
                style={{
                  background: "linear-gradient(180deg, rgba(13,17,31,0.95), rgba(8,11,20,0.95))",
                  border: "1px solid rgba(255,255,255,0.04)",
                  boxShadow: "0 24px 50px rgba(2,6,23,0.24), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Live Summary</p>
                  <div className="mt-5 space-y-3">
                    <InfoRow
                      label="Manual override"
                      desc={blocker?.manual_override_enabled ? "Forcing blocking state manually" : "Following live distraction state"}
                      right={<StatusPill label={blocker?.manual_override_enabled ? "Enabled" : "Auto"} tone={blocker?.manual_override_enabled ? "danger" : "info"} />}
                    />
                    <InfoRow
                      label="Detection feed"
                      desc={blockerSummary}
                      right={<StatusPill label={`${detectedDistractedApps.length} apps`} tone="neutral" />}
                    />
                    <InfoRow
                      label="Protection mode"
                      desc={blocker?.is_admin ? "Hosts file + app process controls available" : "Process-based blocking only"}
                      right={<StatusPill label={blocker?.is_admin ? "Full" : "Limited"} tone={blocker?.is_admin ? "success" : "warning"} />}
                      border={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Surface>

          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <Surface className="p-6 lg:p-7">
              <PanelHeading
                icon={User}
                title="Profile"
                subtitle="Authenticated student identity."
                tint="#8b5cf6"
              />

              <div className="mt-6">
                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-slate-500">Name</label>
                  <div
                    className="rounded-2xl px-4 py-3 text-sm font-medium text-white"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    {name || "Unavailable"}
                  </div>
                </div>
              </div>
            </Surface>

            <Surface className="p-6 lg:p-7" glow="#34d399">
              <PanelHeading
                icon={Shield}
                title="Blocker"
                subtitle="Live controls for automatic protection and manual overrides."
                tint="#34d399"
                action={<StatusPill label={blocker?.is_blocking ? "Active" : "Idle"} tone={blocker?.is_blocking ? "danger" : "neutral"} />}
              />

              <div className="mt-6">
                <InfoRow
                  label="Auto-block distractions"
                  desc="Automatically react when the distraction state becomes unsafe."
                  right={<Toggle value={autoBlock} onChange={handleAutoBlockToggle} disabled={!connected || updatingAutoBlock} />}
                />
                <InfoRow
                  label="Manual override"
                  desc={`Currently ${blocker?.manual_override_enabled ? "forcing blocker on" : "following live auto-block state"}`}
                  right={(
                    <button
                      onClick={toggleBlocking}
                      disabled={!connected}
                      className="rounded-xl px-4 py-2 text-xs font-semibold transition-all disabled:opacity-30"
                      style={{
                        background: blocker?.is_blocking ? "rgba(244,63,94,0.12)" : "rgba(16,185,129,0.12)",
                        color: blocker?.is_blocking ? "#fda4af" : "#6ee7b7",
                        border: `1px solid ${blocker?.is_blocking ? "rgba(244,63,94,0.22)" : "rgba(16,185,129,0.22)"}`,
                      }}
                    >
                      {blocker?.manual_override_enabled ? "Disable" : "Enable"}
                    </button>
                  )}
                />
                <InfoRow
                  label="Admin status"
                  desc={blocker?.is_admin ? "Running as admin. Hosts file edits are available." : "Not admin. Process-level app blocking only."}
                  right={<StatusPill label={blocker?.is_admin ? "Admin" : "Limited"} tone={blocker?.is_admin ? "success" : "warning"} />}
                  border={false}
                />
              </div>
            </Surface>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <Surface className="p-6 lg:p-7">
              <PanelHeading
                icon={Sliders}
                title="Detected Apps"
                subtitle="Apps surfaced by distracted prediction history and available for one-click control."
                tint="#22d3ee"
                action={<StatusPill label={`${manualBlockedApps.length} manual / ${autoBlockedApps.length} auto`} tone="info" />}
              />

              <div className="mt-6 space-y-3">
                {detectedDistractedApps.length > 0 ? (
                  detectedDistractedApps.map((app) => (
                    <div
                      key={app.app_name}
                      className="rounded-[24px] p-4"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      }}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{app.display_name}</p>
                            {app.is_manual_blocked ? <StatusPill label="Blocked" tone="danger" /> : null}
                            {!app.is_manual_blocked && app.is_auto_blocked ? <StatusPill label="Auto-blocked" tone="warning" /> : null}
                            {!app.is_blocked && app.protection_reason === "browser_exempt" ? <StatusPill label="Browser exempt" tone="neutral" /> : null}
                            {!app.is_blocked && app.protection_reason === "productive_exempt" ? <StatusPill label="Study-safe" tone="info" /> : null}
                          </div>
                          <p className="mt-2 text-xs leading-6 text-slate-500">
                            Flagged {app.count} times · peak confidence {Math.round((app.latest_confidence || 0) * 100)}%
                            {app.last_seen ? ` · last seen ${app.last_seen}` : ""}
                            {app.is_auto_blocked && app.auto_block_reason ? ` · ${app.auto_block_reason.replaceAll("_", " ")}` : ""}
                          </p>
                        </div>
                        <div className="self-start sm:self-center">
                          <AppActionButton
                            isBlocked={app.is_manual_blocked}
                            disabled={!connected || pendingApp === app.app_name}
                            onClick={() => handleAppToggle(app.app_name, app.is_manual_blocked)}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className="rounded-[24px] p-5"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-4 w-4 text-cyan-300" />
                      <div>
                        <p className="text-sm font-semibold text-white">Waiting for distracted app history</p>
                        <p className="mt-1 text-sm leading-7 text-slate-500">
                          Once the predictor marks sessions as distracted, the dominant apps will appear here for one-click blocking.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Surface>

            <div className="space-y-6">
              <Surface className="p-6 lg:p-7">
                <PanelHeading
                  icon={BellRing}
                  title="Notifications"
                  subtitle="Session-level alerts and small attention nudges."
                  tint="#f59e0b"
                />
                <div className="mt-6">
                  <InfoRow
                    label="Distraction alerts"
                    desc="Show a notification when the system flags distracted behaviour."
                    right={<Toggle value={alerts} onChange={setAlerts} />}
                    border={false}
                  />
                </div>
              </Surface>

              <Surface className="p-6 lg:p-7">
                <PanelHeading
                  icon={AlertTriangle}
                  title="How It Works"
                  subtitle="A quick explanation of what appears on this page."
                  tint="#fb7185"
                />
                <div
                  className="mt-6 rounded-[24px] p-5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <p className="text-sm font-semibold text-white">
                    Distracted apps are discovered from live prediction history.
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    Each time the agent predicts a distracted state, it records the dominant app for that snapshot.
                    This screen aggregates those apps, shows how often they were involved, and lets you manually add or
                    remove them from the blocker list. While the blocker is active, blocked apps are checked again on each collection cycle.
                  </p>
                </div>
              </Surface>
            </div>
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
}
