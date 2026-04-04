import { Link } from "react-router-dom";
import { Github } from "lucide-react";

const navLinks = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Analytics", to: "/analytics" },
  { label: "Planner", to: "/planner" },
  { label: "Settings", to: "/settings" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto px-6 lg:px-8 flex items-center"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.12)",
        background: "#0a0e1a",
        minHeight: "120px",
      }}
    >
      <div className="mx-auto w-full max-w-[1440px] flex flex-col sm:flex-row items-center justify-between gap-4">

        {/* Brand + copyright */}
        <div className="flex items-center gap-2.5">
          <span
            className="text-xs font-black tracking-widest uppercase"
            style={{ color: "#e2e8f0" }}
          >
            SDPPS
          </span>
          <span className="text-[11px]" style={{ color: "#64748b" }}>
            © {year} · Smart Distraction Prevention
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-[12px] font-semibold transition-colors hover:text-white"
              style={{ color: "#94a3b8" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* GitHub */}
        <a
          href="https://github.com/hangumarchanaofficial-wq/DSGP_GP_19"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#cbd5e1",
          }}
        >
          <Github className="w-3.5 h-3.5" />
          <span className="text-[12px] font-semibold">GitHub</span>
        </a>

      </div>
    </footer>
  );
}
