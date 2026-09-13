"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const LINKS = [
  { href: "/", label: "Cases", icon: "/icons/case-board-icon.svg" },
  { href: "/resume", label: "Master Resume", icon: "/icons/master-resume-icon.svg" },
  { href: "/map", label: "Map", icon: "/icons/map-icon.svg" },
  { href: "/review", label: "Email Review", icon: "/icons/email-review-icon.svg" }
];

export default function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <img src="/logo.png" alt="Casefile logo" className="brand-tab" />
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
          {user && (
            <div className="nav-account">
              <span className="nav-email">{user.email}</span>
              <button className="btn-secondary-inline" onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <nav className="mobile-tabbar">
        {LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`tab-link ${pathname === l.href ? "active" : ""}`}
          >
            <span className="tab-icon" aria-hidden="true">
              <img src={l.icon} alt="" />
            </span>
            <span className="tab-label">{l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
