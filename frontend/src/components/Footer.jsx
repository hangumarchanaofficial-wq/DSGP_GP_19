import { Github, Linkedin, Mail, Heart, ExternalLink } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full" style={{ background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)' }}>
      <div className="w-full px-8 py-12">

        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">

          {/* Brand */}
          <div className="space-y-4">
            <div>
              <span className="brand-mark text-[1.35rem]" style={{ color: 'var(--text-primary)' }}>
                SDPPS
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Smart Student Distraction Prediction & Prevention System. AI-powered
              distraction detection, adaptive planning, and focus analytics.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Features
            </h4>
            <ul className="space-y-2.5">
              {[
                'Real-time Distraction Detection',
                'BiLSTM + App Category Scoring',
                'Adaptive Study Planner',
                'Focus Streak & Badges',
                'Auto Schedule Rescheduling',
              ].map(item => (
                <li key={item} className="text-xs transition cursor-default" style={{ color: 'var(--text-muted)' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Tech Stack */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Tech Stack
            </h4>
            <ul className="space-y-2.5">
              {[
                'React + Tailwind CSS',
                'Flask / FastAPI Backend',
                'BiLSTM Attention Model',
                'Random Forest Planner',
                'PySide Desktop Agent',
              ].map(item => (
                <li key={item} className="text-xs transition cursor-default" style={{ color: 'var(--text-muted)' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Project Links */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Project
            </h4>
            <ul className="space-y-2.5">
              {[
                ['Documentation', '#'],
                ['IEEE Report', '#'],
                ['Source Code', 'https://github.com/hangumarchanaofficial-wq/DSGP_GP_19'],
                ['API Reference', '#'],
              ].map(([label, href]) => (
                <li key={label}>
                  <a href={href} target={href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="text-xs flex items-center gap-1.5 group transition"
                    style={{ color: 'var(--text-muted)' }}>
                    {label}
                    <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition"
                      style={{ color: 'var(--accent)' }} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            &copy; {currentYear} SDPPS — Smart Student Distraction Prediction & Prevention System. Built with
            <Heart size={10} className="inline mx-1 relative -top-[1px]" style={{ color: 'var(--danger)' }} />
            for academic success.
          </p>

          <div className="flex items-center gap-3">
            {[
              [Github, 'https://github.com/hangumarchanaofficial-wq/DSGP_GP_19', 'GitHub'],
              [Linkedin, 'https://linkedin.com', 'LinkedIn'],
              [Mail, 'mailto:hello@example.com', 'Email'],
            ].map(([Icon, href, label]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                aria-label={label}
                className="p-2 rounded-lg transition"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}>
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
