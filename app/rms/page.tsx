"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"

const COLS = 20
const ROWS = 16
const SHELF_COLS = ["01","02","3231","03","3433","04","05","3635","06","07","3837","08","09","39","10","11","40","12","13","41"]
const SHELF_ROWS = ["49","50","51","52","53","54","20","21","22","23","24","25","26","27","28","29"]
const AISLE_COLS = [2, 5, 8, 11, 14, 17]
const AISLE_ROWS = [2, 6, 10, 14]
const AMR_COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316"]

const PRI_COL: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#6b7280",
}

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
  targetRow: number
  targetCol: number
  path: { row: number; col: number }[]
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
  orderId?: string
  wcsProcessed?: boolean
  wcsRule?: string
  completedAt?: number | null
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
      <rect x="11" y="19" width="4" height="3" rx="0.5" fill={color} opacity="0.5"/>
      <rect x="17" y="19" width="2" height="3" rx="0.5" fill={color} opacity="0.7"/>
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

let _aid = 1
function spawnAMR(index: number): AMR {
  const startCol = AISLE_COLS[index % AISLE_COLS.length]
  return {
    id: `AMR-${String(_aid++).padStart(3, "0")}`,
    color: AMR_COLORS[index % AMR_COLORS.length],
    status: "IDLE",
    battery: 75 + Math.random() * 25,
    row: 0,
    col: startCol,
    taskId: null,
    completedTasks: 0,
    totalDist: 0,
    model: ["MiR100","Geek+ P800","Fetch Cart","GreyOrange"][index % 4],
    maxPayload: 200 + Math.floor(Math.random() * 300),
    targetRow: Math.floor(1 + Math.random() * (ROWS - 2)),
    targetCol: AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)],
    path: [],
  }
}

function moveAMR(amr: AMR): AMR {
  let { row, col, targetRow, targetCol, path, totalDist, battery, status } = amr

  battery = Math.max(0, battery - 0.12)

  if (battery < 12 && status !== "CHARGING") {
    return {
      ...amr, battery, status: "CHARGING", taskId: null,
      targetRow: 0,
      targetCol: AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)],
    }
  }

  if (status === "CHARGING") {
    battery = Math.min(100, battery + 1.8)
    if (battery >= 95) return { ...amr, battery, status: "IDLE", taskId: null }
    return { ...amr, battery }
  }

  if (status === "IDLE") {
    const newTargetRow = Math.floor(1 + Math.random() * (ROWS - 2))
    const newTargetCol = AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)]
    return { ...amr, battery, status: "EN_ROUTE", targetRow: newTargetRow, targetCol: newTargetCol }
  }

  let newRow = row
  let newCol = col
  const inAisleCol = AISLE_COLS.includes(col)
  const inAisleRow = AISLE_ROWS.includes(row)

  if (!inAisleCol && !inAisleRow) {
    const nearestAisleCol = AISLE_COLS.reduce((a, b) =>
      Math.abs(a - col) < Math.abs(b - col) ? a : b)
    newCol = col + (nearestAisleCol > col ? 1 : -1)
  } else if (inAisleCol && row !== targetRow) {
    newRow = row + (targetRow > row ? 1 : -1)
  } else if (row === targetRow && col !== targetCol) {
    if (inAisleRow || AISLE_COLS.includes(targetCol)) {
      newCol = col + (targetCol > col ? 1 : -1)
    } else {
      const nearestAisleRow = AISLE_ROWS.reduce((a, b) =>
        Math.abs(a - row) < Math.abs(b - row) ? a : b)
      newRow = row + (nearestAisleRow > row ? 1 : -1)
    }
  }

  newRow = Math.max(0, Math.min(ROWS - 1, newRow))
  newCol = Math.max(0, Math.min(COLS - 1, newCol))
  totalDist += 1
  const newPath = [...path, { row: newRow, col: newCol }].slice(-6)

  return { ...amr, battery, row: newRow, col: newCol, totalDist, path: newPath }
}

export default function RMSPage() {
  const store = useStore()
  const { tasks, completeTask, addLog } = store
  const [amrs, setAmrs] = useState<AMR[]>(() => Array.from({ length: 4 }, (_, i) => spawnAMR(i)))
  const [running, setRunning] = useState(false)
  const [fleetSize, setFleetSize] = useState(4)
  const [zoom, setZoom] = useState(1)
  const [selectedAmr, setSelectedAmr] = useState<string | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    _aid = 1
    setAmrs(Array.from({ length: fleetSize }, (_, i) => spawnAMR(i)))
  }, [fleetSize])

  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current)
      return
    }

    tickRef.current = setInterval(() => {
      const state = useStore.getState()
      const currentTasks: Task[] = state.tasks

      // ── STEP 1: Auto WCS — move WMS_QUEUED → WCS_DISPATCHED ──
      const hasQueued = currentTasks.some(t => t.status === "WMS_QUEUED")
      if (hasQueued) {
        useStore.setState((s: { tasks: Task[] }) => ({
          tasks: s.tasks.map((t: Task) =>
            t.status === "WMS_QUEUED"
              ? { ...t, status: "WCS_DISPATCHED", wcsProcessed: true, wcsRule: "Auto Route" }
              : t
          )
        }))
      }

      // ── STEP 2: Assign WCS_DISPATCHED → idle AMRs ──
      setAmrs(prev => {
        const freshTasks: Task[] = useStore.getState().tasks
        const dispatched = freshTasks.filter(t => t.status === "WCS_DISPATCHED")
        if (!dispatched.length) return prev

        const idleAmrs = prev.filter(a => a.status === "IDLE" && a.battery > 12)
        if (!idleAmrs.length) return prev

        const taskUpdates: Record<string, Task> = {}
        const amrUpdates: Record<string, Partial<AMR>> = {}
        const usedAmrs = new Set<string>()

        for (const task of dispatched) {
          const available = idleAmrs.filter(a => !usedAmrs.has(a.id))
          if (!available.length) break
          const amr = available[0]
          usedAmrs.add(amr.id)
          taskUpdates[task.id] = { ...task, status: "ASSIGNED", assignedTo: amr.id }
          amrUpdates[amr.id] = { status: "EN_ROUTE", taskId: task.id }
          state.addLog(`RMS → ${task.id} ⟶ ${amr.id} [${task.priority}]`, "#e040fb", "RMS")
        }

        if (Object.keys(taskUpdates).length > 0) {
          useStore.setState((s: { tasks: Task[] }) => ({
            tasks: s.tasks.map((t: Task) => taskUpdates[t.id] ? taskUpdates[t.id] : t)
          }))
        }

        return prev.map(a => amrUpdates[a.id] ? { ...a, ...amrUpdates[a.id] } : a)
      })

      // ── STEP 3: Move AMRs + complete tasks ──
      setAmrs(prev => prev.map((amr: AMR) => {
        const moved = moveAMR(amr)

        // complete task with 6% chance each tick while en route
        if (amr.taskId && amr.status === "EN_ROUTE" && Math.random() < 0.06) {
          useStore.getState().completeTask(amr.taskId)
          useStore.getState().addLog(`✓ ${amr.id} completed ${amr.taskId}`, "#10b981", "AMR")
          return {
            ...moved,
            status: "IDLE",
            taskId: null,
            completedTasks: amr.completedTasks + 1,
            targetRow: Math.floor(1 + Math.random() * (ROWS - 2)),
            targetCol: AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)],
          }
        }

        return moved
      }))

    }, 500)

    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running])

  const typedTasks = tasks as Task[]
  const stats = {
    idle:      amrs.filter(a => a.status === "IDLE").length,
    active:    amrs.filter(a => a.status === "EN_ROUTE" || a.status === "WORKING").length,
    charging:  amrs.filter(a => a.status === "CHARGING").length,
    avgBatt:   Math.round(amrs.reduce((s, a) => s + a.battery, 0) / Math.max(1, amrs.length)),
    completed: amrs.reduce((s, a) => s + a.completedTasks, 0),
    tasksDone: typedTasks.filter(t => t.status === "DONE").length,
    tasksLeft: typedTasks.filter(t => t.status !== "DONE").length,
  }

  const CS = Math.max(20, Math.floor(34 * zoom))

  return (
    <div style={{ background: "#060a12", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>

      {/* ── TOP BAR ── */}
      <div style={{
        background: "#0a0f1e", borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 20px", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#8b5cf6", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
            MyRoboCloud · RMS · Layer 3
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, margin: 0, color: "#fff" }}>
            Robot Management System — Live Warehouse Map
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 16 }}>−</button>
          <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", width: 36, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2.5, +(z + 0.15).toFixed(2)))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 16 }}>+</button>
          <div style={{ width: 8, height: 8, borderRadius: "50%", marginLeft: 8, background: running ? "#10b981" : "#ef4444", boxShadow: running ? "0 0 8px #10b981" : "none" }}/>
          <button onClick={() => setRunning(r => !r)} style={{
            padding: "8px 20px",
            background: running ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
            border: `1px solid ${running ? "#ef4444" : "#10b981"}`,
            borderRadius: 7, color: running ? "#ef4444" : "#10b981",
            fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: 1,
            cursor: "pointer", fontWeight: 700,
          }}>
            {running ? "⏸ PAUSE" : "▶ RUN SIM"}
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
        {[
          { label: "IDLE",      value: stats.idle,      color: "#10b981" },
          { label: "ACTIVE",    value: stats.active,    color: "#3b82f6" },
          { label: "CHARGING",  value: stats.charging,  color: "#8b5cf6" },
          { label: "AVG BATT",  value: `${stats.avgBatt}%`, color: stats.avgBatt > 40 ? "#10b981" : "#ef4444" },
          { label: "COMPLETED", value: stats.completed, color: "#10b981" },
          { label: "DONE",      value: stats.tasksDone, color: "#10b981" },
          { label: "REMAINING", value: stats.tasksLeft, color: "#f59e0b" },
        ].map(k => (
          <div key={k.label} style={{
            background: "#0a0f1e", padding: "10px 20px",
            borderRight: "1px solid rgba(255,255,255,0.05)", flexShrink: 0,
          }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── WAREHOUSE MAP ── */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>

          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
            {[
              { color: "#0f1e36", border: "#1e3a6e", label: "Shelf Bay" },
              { color: "#080e1a", border: "#0f1e36", label: "Aisle" },
              { color: "#150a2a", border: "#6d28d9", label: "Charge" },
              { color: "#1a0e00", border: "#92400e", label: "Dock" },
              { color: "#eab308", border: "#eab308", label: "Active Task" },
            ].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, background: l.color, border: `1px solid ${l.border}`, borderRadius: 2 }}/>
                <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{l.label}</span>
              </div>
            ))}
            <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)" }}/>
            {amrs.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <RobotIcon color={a.color} size={10}/>
                <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: a.color }}>{a.id}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: "inline-block", background: "#040810", padding: 4, borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>

            {/* Column headers */}
            <div style={{ display: "flex", paddingLeft: CS + 4 }}>
              {SHELF_COLS.map((label, c) => (
                <div key={c} style={{
                  width: CS, textAlign: "center",
                  fontFamily: "'Courier New',monospace",
                  fontSize: Math.max(6, CS * 0.2),
                  color: AISLE_COLS.includes(c) ? "#f97316" : "rgba(255,255,255,0.25)",
                  marginBottom: 2, flexShrink: 0,
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Rows */}
            {Array.from({ length: ROWS }, (_, r) => (
              <div key={r} style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  width: CS, textAlign: "right", paddingRight: 4, flexShrink: 0,
                  fontFamily: "'Courier New',monospace",
                  fontSize: Math.max(6, CS * 0.2),
                  color: AISLE_ROWS.includes(r) ? "#f97316" : "rgba(255,255,255,0.25)",
                }}>
                  {SHELF_ROWS[r] || ""}
                </div>

                {Array.from({ length: COLS }, (_, c) => {
                  const cellType = getCellType(r, c)
                  const amr = amrs.find(a => a.row === r && a.col === c)
                  const isPath = !amr && amrs.some(a => a.path.some(p => p.row === r && p.col === c))
                  const hasTask = typedTasks.some(t =>
                    (t.status === "ASSIGNED" || t.status === "WCS_DISPATCHED") &&
                    t.from && t.from[0] === r && t.from[1] === c
                  )

                  let bg = "#080d14"
                  let borderColor = "rgba(255,255,255,0.03)"

                  if (cellType === "shelf")  { bg = "#0d1a2e"; borderColor = "#162d52" }
                  if (cellType === "aisle")  { bg = "#060c18"; borderColor = "#0a1428" }
                  if (cellType === "charge") { bg = "#120820"; borderColor = "#5b21b6" }
                  if (cellType === "dock")   { bg = "#150a00"; borderColor = "#78350f" }
                  if (isPath)                { bg = "#0a1428"; borderColor = "#1d4ed840" }
                  if (hasTask && !amr)       { borderColor = "#eab308" }
                  if (amr)                   { bg = `${amr.color}20`; borderColor = amr.color }

                  return (
                    <div key={c}
                      onClick={() => amr && setSelectedAmr(selectedAmr === amr.id ? null : amr.id)}
                      title={`[${SHELF_ROWS[r]||r}, ${SHELF_COLS[c]||c}] ${cellType}${amr ? ` — ${amr.id}` : ""}`}
                      style={{
                        width: CS, height: CS, flexShrink: 0,
                        background: bg,
                        border: `1px solid ${borderColor}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative",
                        boxShadow: amr ? `0 0 10px ${amr.color}80` : "none",
                        transition: "box-shadow 0.15s",
                        cursor: amr ? "pointer" : "default",
                      }}>
                      {amr ? (
                        <RobotIcon color={amr.color} size={Math.max(10, CS * 0.65)}/>
                      ) : cellType === "shelf" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, padding: Math.max(2, CS * 0.08), width: "100%", height: "100%", boxSizing: "border-box" }}>
                          <div style={{ background: "#1a3358", borderRadius: 1 }}/>
                          <div style={{ background: "#1a3358", borderRadius: 1 }}/>
                          <div style={{ background: "#1a3358", borderRadius: 1 }}/>
                          <div style={{ background: "#1a3358", borderRadius: 1 }}/>
                        </div>
                      ) : cellType === "charge" ? (
                        <span style={{ fontSize: Math.max(8, CS * 0.35), color: "#7c3aed" }}>⚡</span>
                      ) : cellType === "dock" ? (
                        <span style={{ fontSize: Math.max(8, CS * 0.32), color: "#b45309" }}>▼</span>
                      ) : null}

                      {hasTask && !amr && (
                        <div style={{
                          position: "absolute", top: 2, right: 2,
                          width: Math.max(3, CS * 0.12), height: Math.max(3, CS * 0.12),
                          borderRadius: "50%", background: "#eab308",
                          boxShadow: "0 0 4px #eab308",
                        }}/>
                      )}
                      {isPath && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(59,130,246,0.08)", pointerEvents: "none" }}/>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{
          width: 280, flexShrink: 0,
          background: "#0a0f1e",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* Fleet size */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#8b5cf6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Fleet Size</div>
            <div style={{ display: "flex", gap: 5 }}>
              {[2,3,4,5,6].map(n => (
                <button key={n} onClick={() => setFleetSize(n)} style={{
                  flex: 1, height: 28, borderRadius: 5,
                  border: `1px solid ${fleetSize === n ? "#8b5cf6" : "rgba(255,255,255,0.1)"}`,
                  background: fleetSize === n ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
                  color: fleetSize === n ? "#8b5cf6" : "rgba(255,255,255,0.3)",
                  fontFamily: "monospace", fontSize: 12, cursor: "pointer", fontWeight: 700,
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* AMR cards */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>AMR Fleet</div>
            {amrs.map((amr: AMR) => {
              const sc: Record<string,string> = { IDLE:"#10b981", EN_ROUTE:"#3b82f6", WORKING:"#f59e0b", CHARGING:"#8b5cf6" }
              const statusColor = sc[amr.status] || "#fff"
              const battColor = amr.battery > 50 ? "#10b981" : amr.battery > 20 ? "#f59e0b" : "#ef4444"
              const isSelected = selectedAmr === amr.id
              const activeTask = typedTasks.find(t => t.id === amr.taskId)

              return (
                <div key={amr.id}
                  onClick={() => setSelectedAmr(isSelected ? null : amr.id)}
                  style={{
                    background: isSelected ? `${amr.color}15` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? amr.color : "rgba(255,255,255,0.07)"}`,
                    borderLeft: `3px solid ${amr.color}`,
                    borderRadius: 8, padding: 10, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: `${amr.color}15`, border: `1px solid ${amr.color}40`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <RobotIcon color={amr.color} size={17}/>
                      </div>
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: amr.color }}>{amr.id}</div>
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{amr.model}</div>
                      </div>
                    </div>
                    <span style={{
                      background: `${statusColor}18`, border: `1px solid ${statusColor}40`,
                      borderRadius: 4, padding: "1px 6px",
                      fontFamily: "'Courier New',monospace", fontSize: 8, color: statusColor,
                    }}>
                      {amr.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Battery */}
                  <div style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>BATTERY</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: battColor }}>{Math.round(amr.battery)}%</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${amr.battery}%`, background: battColor, borderRadius: 2, transition: "width 0.5s" }}/>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                    {[
                      { l: "Row",  v: SHELF_ROWS[amr.row] || amr.row },
                      { l: "Done", v: amr.completedTasks },
                      { l: "Dist", v: `${amr.totalDist}m` },
                    ].map(f => (
                      <div key={f.l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "4px 6px" }}>
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 1, textTransform: "uppercase" }}>{f.l}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{f.v}</div>
                      </div>
                    ))}
                  </div>

                  {activeTask && (
                    <div style={{ marginTop: 8, background: `${amr.color}10`, border: `1px solid ${amr.color}25`, borderRadius: 5, padding: "5px 8px" }}>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: amr.color, letterSpacing: 1, marginBottom: 1 }}>ACTIVE TASK</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{activeTask.id} · {activeTask.type} · {activeTask.sku}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Task queue */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", maxHeight: 220, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase" }}>Task Queue</div>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#10b981" }}>
                {stats.tasksDone} / {typedTasks.length} done
              </div>
            </div>
            {typedTasks.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontStyle: "italic", padding: "10px 0", textAlign: "center" }}>
                Go to WMS → inject orders
              </div>
            )}
            {[...typedTasks].reverse().slice(0, 15).map(t => {
              const sc: Record<string,string> = {
                WMS_QUEUED: "#3b82f6",
                WCS_DISPATCHED: "#f59e0b",
                ASSIGNED: "#8b5cf6",
                DONE: "#10b981"
              }
              const color = sc[t.status] || "#fff"
              return (
                <div key={t.id} style={{
                  display: "flex", gap: 5, alignItems: "center",
                  padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  flexWrap: "wrap",
                  opacity: t.status === "DONE" ? 0.5 : 1,
                }}>
                  <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{t.id}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fff", flex: 1 }}>{t.type}</span>
                  <span style={{
                    background: `${PRI_COL[t.priority]}18`,
                    border: `1px solid ${PRI_COL[t.priority]}40`,
                    borderRadius: 3, padding: "0 4px",
                    fontFamily: "'Courier New',monospace", fontSize: 7,
                    color: PRI_COL[t.priority],
                  }}>{t.priority}</span>
                  <span style={{
                    background: `${color}18`,
                    border: `1px solid ${color}40`,
                    borderRadius: 3, padding: "0 4px",
                    fontFamily: "'Courier New',monospace", fontSize: 7, color,
                  }}>{t.status.replace(/_/g," ")}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}