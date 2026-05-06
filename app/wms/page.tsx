"use client"
import { useStore } from "../../lib/store"

const PRI_COL: Record<string, string> = {
  CRITICAL: "#ff3d3d",
  HIGH: "#ff8c00",
  MEDIUM: "#ffd600",
  LOW: "#78909c",
}

export default function WMSPage() {
  const { orders, tasks, injectOrder, injectBatch } = useStore()

  const stats = {
    total:    orders.length,
    critical: orders.filter(o => o.priority === "CRITICAL").length,
    high:     orders.filter(o => o.priority === "HIGH").length,
    medium:   orders.filter(o => o.priority === "MEDIUM").length,
    low:      orders.filter(o => o.priority === "LOW").length,
  }

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#00e5ff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
            LAYER 1
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>
            Warehouse Management System
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", marginTop: 6, fontSize: 13, fontStyle: "italic", margin: "6px 0 0" }}>
            Receives customer orders · Generates pick tasks · Passes to WCS for routing
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={injectOrder} style={{
            padding: "10px 22px",
            background: "rgba(0,229,255,0.1)",
            border: "1px solid #00e5ff",
            borderRadius: 8, color: "#00e5ff",
            fontFamily: "'Courier New', monospace",
            fontSize: 12, letterSpacing: 1, cursor: "pointer",
          }}>
            ＋ INJECT ORDER
          </button>
          <button onClick={() => injectBatch(5)} style={{
            padding: "10px 22px",
            background: "rgba(255,179,0,0.1)",
            border: "1px solid #ffb300",
            borderRadius: 8, color: "#ffb300",
            fontFamily: "'Courier New', monospace",
            fontSize: 12, letterSpacing: 1, cursor: "pointer",
          }}>
            ⚡ BATCH ×5
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Orders", value: stats.total,    color: "#00e5ff" },
          { label: "Critical",     value: stats.critical, color: "#ff3d3d" },
          { label: "High",         value: stats.high,     color: "#ff8c00" },
          { label: "Medium",       value: stats.medium,   color: "#ffd600" },
          { label: "Low",          value: stats.low,      color: "#78909c" },
        ].map(k => (
          <div key={k.label} style={{
            background: "rgba(0,0,0,0.3)",
            border: `1px solid ${k.color}25`,
            borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              {k.label}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 700, color: k.color }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Orders List */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, padding: 20,
      }}>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#00e5ff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>
          Order Queue
        </div>

        {orders.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
            No orders yet — click INJECT ORDER or BATCH ×5 above
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflowY: "auto" }}>
          {orders.map(o => (
            <div key={o.id} style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderLeft: `3px solid ${PRI_COL[o.priority]}`,
              borderRadius: 8, padding: "12px 16px",
              display: "flex", alignItems: "center",
              gap: 16, flexWrap: "wrap",
            }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
                {o.id}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "#fff", fontWeight: 700, flex: 1 }}>
                {o.customer}
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {o.items.slice(0, 3).map((item, i) => (
                  <span key={i} style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 8px" }}>
                    {item.sku} ×{item.qty}
                  </span>
                ))}
                {o.items.length > 3 && (
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                    +{o.items.length - 3} more
                  </span>
                )}
              </div>
              <span style={{
                background: `${PRI_COL[o.priority]}18`,
                border: `1px solid ${PRI_COL[o.priority]}45`,
                borderRadius: 4, padding: "2px 10px",
                fontFamily: "'Courier New', monospace",
                fontSize: 10, color: PRI_COL[o.priority],
                textTransform: "uppercase", flexShrink: 0,
              }}>
                {o.priority}
              </span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                {o.items.length} lines
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}