"use client"
import { useState } from "react"
import { useStore } from "@/lib/store"

const PRI_COL: Record<string, string> = {
  CRITICAL: "#ff3d3d",
  HIGH: "#ff8c00",
  MEDIUM: "#ffd600",
  LOW: "#78909c",
}

const STATUS_COL: Record<string, string> = {
  RECEIVED:   "#00e5ff",
  PROCESSING: "#ffb300",
  PICKING:    "#e040fb",
  PACKED:     "#ff8c00",
  SHIPPED:    "#69ff47",
  CANCELLED:  "#ff3d3d",
}

interface OrderItem {
  sku: string
  qty: number
  location: string
}

interface Order {
  id: string
  customer: string
  priority: string
  status: string
  createdAt: number
  items: OrderItem[]
}

interface Task {
  status: string
  orderId: string
}

const TABS = ["Orders", "Inventory", "Inbound / Outbound", "Status Tracking"]

export default function WMSPage() {
  const { orders, tasks, injectOrder, injectBatch } = useStore()
  const [activeTab, setActiveTab] = useState("Orders")
  const [filterPriority, setFilterPriority] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [search, setSearch] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const filteredOrders = (orders as Order[]).filter(o => {
    const matchPriority = filterPriority === "ALL" || o.priority === filterPriority
    const matchStatus   = filterStatus === "ALL" || o.status === filterStatus
    const matchSearch   = search === "" || o.id.toLowerCase().includes(search.toLowerCase()) || o.customer.toLowerCase().includes(search.toLowerCase())
    return matchPriority && matchStatus && matchSearch
  })

  // Build inventory from tasks
  const inventory = Array.from(
    (tasks as Task[]).reduce((map, t) => {
      const order = (orders as Order[]).find(o => o.id === t.orderId)
      if (!order) return map
      order.items.forEach((item: OrderItem) => {
        const existing = map.get(item.sku) || { sku: item.sku, location: item.location, total: 0, picked: 0, available: 0 }
        existing.total += item.qty
        existing.picked += t.status === "DONE" ? item.qty : 0
        existing.available = existing.total - existing.picked
        map.set(item.sku, existing)
      })
      return map
    }, new Map())
  ).map(([, v]) => v).slice(0, 30)

  const stats = {
    total:      (orders as Order[]).length,
    received:   (orders as Order[]).filter(o => o.status === "RECEIVED").length,
    processing: (orders as Order[]).filter(o => o.status === "PROCESSING").length,
    shipped:    (orders as Order[]).filter(o => o.status === "SHIPPED").length,
    critical:   (orders as Order[]).filter(o => o.priority === "CRITICAL").length,
    totalLines: (orders as Order[]).reduce((s, o) => s + o.items.length, 0),
  }

  return (
    <div style={{ padding: "0", maxWidth: "100%", background: "#060a12", minHeight: "100vh" }}>

      {/* Top header bar */}
      <div style={{
        background: "#0a0f1e",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "16px 28px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#00e5ff", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
            LAYER 1 · WAREHOUSE MANAGEMENT SYSTEM
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}>
            WMS — Order & Inventory Control
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => injectOrder()} style={{
            padding: "9px 20px", background: "rgba(0,229,255,0.1)",
            border: "1px solid #00e5ff", borderRadius: 7, color: "#00e5ff",
            fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: 1, cursor: "pointer",
          }}>＋ NEW ORDER</button>
          <button onClick={() => injectBatch(5)} style={{
            padding: "9px 20px", background: "rgba(255,179,0,0.1)",
            border: "1px solid #ffb300", borderRadius: 7, color: "#ffb300",
            fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: 1, cursor: "pointer",
          }}>⚡ BATCH ×5</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 1, background: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        {[
          { label: "Total Orders",  value: stats.total,      color: "#00e5ff" },
          { label: "Received",      value: stats.received,   color: "#00bcd4" },
          { label: "Processing",    value: stats.processing, color: "#ffb300" },
          { label: "Shipped",       value: stats.shipped,    color: "#69ff47" },
          { label: "Critical",      value: stats.critical,   color: "#ff3d3d" },
          { label: "Total Lines",   value: stats.totalLines, color: "#e040fb" },
        ].map(k => (
          <div key={k.label} style={{
            background: "#0a0f1e", padding: "14px 20px",
            borderRight: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
              {k.label}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: k.color }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "#0a0f1e", padding: "0 28px",
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            background: "none", border: "none",
            borderBottom: `2px solid ${activeTab === t ? "#00e5ff" : "transparent"}`,
            color: activeTab === t ? "#00e5ff" : "rgba(255,255,255,0.35)",
            fontFamily: "'Courier New', monospace", fontSize: 11,
            letterSpacing: 1.5, textTransform: "uppercase",
            padding: "14px 20px", cursor: "pointer", transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}>{t}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: "24px 28px" }}>

        {/* ── ORDERS TAB ── */}
        {activeTab === "Orders" && (
          <div>
            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Search order ID or customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: "#0d1424", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 7, padding: "8px 14px", color: "#fff",
                  fontFamily: "'Courier New', monospace", fontSize: 11,
                  width: 260, outline: "none",
                }}
              />
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{
                background: "#0d1424", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7, padding: "8px 14px", color: "#fff",
                fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer",
              }}>
                <option value="ALL">All Priorities</option>
                {["CRITICAL","HIGH","MEDIUM","LOW"].map(p => <option key={p}>{p}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
                background: "#0d1424", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 7, padding: "8px 14px", color: "#fff",
                fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer",
              }}>
                <option value="ALL">All Statuses</option>
                {["RECEIVED","PROCESSING","PICKING","PACKED","SHIPPED","CANCELLED"].map(s => <option key={s}>{s}</option>)}
              </select>
              <div style={{ marginLeft: "auto", fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                {filteredOrders.length} orders
              </div>
            </div>

            {/* Table */}
            <div style={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{
                display: "grid", gridTemplateColumns: "140px 1fr 100px 100px 80px 120px 80px",
                background: "#0d1424", borderBottom: "1px solid rgba(255,255,255,0.08)",
                padding: "10px 16px",
              }}>
                {["Order ID","Customer","Priority","Status","Lines","Created","Actions"].map(h => (
                  <div key={h} style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Table rows */}
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {filteredOrders.length === 0 && (
                  <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                    No orders found — click NEW ORDER or BATCH ×5 above
                  </div>
                )}
                {filteredOrders.map((o: Order, i: number) => (
                  <div key={o.id} style={{
                    display: "grid", gridTemplateColumns: "140px 1fr 100px 100px 80px 120px 80px",
                    padding: "12px 16px", alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    transition: "background 0.15s",
                  }}>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#00e5ff" }}>
                      {o.id}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "#fff" }}>
                      {o.customer}
                    </span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: `${PRI_COL[o.priority]}18`,
                      border: `1px solid ${PRI_COL[o.priority]}45`,
                      borderRadius: 4, padding: "2px 8px",
                      fontFamily: "'Courier New', monospace",
                      fontSize: 9, color: PRI_COL[o.priority],
                      width: "fit-content",
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: PRI_COL[o.priority], display: "inline-block" }}/>
                      {o.priority}
                    </span>
                    <span style={{
                      display: "inline-flex",
                      background: `${STATUS_COL[o.status] || "#78909c"}18`,
                      border: `1px solid ${STATUS_COL[o.status] || "#78909c"}45`,
                      borderRadius: 4, padding: "2px 8px",
                      fontFamily: "'Courier New', monospace",
                      fontSize: 9, color: STATUS_COL[o.status] || "#78909c",
                      width: "fit-content",
                    }}>
                      {o.status}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                      {o.items.length}
                    </span>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                      {new Date(o.createdAt).toLocaleTimeString("en-AU", { hour12: false })}
                    </span>
                    <button
                      onClick={() => setSelectedOrder(selectedOrder?.id === o.id ? null : o)}
                      style={{
                        background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.25)",
                        borderRadius: 5, padding: "4px 10px", color: "#00e5ff",
                        fontFamily: "'Courier New', monospace", fontSize: 9,
                        cursor: "pointer", letterSpacing: 1,
                      }}>
                      {selectedOrder?.id === o.id ? "CLOSE" : "VIEW"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Detail Panel */}
            {selectedOrder && (
              <div style={{
                marginTop: 16,
                background: "#0a0f1e", border: "1px solid rgba(0,229,255,0.2)",
                borderRadius: 10, padding: 20,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#00e5ff", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                      Order Detail
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#fff" }}>
                      {selectedOrder.id} — {selectedOrder.customer}
                    </div>
                  </div>
                  <span style={{
                    background: `${PRI_COL[selectedOrder.priority]}18`,
                    border: `1px solid ${PRI_COL[selectedOrder.priority]}45`,
                    borderRadius: 4, padding: "4px 12px",
                    fontFamily: "'Courier New', monospace",
                    fontSize: 10, color: PRI_COL[selectedOrder.priority],
                  }}>
                    {selectedOrder.priority}
                  </span>
                </div>
                <div style={{ background: "#0d1424", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 80px 140px",
                    background: "#111827", padding: "8px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    {["SKU","Qty","Location"].map(h => (
                      <div key={h} style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase" }}>{h}</div>
                    ))}
                  </div>
                  {selectedOrder.items.map((item: OrderItem, i: number) => (
                    <div key={i} style={{
                      display: "grid", gridTemplateColumns: "1fr 80px 140px",
                      padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                      background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    }}>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#00e5ff" }}>{item.sku}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#fff" }}>{item.qty}</span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.location}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INVENTORY TAB ── */}
        {activeTab === "Inventory" && (
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
              SKU Inventory Tracker
            </div>
            <div style={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 100px",
                background: "#0d1424", borderBottom: "1px solid rgba(255,255,255,0.08)",
                padding: "10px 16px",
              }}>
                {["SKU","Location","Total Qty","Picked","Available"].map(h => (
                  <div key={h} style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {inventory.length === 0 && (
                  <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                    No inventory data yet — inject orders first
                  </div>
                )}
                {inventory.map((item: any, i: number) => (
                  <div key={item.sku} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 100px",
                    padding: "12px 16px", alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                  }}>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#00e5ff" }}>{item.sku}</span>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.location}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: "#fff", fontWeight: 700 }}>{item.total}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: "#e040fb" }}>{item.picked}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: item.available > 0 ? "#69ff47" : "#ff3d3d", fontWeight: 700 }}>{item.available}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INBOUND / OUTBOUND TAB ── */}
        {activeTab === "Inbound / Outbound" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Inbound */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00e5ff" }}/>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#00e5ff", letterSpacing: 3, textTransform: "uppercase" }}>
                  Inbound Shipments
                </div>
              </div>
              <div style={{ background: "#0a0f1e", border: "1px solid rgba(0,229,255,0.15)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", background: "#0d1424", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px" }}>
                  {["Order","Lines","Priority"].map(h => (
                    <div key={h} style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>{h}</div>
                  ))}
                </div>
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  {(orders as Order[]).filter(o => o.status === "RECEIVED").length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>No inbound orders</div>
                  )}
                  {(orders as Order[]).filter(o => o.status === "RECEIVED").map((o, i) => (
                    <div key={o.id} style={{
                      display: "grid", gridTemplateColumns: "1fr 80px 100px",
                      padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    }}>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#00e5ff" }}>{o.id}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#fff" }}>{o.items.length}</span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: PRI_COL[o.priority] }}>{o.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Outbound */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#69ff47" }}/>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#69ff47", letterSpacing: 3, textTransform: "uppercase" }}>
                  Outbound Shipments
                </div>
              </div>
              <div style={{ background: "#0a0f1e", border: "1px solid rgba(105,255,71,0.15)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", background: "#0d1424", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px" }}>
                  {["Order","Lines","Priority"].map(h => (
                    <div key={h} style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>{h}</div>
                  ))}
                </div>
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  {(orders as Order[]).filter(o => o.status !== "RECEIVED").length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>No outbound orders</div>
                  )}
                  {(orders as Order[]).filter(o => o.status !== "RECEIVED").map((o, i) => (
                    <div key={o.id} style={{
                      display: "grid", gridTemplateColumns: "1fr 80px 100px",
                      padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    }}>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#69ff47" }}>{o.id}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#fff" }}>{o.items.length}</span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: PRI_COL[o.priority] }}>{o.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STATUS TRACKING TAB ── */}
        {activeTab === "Status Tracking" && (
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
              Real-Time Order Status
            </div>

            {/* Status summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
              {Object.entries(STATUS_COL).map(([status, color]) => {
                const count = (orders as Order[]).filter(o => o.status === status).length
                return (
                  <div key={status} style={{
                    background: "#0a0f1e", border: `1px solid ${color}25`,
                    borderLeft: `3px solid ${color}`, borderRadius: 8, padding: "14px 16px",
                  }}>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                      {status}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color }}>{count}</div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 2, background: color, opacity: 0.7,
                        width: `${(orders as Order[]).length ? (count / (orders as Order[]).length) * 100 : 0}%`,
                        transition: "width 0.5s",
                      }}/>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Live order timeline */}
            <div style={{ background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 20 }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>
                Live Order Timeline
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {(orders as Order[]).length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                    No orders yet — inject orders to see timeline
                  </div>
                )}
                {(orders as Order[]).map(o => {
                  const color = STATUS_COL[o.status] || "#78909c"
                  return (
                    <div key={o.id} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 7,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }}/>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#00e5ff", flexShrink: 0, width: 100 }}>{o.id}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#fff", flex: 1 }}>{o.customer}</span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: PRI_COL[o.priority], flexShrink: 0 }}>{o.priority}</span>
                      <span style={{
                        background: `${color}18`, border: `1px solid ${color}45`,
                        borderRadius: 4, padding: "2px 10px",
                        fontFamily: "'Courier New', monospace",
                        fontSize: 9, color, flexShrink: 0,
                      }}>{o.status}</span>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
                        {new Date(o.createdAt).toLocaleTimeString("en-AU", { hour12: false })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}