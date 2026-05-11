"use client"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"

const SKUS = [
  "SKU-1042","SKU-2381","SKU-4917","SKU-3205","SKU-8834",
  "SKU-6612","SKU-7743","SKU-9901","SKU-5523","SKU-4410",
]

interface StoreStation {
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
  waypoint: { row: number; col: number }
}

interface Task {
  id: string
  orderId: string
  type: string
  status: string
  g2pStatus: string
  priority: string
  sku: string
  qty: number
  weight: number
  assignedTo: string | null
  stationId: string | null
  queuePosition: number | null
  pickStartedAt: number | null
}

interface AMR {
  id: string
  color: string
  model: string
  status: string
  phase: string
  battery: number
  row: number
  col: number
  carryingRack: boolean
  rackId: string | null
  taskId: string | null
  stationId: string | null
  queuePosition: number | null
  completedTasks: number
  totalDist: number
}

interface RackSlot {
  id: string
  sku: string
  qty: number
  weight: number
  picked: boolean
}

interface RackLevel {
  level: number
  label: string
  slots: RackSlot[]
}

interface WallSlot {
  id: string
  orderId: string | null
  sku: string | null
  qtyRequired: number
  qtyFilled: number
  filled: boolean
}

function rnd(min: number, max: number) { return Math.floor(min + Math.random() * (max - min)) }

function genRack(task: Task | null): RackLevel[] {
  return [
    { level: 3, label: "TOP" },
    { level: 2, label: "UPPER MID" },
    { level: 1, label: "LOWER MID" },
    { level: 0, label: "BOTTOM" },
  ].map(lv => ({
    ...lv,
    slots: Array.from({ length: 4 }, (_, s) => ({
      id: `L${lv.level}-S${s+1}`,
      sku: lv.level === 0 && s === 0 && task ? task.sku : SKUS[rnd(0,SKUS.length)],
      qty: lv.level === 0 && s === 0 && task ? task.qty : rnd(1,20),
      weight: rnd(1,15),
      picked: false,
    }))
  }))
}

function genWall(task: Task | null): WallSlot[] {
  const rows = ["A","B","C","D"]
  const cols = [1,2,3]
  return rows.flatMap((r, ri) => cols.map((c, ci) => ({
    id: `${r}${c}`,
    orderId: ri===0&&ci===0&&task ? task.orderId : Math.random()>0.4?`ORD-${rnd(1,99).toString().padStart(5,"0")}`:null,
    sku: ri===0&&ci===0&&task ? task.sku : Math.random()>0.4?SKUS[rnd(0,SKUS.length)]:null,
    qtyRequired: ri===0&&ci===0&&task ? task.qty : rnd(1,6),
    qtyFilled: 0,
    filled: false,
  })))
}

const STATION_COLORS: Record<string,string> = {
  S1:"#3b82f6", S2:"#10b981", S3:"#f59e0b", S4:"#8b5cf6"
}

function RobotIcon({ color="#3b82f6", size=20 }: { color?: string; size?: number }) {
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

export default function StationPage() {
  const store = useStore()
  const { stations, tasks, amrs, loginStation, logoutStation, confirmPickComplete, addLog } = store
  const [activeStationId, setActiveStationId] = useState<string>("S1")
  const [rackData, setRackData] = useState<Record<string, RackLevel[]>>({})
  const [wallData, setWallData] = useState<Record<string, WallSlot[]>>({})
  const [selectedSlot, setSelectedSlot] = useState<{ level: number; slot: number } | null>(null)
  const [highlightedWall, setHighlightedWall] = useState<string | null>(null)
  const [pickQty, setPickQty] = useState(1)
  const [pickLog, setPickLog] = useState<{ msg: string; color: string; t: string }[]>([])

  const typedStations = stations as StoreStation[]
  const typedTasks    = tasks    as Task[]
  const typedAmrs     = amrs     as AMR[]

  const station = typedStations.find(s => s.id === activeStationId)!
  const stationColor = STATION_COLORS[activeStationId] || "#3b82f6"

  // Current presenting task + AMR
  const currentTask = station?.currentTaskId
    ? typedTasks.find((t: Task) => t.id === station.currentTaskId) ?? null
    : null
  const presentingAmr = station
    ? typedAmrs.find((a: AMR) => a.stationId === activeStationId && a.phase === "PRESENTING") ?? null
    : null
  const queuedAmrs: AMR[] = station
    ? typedAmrs
        .filter((a: AMR) => a.stationId === activeStationId && (a.phase === "QUEUED" || a.phase === "TO_STATION" || a.phase === "TO_RACK"))
        .sort((a: AMR, b: AMR) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0))
    : []

  // Auto-generate rack+wall when presenting AMR arrives
  useEffect(() => {
    if (presentingAmr && currentTask && !rackData[activeStationId]) {
      setRackData(prev => ({ ...prev, [activeStationId]: genRack(currentTask) }))
      setWallData(prev => ({ ...prev, [activeStationId]: genWall(currentTask) }))
      setSelectedSlot(null)
      setHighlightedWall(null)
      localLog(`Rack presented by ${presentingAmr.id} — ${currentTask.sku}`, "#10b981")
    }
    // Clear rack data when no presenting AMR
    if (!presentingAmr && rackData[activeStationId]) {
      setRackData(prev => { const n={...prev}; delete n[activeStationId]; return n })
      setWallData(prev => { const n={...prev}; delete n[activeStationId]; return n })
    }
  }, [presentingAmr?.id, currentTask?.id, activeStationId])

  const localLog = (msg: string, color: string) => {
    setPickLog(prev => [{ msg, color, t: new Date().toLocaleTimeString("en-AU",{hour12:false}) }, ...prev].slice(0,60))
  }

  const handleLogin = () => { loginStation(activeStationId); localLog(`Logged in at ${activeStationId}`, "#10b981") }
  const handleLogout = () => { logoutStation(activeStationId); localLog(`Logged out from ${activeStationId}`, "#f59e0b") }

  const handleSlotClick = (levelIdx: number, slotIdx: number) => {
    const rack = rackData[activeStationId]
    if (!rack) return
    const slot = rack[levelIdx]?.slots[slotIdx]
    if (!slot || slot.picked) return
    setSelectedSlot({ level: levelIdx, slot: slotIdx })
    const wall = wallData[activeStationId]
    const match = wall?.find(w => w.sku === slot.sku && !w.filled)
    setHighlightedWall(match?.id || null)
    setPickQty(Math.min(slot.qty, match?.qtyRequired || 1))
    localLog(`Selected ${slot.sku} ×${slot.qty} from ${slot.id}`, "#3b82f6")
  }

  const confirmPick = () => {
    if (!selectedSlot || !highlightedWall) return
    const rack = rackData[activeStationId]
    const wall = wallData[activeStationId]
    const slot = rack?.[selectedSlot.level]?.slots[selectedSlot.slot]
    const wSlot = wall?.find(w => w.id === highlightedWall)
    if (!slot || !wSlot) return

    setRackData(prev => ({
      ...prev,
      [activeStationId]: prev[activeStationId].map((lv,li) => ({
        ...lv,
        slots: lv.slots.map((sl,si) =>
          li===selectedSlot.level && si===selectedSlot.slot
            ? { ...sl, qty: sl.qty-pickQty, picked: sl.qty-pickQty<=0 }
            : sl
        )
      }))
    }))
    setWallData(prev => ({
      ...prev,
      [activeStationId]: prev[activeStationId].map(w =>
        w.id===highlightedWall
          ? { ...w, qtyFilled:w.qtyFilled+pickQty, filled:w.qtyFilled+pickQty>=w.qtyRequired }
          : w
      )
    }))

    localLog(`✓ Picked ${slot.sku} ×${pickQty} → Wall ${highlightedWall}`, "#10b981")
    addLog(`Pick: ${slot.sku} ×${pickQty} at ${activeStationId} → ${highlightedWall}`, "#10b981", "STATION")
    setSelectedSlot(null)
    setHighlightedWall(null)
  }

  const handlePickComplete = () => {
    confirmPickComplete(activeStationId)
    localLog(`Rack pick complete — next rack incoming`, "#f59e0b")
    setSelectedSlot(null)
    setHighlightedWall(null)
  }

  const rack = rackData[activeStationId]
  const wall = wallData[activeStationId]
  const pickedCount = rack ? rack.flatMap(l=>l.slots).filter(s=>s.picked).length : 0
  const totalSlots  = rack ? rack.flatMap(l=>l.slots).length : 0
  const allPicked   = rack ? rack.flatMap(l=>l.slots).every(s=>s.picked||s.qty===0) : false

  return (
    <div style={{ background:"#040810", minHeight:"100vh", color:"#fff", display:"flex", flexDirection:"column" }}>

      {/* ── HEADER ── */}
      <div style={{
        background:"#080d1a", borderBottom:"1px solid rgba(255,255,255,0.07)",
        padding:"12px 24px", display:"flex", justifyContent:"space-between",
        alignItems:"center", flexWrap:"wrap", gap:10,
      }}>
        <div>
          <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"#10b981", letterSpacing:3, textTransform:"uppercase", marginBottom:2 }}>
            MyRoboCloud · G2P · Picking Station
          </div>
          <h1 style={{ fontFamily:"monospace", fontSize:20, fontWeight:700, margin:0 }}>
            Station Control — Goods to Person
          </h1>
        </div>

        {/* Station selector */}
        <div style={{ display:"flex", gap:6 }}>
          {typedStations.map(s => {
            const col = STATION_COLORS[s.id]
            const isPresenting = s.status==="PRESENTING"
            const hasQueue = s.amrQueue.length>0
            return (
              <button key={s.id}
                onClick={() => { setActiveStationId(s.id); setSelectedSlot(null); setHighlightedWall(null) }}
                style={{
                  padding:"8px 14px",
                  background:activeStationId===s.id?`${col}20`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${activeStationId===s.id?col:"rgba(255,255,255,0.1)"}`,
                  borderRadius:7, color:activeStationId===s.id?col:"rgba(255,255,255,0.4)",
                  fontFamily:"'Courier New',monospace", fontSize:10, letterSpacing:1, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:6,
                }}>
                <div style={{
                  width:6, height:6, borderRadius:"50%",
                  background:s.loggedIn?(isPresenting?"#10b981":"#f59e0b"):"rgba(255,255,255,0.2)",
                  boxShadow:s.loggedIn?`0 0 6px ${isPresenting?"#10b981":"#f59e0b"}`:"none",
                }}/>
                {s.id}
                {s.loggedIn && <span style={{ fontSize:7, color:"#10b981" }}>●</span>}
                {hasQueue && <span style={{ fontSize:8, background:`${col}30`, borderRadius:3, padding:"0 4px", color:col }}>{s.amrQueue.length}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{ display:"flex", background:"#080d1a", borderBottom:"1px solid rgba(255,255,255,0.05)", overflowX:"auto", flexShrink:0 }}>
        {[
          { label:"Station",     value:station?.label||"—",                                              color:stationColor },
          { label:"Status",      value:station?.loggedIn?(station.status==="PRESENTING"?"PRESENTING":"LOGGED IN"):"LOGGED OUT", color:station?.loggedIn?"#10b981":"#6b7280" },
          { label:"AMR Queue",   value:station?.amrQueue.length||0,                                      color:"#f59e0b" },
          { label:"Tasks Left",  value:station?.taskQueue.length||0,                                     color:"#f97316" },
          { label:"Picks Done",  value:`${station?.picksCompleted||0}/${station?.totalPicks||0}`,        color:"#10b981" },
          { label:"Current Task",value:currentTask?.id||"—",                                             color:currentTask?"#f59e0b":"#6b7280" },
          { label:"Presenting",  value:presentingAmr?.id||"—",                                          color:presentingAmr?presentingAmr.color:"#6b7280" },
          { label:"In Queue",    value:queuedAmrs.length,                                                color:"#8b5cf6" },
        ].map(k => (
          <div key={k.label} style={{ padding:"9px 14px", borderRight:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:3 }}>{k.label}</div>
            <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <div style={{ flex:1, padding:20, overflow:"auto", display:"flex", flexDirection:"column", gap:16 }}>

          {/* ── LOGIN/LOGOUT BAR ── */}
          <div style={{
            background:"#080d1a", border:`1px solid ${stationColor}30`,
            borderRadius:10, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:16, flexWrap:"wrap",
          }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:4 }}>
                OPERATOR STATION — {station?.label}
              </div>
              <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:stationColor }}>
                {station?.loggedIn ? `✓ Logged in — receiving tasks` : "No operator logged in"}
              </div>
              {station?.loggedIn && (
                <div style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:3 }}>
                  {station.amrQueue.length} AMR(s) assigned · {station.taskQueue.length} task(s) in queue
                </div>
              )}
            </div>

            {/* AMR Queue visual */}
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {[0,1,2,3].map(pos => {
                const amrAtPos = typedAmrs.find(a => a.stationId===activeStationId && a.queuePosition===pos)
                const posLabel = pos===0?"PRESENTING":`QUEUE ${pos}`
                return (
                  <div key={pos} style={{
                    width:64, height:64,
                    background:amrAtPos?`${amrAtPos.color}15`:"rgba(255,255,255,0.03)",
                    border:`1.5px ${amrAtPos?"solid":"dashed"} ${amrAtPos?amrAtPos.color:"rgba(255,255,255,0.1)"}`,
                    borderRadius:8,
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                    gap:3,
                  }}>
                    {amrAtPos ? (
                      <>
                        <RobotIcon color={amrAtPos.color} size={22}/>
                        <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:amrAtPos.color, letterSpacing:0.5 }}>
                          {amrAtPos.id}
                        </div>
                        {amrAtPos.carryingRack && (
                          <div style={{ fontFamily:"'Courier New',monospace", fontSize:6, color:"#f59e0b" }}>
                            {amrAtPos.rackId?.replace("RACK-","R-")}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.15)", textAlign:"center" }}>
                        {posLabel}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display:"flex", gap:8 }}>
              {!station?.loggedIn ? (
                <button onClick={handleLogin} style={{
                  padding:"10px 24px", background:"rgba(16,185,129,0.15)",
                  border:"1px solid #10b981", borderRadius:8, color:"#10b981",
                  fontFamily:"'Courier New',monospace", fontSize:11, letterSpacing:1, cursor:"pointer", fontWeight:700,
                }}>
                  ▶ LOGIN TO STATION
                </button>
              ) : (
                <button onClick={handleLogout} style={{
                  padding:"10px 24px", background:"rgba(239,68,68,0.1)",
                  border:"1px solid #ef4444", borderRadius:8, color:"#ef4444",
                  fontFamily:"'Courier New',monospace", fontSize:11, letterSpacing:1, cursor:"pointer",
                }}>
                  ✕ LOGOUT
                </button>
              )}
            </div>
          </div>

          {/* ── WAITING FOR AMR ── */}
          {station?.loggedIn && !presentingAmr && station.taskQueue.length>0 && (
            <div style={{
              background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.2)",
              borderRadius:10, padding:"24px", textAlign:"center",
            }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🤖</div>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:12, color:"#f59e0b", letterSpacing:2, marginBottom:6 }}>
                AMR EN ROUTE — RACK INCOMING
              </div>
              <div style={{ fontFamily:"monospace", fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:16 }}>
                {station.amrQueue.length} AMR(s) heading to this station
              </div>
              {/* Show AMRs heading here */}
              <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                {typedAmrs.filter(a=>a.stationId===activeStationId).map(a=>(
                  <div key={a.id} style={{
                    display:"flex", alignItems:"center", gap:8,
                    background:`${a.color}10`, border:`1px solid ${a.color}40`,
                    borderRadius:8, padding:"8px 14px",
                  }}>
                    <RobotIcon color={a.color} size={18}/>
                    <div>
                      <div style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:a.color }}>{a.id}</div>
                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)" }}>
                        {a.phase?.replace(/_/g," ")} · pos {a.queuePosition}
                      </div>
                    </div>
                    {a.carryingRack && <div style={{ fontSize:16 }}>📦</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── IDLE — NO TASKS ── */}
          {station?.loggedIn && station.taskQueue.length===0 && !presentingAmr && (
            <div style={{
              background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.08)",
              borderRadius:10, padding:"40px", textAlign:"center",
            }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏭</div>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:6 }}>
                STATION ACTIVE — NO TASKS YET
              </div>
              <div style={{ fontFamily:"monospace", fontSize:13, color:"rgba(255,255,255,0.2)" }}>
                Go to WMS → inject orders, then RMS → run automation
              </div>
            </div>
          )}

          {/* ── NOT LOGGED IN ── */}
          {!station?.loggedIn && (
            <div style={{
              background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.08)",
              borderRadius:10, padding:"40px", textAlign:"center",
            }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔐</div>
              <div style={{ fontFamily:"'Courier New',monospace", fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:8 }}>
                NO OPERATOR LOGGED IN
              </div>
              <div style={{ fontFamily:"monospace", fontSize:13, color:"rgba(255,255,255,0.2)", marginBottom:20 }}>
                Click LOGIN TO STATION above to activate this station and receive tasks
              </div>
            </div>
          )}

          {/* ── PICKING UI — AMR PRESENTING ── */}
          {presentingAmr && rack && wall && currentTask && (
            <>
              {/* Presenting AMR info */}
              <div style={{
                background:"#080d1a", border:`1px solid ${presentingAmr.color}30`,
                borderRadius:10, padding:"12px 18px",
                display:"flex", alignItems:"center", gap:14, flexWrap:"wrap",
              }}>
                <div style={{ width:44, height:44, borderRadius:8, background:`${presentingAmr.color}15`, border:`1.5px solid ${presentingAmr.color}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <RobotIcon color={presentingAmr.color} size={28}/>
                </div>
                <div>
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"#10b981", letterSpacing:2, marginBottom:3 }}>AMR PRESENTING RACK</div>
                  <div style={{ fontFamily:"monospace", fontSize:16, fontWeight:700, color:presentingAmr.color }}>{presentingAmr.id}</div>
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)" }}>
                    {presentingAmr.model} · {presentingAmr.rackId}
                  </div>
                </div>
                <div style={{ borderLeft:"1px solid rgba(255,255,255,0.08)", paddingLeft:14 }}>
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", marginBottom:3 }}>TASK</div>
                  <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:"#f59e0b" }}>{currentTask.id}</div>
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)" }}>{currentTask.sku} · ×{currentTask.qty}</div>
                </div>
                <div style={{ flex:1 }}/>

                {/* Queue preview */}
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", marginRight:4 }}>NEXT IN QUEUE:</div>
                  {queuedAmrs.slice(0,3).map(a=>(
                    <div key={a.id} style={{
                      display:"flex", alignItems:"center", gap:5,
                      background:`${a.color}10`, border:`1px solid ${a.color}30`,
                      borderRadius:6, padding:"4px 8px",
                    }}>
                      <RobotIcon color={a.color} size={14}/>
                      <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:a.color }}>{a.id}</span>
                      <span style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.3)" }}>
                        {a.phase==="QUEUED"?"ready":a.phase?.replace(/_/g," ")}
                      </span>
                    </div>
                  ))}
                  {queuedAmrs.length===0 && (
                    <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.2)" }}>No more racks queued</span>
                  )}
                </div>

                {/* Pick progress */}
                <div style={{ minWidth:160 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:1 }}>RACK PROGRESS</span>
                    <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"#10b981" }}>{pickedCount}/{totalSlots}</span>
                  </div>
                  <div style={{ height:5, background:"rgba(255,255,255,0.07)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${totalSlots?(pickedCount/totalSlots)*100:0}%`, background:"#10b981", borderRadius:3, transition:"width 0.4s" }}/>
                  </div>
                </div>

                {/* Complete this rack button */}
                <button onClick={handlePickComplete} style={{
                  padding:"10px 20px",
                  background:allPicked?"rgba(16,185,129,0.2)":"rgba(245,158,11,0.15)",
                  border:`1px solid ${allPicked?"#10b981":"#f59e0b"}`,
                  borderRadius:8, color:allPicked?"#10b981":"#f59e0b",
                  fontFamily:"'Courier New',monospace", fontSize:11, letterSpacing:1,
                  cursor:"pointer", fontWeight:700,
                }}>
                  {allPicked?"✓ RACK DONE — NEXT":"⟵ RELEASE RACK"}
                </button>
              </div>

              {/* Rack + Wall */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

                {/* RACK */}
                <div style={{ background:"#060c18", border:"2px solid #1e3a6e", borderRadius:12, overflow:"hidden" }}>
                  <div style={{ background:"#0d1a2e", borderBottom:"1px solid #1e3a6e", padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:"#3b82f6", boxShadow:"0 0 6px #3b82f6" }}/>
                    <span style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"#3b82f6", letterSpacing:2, textTransform:"uppercase" }}>
                      Rack — {presentingAmr.rackId}
                    </span>
                    <span style={{ marginLeft:"auto", fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.3)" }}>
                      {rack.flatMap(l=>l.slots).filter(s=>!s.picked).length} items remaining
                    </span>
                  </div>
                  {[...rack].reverse().map((level, revIdx) => {
                    const realIdx = rack.length - 1 - revIdx
                    return (
                      <div key={level.level}>
                        <div style={{ background:"#080f1e", padding:"4px 16px", display:"flex", alignItems:"center", gap:6, borderTop:revIdx>0?"1px solid #0d1a2e":"none" }}>
                          <div style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,0.2)" }}/>
                          <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2 }}>{level.label}</span>
                        </div>
                        <div style={{ height:5, background:"linear-gradient(to bottom,#2a3a5a,#1a2a4a)", borderTop:"1px solid #3a5a8a" }}/>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, padding:"10px 14px", background:"rgba(0,0,0,0.15)" }}>
                          {level.slots.map((slot,si) => {
                            const isSel = selectedSlot?.level===realIdx&&selectedSlot?.slot===si
                            const isPicked = slot.picked
                            return (
                              <div key={slot.id}
                                onClick={() => !isPicked&&handleSlotClick(realIdx,si)}
                                style={{
                                  cursor:isPicked?"default":"pointer",
                                  background:isPicked?"rgba(16,185,129,0.06)":isSel?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.04)",
                                  border:`1.5px solid ${isPicked?"#10b981":isSel?"#3b82f6":"rgba(255,255,255,0.1)"}`,
                                  borderRadius:8, padding:"8px 6px", textAlign:"center",
                                  boxShadow:isSel?"0 0 16px rgba(59,130,246,0.5)":"none",
                                  transform:isSel?"translateY(-3px)":"none",
                                  transition:"all 0.15s",
                                }}>
                                <div style={{ fontSize:18, marginBottom:3 }}>{isPicked?"✅":"📦"}</div>
                                <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:isPicked?"#10b981":isSel?"#93c5fd":"rgba(255,255,255,0.4)", marginBottom:2 }}>
                                  {slot.sku.replace("SKU-","")}
                                </div>
                                <div style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:isPicked?"#10b981":isSel?"#fff":"rgba(255,255,255,0.7)" }}>
                                  ×{slot.qty}
                                </div>
                                <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.2)", marginTop:2 }}>{slot.id}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* WALL */}
                <div style={{ background:"#060c18", border:"2px solid #2d1b00", borderRadius:12, overflow:"hidden" }}>
                  <div style={{ background:"#1a0e00", borderBottom:"1px solid #78350f", padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:"#f59e0b", boxShadow:"0 0 6px #f59e0b" }}/>
                    <span style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:"#f59e0b", letterSpacing:2, textTransform:"uppercase" }}>
                      Pick-to-Wall
                    </span>
                    <span style={{ marginLeft:"auto", fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.3)" }}>
                      {wall.filter(w=>w.filled).length}/{wall.filter(w=>w.sku).length} filled
                    </span>
                  </div>
                  <div style={{ padding:"12px 16px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"28px repeat(3,1fr)", gap:6, marginBottom:6 }}>
                      <div/>
                      {[1,2,3].map(c=>(
                        <div key={c} style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.3)", textAlign:"center", letterSpacing:1 }}>COL {c}</div>
                      ))}
                    </div>
                    {["A","B","C","D"].map(row=>(
                      <div key={row} style={{ display:"grid", gridTemplateColumns:"28px repeat(3,1fr)", gap:6, marginBottom:6, alignItems:"center" }}>
                        <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"rgba(255,255,255,0.4)", textAlign:"center" }}>{row}</div>
                        {wall.filter(w=>w.id.startsWith(row)).map(slot=>{
                          const isHL = slot.id===highlightedWall
                          const isFilled = slot.filled
                          const isEmpty = !slot.sku
                          return (
                            <div key={slot.id}
                              onClick={()=>!isEmpty&&!isFilled&&setHighlightedWall(slot.id)}
                              style={{
                                cursor:isEmpty||isFilled?"default":"pointer",
                                background:isFilled?"rgba(16,185,129,0.1)":isHL?"rgba(245,158,11,0.18)":isEmpty?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.04)",
                                border:`1.5px solid ${isFilled?"#10b981":isHL?"#f59e0b":isEmpty?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.1)"}`,
                                borderRadius:8, padding:"10px 6px", textAlign:"center",
                                boxShadow:isHL?"0 0 14px rgba(245,158,11,0.4)":"none",
                                position:"relative", transition:"all 0.15s",
                              }}>
                              <div style={{ position:"absolute", top:3, left:5, fontFamily:"monospace", fontSize:10, fontWeight:700, color:isFilled?"#10b981":isHL?"#f59e0b":"rgba(255,255,255,0.25)" }}>{slot.id}</div>
                              {isHL&&!isFilled&&<div style={{ position:"absolute", top:3, right:5, fontSize:10 }}>👈</div>}
                              {isFilled?(
                                <>
                                  <div style={{ fontSize:18, marginBottom:3, marginTop:8 }}>✅</div>
                                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"#10b981" }}>FILLED</div>
                                  <div style={{ fontFamily:"monospace", fontSize:11, color:"#10b981", marginTop:1 }}>×{slot.qtyFilled}</div>
                                </>
                              ):isEmpty?(
                                <>
                                  <div style={{ fontSize:18, marginBottom:3, marginTop:8, opacity:0.2 }}>□</div>
                                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.15)" }}>EMPTY</div>
                                </>
                              ):(
                                <>
                                  <div style={{ fontSize:18, marginBottom:3, marginTop:8 }}>{isHL?"📥":"📋"}</div>
                                  <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:isHL?"#f59e0b":"rgba(255,255,255,0.4)", marginBottom:2 }}>
                                    {slot.sku?.replace("SKU-","")}
                                  </div>
                                  <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:isHL?"#f59e0b":"rgba(255,255,255,0.7)" }}>×{slot.qtyRequired}</div>
                                  {slot.orderId&&<div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.2)", marginTop:2 }}>{slot.orderId}</div>}
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pick action bar */}
              {selectedSlot!==null&&(()=>{
                const level = rack[selectedSlot.level]
                const slot  = level?.slots[selectedSlot.slot]
                if(!slot) return null
                return (
                  <div style={{
                    background:"#0a1428", border:"1px solid rgba(59,130,246,0.3)",
                    borderRadius:10, padding:"14px 20px",
                    display:"flex", alignItems:"center", gap:16, flexWrap:"wrap",
                  }}>
                    <div>
                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:3 }}>ITEM SELECTED</div>
                      <div style={{ fontFamily:"monospace", fontSize:15, fontWeight:700, color:"#3b82f6" }}>{slot.sku}</div>
                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.4)" }}>From: {slot.id} · {slot.weight}kg</div>
                    </div>
                    <div>
                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:3 }}>WALL TARGET</div>
                      <div style={{ fontFamily:"monospace", fontSize:15, fontWeight:700, color:highlightedWall?"#f59e0b":"rgba(255,255,255,0.2)" }}>
                        {highlightedWall||"— Select wall slot →"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:3 }}>QUANTITY</div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <button onClick={()=>setPickQty(q=>Math.max(1,q-1))} style={{ width:28, height:28, borderRadius:5, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.05)", color:"#fff", cursor:"pointer" }}>−</button>
                        <span style={{ fontFamily:"monospace", fontSize:18, fontWeight:700, color:"#fff", width:30, textAlign:"center" }}>{pickQty}</span>
                        <button onClick={()=>setPickQty(q=>Math.min(slot.qty,q+1))} style={{ width:28, height:28, borderRadius:5, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.05)", color:"#fff", cursor:"pointer" }}>+</button>
                        <span style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:"rgba(255,255,255,0.3)" }}>/ {slot.qty}</span>
                      </div>
                    </div>
                    <div style={{ marginLeft:"auto", display:"flex", gap:10 }}>
                      <button onClick={()=>{setSelectedSlot(null);setHighlightedWall(null)}} style={{ padding:"10px 16px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:7, color:"#ef4444", fontFamily:"'Courier New',monospace", fontSize:11, cursor:"pointer" }}>
                        ✕ CANCEL
                      </button>
                      <button onClick={confirmPick} disabled={!highlightedWall} style={{
                        padding:"10px 24px",
                        background:highlightedWall?"rgba(16,185,129,0.2)":"rgba(255,255,255,0.05)",
                        border:`1px solid ${highlightedWall?"#10b981":"rgba(255,255,255,0.1)"}`,
                        borderRadius:7, color:highlightedWall?"#10b981":"rgba(255,255,255,0.2)",
                        fontFamily:"'Courier New',monospace", fontSize:12, letterSpacing:1,
                        cursor:highlightedWall?"pointer":"not-allowed", fontWeight:700,
                      }}>
                        ✓ CONFIRM PICK
                      </button>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {/* ── RIGHT PANEL — LOG ── */}
        <div style={{
          width:280, flexShrink:0, background:"#080d1a",
          borderLeft:"1px solid rgba(255,255,255,0.07)",
          display:"flex", flexDirection:"column", overflow:"hidden",
        }}>
          {/* All stations summary */}
          <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>All Stations</div>
            {typedStations.map(s=>{
              const col=STATION_COLORS[s.id]
              return (
                <div key={s.id} style={{
                  display:"flex", alignItems:"center", gap:8, marginBottom:8,
                  background:"rgba(255,255,255,0.03)", border:`1px solid ${s.loggedIn?col:"rgba(255,255,255,0.06)"}`,
                  borderRadius:7, padding:"8px 10px",
                }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:s.loggedIn?col:"#374151", flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Courier New',monospace", fontSize:9, color:s.loggedIn?col:"rgba(255,255,255,0.3)", fontWeight:700 }}>{s.id}</div>
                    <div style={{ fontFamily:"'Courier New',monospace", fontSize:7, color:"rgba(255,255,255,0.25)" }}>
                      {s.loggedIn?`${s.amrQueue.length} AMR · ${s.taskQueue.length} tasks`:"IDLE"}
                    </div>
                  </div>
                  {s.loggedIn&&s.amrQueue.length>0&&(
                    <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:col }}>
                      {s.amrQueue.length}🤖
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pick log */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
            <div style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.3)", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>
              Station Log
            </div>
            {pickLog.length===0&&(
              <div style={{ color:"rgba(255,255,255,0.2)", fontSize:11, fontStyle:"italic", textAlign:"center", padding:"24px 0" }}>
                Login to a station to begin
              </div>
            )}
            {pickLog.map((l,i)=>(
              <div key={i} style={{ display:"flex", gap:6, alignItems:"flex-start", marginBottom:6 }}>
                <span style={{ fontFamily:"'Courier New',monospace", fontSize:8, color:"rgba(255,255,255,0.2)", flexShrink:0 }}>{l.t}</span>
                <span style={{ fontFamily:"'Courier New',monospace", fontSize:10, color:l.color, lineHeight:1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}