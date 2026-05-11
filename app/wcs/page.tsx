"use client"
import { useStore } from "@/lib/store"

const PRI_COL: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#94a3b8",
}
const PRI_BG: Record<string, string> = {
  CRITICAL: "rgba(239,68,68,0.12)", HIGH: "rgba(249,115,22,0.12)",
  MEDIUM: "rgba(245,158,11,0.12)", LOW: "rgba(148,163,184,0.12)",
}

interface Task {
  id: string; status: string; priority: string
  sku: string; wcsProcessed: boolean; wcsRule?: string
}
interface WCSRule { id: string; name: string; desc: string; active: boolean }

const RULE_ICONS: Record<string, string> = {
  R1: "🔋", R2: "⚖️", R3: "⚡", R4: "📦", R5: "🔄", R6: "🚦",
}

const STATUS_PIPELINE = [
  { label: "WMS Queued",        status: "WMS_QUEUED",       color: "#6366f1", dim: "rgba(99,102,241,0.15)"  },
  { label: "WCS Dispatched",    status: "WCS_DISPATCHED",   color: "#f59e0b", dim: "rgba(245,158,11,0.15)"  },
  { label: "Station Assigned",  status: "STATION_ASSIGNED", color: "#8b5cf6", dim: "rgba(139,92,246,0.15)"  },
  { label: "Completed",         status: "DONE",             color: "#10b981", dim: "rgba(16,185,129,0.15)"  },
]

export default function WCSPage() {
  const { tasks, wcsRules, toggleRule, processWCS } = useStore()
  const typedTasks = tasks as Task[]
  const typedRules = wcsRules as WCSRule[]
  const total      = typedTasks.length
  const dispatches = typedTasks.filter(t => t.wcsProcessed).slice(0, 15)

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── PAGE HEADER ── */}
      <div style={{
        background: "#1e293b",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "22px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#475569", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
            Layer 2 · Warehouse Control / Execution System
          </p>
          <h1 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: 0, letterSpacing: -0.3 }}>
            WCS / WES Control Centre
          </h1>
        </div>
        <button onClick={processWCS} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "11px 24px",
          background: "#f97316",
          border: "none", borderRadius: 10,
          color: "#ffffff",
          fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
        }}>
          <span>▶</span> Process All Tasks
        </button>
      </div>

      {/* ── PIPELINE KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {STATUS_PIPELINE.map(s => {
          const count = typedTasks.filter(t => t.status === s.status).length
          const pct   = total ? Math.round((count / total) * 100) : 0
          return (
            <div key={s.status} style={{ background: "#1e293b", padding: "18px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase" }}>{s.label}</span>
                <span style={{ background: s.dim, color: s.color, borderRadius: 5, padding: "1px 8px", fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 600 }}>{pct}%</span>
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 28, fontWeight: 700, color: s.color, marginBottom: 8 }}>{count}</div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: s.color, borderRadius: 99, transition: "width 0.5s" }}/>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ padding: "28px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* ── LEFT: RULES ENGINE ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Rules Engine</h2>
            <span style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "2px 10px", fontFamily: "'DM Mono',monospace", fontSize: 10 }}>
              {typedRules.filter(r => r.active).length}/{typedRules.length} active
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {typedRules.map((rule: WCSRule) => (
              <div key={rule.id} onClick={() => toggleRule(rule.id)} style={{
                background: rule.active ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${rule.active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 12, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer", transition: "all 0.15s",
              }}>
                {/* Icon */}
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: rule.active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${rule.active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>
                  {RULE_ICONS[rule.id] || "⚙️"}
                </div>
                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: rule.active ? "#e2e8f0" : "#64748b", marginBottom: 2 }}>
                    {rule.name}
                  </div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#475569" }}>{rule.desc}</div>
                </div>
                {/* Toggle */}
                <div style={{
                  width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                  background: rule.active ? "#6366f1" : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.2s",
                }}>
                  <div style={{
                    position: "absolute", top: 3,
                    left: rule.active ? 22 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    transition: "left 0.2s",
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: PIPELINE + DISPATCHES ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Pipeline */}
          <div>
            <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", margin: "0 0 14px" }}>Task Pipeline</h2>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              {STATUS_PIPELINE.map((s, i) => {
                const count = typedTasks.filter(t => t.status === s.status).length
                const pct   = total ? (count / total) * 100 : 0
                return (
                  <div key={s.status} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "14px 18px",
                    borderBottom: i < STATUS_PIPELINE.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    background: count > 0 ? s.dim : "transparent",
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: count > 0 ? s.color : "#334155", flexShrink: 0 }}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500, color: count > 0 ? "#e2e8f0" : "#475569" }}>{s.label}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: count > 0 ? s.color : "#334155" }}>{count}</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 99 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: s.color, borderRadius: 99, opacity: 0.8, transition: "width 0.5s" }}/>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Dispatches table */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Recent Dispatches</h2>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#475569" }}>{dispatches.length} tasks</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 110px", padding: "10px 16px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {["Task ID","Priority","Rule","Status"].map(h => (
                  <div key={h} style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {dispatches.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#475569", fontSize: 13 }}>
                    No dispatches yet — click Process All Tasks
                  </div>
                )}
                {dispatches.map((t: Task, i: number) => {
                  const sc: Record<string,string> = {
                    WMS_QUEUED:"#6366f1", WCS_DISPATCHED:"#f59e0b",
                    STATION_ASSIGNED:"#8b5cf6", AMR_ASSIGNED:"#8b5cf6",
                    AT_STATION:"#10b981", DONE:"#10b981",
                  }
                  const sc_bg: Record<string,string> = {
                    WMS_QUEUED:"rgba(99,102,241,0.12)", WCS_DISPATCHED:"rgba(245,158,11,0.12)",
                    STATION_ASSIGNED:"rgba(139,92,246,0.12)", AMR_ASSIGNED:"rgba(139,92,246,0.12)",
                    AT_STATION:"rgba(16,185,129,0.12)", DONE:"rgba(16,185,129,0.12)",
                  }
                  return (
                    <div key={t.id} style={{
                      display: "grid", gridTemplateColumns: "1fr 90px 130px 110px",
                      padding: "10px 16px",
                      borderBottom: i < dispatches.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                      alignItems: "center",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#6366f1", fontWeight: 500 }}>{t.id}</span>
                      <span style={{
                        background: PRI_BG[t.priority], color: PRI_COL[t.priority],
                        borderRadius: 5, padding: "2px 8px",
                        fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 600,
                        width: "fit-content",
                      }}>{t.priority}</span>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#64748b",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{t.wcsRule || "—"}</span>
                      <span style={{
                        background: sc_bg[t.status] || "rgba(255,255,255,0.05)",
                        color: sc[t.status] || "#64748b",
                        borderRadius: 5, padding: "2px 8px",
                        fontFamily: "'DM Mono',monospace", fontSize: 9,
                        width: "fit-content",
                      }}>{t.status.replace(/_/g," ")}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}