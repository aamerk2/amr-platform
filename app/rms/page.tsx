"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"

// ── Grid config matching real warehouse layout ──
const COLS = 20  // aisles across
const ROWS = 16  // rows down
const SHELF_COLS = ["01","02","3231","03","3433","04","05","3635","06","07","3837","08","09","39","10","11","40","12","13","41"]
const SHELF_ROWS = ["49","50","51","52","53","54","20","21","22","23","24","25","26","27","28","29"]
const AISLE_COLS = [2, 5, 8, 11, 14, 17]  // col indices that are aisles
const AISLE_ROWS = [2, 6, 10, 14]          // row indices that are aisles

const AMR_COLS_LIST = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316"]

interface AMR {
  id: string
  color: string
  status: string
  battery: number
  row: number
  col: number
  taskId: string | null
  completedTasks: number
  totalDist: number
  model: string
  maxPayload: number
  path: {row: number, col: number}[]
  targetRow: number
  targetCol: number
}

interface Task {
  id: string
  type: string
  status: string
  priority: string
  sku: string
  weight: number
  assignedTo: string | null
  from?: number[]
}

const PRI_COL: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#6b7280",
}

let _amrId = 1
function makeAMR(index: number): AMR {
  const startPositions = [
    {row:0, col:2},{row:0, col:5},{row:0, col:8},
    {row:0, col:11},{row:0, col:14},{row:0, col:17}
  ]
  const pos = startPositions[index % startPositions.length]
  return {
    id: `AMR-${String(_amrId++).padStart(3,"0")}`,
    color: AMR_COLS_LIST[index % AMR_COLS_LIST.length],
    status: "IDLE",
    battery: 70 + Math.random() * 30,
    row: pos.row, col: pos.col,
    taskId: null,
    completedTasks: 0,
    totalDist: 0,
    model: ["MiR100","Geek+ P800","Fetch Cart","GreyOrange"][index % 4],
    maxPayload: 200 + Math.floor(Math.random() * 300),
    path: [],
    targetRow: pos.row,
    targetCol: pos.col,
  }
}

function isAisle(row: number, col: number) {
  return AISLE_COLS.includes(col) || AISLE_ROWS.includes(row)
}

function getCellType(row: number, col: number) {
  if (row === ROWS - 1) return "dock"
  if (row === 0 && AISLE_COLS.includes(col)) return "charge"
  if (isAisle(row, col)) return "aisle"
  return "shelf"
}

// Professional SVG Robot Icon
function RobotIcon({ color = "#3b82f6", size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="16" cy="2" r="1.5" fill={color}/>
      <rect x="10" y="6" width="12" height="9" rx="2" fill={`${color}30`} stroke={color} strokeWidth="1.5"/>
      <rect x="12" y="9" width="3" height="2" rx="0.5" fill={color}/>
      <rect x="17" y="9" width="3" height="2" rx="0.5" fill={color}/>
      <rect x="8" y="17" width="16" height="10" rx="2" fill={`${color}20`} stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="19" width="4" height="3" rx="0.5" fill={color} opacity="0.5"/>
      <rect x="17" y="19" width="2" height="3" rx="0.5" fill={color} opacity="0.7"/>
      <rect x="3" y="18" width="4" height="7" rx="1.5" fill={`${color}20`} stroke={color} strokeWidth="1.3"/>
      <rect x="25" y="18" width="4" height="7" rx="1.5" fill={`${color}20`} stroke={color} strokeWidth="1.3"/>
      <rect x="9" y="27" width="5" height="3" rx="1.5" fill={color} opacity="0.8"/>
      <rect x="18" y="27" width="5" height="3" rx="1.5" fill={color} opacity="0.8"/>
    </svg>
  )
}

export default function RMSPage() {
  const { tasks, processRMS, completeTask, addLog } = useStore()
  const [amrs, setAmrs] = useState<AMR[]>(() => Array.from({ length: 4 }, (_, i) => makeAMR(i)))
  const [running, setRunning] = useState(false)
  const [fleetSize, setFleetSize] = useState(4)
  const [hoveredCell, setHoveredCell] = useState<{row:number,col:number}|null>(null)
  const [selectedAmr, setSelectedAmr] = useState<AMR|null>(null)
  const [zoom, setZoom] = useState(1)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setAmrs(Array.from({ length: fleetSize }, (_, i) => makeAMR(i)))
  }, [fleetSize])

  useEffect(() => {
    if (!running) { if (tickRef.current) clearInterval(tickRef.current); return }
    tickRef.current = setInterval(() => {
      processRMS(amrs, setAmrs)
      setAmrs(prev => prev.map((amr: AMR) => {
        let { battery, status, completedTasks, row, col, totalDist, taskId, path, targetRow, targetCol } = amr
        battery = Math.max(0, battery - 0.15)

        if (battery < 10 && status !== "CHARGING") {
          addLog(`${amr.id} low battery → charging`, "#8b5cf6", "RMS")
          // go to nearest charge station
          const chargeCol = AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)]
          return { ...amr, battery, status: "CHARGING", taskId: null, targetRow: 0, targetCol: chargeCol }
        }
        if (status === "CHARGING") {
          battery = Math.min(100, battery + 1.5)
          if (battery > 92) return { ...amr, battery, status: "IDLE", taskId: null }
          return { ...amr, battery }
        }
        if (status === "EN_ROUTE" || status === "WORKING") {
          // Move through aisles only (professional pathfinding)
          let newRow = row
          let newCol = col

          // First move to an aisle column, then move row-wise, then to target col
          if (!AISLE_COLS.includes(col)) {
            // Move horizontally to nearest aisle
            const nearestAisle = AISLE_COLS.reduce((a, b) => Math.abs(a - col) < Math.abs(b - col) ? a : b)
            newCol = col + (nearestAisle > col ? 1 : -1)
          } else if (row !== targetRow) {
            // Move vertically along aisle
            newRow = row + (targetRow > row ? 1 : -1)
          } else if (col !== targetCol) {
            // Move horizontally to target
            newCol = col + (targetCol > col ? 1 : -1)
          }

          // Record path
          const newPath = [...path, {row: newRow, col: newCol}].slice(-8)
          totalDist += 1

          if (Math.random() < 0.04) {
            completedTasks += 1
            if (taskId) completeTask(taskId)
            addLog(`✓ ${amr.id} task complete`, "#10b981", "AMR")
            return { ...amr, battery, status: "IDLE", taskId: null, row: newRow, col: newCol, completedTasks, totalDist, path: newPath }
          }
          return { ...amr, battery, row: newRow, col: newCol, totalDist, path: newPath }
        }

        // Random target for idle AMRs to patrol
        if (status === "IDLE" && Math.random() < 0.02) {
          const newTargetRow = Math.floor(Math.random() * ROWS)
          const newTargetCol = AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)]
          return { ...amr, battery, targetRow: newTargetRow, targetCol: newTargetCol }
        }
        return { ...amr, battery }
      }))
    }, 600)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running, amrs, processRMS, completeTask, addLog])

  const stats = {
    idle:     amrs.filter(a => a.status === "IDLE").length,
    active:   amrs.filter(a => a.status === "EN_ROUTE" || a.status === "WORKING").length,
    charging: amrs.filter(a => a.status === "CHARGING").length,
    avgBatt:  Math.round(amrs.reduce((s, a) => s + a.battery, 0) / amrs.length),
  }

  const CS = Math.floor(36 * zoom)

  return (
    <div style={{ background: "#060a12", minHeight: "100vh", color: "#fff" }}>

      {/* Top bar */}
      <div style={{
        background: "#0a0f1e", borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "14px 24px", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#8b5cf6", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
            MyRoboCloud · Layer 3
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, margin: 0, color: "#fff" }}>
            Robot Management System — Live Warehouse View
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Zoom controls */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginRight: 8 }}>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 16 }}>−</button>
            <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", width: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 16 }}>+</button>
          </div>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: running ? "#10b981" : "#ef4444", boxShadow: running ? "0 0 8px #10b981" : "none" }}/>
          <button onClick={() => setRunning(r => !r)} style={{
            padding: "8px 18px",
            background: running ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)",
            border: `1px solid ${running ? "#ef4444" : "#10b981"}`,
            borderRadius: 7, color: running ? "#ef4444" : "#10b981",
            fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: 1, cursor: "pointer",
          }}>
            {running ? "⏸ PAUSE" : "▶ RUN SIM"}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 1, background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {[
          { label: "Idle",          value: stats.idle,     color: "#10b981" },
          { label: "Active",        value: stats.active,   color: "#3b82f6" },
          { label: "Charging",      value: stats.charging, color: "#8b5cf6" },
          { label: "Avg Battery",   value: `${stats.avgBatt}%`, color: stats.avgBatt > 40 ? "#10b981" : "#ef4444" },
          { label: "Tasks Queued",  value: (tasks as Task[]).filter(t => t.status === "WCS_DISPATCHED").length, color: "#f59e0b" },
          { label: "Tasks Done",    value: (tasks as Task[]).filter(t => t.status === "DONE").length, color: "#10b981" },
          { label: "Total Completed", value: amrs.reduce((s,a)=>s+a.completedTasks,0), color: "#3b82f6" },
        ].map(k => (
          <div key={k.label} style={{ background: "#0a0f1e", padding: "12px 16px", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 0, height: "calc(100vh - 160px)" }}>

        {/* ── MAIN MAP ── */}
        <div style={{ padding: 20, overflowAuto: "both", overflow: "auto" }}>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { color: "#1e3a5f", border: "#2563eb", label: "Shelf Bay" },
              { color: "#0a1628", border: "#1d4ed8", label: "Aisle" },
              { color: "#1a0a2e", border: "#7c3aed", label: "Charge Station" },
              { color: "#1a0a00", border: "#b45309", label: "Dock / Dispatch" },
              { color: "#eab308", border: "#eab308", label: "Active Task" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 12, background: l.color, border: `1px solid ${l.border}`, borderRadius: 2 }}/>
                <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>{l.label}</span>
              </div>
            ))}
            {amrs.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <RobotIcon color={a.color} size={12}/>
                <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: a.color }}>{a.id}</span>
              </div>
            ))}
          </div>

          {/* Warehouse grid */}
          <div style={{ overflowX: "auto", overflowY: "auto" }}>
            <div style={{ display: "inline-block" }}>

              {/* Column headers (aisle numbers) */}
              <div style={{ display: "flex", marginLeft: CS + 4 }}>
                {SHELF_COLS.map((label, c) => (
                  <div key={c} style={{
                    width: CS, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Courier New',monospace", fontSize: Math.max(7, CS * 0.22),
                    color: AISLE_COLS.includes(c) ? "#f97316" : "rgba(255,255,255,0.35)",
                    letterSpacing: 0,
                  }}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid rows */}
              {Array.from({ length: ROWS }, (_, r) => (
                <div key={r} style={{ display: "flex", alignItems: "center" }}>
                  {/* Row label */}
                  <div style={{
                    width: CS, height: CS, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Courier New',monospace", fontSize: Math.max(7, CS * 0.22),
                    color: AISLE_ROWS.includes(r) ? "#f97316" : "rgba(255,255,255,0.35)",
                    flexShrink: 0,
                  }}>
                    {SHELF_ROWS[r] || ""}
                  </div>

                  {/* Cells */}
                  {Array.from({ length: COLS }, (_, c) => {
                    const cellType = getCellType(r, c)
                    const amr = amrs.find(a => a.row === r && a.col === c)
                    const isPath = amrs.some(a => a.path.some(p => p.row === r && p.col === c))
                    const hasTask = (tasks as Task[]).some(t =>
                      (t.status === "ASSIGNED" || t.status === "WCS_DISPATCHED") &&
                      t.from && t.from[0] === r && t.from[1] === c
                    )
                    const isHovered = hoveredCell?.row === r && hoveredCell?.col === c

                    let bg = "#0d1424"
                    let border = "rgba(255,255,255,0.04)"
                    let innerContent = null

                    if (cellType === "shelf") {
                      bg = "#0f1e36"
                      border = "#1e3a6e"
                      // Draw shelf bay pattern (2 small rectangles like "HH")
                      innerContent = (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, padding: 2, width: "100%", height: "100%" }}>
                          <div style={{ background: "#162d52", borderRadius: 1 }}/>
                          <div style={{ background: "#162d52", borderRadius: 1 }}/>
                          <div style={{ background: "#162d52", borderRadius: 1 }}/>
                          <div style={{ background: "#162d52", borderRadius: 1 }}/>
                        </div>
                      )
                    } else if (cellType === "aisle") {
                      bg = "#080e1a"
                      border = "#0f1e36"
                    } else if (cellType === "charge") {
                      bg = "#150a2a"
                      border = "#6d28d9"
                      innerContent = <span style={{ color: "#8b5cf6", fontSize: CS * 0.35, lineHeight: 1 }}>⚡</span>
                    } else if (cellType === "dock") {
                      bg = "#1a0e00"
                      border = "#92400e"
                      innerContent = <span style={{ color: "#b45309", fontSize: CS * 0.32, lineHeight: 1 }}>▼</span>
                    }

                    if (isPath && !amr) {
                      bg = "#0f1e36"
                      border = "#1d4ed860"
                    }

                    return (
                      <div
                        key={c}
                        onMouseEnter={() => setHoveredCell({row:r,col:c})}
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`[Row ${SHELF_ROWS[r]||r}, Col ${SHELF_COLS[c]||c}] ${cellType}`}
                        style={{
                          width: CS, height: CS, flexShrink: 0,
                          background: amr ? `${amr.color}25` : hasTask ? "#eab30825" : bg,
                          border: `1px solid ${amr ? amr.color : hasTask ? "#eab308" : isPath ? "#3b82f640" : border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative", cursor: "default",
                          boxShadow: amr ? `0 0 8px ${amr.color}60` : "none",
                          transition: "background 0.2s, box-shadow 0.2s",
                          overflow: "hidden",
                        }}
                      >
                        {amr ? (
                          <div
                            onClick={() => setSelectedAmr(selectedAmr?.id === amr.id ? null : amr)}
                            style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <RobotIcon color={amr.color} size={CS * 0.7}/>
                          </div>
                        ) : innerContent}

                        {hasTask && !amr && (
                          <div style={{ position: "absolute", top: 2, right: 2, width: 4, height: 4, borderRadius: "50%", background: "#eab308", boxShadow: "0 0 4px #eab308" }}/>
                        )}
                        {isHovered && !amr && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.04)", pointerEvents: "none" }}/>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          background: "#0a0f1e", borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>

          {/* Fleet size */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#8b5cf6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Fleet Size</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[2,3,4,5,6].map(n => (
                <button key={n} onClick={() => setFleetSize(n)} style={{
                  width: 34, height: 30, borderRadius: 5,
                  border: `1px solid ${fleetSize === n ? "#8b5cf6" : "rgba(255,255,255,0.1)"}`,
                  background: fleetSize === n ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)",
                  color: fleetSize === n ? "#8b5cf6" : "rgba(255,255,255,0.35)",
                  fontFamily: "'Courier New',monospace", fontSize: 12, cursor: "pointer",
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* AMR Cards */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>AMR Fleet Status</div>
            {amrs.map((amr: AMR) => {
              const sc: Record<string,string> = { IDLE:"#10b981", EN_ROUTE:"#3b82f6", WORKING:"#f59e0b", CHARGING:"#8b5cf6" }
              const statusColor = sc[amr.status] || "#fff"
              const battColor = amr.battery > 50 ? "#10b981" : amr.battery > 20 ? "#f59e0b" : "#ef4444"
              const activeTask = (tasks as Task[]).find(t => t.id === amr.taskId)
              const isSelected = selectedAmr?.id === amr.id

              return (
                <div key={amr.id}
                  onClick={() => setSelectedAmr(isSelected ? null : amr)}
                  style={{
                    background: isSelected ? `${amr.color}12` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? amr.color : "rgba(255,255,255,0.07)"}`,
                    borderLeft: `3px solid ${amr.color}`,
                    borderRadius: 8, padding: "12px",
                    cursor: "pointer", transition: "all 0.2s",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 6,
                        background: `${amr.color}15`, border: `1px solid ${amr.color}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <RobotIcon color={amr.color} size={18}/>
                      </div>
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: amr.color }}>{amr.id}</div>
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{amr.model}</div>
                      </div>
                    </div>
                    <span style={{
                      background: `${statusColor}18`, border: `1px solid ${statusColor}45`,
                      borderRadius: 4, padding: "1px 7px",
                      fontFamily: "'Courier New',monospace", fontSize: 8, color: statusColor,
                      display: "flex", alignItems: "center", gap: 3,
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: statusColor, display: "inline-block" }}/>
                      {amr.status.replace("_"," ")}
                    </span>
                  </div>

                  {/* Battery */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>BATTERY</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: battColor }}>{Math.round(amr.battery)}%</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${amr.battery}%`, background: battColor, borderRadius: 2, transition: "width 0.6s" }}/>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 8px" }}>
                    {[
                      { l: "Position", v: `R${SHELF_ROWS[amr.row]||amr.row} C${amr.col}` },
                      { l: "Done",     v: amr.completedTasks },
                      { l: "Dist",     v: `${amr.totalDist}m` },
                    ].map(f => (
                      <div key={f.l}>
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 1 }}>{f.l}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{f.v}</div>
                      </div>
                    ))}
                  </div>

                  {activeTask && (
                    <div style={{ marginTop: 8, background: `${amr.color}10`, border: `1px solid ${amr.color}25`, borderRadius: 5, padding: "5px 8px" }}>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: amr.color, letterSpacing: 1, marginBottom: 1 }}>ACTIVE TASK</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{activeTask.id} · {activeTask.type}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Task list */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "12px 16px", maxHeight: 220, overflowY: "auto" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Task Queue</div>
            {(tasks as Task[]).length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>
                Go to WMS → inject orders
              </div>
            )}
            {[...(tasks as Task[])].reverse().slice(0, 15).map(t => {
              const sc: Record<string,string> = { WMS_QUEUED:"#3b82f6", WCS_DISPATCHED:"#f59e0b", ASSIGNED:"#8b5cf6", DONE:"#10b981" }
              const color = sc[t.status] || "#fff"
              return (
                <div key={t.id} style={{
                  display: "flex", gap: 6, alignItems: "center", padding: "5px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.03)", flexWrap: "wrap",
                }}>
                  <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{t.id}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fff", flex: 1 }}>{t.type}</span>
                  <span style={{ background: `${PRI_COL[t.priority]}18`, border: `1px solid ${PRI_COL[t.priority]}45`, borderRadius: 3, padding: "0 5px", fontFamily: "'Courier New',monospace", fontSize: 8, color: PRI_COL[t.priority] }}>{t.priority}</span>
                  <span style={{ background: `${color}18`, border: `1px solid ${color}45`, borderRadius: 3, padding: "0 5px", fontFamily: "'Courier New',monospace", fontSize: 8, color }}>{t.status.replace(/_/g," ")}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}