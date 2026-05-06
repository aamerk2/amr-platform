"use client"
import { useStore } from "../../lib/store"

const PRI_COL: Record<string, string> = {
  CRITICAL: "#ff3d3d",
  HIGH: "#ff8c00",
  MEDIUM: "#ffd600",
  LOW: "#78909c",
}

export default function WCSPage() {
  const { tasks, wcsRules, toggleRule, processWCS } = useStore()

  const pipeline = [
    { label: "WMS Queued",      status: "WMS_QUEUED",      color: "#00e5ff" },
    { label: "WCS Dispatched",  status: "WCS_DISPATCHED",  color: "#ffb300" },
    { label: "Assigned to AMR", status: "ASSIGNED",        color: "#e040fb" },
    { label: "Completed",       status: "DONE",            color: "#69ff47" },
  ]

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#ffb300", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
          LAYER 2
        </div>
        <h1 style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>
          Warehouse Control / Execution System
        </h1>
        <p style={{ color: "rgba(255,255,255,0.35)", marginTop: 6, fontSize: 13, fontStyle: "italic", margin: "6px 0 0" }}>
          Applies business rules to WMS tasks · Optimises routing · Dispatches to RMS
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Rules Engine */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#ffb300", letterSpacing: 3, textTransform: "uppercase" }}>
              Rules Engine
            </div>
            <button onClick={processWCS} style={{
              padding: "8px 18px",
              background: "rgba(255,179,0,0.15)",
              border: "1px solid #ffb300",
              borderRadius: 7, color: "#ffb300",
              fontFamily: "'Courier New', monospace",
              fontSize: 11, letterSpacing: 1, cursor: "pointer",
            }}>
              ▶ PROCESS TASKS
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {wcsRules.map(rule => (
              <div key={rule.id} style={{
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${rule.active ? "rgba(255,179,0,0.25)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 8, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                {/* Toggle switch */}
                <div
                  onClick={() => toggleRule(rule.id)}
                  style={{
                    width: 38, height: 22, borderRadius: 11,
                    cursor: "pointer", flexShrink: 0,
                    background: rule.active ? "#ffb300" : "rgba(255,255,255,0.1)",
                    position: "relative", transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: rule.active ? 18 : 3,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "#fff", transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: 12, fontWeight: 700,
                    color: rule.active ? "#fff" : "rgba(255,255,255,0.35)",
                  }}>
                    {rule.name}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, fontStyle: "italic" }}>
                    {rule.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Pipeline */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#ffb300", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
            Task Pipeline
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            {pipeline.map(s => {
              const count = tasks.filter(t => t.status === s.status).length
              const pct = tasks.length ? (count / tasks.length) * 100 : 0
              return (
                <div key={s.status}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                      {s.label}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: s.color }}>
                      {count}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${pct}%`,
                      background: s.color, borderRadius: 3,
                      transition: "width 0.5s", opacity: 0.85,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Recent dispatches */}
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#ffb300", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>
            Recent Dispatches
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.filter(t => t.wcsProcessed).length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic", fontSize: 12, textAlign: "center", padding: 20 }}>
                No dispatches yet — click PROCESS TASKS above
              </div>
            )}
            {tasks.filter(t => t.wcsProcessed).slice(0, 20).map(t => (
              <div key={t.id} style={{
                display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
                padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                  {t.id}
                </span>
                <span style={{
                  background: `${PRI_COL[t.priority]}18`,
                  border: `1px solid ${PRI_COL[t.priority]}45`,
                  borderRadius: 4, padding: "1px 8px",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 9, color: PRI_COL[t.priority],
                }}>
                  {t.priority}
                </span>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", flex: 1 }}>
                  {t.wcsRule}
                </span>
                <span style={{
                  background: "rgba(255,179,0,0.1)",
                  border: "1px solid rgba(255,179,0,0.3)",
                  borderRadius: 4, padding: "1px 8px",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 9, color: "#ffb300",
                }}>
                  {t.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}