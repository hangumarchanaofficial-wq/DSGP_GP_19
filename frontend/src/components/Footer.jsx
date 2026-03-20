// components/Footer.jsx
import React from 'react';
import { Brain, Github, Linkedin, Mail, Heart, ExternalLink } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-[#0a0c10]">
      <div className="max-w-[1440px] mx-auto px-8 py-12">

        {/* ── Top row ── */}
        <div className="grid grid-cols-4 gap-12 mb-12">

          {/* Brand */}
          <div className="col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Brain size={16} className="text-indigo-400" />
              </div>
              <span className="text-[15px] font-semibold text-white tracking-tight">
                Adaptive Planner
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              AI-powered academic planner that predicts task completion,
              adapts schedules in real time, and helps students stay on track.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
              Features
            </h4>
            <ul className="space-y-2.5">
              {[
                'Smart Scheduling',
                'ML Predictions',
                'Focus Timer',
                'Streak Tracking',
                'Distraction Alerts',
              ].map(item => (
                <li key={item} className="text-xs text-gray-500 hover:text-gray-300 transition cursor-default">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Tech Stack */}
          <div className="space-y-4">
            <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
              Tech Stack
            </h4>
            <ul className="space-y-2.5">
              {[
                'React + Tailwind CSS',
                'FastAPI Backend',
                'Random Forest Model',
                'SQLite Persistence',
                'Lucide Icons',
              ].map(item => (
                <li key={item} className="text-xs text-gray-500 hover:text-gray-300 transition cursor-default">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Project Links */}
          <div className="space-y-4">
            <h4 className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
              Project
            </h4>
            <ul className="space-y-2.5">
              {[
                ['Documentation', '#'],
                ['IEEE Report', '#'],
                ['Source Code', '#'],
                ['API Reference', '#'],
              ].map(([label, href]) => (
                <li key={label}>
                  <a href={href}
                    className="text-xs text-gray-500 hover:text-indigo-400 transition
                      flex items-center gap-1.5 group">
                    {label}
                    <ExternalLink size={10}
                      className="opacity-0 group-hover:opacity-100 transition" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-white/[0.06]" />

        {/* ── Bottom row ── */}
        <div className="flex items-center justify-between pt-8">
          <p className="text-[11px] text-gray-600">
            &copy; {currentYear} Adaptive Planner. Built with
            <Heart size={10} className="inline mx-1 text-red-400/60 relative -top-[1px]" />
            for academic success.
          </p>

          {/* Social links */}
          <div className="flex items-center gap-3">
            {[
              [Github, 'https://github.com', 'GitHub'],
              [Linkedin, 'https://linkedin.com', 'LinkedIn'],
              [Mail, 'mailto:hello@example.com', 'Email'],
            ].map(([Icon, href, label]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                aria-label={label}
                className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]
                  hover:bg-white/[0.06] hover:border-white/[0.1] transition text-gray-600
                  hover:text-gray-300">
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
