"use client"
import { useStore } from "@/lib/store"

interface Task  { status: string; priority?: string }
interface Order { id: string; status: string; priority: string; createdAt: number; customer: string; items: {sku:string;qty:number}[] }
interface Log   { t: string; color: string; layer: string; msg: string }

export default function Dashboard() {
  const { orders, tasks, logs } = useStore()
  const typedOrders = orders as Order[]
  const typedTasks  = tasks  as Task[]
  const typedLogs   = logs   as Log[]

  const stats = {
    totalOrders:  typedOrders.length,
    activeOrders: typedOrders.filter(o => o.status !== "SHIPPED").length,
    shipped:      typedOrders.filter(o => o.status === "SHIPPED").length,
    tasksActive:  typedTasks.filter(t => t.status === "AMR_ASSIGNED" || t.status === "AT_STATION" || t.status === "STATION_ASSIGNED").length,
    tasksDone:    typedTasks.filter(t => t.status === "DONE").length,
    efficiency:   typedTasks.length ? Math.round((typedTasks.filter(t => t.status === "DONE").length / typedTasks.length) * 100) : 0,
  }

  const kpis = [
    { label: "Stock levels",      value: typedOrders.length * 12 || 12480, suffix: "",  color: "#f97316", icon: "📦", dim: "rgba(249,115,22,0.12)"  },
    { label: "Active orders",     value: stats.activeOrders,               suffix: "",  color: "#6366f1", icon: "📋", dim: "rgba(99,102,241,0.12)"   },
    { label: "Inbound shipment",  value: stats.tasksActive,                suffix: "",  color: "#10b981", icon: "🚚", dim: "rgba(16,185,129,0.12)"   },
    { label: "Worker efficiency", value: stats.efficiency,                 suffix: "%", color: "#8b5cf6", icon: "⚡", dim: "rgba(139,92,246,0.12)"   },
  ]

  const flowSteps = [
    { label:"WMS",     sub:"Order intake",  color:"#f97316", icon:"📥",  count:typedOrders.length },
    { label:"WCS",     sub:"Rules engine",  color:"#6366f1", icon:"⚙️",  count:typedTasks.filter(t=>t.status==="WCS_DISPATCHED").length },
    { label:"RMS",     sub:"Robot control", color:"#8b5cf6", icon:"🤖",  count:typedTasks.filter(t=>t.status==="AMR_ASSIGNED"||t.status==="STATION_ASSIGNED").length },
    { label:"AMRs",    sub:"Execution",     color:"#10b981", icon:"🚗",  count:typedTasks.filter(t=>t.status==="AT_STATION").length },
    { label:"Shipped", sub:"Complete",      color:"#0ea5e9", icon:"✅",  count:stats.shipped },
  ]

  const PRI_COL: Record<string,string> = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#f59e0b", LOW:"#94a3b8" }
  const PRI_BG:  Record<string,string> = { CRITICAL:"rgba(239,68,68,0.12)", HIGH:"rgba(249,115,22,0.12)", MEDIUM:"rgba(245,158,11,0.12)", LOW:"rgba(148,163,184,0.08)" }
  const STA_COL: Record<string,string> = { RECEIVED:"#6366f1", PROCESSING:"#f59e0b", SHIPPED:"#10b981", CANCELLED:"#ef4444" }
  const STA_BG:  Record<string,string> = { RECEIVED:"rgba(99,102,241,0.12)", PROCESSING:"rgba(245,158,11,0.12)", SHIPPED:"rgba(16,185,129,0.12)", CANCELLED:"rgba(239,68,68,0.12)" }

  return (
    <div style={{ padding:"28px 32px", maxWidth:1400, margin:"0 auto", background:"#0f172a", minHeight:"100vh" }}>

      {/* Title */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontFamily:"'DM Sans',sans-serif", fontSize:26, fontWeight:700, color:"#f1f5f9", margin:0, letterSpacing:-0.3 }}>
          Warehouse Manager Dashboard
        </h1>
        <p style={{ color:"#475569", fontSize:13, marginTop:4 }}>
          Updated {new Date().toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
        {kpis.map((k,i) => (
          <div key={k.label} style={{
            background:"#1e293b",
            border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:14, padding:"20px 22px",
            position:"relative", overflow:"hidden",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#64748b" }}>{k.label}</span>
              <div style={{ width:36, height:36, borderRadius:10, background:k.dim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                {k.icon}
              </div>
            </div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:34, fontWeight:700, color:"#f1f5f9", lineHeight:1 }}>
              {typeof k.value === "number" ? k.value.toLocaleString() : k.value}{k.suffix}
            </div>
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:k.color, borderRadius:"0 0 14px 14px", opacity:0.8 }}/>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:20, marginBottom:20 }}>

        {/* Flow diagram */}
        <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"22px 24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h2 style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:700, color:"#f1f5f9", margin:0 }}>End-to-End Flow</h2>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#10b981", background:"rgba(16,185,129,0.1)", padding:"3px 8px", borderRadius:6, border:"1px solid rgba(16,185,129,0.2)" }}>LIVE</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:24 }}>
            {flowSteps.map((s,i) => (
              <div key={s.label} style={{ display:"flex", alignItems:"center", flex:1 }}>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ width:48, height:48, background:`${s.color}15`, border:`1.5px solid ${s.color}30`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 8px", fontSize:20 }}>{s.icon}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700, color:s.color }}>{s.label}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#475569", marginBottom:4 }}>{s.sub}</div>
                  <div style={{ display:"inline-block", background:`${s.color}15`, color:s.color, borderRadius:6, padding:"2px 10px", fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:700 }}>{s.count}</div>
                </div>
                {i < flowSteps.length - 1 && <div style={{ color:"#334155", fontSize:18, flexShrink:0, marginBottom:16 }}>→</div>}
              </div>
            ))}
          </div>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#64748b" }}>Overall completion</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#10b981", fontWeight:600 }}>{stats.efficiency}%</span>
            </div>
            <div style={{ height:8, background:"rgba(255,255,255,0.06)", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${stats.efficiency}%`, background:"linear-gradient(90deg,#f97316,#6366f1)", borderRadius:99, transition:"width 0.6s" }}/>
            </div>
          </div>
        </div>

        {/* Live events */}
        <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"22px 24px", display:"flex", flexDirection:"column" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h2 style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:700, color:"#f1f5f9", margin:0 }}>Live Event Stream</h2>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#10b981" }}/>
              <span style={{ fontSize:11, color:"#10b981", fontWeight:500 }}>Live</span>
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", maxHeight:260, display:"flex", flexDirection:"column", gap:6 }}>
            {typedLogs.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 0", color:"#475569", fontSize:13 }}>Go to WMS → inject orders</div>
            )}
            {typedLogs.slice(0,15).map((l,i) => (
              <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"7px 10px", background:"rgba(255,255,255,0.03)", borderRadius:8, borderLeft:`3px solid ${l.color}` }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#334155", flexShrink:0, marginTop:1 }}>{l.t}</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, background:`${l.color}18`, color:l.color, padding:"0 5px", borderRadius:3, flexShrink:0 }}>{l.layer}</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#94a3b8", lineHeight:1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orders table */}
      <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" }}>
        <div style={{ padding:"18px 24px", borderBottom:"1px solid rgba(255,255,255,0.04)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:700, color:"#f1f5f9", margin:0 }}>Recent Orders</h2>
          <button style={{ background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"6px 14px", fontSize:12, color:"#64748b", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            View all →
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 100px 100px 80px", padding:"10px 24px", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
          {["Order / Customer","Priority","Status","Items","Time"].map(h => (
            <div key={h} style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569", letterSpacing:2, textTransform:"uppercase" }}>{h}</div>
          ))}
        </div>
        {typedOrders.length === 0 && (
          <div style={{ textAlign:"center", padding:"48px 0", color:"#475569", fontSize:13 }}>No orders yet — go to WMS to inject orders</div>
        )}
        {typedOrders.slice(0,6).map((o,i) => (
          <div key={o.id} style={{ display:"grid", gridTemplateColumns:"1fr 120px 100px 100px 80px", padding:"13px 24px", borderBottom:i<5?"1px solid rgba(255,255,255,0.03)":"none", alignItems:"center" }}>
            <div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#6366f1", fontWeight:500, marginBottom:2 }}>{o.id}</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#475569" }}>{o.customer}</div>
            </div>
            <span style={{ background:PRI_BG[o.priority]||"rgba(255,255,255,0.05)", color:PRI_COL[o.priority]||"#64748b", borderRadius:5, padding:"2px 8px", fontFamily:"'DM Mono',monospace", fontSize:9, fontWeight:600, width:"fit-content" }}>{o.priority}</span>
            <span style={{ background:STA_BG[o.status]||"rgba(255,255,255,0.05)", color:STA_COL[o.status]||"#64748b", borderRadius:5, padding:"2px 8px", fontFamily:"'DM Mono',monospace", fontSize:9, width:"fit-content" }}>{o.status}</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#94a3b8", fontWeight:500 }}>{o.items.length} lines</span>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#334155" }}>
              {new Date(o.createdAt).toLocaleTimeString("en-AU",{hour12:false,hour:"2-digit",minute:"2-digit"})}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}