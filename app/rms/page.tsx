"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"

// ── GRID MATCHING GEEK+ STYLE ──
const COLS = 24
const ROWS = 20
const CELL = 28

// Aisle columns (vertical lanes AMRs travel)
const AISLE_COLS = [0, 4, 8, 12, 16, 20, 23]
// Aisle rows (horizontal lanes)
const AISLE_ROWS = [0, 5, 10, 15, 19]

// Station positions — ON the grid edges
const STATION_POSITIONS: Record<string, { row: number; col: number; side: string }> = {
  S1: { row: 2,  col: 0,  side: "left"   },
  S2: { row: 12, col: 0,  side: "left"   },
  S3: { row: 2,  col: 23, side: "right"  },
  S4: { row: 12, col: 23, side: "right"  },
}

const ROW_LABELS = ["49","50","51","52","53","54","20","21","22","23","24","25","26","27","28","29","30","31","32","33"]
const COL_LABELS = ["01","02","03","3233","04","05","06","3435","07","08","09","3637","10","11","12","3839","13","14","15","4041","16","17","18","42"]

const AMR_COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316"]

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
  amrId: string | null
  taskId: string | null
  pickProgress: number
  totalItems: number
  waypoint?: { row: number; col: number }
}

const PRI_COL: Record<string, string> = {
  CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#eab308", LOW:"#6b7280"
}

const G2P_COLORS: Record<string, string> = {
  WMS_QUEUED:"#3b82f6", WCS_DISPATCHED:"#f59e0b",
  AMR_ASSIGNED:"#8b5cf6", AMR_MOVING:"#f97316",
  AT_STATION:"#10b981", PICKING:"#10b981",
  PICKED:"#4ade80", AMR_RETURNING:"#8b5cf6", DONE:"#10b981",
}

function isAisle(r: number, c: number) {
  return AISLE_COLS.includes(c) || AISLE_ROWS.includes(r)
}

function isStation(r: number, c: number) {
  return Object.values(STATION_POSITIONS).some(p => p.row === r && p.col === c)
}

// ── 3D ISOMETRIC CELL ──
function IsoCell({ x, y, w, h, depth, topColor, leftColor, rightColor, children }: {
  x: number; y: number; w: number; h: number; depth: number
  topColor: string; leftColor: string; rightColor: string
  children?: React.ReactNode
}) {
  // Isometric projection
  // Top face
  const top = `${x},${y} ${x+w},${y} ${x+w},${y+h} ${x},${y+h}`
  // Left face (below)
  const left = `${x},${y+h} ${x+w},${y+h} ${x+w},${y+h+depth} ${x},${y+h+depth}`
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={topColor} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"/>
      <rect x={x} y={y+h} width={w} height={depth} fill={leftColor} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"/>
    </g>
  )
}

// ── WAREHOUSE MAP ──
function WarehouseMap({ amrs, tasks, stations, zoom }: {
  amrs: AMR[]; tasks: Task[]; stations: Station[]; zoom: number
}) {
  const PAD_TOP = 32
  const PAD_LEFT = 36
  const SHELF_H = CELL
  const RACK_DEPTH = 6  // 3D depth

  const mapW = COLS * CELL + PAD_LEFT + 60
  const mapH = ROWS * (SHELF_H + RACK_DEPTH) + PAD_TOP + 60

  return (
    <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.2s", display: "inline-block" }}>
      <svg width={mapW} height={mapH} style={{ display: "block" }}>
        <defs>
          <filter id="amrglow">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="stationglow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width={mapW} height={mapH} fill="#050911"/>

        {/* Column headers */}
        {Array.from({ length: COLS }, (_, c) => (
          <text key={c}
            x={PAD_LEFT + c * CELL + CELL / 2}
            y={PAD_TOP - 6}
            textAnchor="middle"
            fontFamily="Courier New" fontSize="7"
            fill={AISLE_COLS.includes(c) ? "#f97316" : "rgba(255,255,255,0.25)"}
            fontWeight={AISLE_COLS.includes(c) ? "bold" : "normal"}>
            {COL_LABELS[c] || c}
          </text>
        ))}

        {/* Row headers */}
        {Array.from({ length: ROWS }, (_, r) => (
          <text key={r}
            x={PAD_LEFT - 4}
            y={PAD_TOP + r * (SHELF_H + RACK_DEPTH) + SHELF_H / 2 + 3}
            textAnchor="end"
            fontFamily="Courier New" fontSize="7"
            fill={AISLE_ROWS.includes(r) ? "#f97316" : "rgba(255,255,255,0.25)"}>
            {ROW_LABELS[r] || r}
          </text>
        ))}

        {/* Grid cells */}
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const x = PAD_LEFT + c * CELL
            const y = PAD_TOP + r * (SHELF_H + RACK_DEPTH)
            const aisle = isAisle(r, c)
            const stPos = Object.entries(STATION_POSITIONS).find(([, p]) => p.row === r && p.col === c)
            const hasTask = tasks.some(t =>
              (t.g2pStatus === "AMR_MOVING" || t.g2pStatus === "AT_STATION") &&
              t.from && t.from[0] === r && t.from[1] === c
            )

            if (stPos) {
              const [sid] = stPos
              const st = stations.find(s => s.id === sid)
              const isActive = st?.status === "ACTIVE"
              const isWaiting = st?.status === "WAITING_AMR" || st?.status === "AMR_EN_ROUTE"
              const stColor = isActive ? "#10b981" : isWaiting ? "#f59e0b" : "#374151"
              return (
                <g key={`${r}-${c}`}>
                  <rect x={x} y={y} width={CELL} height={SHELF_H} fill={isActive ? "#0a2a18" : "#111827"} stroke={stColor} strokeWidth="1.5"/>
                  <rect x={x} y={y+SHELF_H} width={CELL} height={RACK_DEPTH} fill={isActive ? "#051410" : "#0a0f18"} stroke={stColor} strokeWidth="0.5"/>
                  <text x={x+CELL/2} y={y+SHELF_H/2-4} textAnchor="middle" fontFamily="Courier New" fontSize="6" fill={stColor} fontWeight="bold">{sid}</text>
                  <text x={x+CELL/2} y={y+SHELF_H/2+6} textAnchor="middle" fontFamily="Courier New" fontSize="5" fill={stColor} opacity="0.8">
                    {isActive ? "PICK" : isWaiting ? "WAIT" : "IDLE"}
                  </text>
                  {(isActive || isWaiting) && (
                    <circle cx={x+CELL-4} cy={y+4} r="3" fill={stColor} filter="url(#stationglow)"/>
                  )}
                  {/* Progress bar */}
                  {st && st.totalItems > 0 && (
                    <>
                      <rect x={x+2} y={y+SHELF_H-6} width={CELL-4} height={3} rx="1" fill="rgba(0,0,0,0.4)"/>
                      <rect x={x+2} y={y+SHELF_H-6} width={(CELL-4)*(st.pickProgress/Math.max(1,st.totalItems))} height={3} rx="1" fill={stColor}/>
                    </>
                  )}
                </g>
              )
            }

            if (aisle) {
              return (
                <g key={`${r}-${c}`}>
                  <rect x={x} y={y} width={CELL} height={SHELF_H} fill="#080d18" stroke="#0d1628" strokeWidth="0.5"/>
                  <rect x={x} y={y+SHELF_H} width={CELL} height={RACK_DEPTH} fill="#050a12" stroke="#0a1020" strokeWidth="0.3"/>
                  {/* Aisle guide lines */}
                  {AISLE_COLS.includes(c) && (
                    <line x1={x+CELL/2} y1={y} x2={x+CELL/2} y2={y+SHELF_H} stroke="#1e3a5f" strokeWidth="1" strokeDasharray="3,4" opacity="0.6"/>
                  )}
                  {AISLE_ROWS.includes(r) && (
                    <line x1={x} y1={y+SHELF_H/2} x2={x+CELL} y2={y+SHELF_H/2} stroke="#1e3a5f" strokeWidth="1" strokeDasharray="3,4" opacity="0.4"/>
                  )}
                </g>
              )
            }

            // Shelf bay — the "HH" pattern from Geek+ image
            return (
              <g key={`${r}-${c}`}>
                {/* Top face */}
                <rect x={x} y={y} width={CELL} height={SHELF_H}
                  fill={hasTask ? "#0f2a10" : "#0d1e3a"}
                  stroke={hasTask ? "#4ade80" : "#1a3060"}
                  strokeWidth={hasTask ? "1.2" : "0.5"}/>
                {/* 3D depth face */}
                <rect x={x} y={y+SHELF_H} width={CELL} height={RACK_DEPTH}
                  fill={hasTask ? "#081a08" : "#091428"}
                  stroke={hasTask ? "#4ade80" : "#0f1e40"}
                  strokeWidth="0.3"/>
                {/* Inner shelf divider — creates "HH" look */}
                <line x1={x+CELL/2} y1={y+2} x2={x+CELL/2} y2={y+SHELF_H-2} stroke={hasTask ? "#4ade8040" : "#1e3a6040"} strokeWidth="0.8"/>
                {/* Shelf levels */}
                <line x1={x+2} y1={y+SHELF_H*0.33} x2={x+CELL-2} y2={y+SHELF_H*0.33} stroke={hasTask ? "#4ade8030" : "#1e3a6030"} strokeWidth="0.5"/>
                <line x1={x+2} y1={y+SHELF_H*0.66} x2={x+CELL-2} y2={y+SHELF_H*0.66} stroke={hasTask ? "#4ade8030" : "#1e3a6030"} strokeWidth="0.5"/>
                {/* Active task glow dot */}
                {hasTask && <circle cx={x+CELL/2} cy={y+4} r="2.5" fill="#4ade80" filter="url(#amrglow)"/>}
              </g>
            )
          })
        )}

        {/* Station labels on the sides */}
        {stations.map((st, i) => {
          const wp = STATION_POSITIONS[st.id]
          if (!wp) return null
          const x = PAD_LEFT + wp.col * CELL
          const y = PAD_TOP + wp.row * (SHELF_H + RACK_DEPTH)
          const isLeft = wp.side === "left"
          const isActive = st.status === "ACTIVE"
          const isWaiting = st.status === "WAITING_AMR" || st.status === "AMR_EN_ROUTE"
          const color = isActive ? "#10b981" : isWaiting ? "#f59e0b" : "#374151"

          return (
            <g key={st.id}>
              {/* Side arrow indicator */}
              <text
                x={isLeft ? x - 12 : x + CELL + 12}
                y={y + SHELF_H / 2 + 3}
                textAnchor="middle"
                fontFamily="Courier New" fontSize="8"
                fill={color} fontWeight="bold">
                {isLeft ? "▶" : "◀"}
              </text>
              {/* Station label */}
              <text
                x={isLeft ? x - 28 : x + CELL + 28}
                y={y + SHELF_H / 2 + 3}
                textAnchor="middle"
                fontFamily="Courier New" fontSize="7"
                fill={color}>
                {st.id}
              </text>
            </g>
          )
        })}

        {/* ── AMRs ── */}
        {amrs.map(amr => {
          const x = PAD_LEFT + amr.col * CELL
          const y = PAD_TOP + amr.row * (SHELF_H + RACK_DEPTH)
          const cx = x + CELL / 2
          const cy = y + SHELF_H / 2

          const statusColors: Record<string,string> = {
            IDLE: "#10b981", EN_ROUTE: amr.color,
            AT_STATION: "#10b981", CHARGING: "#8b5cf6",
          }
          const dotColor = statusColors[amr.status] || amr.color

          return (
            <g key={amr.id} filter="url(#amrglow)">
              {/* Path trail */}
              {amr.path.length > 1 && amr.path.slice(-6).map((p, i, arr) => {
                if (i === 0) return null
                const prev = arr[i-1]
                const x1 = PAD_LEFT + prev.col * CELL + CELL/2
                const y1 = PAD_TOP + prev.row * (SHELF_H + RACK_DEPTH) + SHELF_H/2
                const x2 = PAD_LEFT + p.col * CELL + CELL/2
                const y2 = PAD_TOP + p.row * (SHELF_H + RACK_DEPTH) + SHELF_H/2
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={amr.color} strokeWidth="1"
                    opacity={(i / arr.length) * 0.5}
                    strokeDasharray="2,3"/>
                )
              })}

              {/* Rack being carried — shown as dashed box above AMR */}
              {amr.carryingRack && (
                <rect x={cx-9} y={cy-18} width={18} height={10} rx="1"
                  fill="rgba(245,158,11,0.12)" stroke="#f59e0b"
                  strokeWidth="1" strokeDasharray="2,2"/>
              )}

              {/* AMR body — coloured square like Geek+ */}
              <rect x={cx-7} y={cy-7} width={14} height={14} rx="2"
                fill={`${amr.color}30`} stroke={amr.color} strokeWidth="1.5"/>

              {/* Inner cross detail */}
              <line x1={cx-4} y1={cy} x2={cx+4} y2={cy} stroke={amr.color} strokeWidth="0.8" opacity="0.7"/>
              <line x1={cx} y1={cy-4} x2={cx} y2={cy+4} stroke={amr.color} strokeWidth="0.8" opacity="0.7"/>

              {/* Direction dot */}
              <circle cx={cx} cy={cy-9} r="2" fill={dotColor}/>

              {/* AMR ID above */}
              <text x={cx} y={cy-22} textAnchor="middle"
                fontFamily="Courier New" fontSize="6.5" fill={amr.color} fontWeight="bold">
                {amr.id}
              </text>

              {/* Phase label */}
              <text x={cx} y={cy+20} textAnchor="middle"
                fontFamily="Courier New" fontSize="5.5"
                fill={amr.phase === "AT_STATION" ? "#10b981" : amr.phase === "TO_STATION" ? "#f59e0b" : "rgba(255,255,255,0.3)"}>
                {amr.phase?.replace(/_/g,"")}
              </text>
            </g>
          )
        })}

        {/* Station connection lines — show which AMR is heading to which station */}
        {amrs.filter(a => a.stationId && (a.phase === "TO_STATION" || a.phase === "AT_STATION")).map(amr => {
          const sp = STATION_POSITIONS[amr.stationId!]
          if (!sp) return null
          const ax = PAD_LEFT + amr.col * CELL + CELL/2
          const ay = PAD_TOP + amr.row * (SHELF_H + RACK_DEPTH) + SHELF_H/2
          const sx = PAD_LEFT + sp.col * CELL + CELL/2
          const sy = PAD_TOP + sp.row * (SHELF_H + RACK_DEPTH) + SHELF_H/2
          return (
            <line key={amr.id} x1={ax} y1={ay} x2={sx} y2={sy}
              stroke={amr.color} strokeWidth="1"
              strokeDasharray="4,4" opacity="0.4"/>
          )
        })}
      </svg>
    </div>
  )
}

// ── MAIN PAGE ──
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
    tickRef.current = setInterval(() => automationTick(), 400)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running, automationTick])

  const stats = {
    idle:          typedAmrs.filter(a => a.status === "IDLE").length,
    toRack:        typedAmrs.filter(a => a.phase === "TO_RACK").length,
    toStation:     typedAmrs.filter(a => a.phase === "TO_STATION").length,
    atStation:     typedAmrs.filter(a => a.phase === "AT_STATION").length,
    returning:     typedAmrs.filter(a => a.phase === "RETURNING").length,
    charging:      typedAmrs.filter(a => a.status === "CHARGING").length,
    avgBatt:       Math.round(typedAmrs.reduce((s,a) => s+a.battery,0) / Math.max(1,typedAmrs.length)),
    done:          typedTasks.filter(t => t.status === "DONE").length,
    total:         typedTasks.length,
    activeStations:typedStations.filter(s => s.status === "ACTIVE").length,
  }

  const openStations = () => window.open("/station","_blank","width=1400,height=900")

  return (
    <div style={{ background:"#050911", minHeight:"100vh", color:"#fff", display:"flex", flexDirection:"column" }}>

      {/* ── TOP BAR ── */}
      <div style={{
        background:"#080d1a", borderBottom:"1px solid rgba(255,255,255,0.07)",
        padding:"10px 20px", display:"flex", justifyContent:"space-between",
        alignItems:"center", flexWrap:"wrap", gap:10, flexShrink:0,
      }}>
        <div>
          <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"#8b5cf6", letterSpacing:3, textTransform:"uppercase", marginBottom:2 }}>
            MyRoboCloud · RMS · G2P Automation
          </div>
          <h1 style={{ fontFamily:"monospace", fontSize:17, fontWeight:700, margin:0 }}>
            Robot Management System — Live Warehouse Map
          </h1>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={openStations} style={{
            padding:"8px 14px", background:"rgba(16,185,129,0.12)",
            border:"1px solid #10b981", borderRadius:7, color:"#10b981",
            fontFamily:"'Courier New',monospace", fontSize:10, letterSpacing:1, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6,
          }}>
            🏭 OPEN STATIONS ↗
          </button>
          <button onClick={() => setZoom(z => Math.max(0.4,+(z-0.1).toFixed(1)))}
            style={{ width:28, height:28, borderRadius:5, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.05)", color:"#fff", cursor:"pointer" }}>−</button>
          <span style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.4)", width:36, textAlign:"center" }}>
            {Math.round(zoom*100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(2.5,+(z+0.1).toFixed(1)))}
            style={{ width:28, height:28, borderRadius:5, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.05)", color:"#fff", cursor:"pointer" }}>+</button>
          <div style={{ width:8, height:8, borderRadius:"50%", marginLeft:8, background:running?"#10b981":"#ef4444", boxShadow:running?"0 0 8px #10b981":"none" }}/>
          <button onClick={() => setRunning(r=>!r)} style={{
            padding:"8px 20px",
            background:running?"rgba(239,68,68,0.15)":"rgba(16,185,129,0.15)",
            border:`1px solid ${running?"#ef4444":"#10b981"}`,
            borderRadius:7, color:running?"#ef4444":"#10b981",
            fontFamily:"'Courier New',monospace", fontSize:11, letterSpacing:1,
            cursor:"pointer", fontWeight:700,
          }}>
            {running?"⏸ PAUSE":"▶ RUN AUTOMATION"}
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{ display:"flex", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.05)", overflowX:"auto", background:"#080d1a" }}>
        {[
          { label:"IDLE",       value:stats.idle,          color:"#10b981" },
          { label:"→ RACK",     value:stats.toRack,        color:"#3b82f6" },
          { label:"→ STATION",  value:stats.toStation,     color:"#f59e0b" },
          { label:"AT STATION", value:stats.atStation,     color:"#10b981" },
          { label:"RETURNING",  value:stats.returning,     color:"#8b5cf6" },
          { label:"CHARGING",   value:stats.charging,      color:"#6366f1" },
          { label:"AVG BATTERY",value:`${stats.avgBatt}%`, color:stats.avgBatt>40?"#10b981":"#ef4444" },
          { label:"TASKS DONE", value:`${stats.done}/${stats.total}`, color:"#10b981" },
          { label:"G2P ACTIVE", value:stats.activeStations, color:"#f59e0b" },
        ].map(k => (
          <div key={k.label} style={{ background:"#080d1a", padding:"9px 14px", borderRight:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:3 }}>{k.label}</div>
            <div style={{ fontFamily:"monospace", fontSize:17, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── MAP AREA ── */}
        <div style={{ flex:1, overflow:"auto", padding:16, background:"#050911" }}>

          {/* Station pills */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
            {typedStations.map(s => {
              const isActive  = s.status === "ACTIVE"
              const isWaiting = s.status === "WAITING_AMR" || s.status === "AMR_EN_ROUTE"
              const isDone    = s.status === "PICKING_DONE"
              const color = isActive?"#10b981":isWaiting?"#f59e0b":isDone?"#3b82f6":"#374151"
              return (
                <div key={s.id} style={{
                  display:"flex", alignItems:"center", gap:6,
                  background:`${color}10`, border:`1px solid ${color}40`,
                  borderRadius:7, padding:"5px 10px",
                }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:color, boxShadow:isActive?`0 0 6px ${color}`:"none" }}/>
                  <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color, letterSpacing:1 }}>
                    {s.label} · {s.status.replace(/_/g," ")}
                  </span>
                  {s.amrId && <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)" }}>· {s.amrId}</span>}
                  {s.totalItems > 0 && <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"#10b981" }}>{s.pickProgress}/{s.totalItems}</span>}
                </div>
              )
            })}
            <div style={{ marginLeft:"auto", background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:7, padding:"5px 10px" }}>
              <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.4)" }}>
                💡 When AMR reaches station → click OPEN STATIONS ↗ to pick
              </span>
            </div>
          </div>

          {/* Map */}
          <div style={{ overflow:"auto" }}>
            <WarehouseMap amrs={typedAmrs} tasks={typedTasks} stations={typedStations} zoom={zoom}/>
          </div>

          {/* Legend */}
          <div style={{ display:"flex", gap:16, marginTop:12, flexWrap:"wrap" }}>
            {[
              { color:"#0d1e3a", border:"#1a3060",  label:"Shelf Bay" },
              { color:"#080d18", border:"#0d1628",  label:"Aisle" },
              { color:"#0a2a18", border:"#10b981",  label:"Station Active" },
              { color:"#111827", border:"#374151",  label:"Station Idle" },
              { color:"rgba(245,158,11,0.12)", border:"#f59e0b", label:"Rack on AMR" },
              { color:"#4ade80", border:"#4ade80",  label:"Active Task" },
            ].map(l => (
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, background:l.color, border:`1px solid ${l.border}`, borderRadius:2 }}/>
                <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.35)" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          width:280, flexShrink:0, background:"#080d1a",
          borderLeft:"1px solid rgba(255,255,255,0.07)",
          display:"flex", flexDirection:"column", overflow:"hidden",
        }}>

          {/* Fleet size */}
          <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"#8b5cf6", letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Fleet Size</div>
            <div style={{ display:"flex", gap:5 }}>
              {[2,3,4,5,6].map(n => (
                <button key={n} onClick={() => { setFleetSizeLocal(n); setFleetSize(n) }} style={{
                  flex:1, height:28, borderRadius:5,
                  border:`1px solid ${fleetSize===n?"#8b5cf6":"rgba(255,255,255,0.1)"}`,
                  background:fleetSize===n?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.03)",
                  color:fleetSize===n?"#8b5cf6":"rgba(255,255,255,0.3)",
                  fontFamily:"monospace", fontSize:12, cursor:"pointer", fontWeight:700,
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* AMR cards */}
          <div style={{ flex:1, overflowY:"auto", padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, textTransform:"uppercase", marginBottom:2 }}>AMR Fleet</div>
            {typedAmrs.map((amr: AMR) => {
              const phaseColors: Record<string,string> = {
                IDLE:"#10b981", TO_RACK:"#3b82f6", TO_STATION:"#f59e0b",
                AT_STATION:"#10b981", RETURNING:"#8b5cf6", CHARGING:"#6366f1",
              }
              const pc = phaseColors[amr.phase] || "#fff"
              const bc = amr.battery>50?"#10b981":amr.battery>20?"#f59e0b":"#ef4444"
              const activeTask = typedTasks.find(t => t.id === amr.taskId)
              return (
                <div key={amr.id} style={{
                  background:"rgba(255,255,255,0.03)",
                  border:"1px solid rgba(255,255,255,0.07)",
                  borderLeft:`3px solid ${amr.color}`,
                  borderRadius:8, padding:10,
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      {/* Mini robot icon matching map style */}
                      <div style={{
                        width:28, height:28, borderRadius:5,
                        background:`${amr.color}20`, border:`1.5px solid ${amr.color}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        position:"relative",
                      }}>
                        <div style={{ width:10, height:10, border:`1.5px solid ${amr.color}`, borderRadius:2 }}/>
                        <div style={{ position:"absolute", top:3, left:"50%", transform:"translateX(-50%)", width:3, height:3, borderRadius:"50%", background:amr.color }}/>
                      </div>
                      <div>
                        <div style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:amr.color }}>{amr.id}</div>
                        <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)" }}>{amr.model}</div>
                      </div>
                    </div>
                    <span style={{ background:`${pc}18`, border:`1px solid ${pc}40`, borderRadius:4, padding:"1px 6px", fontFamily:"'Courier New',monospace", fontSize:8, color:pc }}>
                      {(amr.phase||amr.status).replace(/_/g," ")}
                    </span>
                  </div>

                  {/* Battery */}
                  <div style={{ marginBottom:7 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                      <span style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.3)" }}>BATTERY</span>
                      <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:bc }}>{Math.round(amr.battery)}%</span>
                    </div>
                    <div style={{ height:3, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${amr.battery}%`, background:bc, borderRadius:2, transition:"width 0.5s" }}/>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                    {[
                      { l:"Pos",     v:`[${amr.row},${amr.col}]` },
                      { l:"Station", v:amr.stationId||"—" },
                      { l:"Rack",    v:amr.carryingRack?amr.rackId?.replace("RACK-","R-")||"YES":"NO" },
                      { l:"Done",    v:amr.completedTasks },
                    ].map(f => (
                      <div key={f.l} style={{ background:"rgba(255,255,255,0.03)", borderRadius:4, padding:"4px 6px" }}>
                        <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.25)", letterSpacing:1, textTransform:"uppercase" }}>{f.l}</div>
                        <div style={{ fontFamily:"monospace", fontSize:10, color:"rgba(255,255,255,0.8)", fontWeight:700 }}>{f.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Active task */}
                  {activeTask && (
                    <div style={{ marginTop:6, background:`${amr.color}08`, border:`1px solid ${amr.color}25`, borderRadius:5, padding:"4px 8px" }}>
                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:amr.color, letterSpacing:1, marginBottom:1 }}>
                        TASK · {activeTask.g2pStatus?.replace(/_/g," ")}
                      </div>
                      <div style={{ fontFamily:"monospace", fontSize:10, color:"rgba(255,255,255,0.6)" }}>
                        {activeTask.id} · {activeTask.sku}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Task queue */}
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"10px 12px", maxHeight:180, overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, textTransform:"uppercase" }}>Task Queue</div>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"#10b981" }}>{stats.done}/{stats.total}</div>
            </div>
            {typedTasks.length===0 && (
              <div style={{ color:"rgba(255,255,255,0.2)", fontSize:10, fontStyle:"italic", padding:"8px 0", textAlign:"center" }}>
                WMS → inject orders to begin
              </div>
            )}
            {[...typedTasks].reverse().slice(0,15).map(t => {
              const color = G2P_COLORS[t.g2pStatus]||"#fff"
              return (
                <div key={t.id} style={{
                  display:"flex", gap:5, alignItems:"center",
                  padding:"4px 0", borderBottom:"1px solid rgba(255,255,255,0.03)",
                  opacity:t.status==="DONE"?0.45:1,
                }}>
                  <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)" }}>{t.id}</span>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:"#fff", flex:1 }}>{t.sku}</span>
                  <span style={{ background:`${color}18`, border:`1px solid ${color}40`, borderRadius:3, padding:"0 4px", fontFamily:"'Courier New',monospace", fontSize:7, color }}>
                    {(t.g2pStatus||t.status).replace(/_/g," ")}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Event log */}
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"10px 12px", maxHeight:140, overflowY:"auto" }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Event Log</div>
            {(logs as {msg:string;color:string;layer:string;t:string}[]).slice(0,15).map((l,i)=>(
              <div key={i} style={{ display:"flex", gap:6, marginBottom:4 }}>
                <span style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.2)", flexShrink:0 }}>{l.t}</span>
                <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:l.color, lineHeight:1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}