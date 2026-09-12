"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Case Board" },
    { href: "/resume", label: "Master Resume" },
    { href: "/reminders", label: "Follow-ups" }
  ];

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand">
          <div className="brand-tab"></div>
          <h1>CASEFILE</h1>
          <p>an open case for every application</p>
        </div>
        <nav className="views">
          {links.map(l => (
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
  );
}
