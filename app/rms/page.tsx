"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"

const COLS = 24
const ROWS = 20
const CELL = 28

const AISLE_COLS = [0, 4, 8, 12, 16, 20, 23]
const AISLE_ROWS = [0, 5, 10, 15, 19]

const STATION_POSITIONS: Record<string, { row: number; col: number; side: string }> = {
  S1: { row: 2,  col: 0,  side: "left"  },
  S2: { row: 12, col: 0,  side: "left"  },
  S3: { row: 2,  col: 23, side: "right" },
  S4: { row: 12, col: 23, side: "right" },
}

const ROW_LABELS = ["49","50","51","52","53","54","20","21","22","23","24","25","26","27","28","29","30","31","32","33"]
const COL_LABELS = ["01","02","03","3233","04","05","06","3435","07","08","09","3637","10","11","12","3839","13","14","15","4041","16","17","18","42"]

interface AMR {
  id: string
  color: string
  model: string
  status: string
  phase: string
  battery: number
  row: number
  col: number
  homeRow: number
  homeCol: number
  taskId: string | null
  stationId: string | null
  carryingRack: boolean
  rackId: string | null
  completedTasks: number
  totalDist: number
  path: { row: number; col: number }[]
  targetRow: number
  targetCol: number
  queuePosition: number | null
}

interface Task {
  id: string
  status: string
  g2pStatus: string
  priority: string
  sku: string
  assignedTo: string | null
  stationId: string | null
  from?: number[]
}

interface Station {
  id: string
  label: string
  side: string
  status: string
  loggedIn: boolean
  amrQueue: string[]
  taskQueue: string[]
  currentTaskId: string | null
  picksCompleted: number
  totalPicks: number
  waypoint?: { row: number; col: number }
}

const G2P_COLORS: Record<string, string> = {
  WMS_QUEUED:       "#3b82f6",
  WCS_DISPATCHED:   "#f59e0b",
  STATION_ASSIGNED: "#6366f1",
  AMR_ASSIGNED:     "#8b5cf6",
  AMR_MOVING:       "#f97316",
  AT_STATION:       "#10b981",
  PICKING:          "#10b981",
  PICKED:           "#4ade80",
  AMR_RETURNING:    "#8b5cf6",
  DONE:             "#10b981",
}

function isAisle(r: number, c: number) {
  return AISLE_COLS.includes(c) || AISLE_ROWS.includes(r)
}

function WarehouseMap({ amrs, tasks, stations, zoom }: {
  amrs: AMR[]
  tasks: Task[]
  stations: Station[]
  zoom: number
}) {
  const PAD_TOP  = 32
  const PAD_LEFT = 36
  const SHELF_H  = CELL
  const RACK_D   = 5

  const mapW = COLS * CELL + PAD_LEFT + 60
  const mapH = ROWS * (SHELF_H + RACK_D) + PAD_TOP + 60

  return (
    <div style={{ transform:`scale(${zoom})`, transformOrigin:"top left", transition:"transform 0.2s", display:"inline-block" }}>
      <svg width={mapW} height={mapH} style={{ display:"block" }}>
        <defs>
          <filter id="amrglow">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* White background */}
        <rect width={mapW} height={mapH} fill="#f8fafc"/>

        {/* Column headers */}
        {Array.from({ length: COLS }, (_, c) => (
          <text key={c}
            x={PAD_LEFT + c * CELL + CELL / 2}
            y={PAD_TOP - 6}
            textAnchor="middle"
            fontFamily="DM Mono, Courier New, monospace"
            fontSize="7"
            fill={AISLE_COLS.includes(c) ? "#f97316" : "#94a3b8"}
            fontWeight={AISLE_COLS.includes(c) ? "bold" : "normal"}>
            {COL_LABELS[c] || c}
          </text>
        ))}

        {/* Row headers */}
        {Array.from({ length: ROWS }, (_, r) => (
          <text key={r}
            x={PAD_LEFT - 4}
            y={PAD_TOP + r * (SHELF_H + RACK_D) + SHELF_H / 2 + 3}
            textAnchor="end"
            fontFamily="DM Mono, Courier New, monospace"
            fontSize="7"
            fill={AISLE_ROWS.includes(r) ? "#f97316" : "#94a3b8"}>
            {ROW_LABELS[r] || r}
          </text>
        ))}

        {/* Grid cells */}
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const x = PAD_LEFT + c * CELL
            const y = PAD_TOP + r * (SHELF_H + RACK_D)
            const aisle = isAisle(r, c)
            const stEntry = Object.entries(STATION_POSITIONS).find(([, p]) => p.row === r && p.col === c)
            const hasTask = tasks.some(t =>
              (t.g2pStatus === "AMR_MOVING" || t.g2pStatus === "AT_STATION") &&
              t.from && t.from[0] === r && t.from[1] === c
            )

            // Station cell
            if (stEntry) {
              const [sid] = stEntry
              const st = stations.find(s => s.id === sid)
              const isActive  = st?.status === "PRESENTING" || st?.status === "ACTIVE"
              const isWaiting = st?.status === "WAITING_AMR" || st?.status === "AMR_EN_ROUTE"
              const isLoggedIn = st?.loggedIn
              const stColor = isActive ? "#10b981" : isWaiting ? "#f59e0b" : isLoggedIn ? "#6366f1" : "#cbd5e1"
              const stBg    = isActive ? "#dcfce7" : isWaiting ? "#fef9c3" : isLoggedIn ? "#eff6ff" : "#f1f5f9"
              return (
                <g key={`${r}-${c}`}>
                  <rect x={x} y={y} width={CELL} height={SHELF_H} fill={stBg} stroke={stColor} strokeWidth="1.5" rx="1"/>
                  <rect x={x} y={y+SHELF_H} width={CELL} height={RACK_D} fill={isActive?"#bbf7d0":"#e2e8f0"} stroke={stColor} strokeWidth="0.5"/>
                  <text x={x+CELL/2} y={y+SHELF_H/2-3} textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="6" fill={stColor} fontWeight="bold">{sid}</text>
                  <text x={x+CELL/2} y={y+SHELF_H/2+6} textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="5" fill={stColor} opacity="0.9">
                    {isActive?"PICK":isWaiting?"WAIT":isLoggedIn?"READY":"IDLE"}
                  </text>
                  {(isActive||isWaiting) && <circle cx={x+CELL-4} cy={y+4} r="3" fill={stColor}/>}
                  {/* Queue count badge */}
                  {st && st.amrQueue.length > 0 && (
                    <>
                      <rect x={x+1} y={y+SHELF_H-8} width={CELL-2} height={5} rx="1" fill="rgba(0,0,0,0.08)"/>
                      <rect x={x+1} y={y+SHELF_H-8} width={(CELL-2)*(st.picksCompleted/Math.max(1,st.totalPicks))} height={5} rx="1" fill={stColor} opacity="0.7"/>
                    </>
                  )}
                </g>
              )
            }

            // Aisle cell
            if (aisle) {
              return (
                <g key={`${r}-${c}`}>
                  <rect x={x} y={y} width={CELL} height={SHELF_H} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.5"/>
                  <rect x={x} y={y+SHELF_H} width={CELL} height={RACK_D} fill="#e8edf2" stroke="#e2e8f0" strokeWidth="0.3"/>
                  {AISLE_COLS.includes(c) && (
                    <line x1={x+CELL/2} y1={y} x2={x+CELL/2} y2={y+SHELF_H}
                      stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3,4" opacity="0.8"/>
                  )}
                  {AISLE_ROWS.includes(r) && (
                    <line x1={x} y1={y+SHELF_H/2} x2={x+CELL} y2={y+SHELF_H/2}
                      stroke="#cbd5e1" strokeWidth="0.8" strokeDasharray="3,4" opacity="0.5"/>
                  )}
                </g>
              )
            }

            // Shelf bay — "HH" pattern
            return (
              <g key={`${r}-${c}`}>
                <rect x={x} y={y} width={CELL} height={SHELF_H}
                  fill={hasTask ? "#dcfce7" : "#dbeafe"}
                  stroke={hasTask ? "#86efac" : "#93c5fd"}
                  strokeWidth={hasTask ? "1.2" : "0.5"}/>
                <rect x={x} y={y+SHELF_H} width={CELL} height={RACK_D}
                  fill={hasTask ? "#bbf7d0" : "#bfdbfe"}
                  stroke={hasTask ? "#86efac" : "#93c5fd"}
                  strokeWidth="0.3"/>
                {/* HH divider */}
                <line x1={x+CELL/2} y1={y+2} x2={x+CELL/2} y2={y+SHELF_H-2}
                  stroke={hasTask ? "#4ade8060" : "#93c5fd60"} strokeWidth="0.8"/>
                <line x1={x+2} y1={y+SHELF_H*0.33} x2={x+CELL-2} y2={y+SHELF_H*0.33}
                  stroke={hasTask ? "#4ade8040" : "#93c5fd40"} strokeWidth="0.5"/>
                <line x1={x+2} y1={y+SHELF_H*0.66} x2={x+CELL-2} y2={y+SHELF_H*0.66}
                  stroke={hasTask ? "#4ade8040" : "#93c5fd40"} strokeWidth="0.5"/>
                {hasTask && <circle cx={x+CELL/2} cy={y+4} r="2.5" fill="#10b981" filter="url(#amrglow)"/>}
              </g>
            )
          })
        )}

        {/* Station side labels */}
        {stations.map(st => {
          const wp = STATION_POSITIONS[st.id]
          if (!wp) return null
          const x = PAD_LEFT + wp.col * CELL
          const y = PAD_TOP + wp.row * (SHELF_H + RACK_D)
          const isLeft   = wp.side === "left"
          const isActive = st.status === "PRESENTING" || st.status === "ACTIVE"
          const isWaiting= st.status === "WAITING_AMR" || st.status === "AMR_EN_ROUTE"
          const color    = isActive ? "#10b981" : isWaiting ? "#f59e0b" : st.loggedIn ? "#6366f1" : "#94a3b8"
          return (
            <g key={st.id}>
              <text
                x={isLeft ? x - 10 : x + CELL + 10}
                y={y + SHELF_H / 2 + 3}
                textAnchor="middle"
                fontFamily="DM Mono, monospace" fontSize="8"
                fill={color} fontWeight="bold">
                {isLeft ? "▶" : "◀"}
              </text>
              <text
                x={isLeft ? x - 26 : x + CELL + 26}
                y={y + SHELF_H / 2 + 3}
                textAnchor="middle"
                fontFamily="DM Mono, monospace" fontSize="7"
                fill={color} fontWeight="bold">
                {st.id}
              </text>
              {/* Queue count */}
              {st.amrQueue.length > 0 && (
                <text
                  x={isLeft ? x - 26 : x + CELL + 26}
                  y={y + SHELF_H / 2 + 13}
                  textAnchor="middle"
                  fontFamily="DM Mono, monospace" fontSize="6"
                  fill={color} opacity="0.8">
                  {st.amrQueue.length} AMR
                </text>
              )}
            </g>
          )
        })}

        {/* AMRs */}
        {amrs.map(amr => {
          const x  = PAD_LEFT + amr.col * CELL
          const y  = PAD_TOP  + amr.row * (SHELF_H + RACK_D)
          const cx = x + CELL / 2
          const cy = y + SHELF_H / 2

          const phaseColors: Record<string,string> = {
            IDLE:"#10b981", TO_RACK:"#3b82f6", TO_STATION:"#f59e0b",
            PRESENTING:"#10b981", QUEUED:"#8b5cf6",
            RETURNING:"#8b5cf6", CHARGING:"#6366f1",
          }
          const dotColor = phaseColors[amr.phase] || amr.color

          return (
            <g key={amr.id} filter="url(#amrglow)">

              {/* Path trail */}
              {amr.path.length > 1 && amr.path.slice(-6).map((p, i, arr) => {
                if (i === 0) return null
                const prev = arr[i-1]
                const x1 = PAD_LEFT + prev.col * CELL + CELL/2
                const y1 = PAD_TOP  + prev.row * (SHELF_H + RACK_D) + SHELF_H/2
                const x2 = PAD_LEFT + p.col * CELL + CELL/2
                const y2 = PAD_TOP  + p.row * (SHELF_H + RACK_D) + SHELF_H/2
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={amr.color} strokeWidth="1"
                    opacity={(i / arr.length) * 0.4}
                    strokeDasharray="2,3"/>
                )
              })}

              {/* Rack being carried */}
              {amr.carryingRack && (
                <rect x={cx-9} y={cy-18} width={18} height={10} rx="1"
                  fill="rgba(245,158,11,0.15)" stroke="#f59e0b"
                  strokeWidth="1" strokeDasharray="2,2"/>
              )}

              {/* AMR body — coloured square */}
              <rect x={cx-7} y={cy-7} width={14} height={14} rx="2"
                fill={`${amr.color}25`} stroke={amr.color} strokeWidth="1.5"/>

              {/* Inner cross */}
              <line x1={cx-4} y1={cy} x2={cx+4} y2={cy} stroke={amr.color} strokeWidth="0.8" opacity="0.8"/>
              <line x1={cx} y1={cy-4} x2={cx} y2={cy+4} stroke={amr.color} strokeWidth="0.8" opacity="0.8"/>

              {/* Direction dot */}
              <circle cx={cx} cy={cy-9} r="2" fill={dotColor}/>

              {/* AMR ID */}
              <text x={cx} y={cy-22} textAnchor="middle"
                fontFamily="DM Mono, Courier New, monospace"
                fontSize="6.5" fill={amr.color} fontWeight="bold">
                {amr.id}
              </text>

              {/* Phase label */}
              <text x={cx} y={cy+20} textAnchor="middle"
                fontFamily="DM Mono, Courier New, monospace" fontSize="5.5"
                fill={amr.phase==="PRESENTING"||amr.phase==="AT_STATION" ? "#10b981"
                    : amr.phase==="TO_STATION" ? "#f59e0b"
                    : amr.phase==="QUEUED" ? "#8b5cf6"
                    : "#94a3b8"}>
                {amr.phase?.replace(/_/g,"")}
              </text>
            </g>
          )
        })}

        {/* Connection lines AMR → Station */}
        {amrs.filter(a => a.stationId && (a.phase==="TO_STATION"||a.phase==="TO_RACK")).map(amr => {
          const sp = STATION_POSITIONS[amr.stationId!]
          if (!sp) return null
          const ax = PAD_LEFT + amr.col * CELL + CELL/2
          const ay = PAD_TOP  + amr.row * (SHELF_H + RACK_D) + SHELF_H/2
          const sx = PAD_LEFT + sp.col * CELL + CELL/2
          const sy = PAD_TOP  + sp.row * (SHELF_H + RACK_D) + SHELF_H/2
          return (
            <line key={amr.id} x1={ax} y1={ay} x2={sx} y2={sy}
              stroke={amr.color} strokeWidth="1"
              strokeDasharray="4,4" opacity="0.35"/>
          )
        })}
      </svg>
    </div>
  )
}

export default function RMSPage() {
  const { tasks, amrs, stations, logs, automationTick, setFleetSize } = useStore()
  const [running, setRunning] = useState(false)
  const [zoom, setZoom] = useState(0.9)
  const [fleetSize, setFleetSizeLocal] = useState(4)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const typedTasks    = tasks    as Task[]
  const typedAmrs     = amrs     as AMR[]
  const typedStations = stations as Station[]

  useEffect(() => {
    if (!running) { if (tickRef.current) clearInterval(tickRef.current); return }
    tickRef.current = setInterval(() => {
      useStore.getState().automationTick()
    }, 400)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running])

  const stats = {
    idle:          typedAmrs.filter(a => a.phase==="IDLE").length,
    toRack:        typedAmrs.filter(a => a.phase==="TO_RACK").length,
    toStation:     typedAmrs.filter(a => a.phase==="TO_STATION").length,
    atStation:     typedAmrs.filter(a => a.phase==="PRESENTING"||a.phase==="QUEUED").length,
    returning:     typedAmrs.filter(a => a.phase==="RETURNING").length,
    charging:      typedAmrs.filter(a => a.phase==="CHARGING").length,
    avgBatt:       Math.round(typedAmrs.reduce((s,a)=>s+a.battery,0)/Math.max(1,typedAmrs.length)),
    done:          typedTasks.filter(t=>t.status==="DONE").length,
    total:         typedTasks.length,
    activeStations:typedStations.filter(s=>s.status==="PRESENTING"||s.status==="ACTIVE").length,
  }

  const openStations = () => window.open("/station","_blank","width=1400,height=900")

  return (
    <div style={{ background:"#f8fafc", minHeight:"100vh", color:"#1e293b", display:"flex", flexDirection:"column" }}>

      {/* TOP BAR */}
      <div style={{
        background:"#ffffff", borderBottom:"1px solid #e2e8f0",
        boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
        padding:"12px 20px", display:"flex", justifyContent:"space-between",
        alignItems:"center", flexWrap:"wrap", gap:10, flexShrink:0,
      }}>
        <div>
          <p style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#94a3b8", letterSpacing:3, textTransform:"uppercase", marginBottom:2 }}>
            MyRoboCloud · RMS · G2P Automation
          </p>
          <h1 style={{ fontFamily:"'DM Sans',sans-serif", fontSize:18, fontWeight:700, margin:0, color:"#0f172a" }}>
            Robot Management System — Live Warehouse Map
          </h1>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={openStations} style={{
            padding:"8px 14px", background:"#f0fdf4",
            border:"1px solid #86efac", borderRadius:8, color:"#059669",
            fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600,
            cursor:"pointer", display:"flex", alignItems:"center", gap:6,
          }}>
            🏭 Open Stations ↗
          </button>
          <button onClick={()=>setZoom(z=>Math.max(0.4,+(z-0.1).toFixed(1)))}
            style={{ width:32, height:32, borderRadius:8, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#475569", cursor:"pointer", fontSize:16 }}>−</button>
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#94a3b8", width:40, textAlign:"center" }}>
            {Math.round(zoom*100)}%
          </span>
          <button onClick={()=>setZoom(z=>Math.min(2.5,+(z+0.1).toFixed(1)))}
            style={{ width:32, height:32, borderRadius:8, border:"1px solid #e2e8f0", background:"#f8fafc", color:"#475569", cursor:"pointer", fontSize:16 }}>+</button>
          <div style={{ width:8, height:8, borderRadius:"50%", marginLeft:8,
            background:running?"#10b981":"#ef4444",
            boxShadow:running?"0 0 0 3px #dcfce7":"0 0 0 3px #fee2e2" }}/>
          <button onClick={()=>setRunning(r=>!r)} style={{
            padding:"8px 20px",
            background:running?"#fef2f2":"#f0fdf4",
            border:`1px solid ${running?"#fca5a5":"#86efac"}`,
            borderRadius:8, color:running?"#dc2626":"#059669",
            fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700,
            cursor:"pointer",
          }}>
            {running?"⏸ Pause":"▶ Run Automation"}
          </button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div style={{ display:"flex", flexShrink:0, borderBottom:"1px solid #e2e8f0", overflowX:"auto", background:"#ffffff" }}>
        {[
          { label:"IDLE",        value:stats.idle,          color:"#10b981", bg:"#f0fdf4" },
          { label:"→ RACK",      value:stats.toRack,        color:"#3b82f6", bg:"#eff6ff" },
          { label:"→ STATION",   value:stats.toStation,     color:"#f59e0b", bg:"#fffbeb" },
          { label:"AT STATION",  value:stats.atStation,     color:"#10b981", bg:"#f0fdf4" },
          { label:"RETURNING",   value:stats.returning,     color:"#8b5cf6", bg:"#f5f3ff" },
          { label:"CHARGING",    value:stats.charging,      color:"#6366f1", bg:"#eef2ff" },
          { label:"AVG BATTERY", value:`${stats.avgBatt}%`, color:stats.avgBatt>40?"#10b981":"#ef4444", bg:"#f8fafc" },
          { label:"TASKS DONE",  value:`${stats.done}/${stats.total}`, color:"#10b981", bg:"#f0fdf4" },
          { label:"G2P ACTIVE",  value:stats.activeStations, color:"#f59e0b", bg:"#fffbeb" },
        ].map(k => (
          <div key={k.label} style={{ background:"#ffffff", padding:"12px 16px", borderRight:"1px solid #f1f5f9", flexShrink:0 }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#94a3b8", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{k.label}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* MAP AREA */}
        <div style={{ flex:1, overflow:"auto", padding:20, background:"#f8fafc" }}>

          {/* Station status pills */}
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
            {typedStations.map(s => {
              const isActive  = s.status==="PRESENTING"||s.status==="ACTIVE"
              const isWaiting = s.status==="WAITING_AMR"||s.status==="AMR_EN_ROUTE"
              const color  = isActive?"#059669":isWaiting?"#d97706":s.loggedIn?"#6366f1":"#94a3b8"
              const bg     = isActive?"#f0fdf4":isWaiting?"#fffbeb":s.loggedIn?"#eef2ff":"#f8fafc"
              const border = isActive?"#86efac":isWaiting?"#fde68a":s.loggedIn?"#c7d2fe":"#e2e8f0"
              return (
                <div key={s.id} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background:bg, border:`1px solid ${border}`,
                  borderRadius:8, padding:"6px 12px",
                }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:color }}/>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#334155", fontWeight:500 }}>
                    {s.label}
                  </span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color }}>
                    {s.loggedIn ? s.status.replace(/_/g," ") : "NOT LOGGED IN"}
                  </span>
                  {s.amrQueue.length>0 && (
                    <span style={{ background:`${color}20`, borderRadius:4, padding:"0 6px", fontFamily:"'DM Mono',monospace", fontSize:9, color, fontWeight:600 }}>
                      {s.amrQueue.length} AMR
                    </span>
                  )}
                </div>
              )
            })}
            <div style={{ marginLeft:"auto", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"6px 12px" }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#3b82f6" }}>
                💡 Login to a Station → then click Open Stations ↗ to pick
              </span>
            </div>
          </div>

          {/* Map container */}
          <div style={{
            background:"#ffffff", borderRadius:14,
            border:"1px solid #e2e8f0",
            boxShadow:"0 1px 3px rgba(0,0,0,0.05)",
            padding:12, overflow:"auto",
          }}>
            <WarehouseMap amrs={typedAmrs} tasks={typedTasks} stations={typedStations} zoom={zoom}/>
          </div>

          {/* Legend */}
          <div style={{ display:"flex", gap:16, marginTop:12, flexWrap:"wrap" }}>
            {[
              { color:"#dbeafe", border:"#93c5fd", label:"Shelf Bay" },
              { color:"#f1f5f9", border:"#cbd5e1", label:"Aisle" },
              { color:"#dcfce7", border:"#86efac", label:"Station Active" },
              { color:"#f1f5f9", border:"#e2e8f0", label:"Station Idle" },
              { color:"#fef9c3", border:"#fde68a", label:"Rack on AMR" },
              { color:"#dcfce7", border:"#4ade80", label:"Active Task" },
            ].map(l => (
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, background:l.color, border:`1px solid ${l.border}`, borderRadius:2 }}/>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#64748b" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{
          width:300, flexShrink:0, background:"#ffffff",
          borderLeft:"1px solid #e2e8f0",
          display:"flex", flexDirection:"column", overflow:"hidden",
        }}>

          {/* Fleet size */}
          <div style={{ padding:"14px 16px", borderBottom:"1px solid #f1f5f9" }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#94a3b8", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Fleet Size</div>
            <div style={{ display:"flex", gap:6 }}>
              {[2,3,4,5,6].map(n => (
                <button key={n} onClick={()=>{ setFleetSizeLocal(n); setFleetSize(n) }} style={{
                  flex:1, height:32, borderRadius:8,
                  border:`1px solid ${fleetSize===n?"#6366f1":"#e2e8f0"}`,
                  background:fleetSize===n?"#eef2ff":"#f8fafc",
                  color:fleetSize===n?"#6366f1":"#64748b",
                  fontFamily:"'DM Sans',sans-serif", fontSize:13,
                  cursor:"pointer", fontWeight:fleetSize===n?700:400,
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* AMR cards */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#94a3b8", letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>AMR Fleet</div>
            {typedAmrs.map((amr: AMR) => {
              const phaseColors: Record<string,string> = {
                IDLE:"#10b981", TO_RACK:"#3b82f6", TO_STATION:"#f59e0b",
                PRESENTING:"#10b981", QUEUED:"#8b5cf6",
                RETURNING:"#8b5cf6", CHARGING:"#6366f1",
              }
              const pc = phaseColors[amr.phase]||"#64748b"
              const bc = amr.battery>50?"#10b981":amr.battery>20?"#f59e0b":"#ef4444"
              const activeTask = typedTasks.find(t=>t.id===amr.taskId)
              return (
                <div key={amr.id} style={{
                  background:"#f8fafc", border:"1px solid #e2e8f0",
                  borderLeft:`3px solid ${amr.color}`,
                  borderRadius:10, padding:12,
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {/* AMR icon matching map */}
                      <div style={{
                        width:30, height:30, borderRadius:7,
                        background:`${amr.color}15`,
                        border:`1.5px solid ${amr.color}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        position:"relative",
                      }}>
                        <div style={{ width:11, height:11, border:`2px solid ${amr.color}`, borderRadius:2 }}/>
                        <div style={{ position:"absolute", top:4, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:amr.color }}/>
                      </div>
                      <div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700, color:"#0f172a" }}>{amr.id}</div>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#94a3b8" }}>{amr.model}</div>
                      </div>
                    </div>
                    <span style={{
                      background:`${pc}15`, border:`1px solid ${pc}40`,
                      borderRadius:6, padding:"2px 8px",
                      fontFamily:"'DM Mono',monospace", fontSize:9, color:pc, fontWeight:500,
                    }}>
                      {(amr.phase||amr.status).replace(/_/g," ")}
                    </span>
                  </div>

                  {/* Battery */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#94a3b8", letterSpacing:1 }}>BATTERY</span>
                      <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color:bc }}>{Math.round(amr.battery)}%</span>
                    </div>
                    <div style={{ height:4, background:"#f1f5f9", borderRadius:99, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${amr.battery}%`, background:bc, borderRadius:99, transition:"width 0.5s" }}/>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                    {[
                      { l:"Station",  v:amr.stationId||"—" },
                      { l:"Done",     v:amr.completedTasks  },
                      { l:"Rack",     v:amr.carryingRack?amr.rackId?.replace("RACK-","R-")||"YES":"—" },
                      { l:"Position", v:`[${amr.row},${amr.col}]` },
                    ].map(f => (
                      <div key={f.l} style={{ background:"#ffffff", borderRadius:6, padding:"4px 8px", border:"1px solid #f1f5f9" }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:"#94a3b8", letterSpacing:1, textTransform:"uppercase" }}>{f.l}</div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#0f172a", fontWeight:600 }}>{f.v}</div>
                      </div>
                    ))}
                  </div>

                  {activeTask && (
                    <div style={{ marginTop:8, background:`${amr.color}08`, border:`1px solid ${amr.color}20`, borderRadius:7, padding:"5px 8px" }}>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:amr.color, letterSpacing:1, marginBottom:2 }}>
                        {activeTask.g2pStatus?.replace(/_/g," ")}
                      </div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#475569" }}>
                        {activeTask.id} · {activeTask.sku}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Task queue */}
          <div style={{ borderTop:"1px solid #f1f5f9", padding:"12px 14px", maxHeight:200, overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#94a3b8", letterSpacing:2, textTransform:"uppercase" }}>Task Queue</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#10b981", fontWeight:600 }}>{stats.done}/{stats.total}</div>
            </div>
            {typedTasks.length===0 && (
              <div style={{ color:"#94a3b8", fontSize:12, textAlign:"center", padding:"12px 0" }}>
                Go to WMS → inject orders to begin
              </div>
            )}
            {[...typedTasks].reverse().slice(0,15).map(t => {
              const color = G2P_COLORS[t.g2pStatus]||"#64748b"
              return (
                <div key={t.id} style={{
                  display:"flex", gap:6, alignItems:"center",
                  padding:"5px 0", borderBottom:"1px solid #f8fafc",
                  opacity:t.status==="DONE"?0.4:1,
                }}>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#cbd5e1" }}>{t.id}</span>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#334155", flex:1 }}>{t.sku}</span>
                  <span style={{
                    background:`${color}15`, border:`1px solid ${color}40`,
                    borderRadius:4, padding:"1px 6px",
                    fontFamily:"'DM Mono',monospace", fontSize:8, color,
                  }}>
                    {(t.g2pStatus||t.status).replace(/_/g," ")}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Event log */}
          <div style={{ borderTop:"1px solid #f1f5f9", padding:"12px 14px", maxHeight:150, overflowY:"auto" }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#94a3b8", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Event Log</div>
            {(logs as {msg:string;color:string;layer:string;t:string}[]).slice(0,15).map((l,i) => (
              <div key={i} style={{ display:"flex", gap:6, marginBottom:4 }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:"#cbd5e1", flexShrink:0 }}>{l.t}</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:l.color, lineHeight:1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}