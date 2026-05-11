"use client"
import { useStore } from "@/lib/store"

interface Task { status: string }
interface Log { t: string; color: string; layer: string; msg: string }
interface Order { id: string }

export default function Overview() {
  const { orders, tasks, logs } = useStore()

  const stats = {
    orders:     (orders as Order[]).length,
    queued:     (tasks as Task[]).filter(t => t.status === "WMS_QUEUED").length,
    dispatched: (tasks as Task[]).filter(t => t.status === "WCS_DISPATCHED").length,
    assigned:   (tasks as Task[]).filter(t => t.status === "AMR_ASSIGNED" || t.status === "STATION_ASSIGNED").length,
    done:       (tasks as Task[]).filter(t => t.status === "DONE").length,
  }

  const boxes = [
    { label: "Total Orders",    value: stats.orders,     color: "#6366f1", bg: "#f5f3ff", icon: "📥", sub: "in WMS" },
    { label: "WMS Queued",      value: stats.queued,     color: "#0ea5e9", bg: "#f0f9ff", icon: "⏳", sub: "awaiting WCS" },
    { label: "WCS Dispatched",  value: stats.dispatched, color: "#f59e0b", bg: "#fffbeb", icon: "⚙️", sub: "routed to RMS" },
    { label: "Assigned to AMR", value: stats.assigned,   color: "#8b5cf6", bg: "#f5f3ff", icon: "🤖", sub: "en route" },
    { label: "Completed",       value: stats.done,       color: "#10b981", bg: "#f0fdf4", icon: "✅", sub: "tasks done" },
  ]

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
          End-to-End Warehouse Automation
        </p>
        <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 30, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: -0.5 }}>
          Operations Overview
        </h1>
        <p style={{ color: "#64748b", marginTop: 8, fontSize: 14 }}>
          Live data flowing through WMS → WCS/WES → RMS → AMRs
        </p>
      </div>

      {/* Flow diagram */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 28,
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        flexWrap: "wrap",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        {[
          { label: "WMS",     color: "#6366f1", bg: "#f5f3ff", icon: "📥", sub: "Order Intake" },
          { label: "WCS/WES", color: "#f59e0b", bg: "#fffbeb", icon: "⚙️", sub: "Rules Engine" },
          { label: "RMS",     color: "#8b5cf6", bg: "#f5f3ff", icon: "🤖", sub: "Robot Control" },
          { label: "AMRs",    color: "#10b981", bg: "#f0fdf4", icon: "🚗", sub: "Execution" },
        ].map((b, i) => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: b.bg,
              border: `1px solid ${b.color}30`,
              borderRadius: 14,
              padding: "18px 28px",
              textAlign: "center",
              minWidth: 130,
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{b.icon}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: b.color }}>{b.label}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{b.sub}</div>
            </div>
            {i < 3 && (
              <div style={{ fontSize: 18, color: "#cbd5e1", fontWeight: 700 }}>→</div>
            )}
          </div>
        ))}
      </div>

      {/* KPI boxes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {boxes.map(b => (
          <div key={b.label} style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            borderTop: `3px solid ${b.color}`,
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{b.icon}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#94a3b8", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              {b.label}
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 700, color: b.color }}>{b.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{b.sub}</div>
          </div>
        ))}
      </div>

      {/* Event log */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#94a3b8", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>
          Live Event Stream
        </div>
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {(logs as Log[]).length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>
              Go to WMS page and inject orders to see live events here
            </div>
          )}
          {(logs as Log[]).map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#cbd5e1", flexShrink: 0, marginTop: 2 }}>{l.t}</span>
              <span style={{
                background: `${l.color}15`,
                border: `1px solid ${l.color}40`,
                borderRadius: 4, padding: "0 6px",
                fontFamily: "'DM Mono', monospace",
                fontSize: 9, color: l.color, flexShrink: 0,
              }}>{l.layer}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#475569" }}>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}