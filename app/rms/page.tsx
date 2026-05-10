"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"

const COLS = 16
const ROWS = 12
const AISLE_COLS = [3, 7, 11]
const AISLE_ROWS = [3, 7]

interface AMR {
  id: string
  color: string
  model: string
  status: string
  battery: number
  row: number
  col: number
  taskId: string | null
  stationId: string | null
  carryingRack: boolean
  rackId: string | null
  completedTasks: number
  totalDist: number
  path: { row: number; col: number }[]
  targetRow: number
  targetCol: number
  homeRow: number
  homeCol: number
}

interface Task {
  id: string
  type: string
  status: string
  g2pStatus: string
  priority: string
  sku: string
  weight: number
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
}

const PRI_COL: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#6b7280",
}

const STATUS_INFO: Record<string, { color: string; label: string }> = {
  IDLE:               { color: "#10b981", label: "IDLE" },
  MOVING_TO_RACK:     { color: "#3b82f6", label: "→ RACK" },
  MOVING_TO_STATION:  { color: "#f59e0b", label: "→ STATION" },
  AT_STATION:         { color: "#10b981", label: "AT STATION" },
  RETURNING:          { color: "#8b5cf6", label: "RETURNING" },
  CHARGING:           { color: "#6366f1", label: "CHARGING" },
}

function RobotIcon({ color = "#3b82f6", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="2" r="1.5" fill={color}/>
      <rect x="10" y="6" width="12" height="9" rx="2" fill={`${color}30`} stroke={color} strokeWidth="1.5"/>
      <rect x="12" y="9" width="3" height="2" rx="0.5" fill={color}/>
      <rect x="17" y="9" width="3" height="2" rx="0.5" fill={color}/>
      <rect x="8" y="17" width="16" height="10" rx="2" fill={`${color}20`} stroke={color} strokeWidth="1.5"/>
      <rect x="3" y="18" width="4" height="7" rx="1.5" fill={`${color}20`} stroke={color} strokeWidth="1.3"/>
      <rect x="25" y="18" width="4" height="7" rx="1.5" fill={`${color}20`} stroke={color} strokeWidth="1.3"/>
      <rect x="9" y="27" width="5" height="3" rx="1.5" fill={color} opacity="0.8"/>
      <rect x="18" y="27" width="5" height="3" rx="1.5" fill={color} opacity="0.8"/>
    </svg>
  )
}

function getCellType(row: number, col: number) {
  if (row === ROWS - 1) return "dock"
  if (row === 0 && AISLE_COLS.includes(col)) return "charge"
  if (AISLE_COLS.includes(col) || AISLE_ROWS.includes(row)) return "aisle"
  return "shelf"
}

function toIso(c: number, r: number, CW: number, CH: number, offsetX: number, offsetY: number) {
  return {
    x: (c - r) * (CW / 2) + offsetX,
    y: (c + r) * (CH / 2) + offsetY,
  }
}

function IsoMap({ amrs, tasks, stations, zoom }: {
  amrs: AMR[]
  tasks: Task[]
  stations: Station[]
  zoom: number
}) {
  const CW = 64
  const CH = 32
  const RACK_H = 26
  const offsetX = (ROWS * CW) / 2 + 80
  const offsetY = 50
  const mapW = (COLS + ROWS) * (CW / 2) + CW + 160
  const mapH = (COLS + ROWS) * (CH / 2) + RACK_H + 120

  return (
    <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.2s" }}>
      <svg width={mapW} height={mapH}>
        <defs>
          <filter id="glow2">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="softglow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── FLOOR + RACKS ── */}
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const { x, y } = toIso(c, r, CW, CH, offsetX, offsetY)
            const ct = getCellType(r, c)
            const isAisle = ct === "aisle"
            const isDock = ct === "dock"
            const isCharge = ct === "charge"
            const hasActiveTask = tasks.some(t =>
              (t.g2pStatus === "AT_STATION" || t.g2pStatus === "AMR_MOVING") &&
              t.from && t.from[0] === r && t.from[1] === c
            )
            const topPts = `${x},${y} ${x + CW / 2},${y + CH / 2} ${x},${y + CH} ${x - CW / 2},${y + CH / 2}`

            if (isAisle) return (
              <g key={`${r}-${c}`}>
                <polygon points={topPts} fill="#060c18" stroke="#0d1a2e" strokeWidth="0.5"/>
                <line x1={x - CW / 4} y1={y + CH * 0.75} x2={x + CW / 4} y2={y + CH * 0.75}
                  stroke="#1e3a6e" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.5"/>
              </g>
            )

            if (isDock) return (
              <g key={`${r}-${c}`}>
                <polygon points={topPts} fill="#1a0e00" stroke="#78350f" strokeWidth="0.8"/>
                <text x={x} y={y + CH * 0.65} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="#b45309" opacity="0.8">DOCK</text>
              </g>
            )

            if (isCharge) return (
              <g key={`${r}-${c}`}>
                <polygon points={topPts} fill="#120820" stroke="#5b21b6" strokeWidth="1"/>
                <text x={x} y={y + CH * 0.7} textAnchor="middle" fontSize="13">⚡</text>
              </g>
            )

            const rackTop  = `${x},${y - RACK_H} ${x + CW / 2},${y + CH / 2 - RACK_H} ${x},${y + CH - RACK_H} ${x - CW / 2},${y + CH / 2 - RACK_H}`
            const rackRight = `${x + CW / 2},${y + CH / 2 - RACK_H} ${x + CW / 2},${y + CH / 2} ${x},${y + CH} ${x},${y + CH - RACK_H}`
            const rackLeft  = `${x - CW / 2},${y + CH / 2 - RACK_H} ${x - CW / 2},${y + CH / 2} ${x},${y + CH} ${x},${y + CH - RACK_H}`

            return (
              <g key={`${r}-${c}`}>
                <polygon points={topPts} fill="#0a1428" stroke="#0d1a2e" strokeWidth="0.5"/>
                <polygon points={rackLeft} fill="#060e20" stroke="#0a1428" strokeWidth="0.5"/>
                <polygon points={rackRight} fill="#08122a" stroke="#0a1428" strokeWidth="0.5"/>
                <polygon points={rackTop}
                  fill={hasActiveTask ? "#0f2a10" : "#0d1e3a"}
                  stroke={hasActiveTask ? "#4ade80" : "#1e3a6e"}
                  strokeWidth={hasActiveTask ? "1.2" : "0.8"}/>
                {[0.33, 0.66].map((f, i) => (
                  <line key={i}
                    x1={x - CW / 2} y1={y + CH / 2 - RACK_H * f}
                    x2={x} y2={y + CH - RACK_H * f}
                    stroke="#1e3a6e" strokeWidth="0.4" opacity="0.5"/>
                ))}
                {hasActiveTask && (
                  <circle cx={x} cy={y - RACK_H - 8} r="4" fill="#4ade80" filter="url(#glow2)"/>
                )}
              </g>
            )
          })
        )}

        {/* ── G2P STATIONS (sides) ── */}
        {stations.map((station, sIdx) => {
          const stRow = sIdx < 2 ? [2, 7][sIdx] : [2, 7][sIdx - 2]
          const stCol = station.side === "left" ? -1 : COLS
          const { x, y } = toIso(stCol, stRow, CW, CH, offsetX, offsetY)
          const isActive = station.status === "ACTIVE"
          const isWaiting = station.status === "WAITING_AMR" || station.status === "AMR_EN_ROUTE"
          const isDone = station.status === "PICKING_DONE"
          const color = isDone ? "#f59e0b" : isActive ? "#10b981" : isWaiting ? "#f59e0b" : "#374151"

          const topPts  = `${x},${y - 22} ${x + CW / 2},${y + CH / 2 - 22} ${x},${y + CH - 22} ${x - CW / 2},${y + CH / 2 - 22}`
          const frontPts = `${x},${y + CH - 22} ${x - CW / 2},${y + CH / 2 - 22} ${x - CW / 2},${y + CH / 2} ${x},${y + CH}`

          return (
            <g key={station.id}>
              <polygon points={topPts}
                fill={isActive || isWaiting ? "rgba(16,185,129,0.15)" : "rgba(55,65,81,0.15)"}
                stroke={color} strokeWidth="1.5"/>
              <polygon points={frontPts}
                fill={isActive ? "rgba(16,185,129,0.06)" : "rgba(55,65,81,0.06)"}
                stroke={color} strokeWidth="1"/>

              {/* Station screen */}
              <rect x={x - 14} y={y - 20} width={28} height={18} rx="2"
                fill={isActive ? "#0a2a18" : "#111"} stroke={color} strokeWidth="1"/>
              {isActive && <>
                <line x1={x - 10} y1={y - 15} x2={x + 10} y2={y - 15} stroke="#10b981" strokeWidth="1" opacity="0.7"/>
                <line x1={x - 10} y1={y - 11} x2={x + 5}  y2={y - 11} stroke="#10b981" strokeWidth="1" opacity="0.5"/>
                <line x1={x - 10} y1={y - 7}  x2={x + 8}  y2={y - 7}  stroke="#10b981" strokeWidth="1" opacity="0.4"/>
              </>}

              {/* Label */}
              <text x={x} y={y - 32} textAnchor="middle"
                fontFamily="Courier New" fontSize="9" fill={color} fontWeight="bold">
                {station.id}
              </text>

              {/* Status label */}
              <text x={x} y={y - 44} textAnchor="middle"
                fontFamily="Courier New" fontSize="7"
                fill={isActive ? "#10b981" : isWaiting ? "#f59e0b" : "rgba(255,255,255,0.2)"}>
                {station.status.replace(/_/g, " ")}
              </text>

              {/* Glow dot */}
              {(isActive || isWaiting) && (
                <circle cx={x + 16} cy={y - 30} r="4"
                  fill={isActive ? "#10b981" : "#f59e0b"}
                  filter="url(#glow2)"/>
              )}

              {/* Pick progress bar */}
              {station.totalItems > 0 && (
                <g>
                  <rect x={x - 18} y={y - 27} width={36} height={4} rx="2"
                    fill="rgba(0,0,0,0.5)" stroke={color} strokeWidth="0.5"/>
                  <rect x={x - 18} y={y - 27}
                    width={36 * (station.pickProgress / Math.max(1, station.totalItems))} height={4} rx="2"
                    fill={color} opacity="0.85"/>
                </g>
              )}

              {/* AMR ID at station */}
              {station.amrId && (
                <text x={x} y={y + CH - 10} textAnchor="middle"
                  fontFamily="Courier New" fontSize="7" fill={color} opacity="0.8">
                  {station.amrId}
                </text>
              )}
            </g>
          )
        })}

        {/* ── AMRs ── */}
        {amrs.map(amr => {
          const { x, y } = toIso(amr.col, amr.row, CW, CH, offsetX, offsetY)
          const cy = y - 12
          const si = STATUS_INFO[amr.status] || { color: "#fff", label: amr.status }

          return (
            <g key={amr.id} filter="url(#softglow)">

              {/* Path trail */}
              {amr.path.length > 1 && amr.path.slice(-5).map((p, i, arr) => {
                if (i === 0) return null
                const prev = arr[i - 1]
                const { x: x1, y: y1 } = toIso(prev.col, prev.row, CW, CH, offsetX, offsetY)
                const { x: x2, y: y2 } = toIso(p.col, p.row, CW, CH, offsetX, offsetY)
                return (
                  <line key={i}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={amr.color} strokeWidth="1.5"
                    opacity={(i / arr.length) * 0.45}
                    strokeDasharray="3,3"/>
                )
              })}

              {/* Rack being carried */}
              {amr.carryingRack && (
                <g>
                  <rect x={x - 13} y={cy - 30} width={26} height={20} rx="2"
                    fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3,2"/>
                  <line x1={x - 13} y1={cy - 22} x2={x + 13} y2={cy - 22} stroke="#f59e0b" strokeWidth="0.6" opacity="0.5"/>
                  <line x1={x - 13} y1={cy - 16} x2={x + 13} y2={cy - 16} stroke="#f59e0b" strokeWidth="0.6" opacity="0.5"/>
                  <text x={x} y={cy - 33} textAnchor="middle" fontSize="7" fontFamily="Courier New" fill="#f59e0b" opacity="0.8">
                    {amr.rackId || "RACK"}
                  </text>
                </g>
              )}

              {/* AMR body */}
              <rect x={x - 11} y={cy - 8} width={22} height={18} rx="3"
                fill={`${amr.color}25`} stroke={amr.color} strokeWidth="1.5"/>
              {/* Wheels */}
              <ellipse cx={x - 8} cy={cy + 12} rx="4" ry="2.5" fill={amr.color} opacity="0.6"/>
              <ellipse cx={x + 8} cy={cy + 12} rx="4" ry="2.5" fill={amr.color} opacity="0.6"/>
              {/* Sensor */}
              <circle cx={x} cy={cy - 4} r="2" fill={amr.color}/>
              {/* Chest panel */}
              <rect x={x - 5} y={cy + 1} width={10} height={4} rx="1" fill={amr.color} opacity="0.4"/>

              {/* Status dot */}
              <circle cx={x + 14} cy={cy - 12} r="3.5" fill={si.color} filter="url(#glow2)"/>

              {/* AMR ID label */}
              <text x={x} y={cy - 36} textAnchor="middle"
                fontFamily="Courier New" fontSize="8" fill={amr.color} fontWeight="bold">
                {amr.id}
              </text>

              {/* Status label */}
              <text x={x} y={cy - 26} textAnchor="middle"
                fontFamily="Courier New" fontSize="6" fill={si.color} opacity="0.8">
                {si.label}
              </text>

              {/* Station heading label */}
              {amr.stationId && amr.status !== "AT_STATION" && (
                <text x={x} y={cy - 46} textAnchor="middle"
                  fontFamily="Courier New" fontSize="6" fill="#10b981" opacity="0.7">
                  → {amr.stationId}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function RMSPage() {
  const { tasks, amrs, stations, logs, automationTick, setFleetSize } = useStore()
  const [running, setRunning] = useState(false)
  const [zoom, setZoom] = useState(0.8)
  const [fleetSize, setFleetSizeLocal] = useState(4)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const typedTasks    = tasks    as Task[]
  const typedAmrs     = amrs     as AMR[]
  const typedStations = stations as Station[]

  useEffect(() => {
    if (!running) { if (tickRef.current) clearInterval(tickRef.current); return }
    tickRef.current = setInterval(() => automationTick(), 500)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running, automationTick])

  const stats = {
    idle:         typedAmrs.filter(a => a.status === "IDLE").length,
    movingRack:   typedAmrs.filter(a => a.status === "MOVING_TO_RACK").length,
    movingStation:typedAmrs.filter(a => a.status === "MOVING_TO_STATION").length,
    atStation:    typedAmrs.filter(a => a.status === "AT_STATION").length,
    returning:    typedAmrs.filter(a => a.status === "RETURNING").length,
    charging:     typedAmrs.filter(a => a.status === "CHARGING").length,
    avgBatt:      Math.round(typedAmrs.reduce((s, a) => s + a.battery, 0) / Math.max(1, typedAmrs.length)),
    done:         typedTasks.filter(t => t.status === "DONE").length,
    total:        typedTasks.length,
    activeStations: typedStations.filter(s => s.status === "ACTIVE").length,
  }

  const openStationWindow = () => {
    window.open("/station", "_blank", "width=1400,height=900")
  }

  return (
    <div style={{ background: "#040810", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>

      {/* ── TOP BAR ── */}
      <div style={{
        background: "#080d1a", borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "12px 20px", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#8b5cf6", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
            MyRoboCloud · RMS · G2P Automation
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, margin: 0 }}>
            Robot Management System — Isometric Live View
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

          {/* Open station in new window */}
          <button onClick={openStationWindow} style={{
            padding: "8px 16px",
            background: "rgba(16,185,129,0.12)",
            border: "1px solid #10b981",
            borderRadius: 7, color: "#10b981",
            fontFamily: "'Courier New',monospace", fontSize: 10,
            letterSpacing: 1, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>🏭</span> OPEN STATIONS ↗
          </button>

          {/* Zoom */}
          <button onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(1)))}
            style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer" }}>−</button>
          <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", width: 36, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
            style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer" }}>+</button>

          {/* Run/Pause */}
          <div style={{ width: 8, height: 8, borderRadius: "50%", marginLeft: 8, background: running ? "#10b981" : "#ef4444", boxShadow: running ? "0 0 8px #10b981" : "none" }}/>
          <button onClick={() => setRunning(r => !r)} style={{
            padding: "8px 20px",
            background: running ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
            border: `1px solid ${running ? "#ef4444" : "#10b981"}`,
            borderRadius: 7, color: running ? "#ef4444" : "#10b981",
            fontFamily: "'Courier New',monospace", fontSize: 11,
            letterSpacing: 1, cursor: "pointer", fontWeight: 700,
          }}>
            {running ? "⏸ PAUSE" : "▶ RUN AUTOMATION"}
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "auto", background: "#080d1a" }}>
        {[
          { label: "IDLE",         value: stats.idle,           color: "#10b981" },
          { label: "→ RACK",       value: stats.movingRack,     color: "#3b82f6" },
          { label: "→ STATION",    value: stats.movingStation,  color: "#f59e0b" },
          { label: "AT STATION",   value: stats.atStation,      color: "#10b981" },
          { label: "RETURNING",    value: stats.returning,      color: "#8b5cf6" },
          { label: "CHARGING",     value: stats.charging,       color: "#6366f1" },
          { label: "AVG BATTERY",  value: `${stats.avgBatt}%`,  color: stats.avgBatt > 40 ? "#10b981" : "#ef4444" },
          { label: "TASKS DONE",   value: `${stats.done}/${stats.total}`, color: "#10b981" },
          { label: "G2P ACTIVE",   value: stats.activeStations, color: "#f59e0b" },
        ].map(k => (
          <div key={k.label} style={{ background: "#080d1a", padding: "10px 16px", borderRight: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── MAP ── */}
        <div style={{ flex: 1, overflow: "auto", padding: 16, background: "#040810" }}>

          {/* Station status pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>STATIONS:</span>
            {typedStations.map(s => {
              const isActive  = s.status === "ACTIVE"
              const isWaiting = s.status === "WAITING_AMR" || s.status === "AMR_EN_ROUTE"
              const isDone    = s.status === "PICKING_DONE"
              const color = isActive ? "#10b981" : isWaiting ? "#f59e0b" : isDone ? "#3b82f6" : "#374151"
              return (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: `${color}10`, border: `1px solid ${color}40`,
                  borderRadius: 7, padding: "6px 12px",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: isActive ? `0 0 6px ${color}` : "none" }}/>
                  <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color, letterSpacing: 1 }}>
                    {s.id} · {s.status.replace(/_/g, " ")}
                  </span>
                  {s.amrId && <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.4)" }}>· {s.amrId}</span>}
                  {s.totalItems > 0 && (
                    <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#10b981" }}>
                      {s.pickProgress}/{s.totalItems}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Station link hint */}
            <div style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
              background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 7, padding: "6px 12px",
            }}>
              <span style={{ fontSize: 12 }}>💡</span>
              <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.4)" }}>
                Click OPEN STATIONS ↗ to pick in a separate window
              </span>
            </div>
          </div>

          {/* Isometric map */}
          <IsoMap
            amrs={typedAmrs}
            tasks={typedTasks}
            stations={typedStations}
            zoom={zoom}
          />
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          width: 280, flexShrink: 0, background: "#080d1a",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>

          {/* Fleet size */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#8b5cf6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Fleet Size</div>
            <div style={{ display: "flex", gap: 5 }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => { setFleetSizeLocal(n); setFleetSize(n) }} style={{
                  flex: 1, height: 28, borderRadius: 5,
                  border: `1px solid ${fleetSize === n ? "#8b5cf6" : "rgba(255,255,255,0.1)"}`,
                  background: fleetSize === n ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
                  color: fleetSize === n ? "#8b5cf6" : "rgba(255,255,255,0.3)",
                  fontFamily: "monospace", fontSize: 12, cursor: "pointer", fontWeight: 700,
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* AMR Cards */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>
              AMR Fleet
            </div>
            {typedAmrs.map((amr: AMR) => {
              const si = STATUS_INFO[amr.status] || { color: "#fff", label: amr.status }
              const battColor = amr.battery > 50 ? "#10b981" : amr.battery > 20 ? "#f59e0b" : "#ef4444"
              const activeTask = typedTasks.find(t => t.id === amr.taskId)
              return (
                <div key={amr.id} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderLeft: `3px solid ${amr.color}`,
                  borderRadius: 8, padding: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: `${amr.color}15`, border: `1px solid ${amr.color}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <RobotIcon color={amr.color} size={17}/>
                      </div>
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: amr.color }}>{amr.id}</div>
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{amr.model}</div>
                      </div>
                    </div>
                    <span style={{ background: `${si.color}18`, border: `1px solid ${si.color}40`, borderRadius: 4, padding: "1px 6px", fontFamily: "'Courier New',monospace", fontSize: 8, color: si.color }}>
                      {si.label}
                    </span>
                  </div>

                  {/* Battery */}
                  <div style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.3)" }}>BATTERY</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: battColor }}>{Math.round(amr.battery)}%</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${amr.battery}%`, background: battColor, borderRadius: 2, transition: "width 0.5s" }}/>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {[
                      { l: "Done",    v: amr.completedTasks },
                      { l: "Rack",    v: amr.carryingRack ? amr.rackId?.replace("RACK-","R-") || "YES" : "NO" },
                      { l: "Station", v: amr.stationId || "—" },
                      { l: "Dist",    v: `${amr.totalDist}m` },
                    ].map(f => (
                      <div key={f.l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "4px 6px" }}>
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 1, textTransform: "uppercase" }}>{f.l}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{f.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Active task */}
                  {activeTask && (
                    <div style={{ marginTop: 6, background: `${amr.color}08`, border: `1px solid ${amr.color}25`, borderRadius: 5, padding: "4px 8px" }}>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: amr.color, letterSpacing: 1, marginBottom: 1 }}>
                        TASK · {activeTask.g2pStatus?.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                        {activeTask.id} · {activeTask.sku}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Task queue */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", maxHeight: 200, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase" }}>Task Queue</div>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#10b981" }}>{stats.done}/{stats.total}</div>
            </div>
            {typedTasks.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontStyle: "italic", padding: "8px 0", textAlign: "center" }}>
                Go to WMS → inject orders
              </div>
            )}
            {[...typedTasks].reverse().slice(0, 15).map(t => {
              const g2pColors: Record<string, string> = {
                WMS_QUEUED: "#3b82f6", WCS_DISPATCHED: "#f59e0b",
                AMR_ASSIGNED: "#8b5cf6", AMR_MOVING: "#f97316",
                AT_STATION: "#10b981", PICKING: "#10b981",
                PICKED: "#4ade80", AMR_RETURNING: "#8b5cf6", DONE: "#10b981",
              }
              const color = g2pColors[t.g2pStatus] || "#fff"
              return (
                <div key={t.id} style={{
                  display: "flex", gap: 5, alignItems: "center",
                  padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  opacity: t.status === "DONE" ? 0.5 : 1,
                }}>
                  <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{t.id}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fff", flex: 1 }}>{t.sku}</span>
                  <span style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 3, padding: "0 4px", fontFamily: "'Courier New',monospace", fontSize: 7, color }}>
                    {(t.g2pStatus || t.status).replace(/_/g, " ")}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Event log */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", maxHeight: 150, overflowY: "auto" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Event Log</div>
            {(logs as { msg: string; color: string; layer: string; t: string }[]).slice(0, 20).map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>{l.t}</span>
                <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: l.color, lineHeight: 1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}