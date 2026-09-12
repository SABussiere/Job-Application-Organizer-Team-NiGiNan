"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Case Board", icon: "🗂" },
  { href: "/resume", label: "Master Resume", icon: "📄" }
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <div className="brand-tab"></div>
            <h1>Casefile</h1>
          </div>
          <nav className="views desktop-nav">
            {LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`view-link ${pathname === l.href ? "active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav className="mobile-tabbar">
        {LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`tab-link ${pathname === l.href ? "active" : ""}`}
          >
            <span className="tab-icon">{l.icon}</span>
            <span className="tab-label">{l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
