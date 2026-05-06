"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "../../lib/store"

const GW = 22, GH = 14
const AMR_COLS = ["#00e5ff","#ffb300","#69ff47","#ff4081","#e040fb","#ff6d00"]

const PRI_COL: Record<string, string> = {
  CRITICAL: "#ff3d3d",
  HIGH: "#ff8c00",
  MEDIUM: "#ffd600",
  LOW: "#78909c",
}

const CELL_META: Record<string, { color: string; border: string; label: string }> = {
  empty:    { color: "#080d14", border: "#111820", label: "Empty" },
  shelf:    { color: "#061830", border: "#0e3a6e", label: "Shelf" },
  aisle:    { color: "#080d0a", border: "#0e2010", label: "Aisle" },
  dock:     { color: "#160e00", border: "#b36a00", label: "Dock" },
  charge:   { color: "#110018", border: "#7c28d4", label: "Charge" },
  pick:     { color: "#001610", border: "#00a86b", label: "Pick Stn" },
  wall:     { color: "#141414", border: "#2a2a2a", label: "Wall" },
  conveyor: { color: "#160800", border: "#cc4400", label: "Conveyor" },
}

function buildGrid() {
  return Array.from({ length: GH }, (_, r) =>
    Array.from({ length: GW }, (_, c) => {
      if (r===0||r===GH-1||c===0||c===GW-1) return "wall"
      if (c===4||c===9||c===14||c===19) return "aisle"
      if (r===GH-2 && [3,8,13,18].includes(c)) return "dock"
      if (r===GH-2 && [5,10,15].includes(c)) return "conveyor"
      if (r===1 && [2,7,12,17].includes(c)) return "charge"
      if (r===1 && [5,10,15].includes(c)) return "pick"
      return "shelf"
    })
  )
}

// Professional SVG Robot Icon
function RobotIcon({ color = "#00e5ff", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="16" cy="2" r="1.2" fill={color}/>
      <rect x="10" y="6" width="12" height="9" rx="2" fill="none" stroke={color} strokeWidth="1.4"/>
      <rect x="12" y="9" width="3" height="2" rx="0.5" fill={color} opacity="0.9"/>
      <rect x="17" y="9" width="3" height="2" rx="0.5" fill={color} opacity="0.9"/>
      <line x1="14" y1="15" x2="14" y2="17" stroke={color} strokeWidth="1.2"/>
      <line x1="18" y1="15" x2="18" y2="17" stroke={color} strokeWidth="1.2"/>
      <rect x="8" y="17" width="16" height="10" rx="2" fill="none" stroke={color} strokeWidth="1.4"/>
      <rect x="11" y="19.5" width="4" height="2.5" rx="0.5" fill={color} opacity="0.4"/>
      <rect x="17" y="19.5" width="2" height="2.5" rx="0.5" fill={color} opacity="0.6"/>
      <line x1="11" y1="24" x2="21" y2="24" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <rect x="3" y="18" width="4" height="7" rx="1.5" fill="none" stroke={color} strokeWidth="1.3"/>
      <rect x="25" y="18" width="4" height="7" rx="1.5" fill="none" stroke={color} strokeWidth="1.3"/>
      <rect x="9" y="27" width="5" height="3" rx="1.5" fill={color} opacity="0.7"/>
      <rect x="18" y="27" width="5" height="3" rx="1.5" fill={color} opacity="0.7"/>
    </svg>
  )
}

let _amrId = 1
function makeAMR(index: number) {
  const positions = [[1,2],[1,7],[1,12],[1,17],[2,2],[2,7]]
  const pos = positions[index % positions.length]
  return {
    id: `AMR-${String(_amrId++).padStart(3,"0")}`,
    color: AMR_COLS[index % AMR_COLS.length],
    status: "IDLE",
    battery: 70 + Math.random() * 30,
    pos: [...pos],
    taskId: null as string | null,
    completedTasks: 0,
    totalDist: 0,
    model: ["MiR100","Geek+ P800","Fetch Cart","GreyOrange"][index % 4],
    maxPayload: 200 + Math.floor(Math.random() * 300),
  }
}

export default function RMSPage() {
  const { tasks, processRMS, completeTask, addLog } = useStore()
  const [grid] = useState(buildGrid)
  const [amrs, setAmrs] = useState(() => Array.from({ length: 4 }, (_, i) => makeAMR(i)))
  const [running, setRunning] = useState(false)
  const [fleetSize, setFleetSize] = useState(4)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setAmrs(Array.from({ length: fleetSize }, (_, i) => makeAMR(i)))
  }, [fleetSize])

  useEffect(() => {
    if (!running) { if (tickRef.current) clearInterval(tickRef.current); return }
    tickRef.current = setInterval(() => {
      processRMS(amrs, setAmrs)
      setAmrs(prev => prev.map(amr => {
        let { battery, status, completedTasks, pos, taskId, totalDist } = amr
        battery = Math.max(0, battery - 0.2)
        if (battery < 10 && status !== "CHARGING") {
          addLog(`${amr.id} low battery → charging`, "#9c4dcc", "RMS")
          return { ...amr, battery, status: "CHARGING", taskId: null }
        }
        if (status === "CHARGING") {
          battery = Math.min(100, battery + 1.5)
          if (battery > 92) return { ...amr, battery, status: "IDLE", taskId: null }
          return { ...amr, battery }
        }
        if (status === "EN_ROUTE" || status === "WORKING") {
          const dr = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : -1)
          const dc = dr === 0 ? (Math.random() < 0.5 ? 1 : -1) : 0
          const nr = Math.min(GH - 1, Math.max(0, pos[0] + dr))
          const nc = Math.min(GW - 1, Math.max(0, pos[1] + dc))
          totalDist += 1
          if (Math.random() < 0.05) {
            completedTasks += 1
            if (taskId) completeTask(taskId)
            addLog(`${amr.id} completed task`, "#69ff47", "AMR")
            return { ...amr, battery, status: "IDLE", taskId: null, pos: [nr, nc], completedTasks, totalDist }
          }
          return { ...amr, battery, pos: [nr, nc], totalDist }
        }
        return { ...amr, battery }
      }))
    }, 700)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running, amrs, processRMS, completeTask, addLog])

  const stats = {
    idle:     amrs.filter(a => a.status === "IDLE").length,
    active:   amrs.filter(a => a.status === "EN_ROUTE" || a.status === "WORKING").length,
    charging: amrs.filter(a => a.status === "CHARGING").length,
    avgBatt:  Math.round(amrs.reduce((s, a) => s + a.battery, 0) / amrs.length),
  }

  const cs = 28

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#e040fb", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
            LAYER 3
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>
            Robot Management System
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", marginTop: 6, fontSize: 13, fontStyle: "italic", margin: "6px 0 0" }}>
            Assigns tasks to AMRs · Tracks live positions · Monitors fleet health
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: running ? "#69ff47" : "#ff3d3d",
            boxShadow: running ? "0 0 8px #69ff47" : "none",
          }}/>
          <button onClick={() => setRunning(r => !r)} style={{
            padding: "10px 22px",
            background: running ? "rgba(255,61,61,0.12)" : "rgba(105,255,71,0.12)",
            border: `1px solid ${running ? "#ff3d3d" : "#69ff47"}`,
            borderRadius: 8,
            color: running ? "#ff3d3d" : "#69ff47",
            fontFamily: "'Courier New', monospace",
            fontSize: 12, letterSpacing: 1, cursor: "pointer",
          }}>
            {running ? "⏸ PAUSE" : "▶ RUN SIM"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "AMRs Idle",    value: stats.idle,     color: "#69ff47" },
          { label: "AMRs Active",  value: stats.active,   color: "#00e5ff" },
          { label: "Charging",     value: stats.charging, color: "#9c4dcc" },
          { label: "Avg Battery",  value: `${stats.avgBatt}%`, color: stats.avgBatt > 40 ? "#69ff47" : "#ff3d3d" },
          { label: "Tasks Queued", value: tasks.filter(t => t.status === "WCS_DISPATCHED").length, color: "#ffb300" },
          { label: "Tasks Done",   value: tasks.filter(t => t.status === "DONE").length, color: "#69ff47" },
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

        {/* Left: Map + Tasks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Warehouse Map */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, padding: 20, overflowX: "auto",
          }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#e040fb", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>
              Live Warehouse Map
            </div>
            <div style={{
              display: "inline-grid",
              gridTemplateColumns: `repeat(${GW}, ${cs}px)`,
              gap: 1, background: "#040810",
              padding: 4, borderRadius: 8,
            }}>
              {grid.map((row, r) => row.map((cell, c) => {
                const meta = CELL_META[cell]
                const amr = amrs.find(a => a.pos[0] === r && a.pos[1] === c)
                const hasTask = tasks.some(t =>
                  (t.status === "ASSIGNED" || t.status === "WCS_DISPATCHED") &&
                  JSON.stringify(t.from) === JSON.stringify([r, c])
                )
                return (
                  <div key={`${r}-${c}`} title={`[${r},${c}] ${meta.label}`} style={{
                    width: cs, height: cs,
                    background: amr ? `${amr.color}15` : meta.color,
                    border: `1px solid ${amr ? amr.color : hasTask ? "#ffd600" : meta.border}`,
                    borderRadius: 2,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: amr ? `0 0 10px ${amr.color}60` : "none",
                    transition: "box-shadow 0.3s",
                    position: "relative",
                  }}>
                    {amr ? (
                      <RobotIcon color={amr.color} size={cs * 0.72}/>
                    ) : cell === "dock" ? (
                      <span style={{ color: "#b36a00", fontSize: cs * 0.38 }}>▼</span>
                    ) : cell === "charge" ? (
                      <span style={{ color: "#9c4dcc", fontSize: cs * 0.38 }}>⚡</span>
                    ) : cell === "pick" ? (
                      <span style={{ color: "#00a86b", fontSize: cs * 0.38 }}>◎</span>
                    ) : cell === "conveyor" ? (
                      <span style={{ color: "#cc4400", fontSize: cs * 0.38 }}>═</span>
                    ) : null}
                    {hasTask && !amr && (
                      <div style={{
                        position: "absolute", top: 2, right: 2,
                        width: 4, height: 4, borderRadius: "50%",
                        background: "#ffd600", boxShadow: "0 0 4px #ffd600",
                      }}/>
                    )}
                  </div>
                )
              }))}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 12 }}>
              {[
                { color: "#0e3a6e", label: "Shelf" },
                { color: "#b36a00", label: "Dock" },
                { color: "#7c28d4", label: "Charge" },
                { color: "#00a86b", label: "Pick Stn" },
                { color: "#cc4400", label: "Conveyor" },
                { color: "#ffd600", label: "Active Task" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 9, height: 9, background: l.color, borderRadius: 2 }}/>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                    {l.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Task Table */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, padding: 20,
          }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#e040fb", letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 }}>
              All Tasks
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {tasks.length === 0 && (
                <div style={{ textAlign: "center", padding: 30, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                  No tasks yet — go to WMS to inject orders
                </div>
              )}
              {[...tasks].reverse().slice(0, 40).map(t => {
                const sc: Record<string, string> = {
                  WMS_QUEUED: "#00e5ff",
                  WCS_DISPATCHED: "#ffb300",
                  ASSIGNED: "#e040fb",
                  DONE: "#69ff47",
                }
                const color = sc[t.status] || "#fff"
                return (
                  <div key={t.id} style={{
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 6, padding: "8px 12px",
                    display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
                  }}>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{t.id}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "#fff" }}>{t.type}</span>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{t.sku}</span>
                    <span style={{
                      background: `${PRI_COL[t.priority]}18`,
                      border: `1px solid ${PRI_COL[t.priority]}45`,
                      borderRadius: 4, padding: "1px 8px",
                      fontFamily: "'Courier New', monospace",
                      fontSize: 9, color: PRI_COL[t.priority],
                    }}>{t.priority}</span>
                    <span style={{
                      background: `${color}18`,
                      border: `1px solid ${color}45`,
                      borderRadius: 4, padding: "1px 8px",
                      fontFamily: "'Courier New', monospace",
                      fontSize: 9, color,
                    }}>{t.status.replace(/_/g, " ")}</span>
                    {t.assignedTo && (
                      <span style={{
                        background: "rgba(224,64,251,0.1)",
                        border: "1px solid rgba(224,64,251,0.3)",
                        borderRadius: 4, padding: "1px 8px",
                        fontFamily: "'Courier New', monospace",
                        fontSize: 9, color: "#e040fb",
                      }}>{t.assignedTo}</span>
                    )}
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>{t.weight}kg</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: Fleet Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Fleet size selector */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#e040fb", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>
              Fleet Size
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setFleetSize(n)} style={{
                  width: 36, height: 32, borderRadius: 6,
                  border: `1px solid ${fleetSize === n ? "#e040fb" : "rgba(255,255,255,0.1)"}`,
                  background: fleetSize === n ? "rgba(224,64,251,0.15)" : "rgba(255,255,255,0.04)",
                  color: fleetSize === n ? "#e040fb" : "rgba(255,255,255,0.35)",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 12, cursor: "pointer",
                }}>{n}</button>
              ))}
            </div>
          </div>

          {/* AMR Cards */}
          {amrs.map(amr => {
            const sc: Record<string, string> = {
              IDLE: "#69ff47",
              EN_ROUTE: "#00e5ff",
              WORKING: "#ffb300",
              CHARGING: "#9c4dcc",
            }
            const statusColor = sc[amr.status] || "#fff"
            const battColor = amr.battery > 50 ? "#69ff47" : amr.battery > 20 ? "#ffb300" : "#ff3d3d"
            const activeTask = tasks.find(t => t.id === amr.taskId)

            return (
              <div key={amr.id} style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderTop: `3px solid ${amr.color}`,
                borderRadius: 12, padding: "16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Professional robot icon */}
                    <div style={{
                      width: 38, height: 38,
                      background: `${amr.color}12`,
                      border: `1px solid ${amr.color}40`,
                      borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <RobotIcon color={amr.color} size={24}/>
                    </div>
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: amr.color }}>{amr.id}</div>
                      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 0.5 }}>{amr.model}</div>
                    </div>
                  </div>
                  <span style={{
                    background: `${statusColor}18`,
                    border: `1px solid ${statusColor}45`,
                    borderRadius: 4, padding: "2px 8px",
                    fontFamily: "'Courier New', monospace",
                    fontSize: 9, color: statusColor,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor, display: "inline-block" }}/>
                    {amr.status.replace("_", " ")}
                  </span>
                </div>

                {/* Battery bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>BATTERY</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: battColor }}>{Math.round(amr.battery)}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${amr.battery}%`, background: battColor, borderRadius: 2, transition: "width 0.6s" }}/>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
                  {[
                    { l: "Position",  v: `[${amr.pos[0]},${amr.pos[1]}]` },
                    { l: "Payload",   v: `${amr.maxPayload}kg` },
                    { l: "Completed", v: amr.completedTasks },
                    { l: "Distance",  v: `${amr.totalDist}m` },
                  ].map(f => (
                    <div key={f.l}>
                      <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 1 }}>{f.l}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{f.v}</div>
                    </div>
                  ))}
                </div>

                {activeTask && (
                  <div style={{ marginTop: 10, background: `${amr.color}12`, border: `1px solid ${amr.color}30`, borderRadius: 6, padding: "6px 10px" }}>
                    <div style={{ fontFamily: "'Courier New', monospace", fontSize: 8, color: amr.color, letterSpacing: 1, marginBottom: 2 }}>ACTIVE TASK</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{activeTask.id} · {activeTask.type} · {activeTask.sku}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}