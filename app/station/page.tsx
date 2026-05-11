"use client"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"

const SKUS = [
  "SKU-1042","SKU-2381","SKU-4917","SKU-3205","SKU-8834",
  "SKU-6612","SKU-7743","SKU-9901","SKU-5523","SKU-4410",
]

interface StoreStation {
  id: string; label: string; side: string
  status: string; loggedIn: boolean
  amrQueue: string[]; taskQueue: string[]
  currentTaskId: string | null
  picksCompleted: number; totalPicks: number
}

interface Task {
  id: string; orderId: string; type: string
  status: string; g2pStatus: string; priority: string
  sku: string; qty: number; weight: number
  assignedTo: string | null; stationId: string | null
  queuePosition: number | null
}

interface AMR {
  id: string; color: string; model: string
  status: string; phase: string; battery: number
  carryingRack: boolean; rackId: string | null
  queuePosition: number | null; stationId: string | null
  taskId: string | null
}

interface RackSlot {
  id: string; sku: string; qty: number
  weight: number; picked: boolean
}

interface RackLevel { level: number; label: string; slots: RackSlot[] }

interface WallSlot {
  id: string; orderId: string | null; sku: string | null
  qtyRequired: number; qtyFilled: number; filled: boolean
}

function rnd(min: number, max: number) { return Math.floor(min + Math.random() * (max - min)) }

function genRack(task: Task | null): RackLevel[] {
  return [
    { level: 3, label: "F5" },
    { level: 2, label: "F4" },
    { level: 1, label: "F3" },
    { level: 0, label: "F2" },
  ].map(lv => ({
    ...lv,
    slots: ["A","B","C","D"].map((col, s) => ({
      id: `${lv.label}${col}`,
      sku: lv.level === 0 && s === 0 && task ? task.sku : SKUS[rnd(0, SKUS.length)],
      qty: lv.level === 0 && s === 0 && task ? task.qty : rnd(1, 20),
      weight: rnd(1, 15),
      picked: false,
    }))
  }))
}

function genWall(task: Task | null): WallSlot[] {
  const rows = ["F1","F2","F3","F4","F5","F6"]
  const cols = ["A","B","C","D"]
  return rows.flatMap((r, ri) => cols.map((c, ci) => ({
    id: `${r}${c}`,
    orderId: ri === 0 && ci === 0 && task ? task.orderId : Math.random() > 0.5 ? `ORD-${rnd(1,99).toString().padStart(5,"0")}` : null,
    sku: ri === 0 && ci === 0 && task ? task.sku : Math.random() > 0.5 ? SKUS[rnd(0,SKUS.length)] : null,
    qtyRequired: ri === 0 && ci === 0 && task ? task.qty : rnd(1,6),
    qtyFilled: 0,
    filled: false,
  })))
}

const AMR_COLORS: Record<string,string> = {
  S1: "#3b82f6", S2: "#10b981", S3: "#f59e0b", S4: "#8b5cf6"
}

export default function StationPage() {
  const { stations, tasks, amrs, loginStation, logoutStation, confirmPickComplete, addLog, updateStationProgress } = useStore()
  const [activeStationId, setActiveStationId] = useState("S1")
  const [rackData, setRackData] = useState<Record<string, RackLevel[]>>({})
  const [wallData, setWallData] = useState<Record<string, WallSlot[]>>({})
  const [selectedSlot, setSelectedSlot] = useState<{level:number;slot:number}|null>(null)
  const [highlightedWall, setHighlightedWall] = useState<string|null>(null)
  const [pickQty, setPickQty] = useState(1)
  const [pickLog, setPickLog] = useState<{msg:string;color:string;t:string}[]>([])
  const [scanInput, setScanInput] = useState("")

  const typedStations = stations as StoreStation[]
  const typedTasks    = tasks    as Task[]
  const typedAmrs     = amrs     as AMR[]

  const station      = typedStations.find(s => s.id === activeStationId)!
  const stationColor = AMR_COLORS[activeStationId] || "#3b82f6"
  const currentTask  = station?.currentTaskId ? typedTasks.find(t => t.id === station.currentTaskId) ?? null : null
  const presentingAmr = station ? typedAmrs.find(a => a.stationId === activeStationId && a.phase === "PRESENTING") ?? null : null
  const queuedAmrs   = station
    ? typedAmrs.filter(a => a.stationId === activeStationId && (a.phase === "QUEUED" || a.phase === "TO_STATION" || a.phase === "TO_RACK"))
        .sort((a,b) => (a.queuePosition??0) - (b.queuePosition??0))
    : []

  // Auto-init rack+wall when AMR arrives
  useEffect(() => {
    if (presentingAmr && currentTask && !rackData[activeStationId]) {
      setRackData(prev => ({ ...prev, [activeStationId]: genRack(currentTask) }))
      setWallData(prev => ({ ...prev, [activeStationId]: genWall(currentTask) }))
      setSelectedSlot(null)
      setHighlightedWall(null)
      localLog(`${presentingAmr.id} docked — rack ${presentingAmr.rackId} presented`, "#10b981")
    }
    if (!presentingAmr && rackData[activeStationId]) {
      setRackData(prev => { const n={...prev}; delete n[activeStationId]; return n })
      setWallData(prev => { const n={...prev}; delete n[activeStationId]; return n })
    }
  }, [presentingAmr?.id, currentTask?.id, activeStationId])

  const localLog = (msg: string, color: string) => {
    setPickLog(prev => [{ msg, color, t: new Date().toLocaleTimeString("en-AU",{hour12:false}) }, ...prev].slice(0,60))
  }

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
  }

  const confirmPick = () => {
    if (!selectedSlot || !highlightedWall) return
    const rack = rackData[activeStationId]
    const wall = wallData[activeStationId]
    const slot  = rack?.[selectedSlot.level]?.slots[selectedSlot.slot]
    const wSlot = wall?.find(w => w.id === highlightedWall)
    if (!slot || !wSlot) return

    setRackData(prev => ({
      ...prev,
      [activeStationId]: prev[activeStationId].map((lv,li) => ({
        ...lv,
        slots: lv.slots.map((sl,si) =>
          li===selectedSlot.level && si===selectedSlot.slot
            ? { ...sl, qty:sl.qty-pickQty, picked:sl.qty-pickQty<=0 }
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

    const filled = (rackData[activeStationId]?.flatMap(l=>l.slots).filter(s=>s.picked).length||0)+1
    updateStationProgress(activeStationId, filled, station.totalPicks||9)
    localLog(`✓ ${slot.sku} ×${pickQty} → Wall ${highlightedWall}`, "#10b981")
    addLog(`Pick: ${slot.sku} ×${pickQty} at ${activeStationId} → ${highlightedWall}`, "#10b981", "STATION")
    setSelectedSlot(null)
    setHighlightedWall(null)
  }

  const handleRelease = () => {
    confirmPickComplete(activeStationId)
    localLog("Rack released — AMR returning to storage", "#f59e0b")
    setRackData(prev => { const n={...prev}; delete n[activeStationId]; return n })
    setWallData(prev => { const n={...prev}; delete n[activeStationId]; return n })
    setSelectedSlot(null)
    setHighlightedWall(null)
  }

  const rack = rackData[activeStationId]
  const wall = wallData[activeStationId]
  const pickedCount = rack ? rack.flatMap(l=>l.slots).filter(s=>s.picked).length : 0
  const totalSlots  = rack ? rack.flatMap(l=>l.slots).length : 0
  const isActive    = !!presentingAmr && !!rack

  const PRI: Record<string,string> = { CRITICAL:"#ef4444",HIGH:"#f97316",MEDIUM:"#f59e0b",LOW:"#94a3b8" }

  return (
    <div style={{ background:"#0f172a", minHeight:"100vh", color:"#e2e8f0", fontFamily:"'DM Sans',sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background:"#1e293b", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"16px 24px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div>
            <p style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569", letterSpacing:3, textTransform:"uppercase", marginBottom:3 }}>
              MyRoboCloud · G2P · Picking Station
            </p>
            <h1 style={{ fontFamily:"'DM Sans',sans-serif", fontSize:20, fontWeight:700, color:"#f1f5f9", margin:0 }}>
              Station Control — Goods to Person
            </h1>
          </div>
          {/* Station tabs */}
          <div style={{ display:"flex", gap:6 }}>
            {typedStations.map(s => {
              const col = AMR_COLORS[s.id]
              const isPresenting = s.status==="PRESENTING"
              const isWaiting    = s.status==="WAITING_AMR"||s.status==="AMR_EN_ROUTE"
              const dotCol = isPresenting?"#10b981":isWaiting?"#f59e0b":s.loggedIn?"#6366f1":"#334155"
              return (
                <button key={s.id}
                  onClick={() => { setActiveStationId(s.id); setSelectedSlot(null); setHighlightedWall(null) }}
                  style={{
                    padding:"7px 14px",
                    background:activeStationId===s.id?`${col}20`:"rgba(255,255,255,0.04)",
                    border:`1px solid ${activeStationId===s.id?col:"rgba(255,255,255,0.08)"}`,
                    borderRadius:8, color:activeStationId===s.id?col:"#475569",
                    fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:activeStationId===s.id?600:400,
                    cursor:"pointer", display:"flex", alignItems:"center", gap:6,
                  }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:dotCol,boxShadow:isPresenting?`0 0 6px ${dotCol}`:"none" }}/>
                  {s.id}
                  {s.amrQueue.length>0 && <span style={{ background:`${col}25`,borderRadius:4,padding:"0 5px",fontSize:10,color:col }}>{s.amrQueue.length}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.06)", overflowX:"auto", background:"#1e293b" }}>
        {[
          { label:"Station",    value:station?.label||"—",                              color:stationColor },
          { label:"Status",     value:station?.loggedIn?(station.status==="PRESENTING"?"PRESENTING":"LOGGED IN"):"LOGGED OUT", color:station?.loggedIn?"#10b981":"#475569" },
          { label:"AMR Queue",  value:station?.amrQueue.length||0,                      color:"#f59e0b" },
          { label:"Tasks Left", value:station?.taskQueue.length||0,                     color:"#f97316" },
          { label:"Picks Done", value:`${station?.picksCompleted||0}/${station?.totalPicks||0}`, color:"#10b981" },
          { label:"Presenting", value:presentingAmr?.id||"—",                           color:presentingAmr?presentingAmr.color:"#334155" },
          { label:"In Queue",   value:queuedAmrs.length,                                color:"#8b5cf6" },
        ].map(k => (
          <div key={k.label} style={{ padding:"10px 18px", borderRight:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:"#475569", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>{k.label}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        <div style={{ flex:1, padding:20, overflow:"auto", display:"flex", flexDirection:"column", gap:14 }}>

          {/* ── LOGIN BAR + AMR QUEUE ── */}
          <div style={{
            background:"#1e293b", border:`1px solid ${stationColor}25`,
            borderRadius:12, padding:"14px 18px",
            display:"flex", alignItems:"center", gap:16, flexWrap:"wrap",
          }}>
            <div style={{ flex:1 }}>
              <p style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#475569", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>
                Operator Station — {station?.label}
              </p>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700, color:station?.loggedIn?"#10b981":"#475569" }}>
                {station?.loggedIn ? `✓ Active — ${station.taskQueue.length} task(s) queued · ${station.amrQueue.length} AMR(s)` : "No operator logged in"}
              </div>
            </div>

            {/* AMR queue slots */}
            <div style={{ display:"flex", gap:8 }}>
              {[0,1,2,3].map(pos => {
                const amrAtPos = typedAmrs.find(a => a.stationId===activeStationId && a.queuePosition===pos)
                const isPresent = pos===0
                return (
                  <div key={pos} style={{
                    width:70, height:70, borderRadius:10,
                    background:amrAtPos?`${amrAtPos.color}15`:"rgba(255,255,255,0.03)",
                    border:`1.5px ${amrAtPos?"solid":"dashed"} ${amrAtPos?amrAtPos.color:"rgba(255,255,255,0.1)"}`,
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3,
                    position:"relative",
                  }}>
                    {isPresent && (
                      <div style={{ position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)", background:"#1e293b", padding:"0 4px" }}>
                        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:amrAtPos?amrAtPos.color:"#334155" }}>PRESENTING</span>
                      </div>
                    )}
                    {amrAtPos ? (
                      <>
                        {/* Mini AMR icon */}
                        <div style={{ width:28, height:28, borderRadius:6, background:`${amrAtPos.color}20`, border:`2px solid ${amrAtPos.color}`, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                          <div style={{ width:12, height:12, border:`2px solid ${amrAtPos.color}`, borderRadius:2 }}/>
                          <div style={{ position:"absolute", top:3, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:amrAtPos.color }}/>
                        </div>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:amrAtPos.color }}>{amrAtPos.id}</div>
                        {amrAtPos.carryingRack && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:6, color:"#f59e0b" }}>📦</div>}
                      </>
                    ) : (
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:"#334155", textAlign:"center" }}>
                        {pos===0?"PRESENTER":`QUEUE ${pos}`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Login/Logout */}
            {!station?.loggedIn ? (
              <button onClick={() => { loginStation(activeStationId); localLog(`Logged in at ${activeStationId}`, "#10b981") }} style={{
                padding:"11px 24px", background:"#10b981",
                border:"none", borderRadius:9, color:"#fff",
                fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700, cursor:"pointer",
                boxShadow:"0 4px 12px rgba(16,185,129,0.3)",
              }}>▶ Login to Station</button>
            ) : (
              <button onClick={() => { logoutStation(activeStationId); localLog(`Logged out from ${activeStationId}`, "#f59e0b") }} style={{
                padding:"11px 24px", background:"rgba(239,68,68,0.12)",
                border:"1px solid rgba(239,68,68,0.3)", borderRadius:9, color:"#ef4444",
                fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:"pointer",
              }}>✕ Logout</button>
            )}
          </div>

          {/* ── WAITING FOR AMR ── */}
          {station?.loggedIn && !presentingAmr && station.taskQueue.length>0 && (
            <div style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:12, padding:"28px", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🤖</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#f59e0b", letterSpacing:2, marginBottom:6 }}>AMR EN ROUTE — RACK INCOMING</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#475569", marginBottom:16 }}>
                {station.amrQueue.length} AMR(s) heading to this station with racks
              </div>
              <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                {typedAmrs.filter(a=>a.stationId===activeStationId).map(a=>(
                  <div key={a.id} style={{ display:"flex", alignItems:"center", gap:8, background:`${a.color}10`, border:`1px solid ${a.color}30`, borderRadius:8, padding:"8px 14px" }}>
                    <div style={{ width:20,height:20,borderRadius:5,background:`${a.color}20`,border:`1.5px solid ${a.color}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <div style={{ width:10,height:10,border:`1.5px solid ${a.color}`,borderRadius:2 }}/>
                    </div>
                    <div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, color:a.color }}>{a.id}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#475569" }}>{a.phase?.replace(/_/g," ")}</div>
                    </div>
                    {a.carryingRack && <span style={{ fontSize:14 }}>📦</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── NO TASKS ── */}
          {station?.loggedIn && station.taskQueue.length===0 && !presentingAmr && (
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.06)", borderRadius:12, padding:"40px", textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🏭</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#334155", letterSpacing:2, marginBottom:6 }}>STATION ACTIVE — NO TASKS YET</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#334155" }}>Go to WMS → inject orders, then RMS → run automation</div>
            </div>
          )}

          {/* ── NOT LOGGED IN ── */}
          {!station?.loggedIn && (
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.06)", borderRadius:12, padding:"40px", textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔐</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#334155", letterSpacing:2, marginBottom:8 }}>NO OPERATOR LOGGED IN</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#334155" }}>Click Login to Station above to activate and receive tasks</div>
            </div>
          )}

          {/* ══ PICKING INTERFACE — shows when AMR presents ══ */}
          {isActive && rack && wall && currentTask && (
            <>
              {/* Top bar — item info + confirm button (like the reference image) */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 280px", gap:12 }}>

                {/* Item to pick */}
                <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"16px 18px" }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569", letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Item to Pick</div>
                  <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                    <div style={{ width:56, height:56, borderRadius:10, background:`${presentingAmr?.color}15`, border:`1px solid ${presentingAmr?.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>📦</div>
                    <div>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:700, color:"#f1f5f9", marginBottom:4 }}>{currentTask.sku}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#475569", marginBottom:2 }}>Order: {currentTask.orderId}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#475569", marginBottom:2 }}>Rack: {presentingAmr?.rackId}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#475569" }}>Weight: {currentTask.weight}kg</div>
                    </div>
                  </div>
                </div>

                {/* Scan / barcode area */}
                <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"16px 18px" }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>
                    Scan Container
                  </div>
                  <input
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    placeholder="Tap here and scan barcode"
                    style={{
                      width:"100%", padding:"10px 12px",
                      background:"rgba(255,255,255,0.04)",
                      border:"1px solid rgba(99,102,241,0.4)",
                      borderRadius:8, color:"#f1f5f9",
                      fontFamily:"'DM Mono',monospace", fontSize:13,
                      outline:"none", boxSizing:"border-box",
                    }}
                  />
                  {selectedSlot !== null && (() => {
                    const slot = rack[selectedSlot.level]?.slots[selectedSlot.slot]
                    if (!slot) return null
                    return (
                      <div style={{ marginTop:10 }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569", letterSpacing:1, marginBottom:4 }}>
                          Scan Container <span style={{ color:"#f97316" }}>0600191395</span> @ Wall Location <span style={{ color:"#f97316" }}>{highlightedWall||"—"}</span>
                        </div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#64748b" }}>
                          After scan — Place {slot.qty} item(s) @ Rack Location {slot.id}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Confirm putaway box */}
                <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"16px 18px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569", letterSpacing:2, textTransform:"uppercase" }}>Confirm Pick</div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <button onClick={() => setPickQty(q => Math.max(1,q-1))} style={{
                      width:36, height:36, borderRadius:"50%",
                      background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
                      color:"#e2e8f0", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center",
                    }}>−</button>
                    <div style={{
                      width:80, height:56, borderRadius:10,
                      background:"rgba(99,102,241,0.15)", border:"2px solid #6366f1",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:"'DM Mono',monospace", fontSize:22, fontWeight:700, color:"#818cf8",
                    }}>
                      {selectedSlot !== null ? `${pickQty}/${rack[selectedSlot.level]?.slots[selectedSlot.slot]?.qty||0}` : "—"}
                    </div>
                    <button onClick={() => {
                      if (selectedSlot === null) return
                      const max = rack[selectedSlot.level]?.slots[selectedSlot.slot]?.qty||1
                      setPickQty(q => Math.min(max,q+1))
                    }} style={{
                      width:36, height:36, borderRadius:"50%",
                      background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
                      color:"#e2e8f0", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center",
                    }}>+</button>
                  </div>
                  <button onClick={confirmPick} disabled={!selectedSlot||!highlightedWall} style={{
                    width:"100%", padding:"10px",
                    background:selectedSlot&&highlightedWall?"#6366f1":"rgba(255,255,255,0.05)",
                    border:"none", borderRadius:8,
                    color:selectedSlot&&highlightedWall?"#fff":"#334155",
                    fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:700,
                    cursor:selectedSlot&&highlightedWall?"pointer":"not-allowed",
                    boxShadow:selectedSlot&&highlightedWall?"0 4px 12px rgba(99,102,241,0.3)":"none",
                  }}>
                    ✓ Confirm Pick
                  </button>
                </div>
              </div>

              {/* ══ WALL (left) + RACK (right) — matching reference image layout ══ */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:16 }}>

                {/* WALL — left, like reference image */}
                <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, overflow:"hidden" }}>
                  <div style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:8,height:8,borderRadius:"50%",background:"#f59e0b",boxShadow:"0 0 6px #f59e0b" }}/>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#f59e0b", letterSpacing:2, textTransform:"uppercase" }}>Wall — Pick to Wall</span>
                    </div>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569" }}>
                      {wall.filter(w=>w.filled).length}/{wall.filter(w=>w.sku).length} filled
                    </span>
                  </div>

                  {/* Wall grid — mimicking reference image layout */}
                  <div style={{ padding:"16px" }}>
                    {/* Column headers */}
                    <div style={{ display:"grid", gridTemplateColumns:"36px repeat(4,1fr)", gap:6, marginBottom:6 }}>
                      <div/>
                      {["A","B","C","D"].map(c => (
                        <div key={c} style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569", textAlign:"center", letterSpacing:1 }}>{c}</div>
                      ))}
                    </div>

                    {/* Rows */}
                    {["F6","F5","F4","F3","F2","F1"].map(row => (
                      <div key={row} style={{ display:"grid", gridTemplateColumns:"36px repeat(4,1fr)", gap:6, marginBottom:6, alignItems:"center" }}>
                        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, fontWeight:600, color:"#64748b", textAlign:"center" }}>{row}</div>
                        {wall.filter(w => w.id.startsWith(row)).map(slot => {
                          const isHL    = slot.id === highlightedWall
                          const isFilled = slot.filled
                          const isEmpty  = !slot.sku
                          return (
                            <div key={slot.id}
                              onClick={() => !isEmpty && !isFilled && setHighlightedWall(slot.id)}
                              style={{
                                cursor: isEmpty||isFilled?"default":"pointer",
                                background: isFilled?"rgba(16,185,129,0.12)":isHL?"rgba(245,158,11,0.15)":isEmpty?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.04)",
                                border: `1.5px solid ${isFilled?"#10b981":isHL?"#f59e0b":isEmpty?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.08)"}`,
                                borderRadius:8, padding:"8px 4px", textAlign:"center",
                                boxShadow: isHL?"0 0 12px rgba(245,158,11,0.3)":"none",
                                transition:"all 0.15s", position:"relative",
                                minHeight:56,
                              }}>
                              <div style={{ position:"absolute", top:3, left:4, fontFamily:"'DM Mono',monospace", fontSize:8, fontWeight:600, color:isFilled?"#10b981":isHL?"#f59e0b":"#475569" }}>{slot.id}</div>
                              {isHL && !isFilled && <div style={{ position:"absolute", top:3, right:4, fontSize:9 }}>👈</div>}
                              <div style={{ marginTop:12 }}>
                                {isFilled ? (
                                  <>
                                    <div style={{ fontSize:14, marginBottom:2 }}>✅</div>
                                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:"#10b981" }}>×{slot.qtyFilled}</div>
                                  </>
                                ) : isEmpty ? (
                                  <div style={{ fontSize:14, opacity:0.2 }}>□</div>
                                ) : (
                                  <>
                                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:isHL?"#f59e0b":"#64748b", marginBottom:1 }}>{slot.sku?.replace("SKU-","")}</div>
                                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, fontWeight:700, color:isHL?"#f59e0b":"#94a3b8" }}>×{slot.qtyRequired}</div>
                                    {slot.orderId && <div style={{ fontFamily:"'DM Mono',monospace", fontSize:6, color:"#334155", marginTop:1 }}>{slot.orderId.replace("ORD-","O-")}</div>}
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* RACK — right, like reference image shelf view */}
                <div style={{ background:"#1e293b", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, overflow:"hidden" }}>
                  <div style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:8,height:8,borderRadius:"50%",background:"#3b82f6",boxShadow:"0 0 6px #3b82f6" }}/>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#3b82f6", letterSpacing:2, textTransform:"uppercase" }}>Rack — {presentingAmr?.rackId}</span>
                    </div>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#475569" }}>
                      {rack.flatMap(l=>l.slots).filter(s=>!s.picked).length} left
                    </span>
                  </div>

                  {/* Rack shelf — each level is a shelf row like the reference image */}
                  <div style={{ padding:"12px" }}>
                    {[...rack].reverse().map((level, revIdx) => {
                      const realIdx = rack.length - 1 - revIdx
                      return (
                        <div key={level.level} style={{ marginBottom:8 }}>
                          {/* Shelf label */}
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#475569", letterSpacing:1, marginBottom:4, paddingLeft:2 }}>
                            {level.label}
                          </div>
                          {/* Slots in a row */}
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4 }}>
                            {level.slots.map((slot, slotIdx) => {
                              const isSel    = selectedSlot?.level===realIdx && selectedSlot?.slot===slotIdx
                              const isPicked = slot.picked
                              return (
                                <div key={slot.id}
                                  onClick={() => !isPicked && handleSlotClick(realIdx, slotIdx)}
                                  style={{
                                    cursor:isPicked?"default":"pointer",
                                    background:isPicked?"rgba(16,185,129,0.08)":isSel?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.04)",
                                    border:`1.5px solid ${isPicked?"#10b981":isSel?"#3b82f6":"rgba(255,255,255,0.08)"}`,
                                    borderRadius:7, padding:"8px 4px", textAlign:"center",
                                    boxShadow:isSel?"0 0 14px rgba(59,130,246,0.4)":"none",
                                    transform:isSel?"translateY(-2px)":"none",
                                    transition:"all 0.15s",
                                    minHeight:60,
                                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2,
                                  }}>
                                  {/* Slot ID */}
                                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:isPicked?"#10b981":isSel?"#93c5fd":"#475569", fontWeight:600 }}>{slot.id}</div>
                                  {/* Box icon */}
                                  <div style={{ fontSize:16 }}>{isPicked?"✅":"📦"}</div>
                                  {/* SKU */}
                                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:isPicked?"#10b981":isSel?"#93c5fd":"#64748b" }}>
                                    {slot.sku.replace("SKU-","")}
                                  </div>
                                  {/* Qty */}
                                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:700, color:isPicked?"#10b981":isSel?"#fff":"#94a3b8" }}>
                                    ×{slot.qty}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {/* Shelf bar */}
                          <div style={{ height:6, background:"rgba(100,116,139,0.25)", borderRadius:"0 0 3px 3px", marginTop:2, border:"1px solid rgba(255,255,255,0.05)" }}/>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Release button */}
              <button onClick={handleRelease} style={{
                width:"100%", padding:"12px",
                background:"rgba(245,158,11,0.1)",
                border:"1px solid rgba(245,158,11,0.3)",
                borderRadius:10, color:"#f59e0b",
                fontFamily:"'DM Sans',sans-serif", fontSize:13, fontWeight:600,
                cursor:"pointer",
              }}>
                ⟵ Release AMR — Send Rack Back to Storage
              </button>
            </>
          )}
        </div>

        {/* ── RIGHT LOG PANEL ── */}
        <div style={{ width:260, flexShrink:0, background:"#1e293b", borderLeft:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* All stations summary */}
          <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#475569", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>All Stations</div>
            {typedStations.map(s => {
              const col = AMR_COLORS[s.id]
              return (
                <div key={s.id} style={{
                  display:"flex", alignItems:"center", gap:8, marginBottom:8,
                  background:"rgba(255,255,255,0.03)",
                  border:`1px solid ${s.loggedIn?col+"30":"rgba(255,255,255,0.06)"}`,
                  borderRadius:7, padding:"8px 10px",
                }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:s.loggedIn?col:"#334155",flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:s.loggedIn?col:"#475569", fontWeight:600 }}>{s.id}</div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:7, color:"#334155" }}>
                      {s.loggedIn?`${s.amrQueue.length} AMR · ${s.taskQueue.length} tasks`:"IDLE"}
                    </div>
                  </div>
                  {s.loggedIn&&s.amrQueue.length>0&&(
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:col }}>{s.amrQueue.length}🤖</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pick log */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#475569", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Station Log</div>
            {pickLog.length===0 && (
              <div style={{ color:"#334155", fontSize:11, textAlign:"center", padding:"20px 0" }}>Login to a station to begin</div>
            )}
            {pickLog.map((l,i) => (
              <div key={i} style={{ display:"flex", gap:6, alignItems:"flex-start", marginBottom:6 }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:8, color:"#334155", flexShrink:0 }}>{l.t}</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:l.color, lineHeight:1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}