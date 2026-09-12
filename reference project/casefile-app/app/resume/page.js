"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

function blankStory() {
  return {
    id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    role: "",
    skills: [],
    situation: "",
    action: "",
    result: "",
    bullets: []
  };
}

function arrayToLines(value) {
  return (value || []).join("\n");
}

function linesToArray(value) {
  return value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
}

function arrayToCsv(value) {
  return (value || []).join(", ");
}

function csvToArray(value) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

export default function ResumePage() {
  const [masterResume, setMasterResume] = useState("");
  const [stories, setStories] = useState([]);
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tailoredResume, setTailoredResume] = useState("");
  const [tailorStatus, setTailorStatus] = useState("");
  const [tailorError, setTailorError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getResumeWorkspace().then(data => {
      setMasterResume(data.masterResume || "");
      setStories((data.masterStories || []).length ? data.masterStories : [blankStory()]);
      setLoading(false);
    });
  }, []);

  function updateStory(id, patch) {
    setStories(current =>
      current.map(story => (story.id === id ? { ...story, ...patch } : story))
    );
  }

  function addStory() {
    setStories(current => [...current, blankStory()]);
  }

  function removeStory(id) {
    setStories(current => (current.length === 1 ? [blankStory()] : current.filter(story => story.id !== id)));
  }

  async function save() {
    await api.saveResumeWorkspace({ text: masterResume, stories });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function generateTailoredResume() {
    setTailorError("");
    setTailorStatus("Generating tailored resume...");
    try {
      await api.saveResumeWorkspace({ text: masterResume, stories });
      const result = await api.tailorResume({ jobUrl, jobDescription });
      setTailoredResume(result.tailoredResume || "");
      setTailorStatus(result.warning ? `Generated. URL note: ${result.warning}` : "Generated tailored resume.");
    } catch (error) {
      setTailorStatus("");
      setTailorError(error.message);
    }
  }

  return (
    <div className="resume-workspace">
      <section className="panel resume-panel">
        <h2>Tailor a Resume</h2>
        <p className="hint">
          Paste a job link or the job description. Casefile will use your master stories below to draft a targeted resume.
        </p>

        <div className="mfield">
          <label>Job posting link</label>
          <input
            value={jobUrl}
            onChange={e => setJobUrl(e.target.value)}
            placeholder="https://company.com/careers/software-developer"
          />
        </div>

        <div className="mfield">
          <label>Job description</label>
          <textarea
            className="jd-input"
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the responsibilities, qualifications, and keywords here..."
          />
        </div>

        <div className="resume-actions">
          <button className="btn-primary" onClick={generateTailoredResume} disabled={tailorStatus.startsWith("Generating")}>
            {tailorStatus.startsWith("Generating") ? "Generating..." : "Generate tailored resume"}
          </button>
          {tailorStatus && <span className="saved-note">{tailorStatus}</span>}
          {tailorError && <span className="error-note">{tailorError}</span>}
        </div>

        {tailoredResume && (
          <div className="tailored-output">
            <label>Generated resume</label>
            <textarea
              className="resume-input"
              value={tailoredResume}
              onChange={e => setTailoredResume(e.target.value)}
            />
          </div>
        )}
      </section>

      <section className="panel resume-panel">
        <h2>Master Stories</h2>
        <p className="hint">
          Add reusable career stories with skills, actions, results, and honest source bullets. These are the evidence the AI can tailor from.
        </p>

        {loading ? (
          <p className="hint">Loading...</p>
        ) : (
          <>
            <div className="story-list">
              {stories.map((story, index) => (
                <div className="story-card" key={story.id}>
                  <div className="story-card-header">
                    <h3>Story {index + 1}</h3>
                    <button className="btn-secondary-inline" onClick={() => removeStory(story.id)}>
                      Remove
                    </button>
                  </div>

                  <div className="mform-row">
                    <div className="mfield">
                      <label>Story title</label>
                      <input
                        value={story.title}
                        onChange={e => updateStory(story.id, { title: e.target.value })}
                        placeholder="Automated reporting dashboard"
                      />
                    </div>
                    <div className="mfield">
                      <label>Role / context</label>
                      <input
                        value={story.role}
                        onChange={e => updateStory(story.id, { role: e.target.value })}
                        placeholder="Internship, class project, volunteer role..."
                      />
                    </div>
                  </div>

                  <div className="mfield">
                    <label>Skills and keywords</label>
                    <input
                      value={arrayToCsv(story.skills)}
                      onChange={e => updateStory(story.id, { skills: csvToArray(e.target.value) })}
                      placeholder="React, SQL, Python, stakeholder communication"
                    />
                  </div>

                  <div className="mform-row">
                    <div className="mfield">
                      <label>Situation</label>
                      <textarea
                        rows={3}
                        value={story.situation}
                        onChange={e => updateStory(story.id, { situation: e.target.value })}
                      />
                    </div>
                    <div className="mfield">
                      <label>Action</label>
                      <textarea
                        rows={3}
                        value={story.action}
                        onChange={e => updateStory(story.id, { action: e.target.value })}
                      />
                    </div>
                    <div className="mfield">
                      <label>Result</label>
                      <textarea
                        rows={3}
                        value={story.result}
                        onChange={e => updateStory(story.id, { result: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mfield">
                    <label>Source bullets</label>
                    <textarea
                      rows={4}
                      value={arrayToLines(story.bullets)}
                      onChange={e => updateStory(story.id, { bullets: linesToArray(e.target.value) })}
                      placeholder="One source bullet per line..."
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="resume-actions">
              <button className="btn-secondary-inline" onClick={addStory}>Add story</button>
              <button className="btn-primary" onClick={save}>Save master stories</button>
              {saved && <span className="saved-note">Saved.</span>}
            </div>

            <div className="legacy-master">
              <h3>Master Resume Text</h3>
              <p className="hint">Optional fallback text. Existing applications can still reset from this master resume.</p>
              <textarea
                className="resume-input"
                placeholder="Paste or write your broader master resume here..."
                value={masterResume}
                onChange={e => setMasterResume(e.target.value)}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
