"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ApplicationModal from "@/components/ApplicationModal";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function RemindersPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  function load() {
    setLoading(true);
    api.listApplications().then(data => { setApps(data); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const withReminders = apps
    .filter(a => a.followUpDate && a.status !== "rejected")
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

  return (
    <div className="panel">
      <h2>Follow-ups</h2>
      <p className="hint">Overdue and upcoming check-ins across every open case.</p>

      {loading ? (
        <p className="hint">Loading...</p>
      ) : withReminders.length === 0 ? (
        <p className="no-reminders">No follow-ups scheduled. Add a "Follow up on" date to any case to see it here.</p>
      ) : (
        <ul className="reminders-list">
          {withReminders.map(app => {
            const overdue = app.followUpDate <= today;
            return (
              <li key={app.id} className={overdue ? "overdue" : ""} onClick={() => setOpenId(app.id)}>
                <div>
                  <div className="r-pos">{app.position}</div>
                  <div className="r-co">{app.company}</div>
                </div>
                <div className="r-date">{overdue ? "Overdue — " : ""}{formatDate(app.followUpDate)}</div>
              </li>
            );
          })}
        </ul>
      )}

      {openId && (
        <ApplicationModal appId={openId} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  );
}
