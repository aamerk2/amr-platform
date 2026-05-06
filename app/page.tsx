"use client"
import { useStore } from "../lib/store"

interface Task {
  status: string
}

interface Log {
  t: string
  color: string
  layer: string
  msg: string
}

export default function Overview() {
  const { orders, tasks, logs } = useStore()

  const stats = {
    orders:     orders.length,
    queued:     tasks.filter((t: Task) => t.status === "WMS_QUEUED").length,
    dispatched: tasks.filter((t: Task) => t.status === "WCS_DISPATCHED").length,
    assigned:   tasks.filter((t: Task) => t.status === "ASSIGNED").length,
    done:       tasks.filter((t: Task) => t.status === "DONE").length,
  }

  const boxes = [
    { label: "Total Orders",    value: stats.orders,     color: "#00e5ff", icon: "📥", sub: "in WMS" },
    { label: "WMS Queued",      value: stats.queued,     color: "#00bcd4", icon: "⏳", sub: "awaiting WCS" },
    { label: "WCS Dispatched",  value: stats.dispatched, color: "#ffb300", icon: "⚙️", sub: "routed to RMS" },
    { label: "Assigned to AMR", value: stats.assigned,   color: "#e040fb", icon: "🤖", sub: "en route" },
    { label: "Completed",       value: stats.done,       color: "#69ff47", icon: "✅", sub: "tasks done" },
  ]

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 10, color: "rgba(255,255,255,0.3)",
          letterSpacing: 3, textTransform: "uppercase" as const, marginBottom: 6,
        }}>
          End-to-End Warehouse Automation
        </div>
        <h1 style={{ fontFamily: "monospace", fontSize: 32, fontWeight: 700, margin: 0, color: "#fff" }}>
          Operations Overview
        </h1>
        <p style={{ color: "rgba(255,255,255,0.35)", marginTop: 8, fontSize: 14, fontStyle: "italic" }}>
          Live data flowing through WMS → WCS/WES → RMS → AMRs
        </p>
      </div>

      {/* Flow diagram */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, padding: 24, marginBottom: 24,
        display: "flex", alignItems: "center",
        justifyContent: "center", gap: 8, flexWrap: "wrap" as const,
      }}>
        {[
          { label: "WMS",     color: "#00e5ff", icon: "📥", sub: "Order Intake" },
          { label: "WCS/WES", color: "#ffb300", icon: "⚙️", sub: "Rules Engine" },
          { label: "RMS",     color: "#e040fb", icon: "🤖", sub: "Robot Control" },
          { label: "AMRs",    color: "#69ff47", icon: "🚗", sub: "Execution" },
        ].map((b, i) => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: `${b.color}10`,
              border: `1px solid ${b.color}40`,
              borderRadius: 12, padding: "16px 24px",
              textAlign: "center" as const, minWidth: 120,
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{b.icon}</div>
              <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: b.color }}>{b.label}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4, fontStyle: "italic" }}>{b.sub}</div>
            </div>
            {i < 3 && (
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>→</div>
            )}
          </div>
        ))}
      </div>

      {/* KPI boxes */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12, marginBottom: 24,
      }}>
        {boxes.map(b => (
          <div key={b.label} style={{
            background: "rgba(0,0,0,0.3)",
            border: `1px solid ${b.color}25`,
            borderRadius: 12, padding: "18px 20px",
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{b.icon}</div>
            <div style={{
              fontFamily: "'Courier New', monospace", fontSize: 9,
              color: "rgba(255,255,255,0.3)", letterSpacing: 2,
              textTransform: "uppercase" as const, marginBottom: 6,
            }}>{b.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, color: b.color }}>{b.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 4, fontStyle: "italic" }}>{b.sub}</div>
          </div>
        ))}
      </div>

      {/* Event log */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, padding: 20,
      }}>
        <div style={{
          fontFamily: "'Courier New', monospace", fontSize: 9,
          color: "rgba(255,255,255,0.3)", letterSpacing: 3,
          textTransform: "uppercase" as const, marginBottom: 12,
        }}>Live Event Stream</div>
        <div style={{ maxHeight: 280, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: 6 }}>
          {logs.length === 0 && (
            <div style={{
              textAlign: "center" as const, padding: 40,
              color: "rgba(255,255,255,0.2)", fontStyle: "italic", fontSize: 13,
            }}>
              Go to WMS page and inject orders to see live events here
            </div>
          )}
          {logs.map((l: Log, i: number) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 9, color: "rgba(255,255,255,0.2)", flexShrink: 0,
              }}>{l.t}</span>
              <span style={{
                background: `${l.color}18`, border: `1px solid ${l.color}40`,
                borderRadius: 3, padding: "0 6px",
                fontFamily: "'Courier New', monospace",
                fontSize: 9, color: l.color, flexShrink: 0,
              }}>{l.layer}</span>
              <span style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 11, color: "rgba(255,255,255,0.6)",
              }}>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}