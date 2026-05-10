"use client"
import { useState } from "react"
import { useStore } from "@/lib/store"

interface StoreStation {
  id: string
  label: string
  side: string
  status: string
  amrId: string | null
  taskId: string | null
  pickProgress: number
  totalItems: number
}

interface Task {
  id: string
  type: string
  status: string
  g2pStatus: string
  priority: string
  sku: string
  qty: number
  weight: number
  assignedTo: string | null
  stationId: string | null
  from?: number[]
  orderId?: string
}

interface AMR {
  id: string
  color: string
  model: string
  status: string
  battery: number
  carryingRack: boolean
  rackId: string | null
}

interface RackSlot {
  id: string
  sku: string
  qty: number
  weight: number
  picked: boolean
}

interface RackShelf {
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

interface PickedItem {
  sku: string
  qty: number
  from: string
  to: string
  timestamp: number
}

interface LocalStation {
  id: string
  rack: RackShelf[]
  wall: WallSlot[]
  pickedItems: PickedItem[]
}

const SKUS = [
  "SKU-1042","SKU-2381","SKU-4917","SKU-3205","SKU-8834",
  "SKU-6612","SKU-7743","SKU-9901","SKU-5523","SKU-4410",
  "SKU-3317","SKU-8821","SKU-1195","SKU-6634","SKU-2278",
]

const ORDERS = ["ORD-00001","ORD-00002","ORD-00003","ORD-00004","ORD-00005"]

function rnd(min: number, max: number) { return Math.floor(min + Math.random() * (max - min)) }

function generateRack(task?: Task): RackShelf[] {
  const levels = [
    { level: 3, label: "TOP" },
    { level: 2, label: "UPPER MID" },
    { level: 1, label: "LOWER MID" },
    { level: 0, label: "BOTTOM" },
  ]
  return levels.map(lv => ({
    level: lv.level,
    label: lv.label,
    slots: Array.from({ length: 4 }, (_, s) => ({
      id: `L${lv.level}-S${s + 1}`,
      sku: lv.level === 0 && s === 0 && task ? task.sku : SKUS[rnd(0, SKUS.length)],
      qty: lv.level === 0 && s === 0 && task ? task.qty : rnd(2, 25),
      weight: rnd(1, 20),
      picked: false,
    }))
  }))
}

function generateWall(task?: Task): WallSlot[] {
  const rows = ["A","B","C","D"]
  const cols = [1,2,3]
  const slots: WallSlot[] = []
  rows.forEach((r, ri) => cols.forEach((c, ci) => {
    const isTarget = ri === 0 && ci === 0 && task
    slots.push({
      id: `${r}${c}`,
      orderId: isTarget ? task.orderId || ORDERS[rnd(0,ORDERS.length)] : Math.random() > 0.4 ? ORDERS[rnd(0,ORDERS.length)] : null,
      sku: isTarget ? task.sku : Math.random() > 0.4 ? SKUS[rnd(0,SKUS.length)] : null,
      qtyRequired: isTarget ? task.qty : rnd(1, 6),
      qtyFilled: 0,
      filled: false,
    })
  }))
  return slots
}

const AMR_COLORS: Record<string,string> = {
  "S1": "#3b82f6", "S2": "#10b981", "S3": "#f59e0b", "S4": "#8b5cf6"
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
  const { stations, tasks, amrs, markPickingDone, updateStationProgress, addLog } = useStore()
  const [activeStationId, setActiveStationId] = useState("S1")
  const [localStations, setLocalStations] = useState<Record<string, LocalStation>>({})
  const [selectedSlot, setSelectedSlot] = useState<{ shelf: number; slot: number } | null>(null)
  const [highlightedWall, setHighlightedWall] = useState<string | null>(null)
  const [pickQty, setPickQty] = useState(1)
  const [log, setLog] = useState<{ msg: string; color: string; t: string }[]>([])

  const storeStations = stations as StoreStation[]
  const typedTasks = tasks as Task[]
  const typedAmrs = amrs as AMR[]

  const storeStation = storeStations.find(s => s.id === activeStationId)!
  const local = localStations[activeStationId]
  const stationColor = AMR_COLORS[activeStationId] || "#3b82f6"
  const amr = typedAmrs.find(a => a.id === storeStation?.amrId)
  const task = typedTasks.find(t => t.id === storeStation?.taskId)
  const isActive = storeStation?.status === "ACTIVE"
  const isWaiting = storeStation?.status === "WAITING_AMR" || storeStation?.status === "AMR_EN_ROUTE"

  const addLocalLog = (msg: string, color: string) => {
    setLog(prev => [{ msg, color, t: new Date().toLocaleTimeString("en-AU", { hour12: false }) }, ...prev].slice(0, 60))
  }

  // When AMR arrives (status becomes ACTIVE), auto-generate rack and wall
  const initStation = (stationId: string) => {
    const station = storeStations.find(s => s.id === stationId)
    const t = typedTasks.find(tk => tk.id === station?.taskId)
    const rack = generateRack(t)
    const wall = generateWall(t)
    const totalItems = wall.filter(w => w.sku).length
    setLocalStations(prev => ({ ...prev, [stationId]: { id: stationId, rack, wall, pickedItems: [] } }))
    updateStationProgress(stationId, 0, totalItems)
    addLocalLog(`Station ${stationId} ready — ${totalItems} items to pick`, "#10b981")
  }

  // Auto-init when station becomes active
  if (isActive && !local) {
    initStation(activeStationId)
  }

  const handleSlotClick = (shelfIdx: number, slotIdx: number) => {
    if (!local) return
    setSelectedSlot({ shelf: shelfIdx, slot: slotIdx })
    const slot = local.rack[shelfIdx]?.slots[slotIdx]
    if (!slot) return
    const matchingWall = local.wall.find(w => w.sku === slot.sku && !w.filled)
    setHighlightedWall(matchingWall?.id || null)
    setPickQty(Math.min(slot.qty, matchingWall?.qtyRequired || 1))
    addLocalLog(`Selected ${slot.sku} ×${slot.qty} from ${slot.id}`, "#3b82f6")
  }

  const confirmPick = () => {
    if (!selectedSlot || !highlightedWall || !local) return
    const shelf = local.rack[selectedSlot.shelf]
    const slot = shelf?.slots[selectedSlot.slot]
    const wallSlot = local.wall.find(w => w.id === highlightedWall)
    if (!slot || !wallSlot) return

    const pickedItem: PickedItem = { sku: slot.sku, qty: pickQty, from: slot.id, to: highlightedWall, timestamp: Date.now() }
    const newItems = [...local.pickedItems, pickedItem]
    const filled = newItems.length

    setLocalStations(prev => ({
      ...prev,
      [activeStationId]: {
        ...local,
        rack: local.rack.map((sh, si) => ({
          ...sh,
          slots: sh.slots.map((sl, li) =>
            si === selectedSlot.shelf && li === selectedSlot.slot
              ? { ...sl, qty: sl.qty - pickQty, picked: sl.qty - pickQty <= 0 }
              : sl
          )
        })),
        wall: local.wall.map(w =>
          w.id === highlightedWall
            ? { ...w, qtyFilled: w.qtyFilled + pickQty, filled: w.qtyFilled + pickQty >= w.qtyRequired }
            : w
        ),
        pickedItems: newItems,
      }
    }))

    updateStationProgress(activeStationId, filled, storeStation.totalItems || 9)
    addLocalLog(`✓ Picked ${slot.sku} ×${pickQty} → Wall ${highlightedWall}`, "#10b981")
    addLog(`Pick: ${slot.sku} ×${pickQty} at ${activeStationId} → ${highlightedWall}`, "#10b981", "STATION")

    setSelectedSlot(null)
    setHighlightedWall(null)
  }

  const handleRelease = () => {
    markPickingDone(activeStationId)
    addLocalLog(`AMR released — returning rack to storage`, "#f59e0b")
    setLocalStations(prev => { const n = { ...prev }; delete n[activeStationId]; return n })
    setSelectedSlot(null)
    setHighlightedWall(null)
  }

  const pickedCount = local?.pickedItems.length || 0
  const totalSlots = local?.wall.filter(w => w.sku).length || 0

  return (
    <div style={{ background: "#040810", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{
        background: "#080d1a", borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "12px 24px", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#10b981", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
            MyRoboCloud · G2P · Picking Interface
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, margin: 0 }}>
            Station Control — Pick & Induct
          </h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {storeStations.map(s => {
            const isAct = s.status === "ACTIVE"
            const isWait = s.status === "WAITING_AMR" || s.status === "AMR_EN_ROUTE"
            const col = isAct ? "#10b981" : isWait ? "#f59e0b" : AMR_COLORS[s.id]
            return (
              <button key={s.id}
                onClick={() => { setActiveStationId(s.id); setSelectedSlot(null); setHighlightedWall(null) }}
                style={{
                  padding: "8px 14px",
                  background: activeStationId === s.id ? `${col}20` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${activeStationId === s.id ? col : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 7, color: activeStationId === s.id ? col : "rgba(255,255,255,0.4)",
                  fontFamily: "'Courier New',monospace", fontSize: 10, letterSpacing: 1, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: isAct ? "#10b981" : isWait ? "#f59e0b" : "rgba(255,255,255,0.2)", boxShadow: isAct ? "0 0 6px #10b981" : "none" }}/>
                {s.id}
                {s.amrId && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>{s.amrId}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", background: "#080d1a", borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "auto", flexShrink: 0 }}>
        {[
          { label: "Station",     value: storeStation?.label || "—",                          color: stationColor },
          { label: "Status",      value: storeStation?.status?.replace(/_/g," ") || "IDLE",   color: isActive ? "#10b981" : isWaiting ? "#f59e0b" : "#6b7280" },
          { label: "AMR Docked",  value: storeStation?.amrId || "—",                          color: storeStation?.amrId ? "#10b981" : "#6b7280" },
          { label: "Task",        value: task?.id || "—",                                     color: task ? "#f59e0b" : "#6b7280" },
          { label: "SKU",         value: task?.sku || "—",                                    color: "#fff" },
          { label: "Picks Done",  value: `${pickedCount}/${totalSlots}`,                      color: "#10b981" },
          { label: "G2P Flow",    value: task?.g2pStatus?.replace(/_/g," ") || "—",           color: "#8b5cf6" },
        ].map(k => (
          <div key={k.label} style={{ padding: "10px 16px", borderRight: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: 20, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* AMR status bar */}
          {isActive && amr ? (
            <div style={{
              background: "#080d1a", border: `1px solid ${amr.color}30`,
              borderRadius: 10, padding: "14px 20px",
              display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: `${amr.color}15`, border: `1px solid ${amr.color}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RobotIcon color={amr.color} size={28}/>
              </div>
              <div>
                <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#10b981", letterSpacing: 2, marginBottom: 3 }}>AMR DOCKED — RACK PRESENTED</div>
                <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: amr.color }}>{amr.id}</div>
                <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{amr.model} · {amr.rackId || "RACK-AUTO"}</div>
              </div>
              <div style={{ flex: 1 }}/>
              {/* Pick progress */}
              <div style={{ minWidth: 200 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>PICK PROGRESS</span>
                  <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#10b981" }}>{pickedCount}/{totalSlots}</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${totalSlots ? (pickedCount/totalSlots)*100 : 0}%`, background: "#10b981", borderRadius: 3, transition: "width 0.4s" }}/>
                </div>
              </div>
              <button onClick={handleRelease} style={{
                padding: "10px 20px", background: "rgba(245,158,11,0.15)",
                border: "1px solid #f59e0b", borderRadius: 8, color: "#f59e0b",
                fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: 1, cursor: "pointer",
              }}>
                ⟵ RELEASE AMR
              </button>
            </div>
          ) : isWaiting ? (
            <div style={{
              background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 10, padding: "24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 11, color: "#f59e0b", letterSpacing: 2, marginBottom: 4 }}>
                AMR EN ROUTE TO STATION
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                {storeStation?.amrId} is carrying a rack to this station...
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", opacity: 0.3 + (i % 3) * 0.35 }}/>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "32px", textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏭</div>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 6 }}>
                STATION IDLE — WAITING FOR AMR
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
                Go to WMS → inject orders, then WCS → process, then RMS → run automation
              </div>
            </div>
          )}

          {/* Rack + Wall */}
          {isActive && local && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                {/* RACK */}
                <div style={{ background: "#060c18", border: "2px solid #1e3a6e", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: "#0d1a2e", borderBottom: "1px solid #1e3a6e", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 6px #3b82f6" }}/>
                    <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "#3b82f6", letterSpacing: 2, textTransform: "uppercase" }}>Rack — {amr?.id}</span>
                    <span style={{ marginLeft: "auto", fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                      {local.rack.reduce((s, sh) => s + sh.slots.filter(sl => !sl.picked).length, 0)} items left
                    </span>
                  </div>
                  {[...local.rack].reverse().map((shelf, revIdx) => {
                    const realIdx = local.rack.length - 1 - revIdx
                    return (
                      <div key={shelf.level}>
                        <div style={{ background: "#080f1e", padding: "4px 16px", display: "flex", alignItems: "center", gap: 6, borderTop: revIdx > 0 ? "1px solid #0d1a2e" : "none" }}>
                          <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }}/>
                          <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>{shelf.label}</span>
                        </div>
                        <div style={{ height: 5, background: "linear-gradient(to bottom, #2a3a5a, #1a2a4a)", borderTop: "1px solid #3a5a8a" }}/>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, padding: "10px 14px", background: "rgba(0,0,0,0.15)" }}>
                          {shelf.slots.map((slot, slotIdx) => {
                            const isSelected = selectedSlot?.shelf === realIdx && selectedSlot?.slot === slotIdx
                            const isPicked = slot.picked
                            return (
                              <div key={slot.id}
                                onClick={() => !isPicked && handleSlotClick(realIdx, slotIdx)}
                                style={{
                                  cursor: isPicked ? "default" : "pointer",
                                  background: isPicked ? "rgba(16,185,129,0.06)" : isSelected ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                                  border: `1.5px solid ${isPicked ? "#10b981" : isSelected ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                                  borderRadius: 8, padding: "8px 6px", textAlign: "center",
                                  boxShadow: isSelected ? "0 0 16px rgba(59,130,246,0.5)" : "none",
                                  transform: isSelected ? "translateY(-3px)" : "none",
                                  transition: "all 0.15s",
                                }}>
                                <div style={{ fontSize: 18, marginBottom: 3 }}>{isPicked ? "✅" : "📦"}</div>
                                <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: isPicked ? "#10b981" : isSelected ? "#93c5fd" : "rgba(255,255,255,0.4)", marginBottom: 3 }}>
                                  {slot.sku.replace("SKU-","")}
                                </div>
                                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: isPicked ? "#10b981" : isSelected ? "#fff" : "rgba(255,255,255,0.7)" }}>
                                  ×{slot.qty}
                                </div>
                                <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{slot.id}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* WALL */}
                <div style={{ background: "#060c18", border: "2px solid #2d1b00", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: "#1a0e00", borderBottom: "1px solid #78350f", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b" }}/>
                    <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase" }}>Pick-to-Wall</span>
                    <span style={{ marginLeft: "auto", fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                      {local.wall.filter(w => w.filled).length}/{local.wall.filter(w => w.sku).length} filled
                    </span>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "28px repeat(3,1fr)", gap: 6, marginBottom: 6 }}>
                      <div/>
                      {[1,2,3].map(c => (
                        <div key={c} style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", letterSpacing: 1 }}>COL {c}</div>
                      ))}
                    </div>
                    {["A","B","C","D"].map(row => (
                      <div key={row} style={{ display: "grid", gridTemplateColumns: "28px repeat(3,1fr)", gap: 6, marginBottom: 6, alignItems: "center" }}>
                        <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>{row}</div>
                        {local.wall.filter(w => w.id.startsWith(row)).map(slot => {
                          const isHL = slot.id === highlightedWall
                          const isFilled = slot.filled
                          const isEmpty = !slot.sku
                          return (
                            <div key={slot.id}
                              onClick={() => !isEmpty && !isFilled && setHighlightedWall(slot.id)}
                              style={{
                                cursor: isEmpty || isFilled ? "default" : "pointer",
                                background: isFilled ? "rgba(16,185,129,0.1)" : isHL ? "rgba(245,158,11,0.18)" : isEmpty ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                                border: `1.5px solid ${isFilled ? "#10b981" : isHL ? "#f59e0b" : isEmpty ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)"}`,
                                borderRadius: 8, padding: "10px 6px", textAlign: "center",
                                boxShadow: isHL ? "0 0 14px rgba(245,158,11,0.4)" : "none",
                                position: "relative", transition: "all 0.15s",
                              }}>
                              <div style={{ position: "absolute", top: 3, left: 5, fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: isFilled ? "#10b981" : isHL ? "#f59e0b" : "rgba(255,255,255,0.25)" }}>{slot.id}</div>
                              {isHL && !isFilled && <div style={{ position: "absolute", top: 3, right: 5, fontSize: 10 }}>👈</div>}
                              {isFilled ? (
                                <>
                                  <div style={{ fontSize: 18, marginBottom: 3, marginTop: 8 }}>✅</div>
                                  <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "#10b981" }}>FILLED</div>
                                  <div style={{ fontFamily: "monospace", fontSize: 11, color: "#10b981", marginTop: 1 }}>×{slot.qtyFilled}</div>
                                </>
                              ) : isEmpty ? (
                                <>
                                  <div style={{ fontSize: 16, marginBottom: 3, marginTop: 8, opacity: 0.2 }}>□</div>
                                  <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.15)" }}>EMPTY</div>
                                </>
                              ) : (
                                <>
                                  <div style={{ fontSize: 18, marginBottom: 3, marginTop: 8 }}>{isHL ? "📥" : "📋"}</div>
                                  <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: isHL ? "#f59e0b" : "rgba(255,255,255,0.4)", marginBottom: 2 }}>{slot.sku?.replace("SKU-","")}</div>
                                  <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: isHL ? "#f59e0b" : "rgba(255,255,255,0.7)" }}>×{slot.qtyRequired}</div>
                                  {slot.orderId && <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{slot.orderId}</div>}
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
              {selectedSlot !== null && (() => {
                const shelf = local.rack[selectedSlot.shelf]
                const slot = shelf?.slots[selectedSlot.slot]
                if (!slot) return null
                return (
                  <div style={{
                    background: "#0a1428", border: "1px solid rgba(59,130,246,0.3)",
                    borderRadius: 10, padding: "16px 20px",
                    display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>ITEM SELECTED</div>
                      <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#3b82f6" }}>{slot.sku}</div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>From: {slot.id} · {slot.weight}kg each</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>WALL TARGET</div>
                      <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: highlightedWall ? "#f59e0b" : "rgba(255,255,255,0.2)" }}>
                        {highlightedWall || "— Select wall slot →"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>QUANTITY</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => setPickQty(q => Math.max(1, q-1))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer" }}>−</button>
                        <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#fff", width: 30, textAlign: "center" }}>{pickQty}</span>
                        <button onClick={() => setPickQty(q => Math.min(slot.qty, q+1))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer" }}>+</button>
                        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>/ {slot.qty}</span>
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                      <button onClick={() => { setSelectedSlot(null); setHighlightedWall(null) }} style={{ padding: "10px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, color: "#ef4444", fontFamily: "'Courier New',monospace", fontSize: 11, cursor: "pointer" }}>
                        ✕ CANCEL
                      </button>
                      <button onClick={confirmPick} disabled={!highlightedWall} style={{
                        padding: "10px 24px",
                        background: highlightedWall ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${highlightedWall ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 7, color: highlightedWall ? "#10b981" : "rgba(255,255,255,0.2)",
                        fontFamily: "'Courier New',monospace", fontSize: 12, letterSpacing: 1,
                        cursor: highlightedWall ? "pointer" : "not-allowed", fontWeight: 700,
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

        {/* Right panel — log + history */}
        <div style={{
          width: 280, flexShrink: 0, background: "#080d1a",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
              Pick History
            </div>
            {(!local || local.pickedItems.length === 0) && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>No picks yet</div>
            )}
            {local?.pickedItems.map((item, i) => (
              <div key={i} style={{
                background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)",
                borderRadius: 7, padding: "8px 10px", marginBottom: 6,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{ fontSize: 16 }}>📦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#fff" }}>{item.sku}</div>
                  <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    ×{item.qty} · {item.from} → Wall {item.to}
                  </div>
                </div>
                <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#10b981" }}>✓</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px", maxHeight: 220, overflowY: "auto" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Station Log</div>
            {log.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>No events yet</div>}
            {log.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>{l.t}</span>
                <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: l.color, lineHeight: 1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}