"use client";

import { SECTION_TITLES } from "@/lib/constants";
import { dateRange, groupByType } from "@/lib/latex";

/**
 * An on-page rendering of the resume, laid out to match Jake's Resume, that
 * the browser's own print engine turns into a PDF ("Save as PDF" in the
 * print dialog). It shares `groupByType` and `dateRange` with the LaTeX
 * renderer, so section order and date formatting can't drift between the
 * two; only the typesetting differs.
 *
 * It is an approximation of the pdfLaTeX output, not a reproduction of it —
 * the LaTeX tab remains the authority on exact typography.
 */

/**
 * `dateRange` returns LaTeX's "--" for an en dash, which is correct in a
 * .tex file but renders as two literal hyphens in HTML.
 */
function displayDates(module) {
  return dateRange(module).replace(/\s*--\s*/g, " – ");
}

function bulletsOf(module) {
  if (!Array.isArray(module.bullets)) return [];
  return module.bullets.map(b => String(b).trim()).filter(Boolean);
}

function Bullets({ module }) {
  const lead = (module.content || "").trim();
  const bullets = bulletsOf(module);
  if (!lead && bullets.length === 0) return null;
  return (
    <ul className="rs-items">
      {lead && <li>{lead}</li>}
      {bullets.map((b, i) => <li key={i}>{b}</li>)}
    </ul>
  );
}

/** Bold line with a right-aligned counterpart, then an italic line below. */
function Subheading({ leftTop, rightTop, leftSub, rightSub }) {
  return (
    <>
      <div className="rs-row">
        <span className="rs-strong">{leftTop}</span>
        <span className="rs-right">{rightTop}</span>
      </div>
      {(leftSub || rightSub) && (
        <div className="rs-row rs-row-sub">
          <span className="rs-em">{leftSub}</span>
          <span className="rs-right rs-em">{rightSub}</span>
        </div>
      )}
    </>
  );
}

// Jake's template feeds education and experience subheadings in a different
// slot order, which is mirrored here and in lib/latex.js.
function Entry({ module }) {
  const dates = displayDates(module);

  if (module.type === "education") {
    return (
      <div className="rs-entry">
        <Subheading
          leftTop={module.organization || module.title}
          rightTop={module.location}
          leftSub={module.organization ? module.title : ""}
          rightSub={dates}
        />
        <Bullets module={module} />
      </div>
    );
  }

  if (module.type === "project") {
    return (
      <div className="rs-entry">
        <div className="rs-row">
          <span>
            <span className="rs-strong">{module.title}</span>
            {module.organization ? (
              <> <span className="rs-sep">|</span> <span className="rs-em">{module.organization}</span></>
            ) : null}
          </span>
          <span className="rs-right">{dates}</span>
        </div>
        <Bullets module={module} />
      </div>
    );
  }

  return (
    <div className="rs-entry">
      <Subheading
        leftTop={module.title}
        rightTop={dates}
        leftSub={module.organization}
        rightSub={module.location}
      />
      <Bullets module={module} />
    </div>
  );
}

function SkillSection({ modules }) {
  const rows = [];
  modules.forEach(module => {
    const lead = (module.content || "").trim();
    if (lead) rows.push({ label: "", items: lead });
    bulletsOf(module).forEach(line => {
      const split = line.indexOf(":");
      if (split > 0) {
        rows.push({ label: line.slice(0, split).trim(), items: line.slice(split + 1).trim() });
      } else {
        rows.push({ label: "", items: line });
      }
    });
  });
  if (rows.length === 0) return null;
  return (
    <div className="rs-skills">
      {rows.map((r, i) => (
        <div key={i} className="rs-skill-row">
          {r.label && <span className="rs-strong">{r.label}: </span>}
          <span>{r.items}</span>
        </div>
      ))}
    </div>
  );
}

function SummarySection({ modules }) {
  const paras = modules
    .map(m => [(m.content || "").trim(), ...bulletsOf(m)].filter(Boolean).join(" "))
    .filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <>
      {paras.map((p, i) => <p key={i} className="rs-summary">{p}</p>)}
    </>
  );
}

function Heading({ profile }) {
  const p = profile || {};
  const pieces = [p.phone, p.location, p.email, ...(p.links || []).map(l => l.label || l.url)]
    .filter(Boolean);

  return (
    <header className="rs-head">
      <h1 className="rs-name">{p.name || "Your Name"}</h1>
      {pieces.length > 0 && (
        <p className="rs-contact">
          {pieces.map((piece, i) => (
            <span key={i}>
              {i > 0 && <span className="rs-sep"> | </span>}
              <span className="rs-contact-item">{piece}</span>
            </span>
          ))}
        </p>
      )}
    </header>
  );
}

export default function ResumePreview({ profile, modules }) {
  const sections = groupByType(modules).filter(([, mods]) => mods.length > 0);

  return (
    <div className="resume-sheet">
      <Heading profile={profile} />

      {sections.length === 0 && (
        <p className="rs-empty">
          Nothing selected yet. Add resume modules, or include some above.
        </p>
      )}

      {sections.map(([type, mods]) => (
        <section className="rs-section" key={type}>
          <h2 className="rs-section-title">{SECTION_TITLES[type] || SECTION_TITLES.other}</h2>
          {type === "skill" ? (
            <SkillSection modules={mods} />
          ) : type === "summary" ? (
            <SummarySection modules={mods} />
          ) : (
            mods.map(m => <Entry key={m.id} module={m} />)
          )}
        </section>
      ))}
    </div>
  );
}
