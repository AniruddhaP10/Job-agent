import { useState, useEffect, useRef, useCallback } from "react";

// ─── API helpers ───────────────────────────────────────────────────────────────
function getToken() {
  return window.netlifyIdentity?.currentUser()?.token?.access_token;
}

async function api(path, opts = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json();
}

function safeParseJSON(text) {
  if (typeof text === "object") return text;
  const s = String(text).replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(s); } catch {
    const arr = s.match(/\[[\s\S]*\]/);
    if (arr) try { return JSON.parse(arr[0]); } catch {}
    const obj = s.match(/\{[\s\S]*\}/);
    if (obj) try { return JSON.parse(obj[0]); } catch {}
    throw new Error("Could not parse server response as JSON");
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "profile", icon: "◎", label: "Profile" },
  { id: "search",  icon: "⊕", label: "Job Search" },
  { id: "score",   icon: "◐", label: "Score Resume" },
  { id: "apply",   icon: "✦", label: "Apply" },
  { id: "tracker", icon: "◈", label: "Tracker" },
];

const STATUS = {
  applied:   { color: "#15803d", bg: "#dcfce7", label: "Applied" },
  interview: { color: "#1d4ed8", bg: "#dbeafe", label: "Interview" },
  offer:     { color: "#0f766e", bg: "#ccfbf1", label: "Offer" },
  rejected:  { color: "#b91c1c", bg: "#fee2e2", label: "Rejected" },
  ghosted:   { color: "#6b7280", bg: "#f3f4f6", label: "Ghosted" },
};

const JOB_SOURCES = ["LinkedIn", "Indeed", "Glassdoor", "AngelList", "Wellfound", "Company"];

// ─── Micro-components ──────────────────────────────────────────────────────────
function Spinner({ size = 16, color = "#f59e0b" }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size, flexShrink: 0,
      border: `2px solid ${color}30`, borderTop: `2px solid ${color}`,
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
    }} />
  );
}

function Badge({ status }) {
  const c = STATUS[status] || STATUS.applied;
  return (
    <span style={{
      background: c.bg, color: c.color, fontSize: 11, fontWeight: 700,
      padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

function TagInput({ tags, setTags, placeholder }) {
  const [val, setVal] = useState("");
  const commit = () => {
    const v = val.trim().replace(/,+$/, "");
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setVal("");
  };
  return (
    <div
      style={{
        border: "1px solid #334155", borderRadius: 8, padding: "8px 10px",
        display: "flex", flexWrap: "wrap", gap: 6, background: "#1e293b", cursor: "text",
      }}
      onClick={e => e.currentTarget.querySelector("input")?.focus()}
    >
      {tags.map(t => (
        <span key={t} style={{
          background: "#f59e0b20", color: "#fbbf24", fontSize: 13, fontWeight: 600,
          padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6,
        }}>
          {t}
          <button
            onClick={() => setTags(tags.filter(x => x !== t))}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#fbbf24", fontSize: 15, lineHeight: 1, padding: 0 }}
          >×</button>
        </span>
      ))}
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : "Add another…"}
        style={{
          border: "none", outline: "none", fontSize: 14, flex: 1, minWidth: 160,
          background: "transparent", color: "#f1f5f9",
        }}
      />
    </div>
  );
}

function MatchBar({ score }) {
  const color = score >= 80 ? "#15803d" : score >= 60 ? "#d97706" : "#b91c1c";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 30 }}>{score}%</span>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#f1f5f9" }}>{title}</h2>
      {subtitle && <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>{subtitle}</p>}
    </div>
  );
}

function EmptyState({ icon, message, action, onAction }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", background: "#1e293b", borderRadius: 12, border: "1px solid #334155" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <p style={{ color: "#64748b", marginBottom: action ? 20 : 0, fontSize: 14 }}>{message}</p>
      {action && (
        <button style={btnStyle(true)} onClick={onAction}>{action}</button>
      )}
    </div>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────────────────
const card = {
  background: "#1e293b", border: "1px solid #334155", borderRadius: 12,
  padding: 24, marginBottom: 20,
};

function btnStyle(primary, danger) {
  return {
    background: danger ? "#b91c1c" : primary ? "#f59e0b" : "#0f172a",
    color: danger ? "#fff" : primary ? "#0f172a" : "#94a3b8",
    border: primary || danger ? "none" : "1px solid #334155",
    borderRadius: 8, padding: "9px 18px", fontWeight: 700,
    fontSize: 13, cursor: "pointer", display: "inline-flex",
    alignItems: "center", gap: 8, textDecoration: "none", transition: "opacity 0.15s",
  };
}

const inputStyle = {
  width: "100%", padding: "9px 12px", border: "1px solid #334155",
  borderRadius: 8, fontSize: 14, color: "#f1f5f9", background: "#0f172a",
  outline: "none", boxSizing: "border-box",
};

const selectStyle = {
  ...inputStyle,
  cursor: "pointer",
};

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6,
  display: "block", textTransform: "uppercase", letterSpacing: "0.5px",
};

const tagStyle = {
  background: "#0f172a", color: "#64748b", fontSize: 12,
  fontWeight: 500, padding: "3px 10px", borderRadius: 20,
};

// ─── JobCard ───────────────────────────────────────────────────────────────────
function JobCard({ job, selected, onToggle, applied }) {
  return (
    <div
      style={{
        background: "#1e293b",
        border: `1.5px solid ${selected ? "#f59e0b" : "#334155"}`,
        borderRadius: 12, padding: 18, marginBottom: 12, cursor: "pointer",
        boxShadow: selected ? "0 0 0 3px #f59e0b20" : "none", transition: "all 0.15s",
      }}
      onClick={onToggle}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
              border: `2px solid ${selected ? "#f59e0b" : "#475569"}`,
              background: selected ? "#f59e0b" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {selected && <span style={{ color: "#0f172a", fontSize: 10, fontWeight: 900 }}>✓</span>}
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{job.title}</h3>
            {applied && <Badge status="applied" />}
            {job.searchTitle && (
              <span style={{ background: "#f59e0b15", color: "#fbbf24", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>
                {job.searchTitle}
              </span>
            )}
          </div>
          <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>{job.company}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            <span style={tagStyle}>📍 {job.location}</span>
            <span style={tagStyle}>{job.remote}</span>
            {job.salary && <span style={{ ...tagStyle, background: "#15803d20", color: "#4ade80" }}>💰 {job.salary}</span>}
            <span style={{ ...tagStyle, background: "#1d4ed820", color: "#93c5fd" }}>{job.source}</span>
            <span style={tagStyle}>{job.postedDate}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{job.description}</p>
          {job.requirements?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {job.requirements.slice(0, 4).map(r => (
                <span key={r} style={{ ...tagStyle, fontSize: 11 }}>{r}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ minWidth: 110, textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: "#475569", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Match</p>
          <MatchBar score={job.matchScore || 70} />
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginTop: 10, color: "#f59e0b", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
            onClick={e => e.stopPropagation()}
          >
            View ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab]           = useState("profile");

  // Profile
  const [resumeB64, setResumeB64]       = useState(null);
  const [resumeFile, setResumeFile]     = useState(null);
  const [parsedResume, setParsedResume] = useState(null);
  const [jobTitles, setJobTitles]       = useState([]);
  const [prefs, setPrefs] = useState({ location: "", remote: "hybrid", level: "mid-level", type: "full-time", salaryMin: "", salaryMax: "" });

  // Search
  const [jobs, setJobs]               = useState([]);
  const [selectedJobs, setSelectedJobs] = useState(new Set());
  const [filterSource, setFilterSource] = useState("all");

  // Score
  const [jobDesc, setJobDesc]       = useState("");
  const [scoreResult, setScoreResult] = useState(null);

  // Apply
  const [coverLetters, setCoverLetters] = useState({});
  const [clLoading, setClLoading]       = useState({});

  // Tracker
  const [applications, setApplications] = useState([]);

  // UI
  const [loading, setLoading]     = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError]         = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef();

  // ── Auth setup ──
  useEffect(() => {
    const ni = window.netlifyIdentity;
    if (!ni) {
      setUser({ email: "user@jobagent.app", user_metadata: { full_name: "User" }, sub: "local-user" });
      setAuthReady(true);
      return;
    }
    ni.on("init", u => {
      if (u) { setUser(u); } 
      else { setUser({ email: "user@jobagent.app", user_metadata: { full_name: "User" }, sub: "local-user" }); }
      setAuthReady(true);
    });
    ni.on("login", u => { setUser(u); ni.close(); });
    ni.on("logout", () => setUser({ email: "user@jobagent.app", user_metadata: { full_name: "User" }, sub: "local-user" }));
    ni.init();
  }, []);

  // Load tracker when tab opens
  useEffect(() => {
    if (tab === "tracker" && user) fetchApplications();
  }, [tab, user]);

  // ── Handlers ──
  const handleFile = useCallback(file => {
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setResumeFile(file.name);
    setError(null);
    const r = new FileReader();
    r.onload = e => setResumeB64(e.target.result.split(",")[1]);
    r.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const parseResume = async () => {
    if (!resumeB64) { setError("Upload your resume first."); return; }
    setLoading(true); setLoadingMsg("Parsing resume…"); setError(null);
    try {
      const data = await api("/api/parse-resume", { method: "POST", body: JSON.stringify({ resumeBase64: resumeB64 }) });
      setParsedResume(safeParseJSON(data));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const searchJobs = async () => {
    if (!parsedResume) { setError("Parse your resume first."); return; }
    if (jobTitles.length === 0) { setError("Add at least one job title."); return; }
    setLoading(true); setLoadingMsg(`Searching ${JOB_SOURCES.join(", ")}…`); setError(null);
    try {
      const data = await api("/api/search-jobs", {
        method: "POST",
        body: JSON.stringify({ jobTitles, ...prefs, resumeSkills: parsedResume.skills }),
      });
      const parsed = safeParseJSON(data);
      setJobs(Array.isArray(parsed) ? parsed : []);
      setSelectedJobs(new Set());
      setTab("search");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const scoreResume = async () => {
    if (!parsedResume) { setError("Parse your resume first."); return; }
    if (!jobDesc.trim()) { setError("Paste a job description to score against."); return; }
    setLoading(true); setLoadingMsg("Scoring your resume…"); setError(null);
    try {
      const data = await api("/api/score-resume", { method: "POST", body: JSON.stringify({ resume: parsedResume, jobDescription: jobDesc }) });
      setScoreResult(safeParseJSON(data));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const generateCoverLetter = async job => {
    setClLoading(p => ({ ...p, [job.id]: true }));
    try {
      const data = await api("/api/cover-letter", { method: "POST", body: JSON.stringify({ job, resume: parsedResume }) });
      setCoverLetters(p => ({ ...p, [job.id]: data.text }));
    } catch (e) { setError(e.message); }
    finally { setClLoading(p => ({ ...p, [job.id]: false })); }
  };

  const generateAllLetters = () => {
    selectedJobList.forEach(job => { if (!coverLetters[job.id] && !clLoading[job.id]) generateCoverLetter(job); });
  };

  const markApplied = async job => {
    if (appliedUrls.has(job.url)) return;
    try {
      const app = await api("/api/applications", {
        method: "POST",
        body: JSON.stringify({ jobTitle: job.title, company: job.company, location: job.location, url: job.url, source: job.source, status: "applied", appliedDate: new Date().toISOString().split("T")[0] }),
      });
      setApplications(p => [app, ...p]);
    } catch (e) { setError(e.message); }
  };

  const fetchApplications = async () => {
    try {
      const data = await api("/api/applications");
      setApplications(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api(`/api/applications?id=${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setApplications(p => p.map(a => a.id === id ? { ...a, status } : a));
    } catch (e) { setError(e.message); }
  };

  const toggleJob = id => setSelectedJobs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedJobList = jobs.filter(j => selectedJobs.has(j.id));
  const appliedUrls = new Set(applications.map(a => a.url));
  const filteredJobs = filterSource === "all" ? jobs : jobs.filter(j => j.source === filterSource);

  // ── Auth gate ──
  if (!authReady) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f172a" }}>
        <Spinner size={36} />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0f172a", padding: 20 }}>
        <div style={{ background: "#1e293b", borderRadius: 20, padding: "48px 40px", textAlign: "center", maxWidth: 400, width: "100%", border: "1px solid #334155" }}>
          <div style={{
            width: 64, height: 64, background: "#f59e0b", borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, margin: "0 auto 24px",
          }}>⚡</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", color: "#f1f5f9" }}>JobAgent AI</h1>
          <p style={{ color: "#64748b", margin: "0 0 12px", fontSize: 15, lineHeight: 1.6 }}>
            Search multiple job titles across LinkedIn, Indeed, Glassdoor and more — with AI cover letters and application tracking.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {["◎ Upload PDF resume & AI parse it", "⊕ Search 5+ job boards simultaneously", "◐ Score resume vs any job description", "◈ Track all applications in a database"].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0f172a", borderRadius: 8, textAlign: "left" }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{f}</span>
              </div>
            ))}
          </div>
          <button
            style={{ ...btnStyle(true), width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 15, borderRadius: 10 }}
            onClick={() => { if(window.netlifyIdentity) window.netlifyIdentity.open(); }}
          >
            Sign In / Create Account
          </button>
        </div>
      </div>
    );
  }

  const initials = (user.user_metadata?.full_name || user.email || "U").split(" ").map(s => s[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter', -apple-system, sans-serif", background: "#0f172a", color: "#f1f5f9", overflow: "hidden" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        input:focus, select:focus, textarea:focus { border-color: #f59e0b !important; box-shadow: 0 0 0 3px #f59e0b20 !important; outline: none; }
        button:hover { opacity: 0.85; }
        a:hover { opacity: 0.85; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ width: 230, background: "#0c1424", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 18px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: "#f59e0b", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#0f172a", flexShrink: 0 }}>⚡</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.3px" }}>JobAgent AI</span>
        </div>

        <nav style={{ flex: 1, padding: "8px 8px" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            const badge = t.id === "search" && jobs.length > 0 ? jobs.length
              : t.id === "tracker" && applications.length > 0 ? applications.length
              : t.id === "apply" && selectedJobs.size > 0 ? selectedJobs.size
              : null;
            return (
              <div
                key={t.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  cursor: "pointer", borderRadius: 8, marginBottom: 2,
                  background: active ? "#f59e0b15" : "transparent",
                  color: active ? "#f59e0b" : "#64748b",
                  fontWeight: active ? 700 : 400, fontSize: 14, transition: "all 0.15s",
                  borderLeft: `3px solid ${active ? "#f59e0b" : "transparent"}`,
                }}
                onClick={() => setTab(t.id)}
              >
                <span style={{ fontSize: 13, width: 16, textAlign: "center" }}>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {badge && (
                  <span style={{ background: active ? "#f59e0b" : "#334155", color: active ? "#0f172a" : "#94a3b8", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "1px 7px", minWidth: 22, textAlign: "center" }}>
                    {badge}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {parsedResume && (
          <div style={{ margin: "0 8px 8px", padding: "12px", background: "#15803d15", border: "1px solid #15803d30", borderRadius: 8 }}>
            <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 700, color: "#4ade80" }}>✓ Resume Active</p>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{parsedResume.name}</p>
          </div>
        )}

        <div style={{ padding: "12px 10px", borderTop: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#0f172a", flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                {user.user_metadata?.full_name || user.email?.split("@")[0]}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{user.email}</p>
            </div>
          </div>
          <button
            style={{ width: "100%", background: "none", border: "1px solid #1e293b", borderRadius: 6, color: "#475569", fontSize: 12, cursor: "pointer", padding: "6px", textAlign: "center" }}
            onClick={() => { if(window.netlifyIdentity) window.netlifyIdentity.logout(); }}
          >Sign Out</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div style={{ background: "#0c1424", borderBottom: "1px solid #1e293b", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{TABS.find(t => t.id === tab)?.label}</h1>
          {tab === "search" && jobs.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                style={{ ...selectStyle, width: "auto", fontSize: 13, padding: "6px 10px" }}>
                <option value="all">All Sources</option>
                {JOB_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {selectedJobs.size > 0 && (
                <button style={btnStyle(true)} onClick={() => setTab("apply")}>
                  ✦ Apply to {selectedJobs.size} →
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, padding: "28px", maxWidth: 880, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {error && (
            <div style={{ background: "#7f1d1d20", color: "#fca5a5", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>⚠ {error}</span>
              <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16, fontWeight: 700, padding: "0 0 0 12px" }}>×</button>
            </div>
          )}

          {/* ══ PROFILE TAB ══ */}
          {tab === "profile" && (
            <>
              <SectionHeader title="Profile Setup" subtitle="Upload your resume and configure your job search preferences" />

              {/* Resume upload */}
              <div style={card}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#f1f5f9" }}>Resume (PDF)</h3>
                <div
                  style={{
                    border: `2px dashed ${dragOver ? "#f59e0b" : "#334155"}`,
                    borderRadius: 10, padding: "28px 20px", textAlign: "center",
                    background: dragOver ? "#f59e0b08" : "#0f172a", cursor: "pointer",
                  }}
                  onClick={() => fileRef.current.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <p style={{ color: resumeFile ? "#f1f5f9" : "#475569", fontWeight: resumeFile ? 600 : 400, margin: "0 0 4px", fontSize: 14 }}>
                    {resumeFile || "Drop your PDF resume here or click to browse"}
                  </p>
                  <p style={{ color: "#334155", fontSize: 12, margin: 0 }}>PDF format only</p>
                </div>
                <input type="file" accept=".pdf" ref={fileRef} style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                  <button style={btnStyle(true)} onClick={parseResume} disabled={loading || !resumeB64}>
                    {loading && loadingMsg.includes("Parsing") ? <><Spinner /> {loadingMsg}</> : "✦ Parse Resume"}
                  </button>
                  {parsedResume && <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>✓ Parsed successfully</span>}
                </div>

                {parsedResume && (
                  <div style={{ marginTop: 16, padding: 16, background: "#0f172a", borderRadius: 8, border: "1px solid #334155" }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{parsedResume.name}</p>
                    <p style={{ margin: "0 0 6px", color: "#94a3b8", fontSize: 13 }}>{parsedResume.title} · {parsedResume.totalYearsExperience} yrs experience</p>
                    <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>{parsedResume.summary}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {parsedResume.skills?.slice(0, 12).map(sk => <span key={sk} style={tagStyle}>{sk}</span>)}
                    </div>
                  </div>
                )}
              </div>

              {/* Job Titles */}
              <div style={card}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "#f1f5f9" }}>Target Job Titles</h3>
                <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px" }}>Add multiple titles — all searched simultaneously across every job board</p>
                <TagInput tags={jobTitles} setTags={setJobTitles} placeholder='e.g. "Senior Engineer" — press Enter to add' />
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#334155" }}>
                  💡 Example: Frontend Engineer, React Developer, UI Engineer → searches all 3 at once
                </p>
              </div>

              {/* Preferences */}
              <div style={card}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "#f1f5f9" }}>Search Preferences</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { label: "Location", key: "location", type: "input", placeholder: "Dublin, Ireland or Remote" },
                    { label: "Work Mode", key: "remote", type: "select", options: ["remote", "hybrid", "on-site"] },
                    { label: "Experience Level", key: "level", type: "select", options: ["entry-level", "mid-level", "senior", "lead", "manager"] },
                    { label: "Employment Type", key: "type", type: "select", options: ["full-time", "contract", "part-time", "freelance"] },
                    { label: "Salary Min (k)", key: "salaryMin", type: "input", placeholder: "e.g. 70" },
                    { label: "Salary Max (k)", key: "salaryMax", type: "input", placeholder: "e.g. 120" },
                  ].map(field => (
                    <div key={field.key}>
                      <label style={labelStyle}>{field.label}</label>
                      {field.type === "input" ? (
                        <input style={inputStyle} placeholder={field.placeholder} value={prefs[field.key]} onChange={e => setPrefs(p => ({ ...p, [field.key]: e.target.value }))} />
                      ) : (
                        <select style={selectStyle} value={prefs[field.key]} onChange={e => setPrefs(p => ({ ...p, [field.key]: e.target.value }))}>
                          {field.options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace("-", " ")}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  {jobTitles.length > 0 && <span style={{ fontSize: 13, color: "#64748b", alignSelf: "center" }}>Searching: {jobTitles.join(" · ")}</span>}
                  <button style={{ ...btnStyle(true), padding: "11px 24px", fontSize: 14 }} onClick={searchJobs} disabled={loading}>
                    {loading && loadingMsg.includes("Search") ? <><Spinner /> {loadingMsg}</> : `⊕ Find Jobs (${jobTitles.length || "?"} titles) →`}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ══ SEARCH TAB ══ */}
          {tab === "search" && (
            <>
              <SectionHeader
                title={`${filteredJobs.length} Job Matches`}
                subtitle={`Across ${jobTitles.length} title${jobTitles.length !== 1 ? "s" : ""}: ${jobTitles.join(", ")}`}
              />
              {jobs.length === 0 ? (
                <EmptyState icon="🔍" message="No jobs loaded yet. Go to Profile and run a search." action="← Go to Profile" onAction={() => setTab("profile")} />
              ) : (
                <>
                  {selectedJobs.size > 0 && (
                    <div style={{ ...card, background: "#f59e0b10", border: "1px solid #f59e0b40", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ margin: 0, color: "#fbbf24", fontSize: 14, fontWeight: 600 }}>
                          {selectedJobs.size} job{selectedJobs.size !== 1 ? "s" : ""} selected
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button style={btnStyle(false)} onClick={() => setSelectedJobs(new Set())}>Clear</button>
                          <button style={btnStyle(true)} onClick={() => setTab("apply")}>✦ Apply to selected →</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Group by search title */}
                  {jobTitles.map(title => {
                    const group = filteredJobs.filter(j =>
                      j.searchTitle === title ||
                      j.title.toLowerCase().includes(title.toLowerCase().split(" ")[0].toLowerCase())
                    );
                    if (group.length === 0) return null;
                    return (
                      <div key={title} style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <span style={{ background: "#f59e0b20", color: "#fbbf24", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>{title}</span>
                          <span style={{ color: "#334155", fontSize: 12 }}>{group.length} result{group.length !== 1 ? "s" : ""}</span>
                        </div>
                        {group.map(job => <JobCard key={job.id} job={job} selected={selectedJobs.has(job.id)} onToggle={() => toggleJob(job.id)} applied={appliedUrls.has(job.url)} />)}
                      </div>
                    );
                  })}

                  {/* Ungrouped */}
                  {filteredJobs.filter(j => !jobTitles.some(t => j.title.toLowerCase().includes(t.toLowerCase().split(" ")[0]))).map(job => (
                    <JobCard key={job.id} job={job} selected={selectedJobs.has(job.id)} onToggle={() => toggleJob(job.id)} applied={appliedUrls.has(job.url)} />
                  ))}
                </>
              )}
            </>
          )}

          {/* ══ SCORE TAB ══ */}
          {tab === "score" && (
            <>
              <SectionHeader title="Score Resume" subtitle="Paste any job description to get an AI match score, skill gaps, and tailoring tips" />
              <div style={card}>
                <label style={labelStyle}>Job Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 220, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }}
                  placeholder="Paste the full job description here — requirements, responsibilities, qualifications…"
                  value={jobDesc}
                  onChange={e => setJobDesc(e.target.value)}
                />
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                  <button style={btnStyle(true)} onClick={scoreResume} disabled={loading || !parsedResume}>
                    {loading && loadingMsg.includes("Scoring") ? <><Spinner /> {loadingMsg}</> : "◐ Analyze Match"}
                  </button>
                  {!parsedResume && <span style={{ fontSize: 13, color: "#475569" }}>Parse your resume in Profile first</span>}
                </div>
              </div>

              {scoreResult && (() => {
                const s = scoreResult;
                const scoreColor = s.score >= 70 ? "#15803d" : s.score >= 50 ? "#d97706" : "#b91c1c";
                return (
                  <>
                    <div style={{ ...card, borderLeft: `4px solid ${scoreColor}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "#f1f5f9" }}>Overall Match Score</h3>
                          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{s.summary}</p>
                        </div>
                        <div style={{ fontSize: 42, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{s.score}<span style={{ fontSize: 16 }}>%</span></div>
                      </div>
                      <div style={{ height: 8, background: "#0f172a", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${s.score}%`, height: "100%", background: scoreColor, borderRadius: 4, transition: "width 0.8s ease" }} />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                      <div style={{ ...card, margin: 0 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#4ade80" }}>✓ Matching Skills</h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {s.matches?.map(m => <span key={m} style={{ ...tagStyle, background: "#15803d20", color: "#4ade80" }}>{m}</span>)}
                        </div>
                      </div>
                      <div style={{ ...card, margin: 0 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#f87171" }}>✗ Skill Gaps</h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {s.missing?.map(m => <span key={m} style={{ ...tagStyle, background: "#b91c1c20", color: "#f87171" }}>{m}</span>)}
                        </div>
                      </div>
                    </div>

                    <div style={card}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px", color: "#f1f5f9" }}>Tailoring Suggestions</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {s.suggestions?.map((tip, i) => (
                          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 14px", background: "#0f172a", borderRadius: 8 }}>
                            <span style={{ color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{tip}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {/* ══ APPLY TAB ══ */}
          {tab === "apply" && (
            <>
              <SectionHeader title="Application Center" subtitle={`${selectedJobList.length} jobs selected · Generate AI cover letters and apply`} />

              {selectedJobList.length > 1 && (
                <div style={{ ...card, background: "#f59e0b08", border: "1px solid #f59e0b30", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontWeight: 700, color: "#fbbf24", fontSize: 15 }}>Bulk Apply — {selectedJobList.length} jobs</p>
                      <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Generate all cover letters at once, then apply to each</p>
                    </div>
                    <button style={btnStyle(true)} onClick={generateAllLetters}>✦ Generate All Letters</button>
                  </div>
                </div>
              )}

              {selectedJobList.length === 0 ? (
                <EmptyState icon="✉" message="No jobs selected. Go to Search and select jobs to apply to." action="← Job Search" onAction={() => setTab("search")} />
              ) : selectedJobList.map(job => (
                <div key={job.id} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{job.title}</h3>
                        <MatchBar score={job.matchScore || 70} />
                      </div>
                      <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{job.company} · {job.location} · {job.remote}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button style={btnStyle(false)} onClick={() => generateCoverLetter(job)} disabled={clLoading[job.id]}>
                        {clLoading[job.id] ? <><Spinner /> Writing…</> : "✦ Cover Letter"}
                      </button>
                      <button
                        style={{ ...btnStyle(true), background: appliedUrls.has(job.url) ? "#15803d" : "#f59e0b" }}
                        onClick={() => markApplied(job)} disabled={appliedUrls.has(job.url)}
                      >
                        {appliedUrls.has(job.url) ? "✓ Tracked" : "Mark Applied"}
                      </button>
                    </div>
                  </div>

                  {coverLetters[job.id] ? (
                    <>
                      <textarea
                        style={{ ...inputStyle, minHeight: 240, resize: "vertical", lineHeight: 1.7, fontFamily: "inherit", fontSize: 13 }}
                        value={coverLetters[job.id]}
                        onChange={e => setCoverLetters(p => ({ ...p, [job.id]: e.target.value }))}
                      />
                      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                        <a href={job.url} target="_blank" rel="noreferrer" style={{ ...btnStyle(true), textDecoration: "none" }}>Apply on {job.source} ↗</a>
                        <button style={btnStyle(false)} onClick={() => navigator.clipboard?.writeText(coverLetters[job.id])}>Copy</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: 20, background: "#0f172a", borderRadius: 8, textAlign: "center" }}>
                      <p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Click "Cover Letter" to generate a tailored letter for this specific role</p>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* ══ TRACKER TAB ══ */}
          {tab === "tracker" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#f1f5f9" }}>Application Tracker</h2>
                  <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>{applications.length} applications saved in your database</p>
                </div>
                <button style={btnStyle(false)} onClick={fetchApplications}>↺ Refresh</button>
              </div>

              {/* Pipeline overview */}
              {applications.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
                  {Object.entries(STATUS).map(([key, conf]) => {
                    const count = applications.filter(a => a.status === key).length;
                    return (
                      <div key={key} style={{ background: "#1e293b", borderRadius: 10, padding: "14px", textAlign: "center", border: `1px solid #334155`, borderTop: `3px solid ${conf.color}` }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: conf.color }}>{count}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, fontWeight: 600 }}>{conf.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {applications.length === 0 ? (
                <EmptyState icon="◈" message="No applications tracked yet. Apply to jobs and mark them." action="← Find Jobs" onAction={() => setTab("search")} />
              ) : (
                <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #334155", background: "#0f172a" }}>
                        {["Role", "Company", "Location", "Applied", "Source", "Status", "Actions"].map(h => (
                          <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app, i) => (
                        <tr key={app.id} style={{ borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "#1e293b" : "#0f172a" }}>
                          <td style={{ padding: "12px 14px", fontWeight: 600, color: "#f1f5f9" }}>{app.job_title || app.jobTitle}</td>
                          <td style={{ padding: "12px 14px", color: "#94a3b8" }}>{app.company}</td>
                          <td style={{ padding: "12px 14px", color: "#64748b" }}>{app.location}</td>
                          <td style={{ padding: "12px 14px", color: "#475569" }}>{app.applied_date || app.appliedDate}</td>
                          <td style={{ padding: "12px 14px" }}><span style={tagStyle}>{app.source}</span></td>
                          <td style={{ padding: "12px 14px" }}><Badge status={app.status} /></td>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <select
                                value={app.status}
                                onChange={e => updateStatus(app.id, e.target.value)}
                                style={{ ...selectStyle, width: "auto", fontSize: 12, padding: "5px 8px" }}
                              >
                                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                              {app.url && (
                                <a href={app.url} target="_blank" rel="noreferrer" style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>↗</a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
