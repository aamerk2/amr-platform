"use client"
import { useStore } from "@/lib/store"

interface Task  { status: string; g2pStatus?: string; priority?: string }
interface Order { id: string; status: string; priority: string; createdAt: number; customer: string; items: {sku:string;qty:number}[] }
interface Log   { t: string; color: string; layer: string; msg: string }

export default function Dashboard() {
  const { orders, tasks, logs } = useStore()

  const typedOrders = orders as Order[]
  const typedTasks  = tasks  as Task[]
  const typedLogs   = logs   as Log[]

  const stats = {
    totalOrders:   typedOrders.length,
    activeOrders:  typedOrders.filter(o => o.status !== "SHIPPED").length,
    shipped:       typedOrders.filter(o => o.status === "SHIPPED").length,
    tasksTotal:    typedTasks.length,
    tasksDone:     typedTasks.filter(t => t.status === "DONE").length,
    tasksActive:   typedTasks.filter(t => t.status === "AMR_ASSIGNED" || t.status === "AT_STATION" || t.status === "STATION_ASSIGNED").length,
    critical:      typedOrders.filter(o => o.priority === "CRITICAL").length,
    efficiency:    typedTasks.length
      ? Math.round((typedTasks.filter(t => t.status === "DONE").length / typedTasks.length) * 100)
      : 0,
  }

  const kpis = [
    { label: "Stock levels",       value: stats.totalOrders * 12 || 12480, suffix: "",   color: "#0f172a", icon: "📦" },
    { label: "Active orders",      value: stats.activeOrders,              suffix: "",   color: "#0f172a", icon: "📋" },
    { label: "Inbound shipment",   value: stats.tasksActive,               suffix: "",   color: "#0f172a", icon: "🚚" },
    { label: "Worker efficiency",  value: stats.efficiency,                suffix: "%",  color: "#0f172a", icon: "⚡" },
  ]

  const flowSteps = [
    { label: "WMS",     sub: "Order intake",   color: "#f97316", count: typedOrders.length },
    { label: "WCS",     sub: "Rules engine",   color: "#6366f1", count: typedTasks.filter(t=>t.status==="WCS_DISPATCHED").length },
    { label: "RMS",     sub: "Robot control",  color: "#8b5cf6", count: typedTasks.filter(t=>t.status==="AMR_ASSIGNED"||t.status==="STATION_ASSIGNED").length },
    { label: "AMRs",    sub: "Execution",      color: "#10b981", count: typedTasks.filter(t=>t.status==="AT_STATION").length },
    { label: "Shipped", sub: "Complete",       color: "#0ea5e9", count: stats.shipped },
  ]

  const recentOrders = typedOrders.slice(0, 6)

  const PRI_COL: Record<string,string> = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#f59e0b", LOW:"#94a3b8" }
  const PRI_BG:  Record<string,string> = { CRITICAL:"#fef2f2", HIGH:"#fff7ed", MEDIUM:"#fffbeb", LOW:"#f8fafc"  }
  const STA_COL: Record<string,string> = { RECEIVED:"#6366f1", PROCESSING:"#f59e0b", SHIPPED:"#10b981", CANCELLED:"#ef4444" }
  const STA_BG:  Record<string,string> = { RECEIVED:"#eef2ff", PROCESSING:"#fffbeb", SHIPPED:"#f0fdf4",  CANCELLED:"#fef2f2" }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 26, fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: -0.3 }}>
          Warehouse Manager Dashboard
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4, margin: "4px 0 0" }}>
          Updated {new Date().toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{
            background: "#ffffff",
            border: "1px solid #f1f5f9",
            borderRadius: 14,
            padding: "20px 22px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#64748b", fontWeight: 400 }}>
                {k.label}
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: ["#fff7ed","#eef2ff","#f0fdf4","#f5f3ff"][i],
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>
                {k.icon}
              </div>
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 32, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>
              {k.value.toLocaleString()}{k.suffix}
            </div>
            {/* Subtle bottom accent */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              height: 3,
              background: ["#f97316","#6366f1","#10b981","#8b5cf6"][i],
              borderRadius: "0 0 14px 14px",
              opacity: 0.6,
            }}/>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, marginBottom: 20 }}>

        {/* Flow diagram */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #f1f5f9",
          borderRadius: 14,
          padding: "22px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              End-to-End Flow
            </h2>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#94a3b8", background: "#f8fafc", padding: "3px 8px", borderRadius: 6, border: "1px solid #f1f5f9" }}>
              LIVE
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
            {flowSteps.map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    width: 48, height: 48,
                    background: `${s.color}15`,
                    border: `1.5px solid ${s.color}40`,
                    borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 8px",
                    fontSize: 18,
                  }}>
                    {["📥","⚙️","🤖","🚗","✅"][i]}
                  </div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{s.sub}</div>
                  <div style={{
                    display: "inline-block",
                    background: `${s.color}15`,
                    color: s.color,
                    borderRadius: 6,
                    padding: "2px 10px",
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 13, fontWeight: 700,
                  }}>{s.count}</div>
                </div>
                {i < flowSteps.length - 1 && (
                  <div style={{ color: "#e2e8f0", fontSize: 18, flexShrink: 0, marginBottom: 16 }}>→</div>
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#64748b" }}>Overall completion</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#10b981", fontWeight: 600 }}>
                {stats.efficiency}%
              </span>
            </div>
            <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${stats.efficiency}%`,
                background: "linear-gradient(90deg, #f97316, #6366f1)",
                borderRadius: 99,
                transition: "width 0.6s ease",
              }}/>
            </div>
          </div>
        </div>

        {/* Live event stream */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #f1f5f9",
          borderRadius: 14,
          padding: "22px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Live Event Stream
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }}/>
              <span style={{ fontSize: 11, color: "#10b981", fontWeight: 500 }}>Live</span>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 260, display: "flex", flexDirection: "column", gap: 8 }}>
            {typedLogs.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>
                Go to WMS and inject orders to see live events
              </div>
            )}
            {typedLogs.slice(0, 15).map((l, i) => (
              <div key={i} style={{
                display: "flex", gap: 8, alignItems: "flex-start",
                padding: "8px 10px",
                background: "#f8fafc",
                borderRadius: 8,
                borderLeft: `3px solid ${l.color}`,
              }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "#94a3b8", flexShrink: 0, marginTop: 2 }}>{l.t}</span>
                <span style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 9,
                  background: `${l.color}15`,
                  color: l.color, padding: "0 5px",
                  borderRadius: 3, flexShrink: 0,
                }}>{l.layer}</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#475569", lineHeight: 1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders table */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #f1f5f9",
        borderRadius: 14,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Recent Orders
          </h2>
          <button style={{
            background: "none", border: "1px solid #e2e8f0",
            borderRadius: 8, padding: "6px 14px",
            fontSize: 12, color: "#64748b", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif",
          }}>
            View all →
          </button>
        </div>

        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 80px",
          padding: "10px 24px",
          background: "#fafafa",
          borderBottom: "1px solid #f1f5f9",
        }}>
          {["Order / Customer","Priority","Status","Items","Time"].map(h => (
            <div key={h} style={{
              fontFamily: "'DM Mono',monospace",
              fontSize: 9, color: "#94a3b8",
              letterSpacing: 2, textTransform: "uppercase",
            }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {recentOrders.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontSize: 13 }}>
            No orders yet — go to WMS to inject orders
          </div>
        )}
        {recentOrders.map((o, i) => (
          <div key={o.id} style={{
            display: "grid", gridTemplateColumns: "1fr 120px 100px 100px 80px",
            padding: "14px 24px",
            borderBottom: i < recentOrders.length - 1 ? "1px solid #f8fafc" : "none",
            alignItems: "center",
          }}>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#6366f1", fontWeight: 500, marginBottom: 2 }}>{o.id}</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#64748b" }}>{o.customer}</div>
            </div>
            <span style={{
              display: "inline-flex",
              background: PRI_BG[o.priority] || "#f8fafc",
              color: PRI_COL[o.priority] || "#94a3b8",
              borderRadius: 6, padding: "3px 10px",
              fontFamily: "'DM Mono',monospace",
              fontSize: 10, fontWeight: 600,
              width: "fit-content",
            }}>{o.priority}</span>
            <span style={{
              display: "inline-flex",
              background: STA_BG[o.status] || "#f8fafc",
              color: STA_COL[o.status] || "#94a3b8",
              borderRadius: 6, padding: "3px 10px",
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              width: "fit-content",
            }}>{o.status}</span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#334155", fontWeight: 500 }}>
              {o.items.length} lines
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#94a3b8" }}>
              {new Date(o.createdAt).toLocaleTimeString("en-AU",{hour12:false,hour:"2-digit",minute:"2-digit"})}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}