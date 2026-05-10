"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"

// ── TYPES ──
interface RackShelf {
  level: number
  label: string
  slots: RackSlot[]
}

interface RackSlot {
  id: string
  sku: string
  qty: number
  weight: number
  picked: boolean
  selected: boolean
}

interface WallSlot {
  id: string
  orderId: string | null
  sku: string | null
  qtyRequired: number
  qtyFilled: number
  filled: boolean
  highlighted: boolean
}

interface Station {
  id: string
  label: string
  side: "left" | "right"
  status: "IDLE" | "ACTIVE" | "COMPLETING"
  amrId: string | null
  rackId: string | null
  rack: RackShelf[]
  wall: WallSlot[]
  pickedItems: PickedItem[]
  completedPicks: number
  totalPicks: number
}

interface PickedItem {
  sku: string
  qty: number
  from: string
  to: string
  timestamp: number
}

interface Task {
  id: string
  type: string
  status: string
  priority: string
  sku: string
  weight: number
  assignedTo: string | null
}

// ── CONSTANTS ──
const SKUS = [
  "SKU-1042","SKU-2381","SKU-4917","SKU-3205","SKU-8834",
  "SKU-6612","SKU-7743","SKU-9901","SKU-5523","SKU-4410",
  "SKU-3317","SKU-8821","SKU-1195","SKU-6634","SKU-2278",
]

const ORDERS = [
  "ORD-00001","ORD-00002","ORD-00003","ORD-00004",
  "ORD-00005","ORD-00006","ORD-00007","ORD-00008",
]

function rnd(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min))
}

function generateRack(): RackShelf[] {
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
      sku: SKUS[rnd(0, SKUS.length)],
      qty: rnd(2, 30),
      weight: rnd(1, 25),
      picked: false,
      selected: false,
    }))
  }))
}

function generateWall(): WallSlot[] {
  const rows = ["A","B","C","D"]
  const cols = [1,2,3]
  const slots: WallSlot[] = []
  rows.forEach(r => cols.forEach(c => {
    const hasSku = Math.random() > 0.3
    slots.push({
      id: `${r}${c}`,
      orderId: hasSku ? ORDERS[rnd(0, ORDERS.length)] : null,
      sku: hasSku ? SKUS[rnd(0, SKUS.length)] : null,
      qtyRequired: hasSku ? rnd(1, 8) : 0,
      qtyFilled: 0,
      filled: false,
      highlighted: false,
    })
  }))
  return slots
}

function makeStation(id: string, label: string, side: "left" | "right"): Station {
  const rack = generateRack()
  const wall = generateWall()
  const totalPicks = wall.filter(w => w.sku).length
  return {
    id, label, side,
    status: "IDLE",
    amrId: null, rackId: null,
    rack, wall,
    pickedItems: [],
    completedPicks: 0,
    totalPicks,
  }
}

// ── 3D RACK COMPONENT ──
function Rack3D({ shelves, onSlotClick, selectedSlot }: {
  shelves: RackShelf[]
  onSlotClick: (shelfIdx: number, slotIdx: number) => void
  selectedSlot: { shelf: number; slot: number } | null
}) {
  return (
    <div style={{
      background: "#060c18",
      border: "2px solid #1e3a6e",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
    }}>
      {/* Rack header */}
      <div style={{
        background: "#0d1a2e",
        borderBottom: "1px solid #1e3a6e",
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 6px #3b82f6" }}/>
        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "#3b82f6", letterSpacing: 2, textTransform: "uppercase" }}>
          Rack Presented by AMR
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
          {shelves.reduce((s, sh) => s + sh.slots.filter(sl => !sl.picked).length, 0)} items remaining
        </span>
      </div>

      {/* Shelves */}
      {[...shelves].reverse().map((shelf, shelfIdx) => {
        const realIdx = shelves.length - 1 - shelfIdx
        return (
          <div key={shelf.level}>
            {/* Shelf level label */}
            <div style={{
              background: "#080f1e",
              padding: "5px 16px",
              display: "flex", alignItems: "center", gap: 8,
              borderTop: shelfIdx > 0 ? "1px solid #0d1a2e" : "none",
            }}>
              <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }}/>
              <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>
                {shelf.label}
              </span>
            </div>

            {/* Shelf bar (3D effect) */}
            <div style={{
              height: 6,
              background: "linear-gradient(to bottom, #2a3a5a, #1a2a4a)",
              borderTop: "1px solid #3a5a8a",
              borderBottom: "1px solid #0a1a2a",
            }}/>

            {/* Slots */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8, padding: "12px 16px",
              background: "rgba(0,0,0,0.2)",
            }}>
              {shelf.slots.map((slot, slotIdx) => {
                const isSelected = selectedSlot?.shelf === realIdx && selectedSlot?.slot === slotIdx
                const isPicked = slot.picked
                return (
                  <div
                    key={slot.id}
                    onClick={() => !isPicked && onSlotClick(realIdx, slotIdx)}
                    style={{
                      cursor: isPicked ? "default" : "pointer",
                      transition: "all 0.2s",
                      transform: isSelected ? "translateY(-4px) scale(1.02)" : "none",
                    }}>
                    {/* Box 3D effect */}
                    <div style={{
                      position: "relative",
                      background: isPicked
                        ? "rgba(16,185,129,0.05)"
                        : isSelected
                        ? "rgba(59,130,246,0.2)"
                        : "rgba(255,255,255,0.05)",
                      border: `1.5px solid ${isPicked ? "#10b981" : isSelected ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 8,
                      padding: "10px 8px",
                      textAlign: "center",
                      boxShadow: isSelected
                        ? "0 0 20px rgba(59,130,246,0.5), 0 4px 12px rgba(0,0,0,0.4)"
                        : isPicked
                        ? "none"
                        : "0 4px 8px rgba(0,0,0,0.3)",
                    }}>
                      {/* 3D box top face */}
                      {!isPicked && (
                        <div style={{
                          position: "absolute",
                          top: -6, left: 4, right: -4,
                          height: 6,
                          background: isSelected ? "#1e40af" : "#1a2a4a",
                          borderRadius: "2px 4px 0 0",
                          transform: "skewX(-45deg)",
                          borderTop: `1px solid ${isSelected ? "#3b82f6" : "#2a3a6a"}`,
                        }}/>
                      )}

                      {/* Item icon */}
                      <div style={{ fontSize: 20, marginBottom: 4 }}>
                        {isPicked ? "✅" : "📦"}
                      </div>

                      {/* SKU */}
                      <div style={{
                        fontFamily: "'Courier New',monospace",
                        fontSize: 8, letterSpacing: 0.5,
                        color: isPicked ? "#10b981" : isSelected ? "#93c5fd" : "rgba(255,255,255,0.5)",
                        marginBottom: 4,
                      }}>
                        {slot.sku.replace("SKU-","")}
                      </div>

                      {/* Qty */}
                      <div style={{
                        fontFamily: "monospace",
                        fontSize: 14, fontWeight: 700,
                        color: isPicked ? "#10b981" : isSelected ? "#fff" : "rgba(255,255,255,0.7)",
                      }}>
                        ×{slot.qty}
                      </div>

                      {/* Weight */}
                      <div style={{
                        fontFamily: "'Courier New',monospace",
                        fontSize: 7, color: "rgba(255,255,255,0.25)",
                        marginTop: 3,
                      }}>
                        {slot.weight}kg
                      </div>

                      {/* Slot ID */}
                      <div style={{
                        marginTop: 4,
                        fontFamily: "'Courier New',monospace",
                        fontSize: 7,
                        color: isSelected ? "#3b82f6" : "rgba(255,255,255,0.2)",
                      }}>
                        {slot.id}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── PICK TO WALL COMPONENT ──
function PickToWall({ slots, highlightedSlot, onSlotClick }: {
  slots: WallSlot[]
  highlightedSlot: string | null
  onSlotClick: (slotId: string) => void
}) {
  const rows = ["A","B","C","D"]
  return (
    <div style={{
      background: "#060c18",
      border: "2px solid #2d1b00",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
    }}>
      {/* Wall header */}
      <div style={{
        background: "#1a0e00",
        borderBottom: "1px solid #78350f",
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b" }}/>
        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase" }}>
          Pick-to-Wall
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
          {slots.filter(s => s.filled).length} / {slots.filter(s => s.sku).length} filled
        </span>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "32px repeat(3, 1fr)",
        gap: 6, padding: "8px 16px 4px",
        background: "#080d14",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div/>
        {[1,2,3].map(c => (
          <div key={c} style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", letterSpacing: 1 }}>
            COL {c}
          </div>
        ))}
      </div>

      {/* Wall grid */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(row => (
          <div key={row} style={{ display: "grid", gridTemplateColumns: "32px repeat(3, 1fr)", gap: 6, alignItems: "center" }}>
            {/* Row label */}
            <div style={{
              fontFamily: "monospace", fontSize: 14, fontWeight: 700,
              color: "rgba(255,255,255,0.4)", textAlign: "center",
            }}>
              {row}
            </div>
            {/* Slots in this row */}
            {slots.filter(s => s.id.startsWith(row)).map(slot => {
              const isHighlighted = slot.id === highlightedSlot
              const isFilled = slot.filled
              const isEmpty = !slot.sku
              return (
                <div
                  key={slot.id}
                  onClick={() => !isEmpty && !isFilled && onSlotClick(slot.id)}
                  style={{
                    cursor: isEmpty || isFilled ? "default" : "pointer",
                    background: isFilled
                      ? "rgba(16,185,129,0.12)"
                      : isHighlighted
                      ? "rgba(245,158,11,0.2)"
                      : isEmpty
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${isFilled ? "#10b981" : isHighlighted ? "#f59e0b" : isEmpty ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 8,
                    padding: "10px 8px",
                    textAlign: "center",
                    transition: "all 0.2s",
                    boxShadow: isHighlighted ? "0 0 16px rgba(245,158,11,0.4)" : "none",
                    position: "relative",
                  }}>

                  {/* Slot ID badge */}
                  <div style={{
                    position: "absolute", top: 4, left: 6,
                    fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                    color: isFilled ? "#10b981" : isHighlighted ? "#f59e0b" : "rgba(255,255,255,0.3)",
                  }}>
                    {slot.id}
                  </div>

                  {/* Arrow indicator */}
                  {isHighlighted && !isFilled && (
                    <div style={{
                      position: "absolute", top: 4, right: 6,
                      fontSize: 14, color: "#f59e0b",
                    }}>👈</div>
                  )}

                  {isFilled ? (
                    <>
                      <div style={{ fontSize: 18, marginBottom: 4, marginTop: 8 }}>✅</div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#10b981" }}>FILLED</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#10b981", marginTop: 2 }}>
                        ×{slot.qtyFilled}
                      </div>
                    </>
                  ) : isEmpty ? (
                    <>
                      <div style={{ fontSize: 18, marginBottom: 4, marginTop: 8, opacity: 0.2 }}>□</div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.15)" }}>EMPTY</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 18, marginBottom: 4, marginTop: 8 }}>
                        {isHighlighted ? "📥" : "📋"}
                      </div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: isHighlighted ? "#f59e0b" : "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>
                        {slot.sku?.replace("SKU-","")}
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: isHighlighted ? "#f59e0b" : "rgba(255,255,255,0.7)", marginTop: 2 }}>
                        ×{slot.qtyRequired}
                      </div>
                      {slot.orderId && (
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                          {slot.orderId}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── AMR DOCKING VISUAL ──
function AMRDockingView({ station, amrColor }: { station: Station; amrColor: string }) {
  return (
    <div style={{
      background: "#080d1a",
      border: `1px solid ${amrColor}30`,
      borderRadius: 10,
      padding: 14,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {/* AMR SVG */}
      <svg width={60} height={60} viewBox="0 0 60 60" fill="none">
        {/* Body */}
        <rect x="15" y="20" width="30" height="24" rx="4" fill={`${amrColor}20`} stroke={amrColor} strokeWidth="1.5"/>
        {/* Rack on top */}
        <rect x="18" y="6" width="24" height="16" rx="2" fill={`${amrColor}10`} stroke={amrColor} strokeWidth="1" strokeDasharray="3,2"/>
        {/* Shelf lines on rack */}
        <line x1="18" y1="11" x2="42" y2="11" stroke={amrColor} strokeWidth="0.5" opacity="0.5"/>
        <line x1="18" y1="16" x2="42" y2="16" stroke={amrColor} strokeWidth="0.5" opacity="0.5"/>
        {/* Eyes */}
        <rect x="22" y="26" width="6" height="4" rx="1" fill={amrColor}/>
        <rect x="32" y="26" width="6" height="4" rx="1" fill={amrColor}/>
        {/* Wheels */}
        <ellipse cx="22" cy="46" rx="5" ry="3" fill={amrColor} opacity="0.7"/>
        <ellipse cx="38" cy="46" rx="5" ry="3" fill={amrColor} opacity="0.7"/>
        {/* Status light */}
        <circle cx="45" cy="22" r="3" fill="#10b981"/>
      </svg>

      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#10b981", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          AMR DOCKED AT STATION
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: amrColor }}>
          {station.amrId || "AMR-000"}
        </div>
        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
          Rack: {station.rackId || "RACK-AUTO"} · Ready for picking
        </div>
      </div>

      {/* Docking animation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 4, height: 4, borderRadius: "50%",
            background: "#10b981",
            opacity: 0.4 + i * 0.3,
            boxShadow: "0 0 4px #10b981",
          }}/>
        ))}
      </div>
    </div>
  )
}

// ── MAIN PAGE ──
export default function StationPage() {
  const { tasks, addLog } = useStore()
  const [stations, setStations] = useState<Station[]>([
    makeStation("S1", "Station 1 — Left A",  "left"),
    makeStation("S2", "Station 2 — Left B",  "left"),
    makeStation("S3", "Station 3 — Right A", "right"),
    makeStation("S4", "Station 4 — Right B", "right"),
  ])
  const [activeStation, setActiveStation] = useState<string>("S1")
  const [selectedSlot, setSelectedSlot] = useState<{ shelf: number; slot: number } | null>(null)
  const [highlightedWall, setHighlightedWall] = useState<string | null>(null)
  const [pickQty, setPickQty] = useState<number>(1)
  const [log, setLog] = useState<{ msg: string; color: string; t: string }[]>([])
  const [amrColors] = useState<Record<string,string>>({
    S1: "#3b82f6", S2: "#10b981", S3: "#f59e0b", S4: "#8b5cf6"
  })

  const station = stations.find(s => s.id === activeStation)!
  const typedTasks = tasks as Task[]

  const addLocalLog = (msg: string, color: string) => {
    setLog(prev => [{ msg, color, t: new Date().toLocaleTimeString("en-AU", { hour12: false }) }, ...prev].slice(0, 50))
  }

  // Simulate AMR arriving at station
  const simulateAMRArrival = (stationId: string) => {
    const amrId = `AMR-00${stations.findIndex(s => s.id === stationId) + 1}`
    const rackId = `RACK-${Math.floor(100 + Math.random() * 900)}`
    setStations(prev => prev.map(s =>
      s.id === stationId
        ? { ...s, status: "ACTIVE", amrId, rackId, rack: generateRack(), wall: generateWall(), pickedItems: [], completedPicks: 0 }
        : s
    ))
    setSelectedSlot(null)
    setHighlightedWall(null)
    addLocalLog(`${amrId} docked at ${stationId} with ${rackId}`, "#10b981")
    addLog(`AMR docked at ${stationId}`, "#10b981", "STATION")
  }

  const releaseAMR = (stationId: string) => {
    setStations(prev => prev.map(s =>
      s.id === stationId
        ? { ...s, status: "IDLE", amrId: null, rackId: null }
        : s
    ))
    setSelectedSlot(null)
    setHighlightedWall(null)
    addLocalLog(`AMR released from ${stationId}`, "#f59e0b")
  }

  // Select rack slot
  const handleSlotClick = (shelfIdx: number, slotIdx: number) => {
    setSelectedSlot({ shelf: shelfIdx, slot: slotIdx })
    const slot = station.rack[shelfIdx]?.slots[slotIdx]
    if (!slot) return
    // Auto-highlight matching wall slot
    const matchingWall = station.wall.find(w => w.sku === slot.sku && !w.filled)
    setHighlightedWall(matchingWall?.id || null)
    setPickQty(Math.min(slot.qty, matchingWall?.qtyRequired || 1))
    addLocalLog(`Selected ${slot.sku} ×${slot.qty} from ${slot.id}`, "#3b82f6")
  }

  // Select wall slot
  const handleWallClick = (slotId: string) => {
    setHighlightedWall(slotId)
  }

  // Confirm pick
  const confirmPick = () => {
    if (!selectedSlot || !highlightedWall || !station) return
    const shelf = station.rack[selectedSlot.shelf]
    const slot = shelf?.slots[selectedSlot.slot]
    const wallSlot = station.wall.find(w => w.id === highlightedWall)
    if (!slot || !wallSlot) return

    const pickedItem: PickedItem = {
      sku: slot.sku,
      qty: pickQty,
      from: slot.id,
      to: highlightedWall,
      timestamp: Date.now(),
    }

    setStations(prev => prev.map(s => {
      if (s.id !== activeStation) return s
      const newRack = s.rack.map((sh, si) => ({
        ...sh,
        slots: sh.slots.map((sl, li) =>
          si === selectedSlot.shelf && li === selectedSlot.slot
            ? { ...sl, qty: sl.qty - pickQty, picked: sl.qty - pickQty <= 0 }
            : sl
        )
      }))
      const newWall = s.wall.map(w =>
        w.id === highlightedWall
          ? { ...w, qtyFilled: w.qtyFilled + pickQty, filled: w.qtyFilled + pickQty >= w.qtyRequired }
          : w
      )
      return {
        ...s,
        rack: newRack, wall: newWall,
        pickedItems: [pickedItem, ...s.pickedItems],
        completedPicks: s.completedPicks + 1,
      }
    }))

    addLocalLog(`✓ Picked ${slot.sku} ×${pickQty} → Wall ${highlightedWall}`, "#10b981")
    addLog(`Pick confirmed: ${slot.sku} ×${pickQty} at ${activeStation}`, "#10b981", "STATION")

    // Auto advance
    setSelectedSlot(null)
    setHighlightedWall(null)
  }

  const stationColor = amrColors[activeStation] || "#3b82f6"

  return (
    <div style={{ background: "#040810", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "#080d1a",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "12px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#10b981", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
            MyRoboCloud · Goods-to-Person · Picking Interface
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, margin: 0, color: "#fff" }}>
            Station Control — Pick & Induct
          </h1>
        </div>

        {/* Station selector tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {stations.map(s => (
            <button key={s.id}
              onClick={() => { setActiveStation(s.id); setSelectedSlot(null); setHighlightedWall(null) }}
              style={{
                padding: "8px 16px",
                background: activeStation === s.id ? `${amrColors[s.id]}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${activeStation === s.id ? amrColors[s.id] : "rgba(255,255,255,0.1)"}`,
                borderRadius: 7,
                color: activeStation === s.id ? amrColors[s.id] : "rgba(255,255,255,0.4)",
                fontFamily: "'Courier New',monospace", fontSize: 10, letterSpacing: 1,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: s.status === "ACTIVE" ? "#10b981" : "rgba(255,255,255,0.2)",
                boxShadow: s.status === "ACTIVE" ? "0 0 6px #10b981" : "none",
              }}/>
              {s.id}
              {s.status === "ACTIVE" && <span style={{ fontSize: 8, color: "#10b981" }}>●</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{
        display: "flex", background: "#080d1a",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        overflowX: "auto", flexShrink: 0,
      }}>
        {[
          { label: "Station",       value: station.label,              color: stationColor },
          { label: "Status",        value: station.status,             color: station.status === "ACTIVE" ? "#10b981" : "#6b7280" },
          { label: "AMR Docked",    value: station.amrId || "—",       color: station.amrId ? "#10b981" : "#6b7280" },
          { label: "Picks Done",    value: station.completedPicks,     color: "#10b981" },
          { label: "Total Picks",   value: station.totalPicks,         color: "rgba(255,255,255,0.5)" },
          { label: "Wall Filled",   value: station.wall.filter(w=>w.filled).length, color: "#f59e0b" },
          { label: "Tasks Pending", value: typedTasks.filter(t=>t.status!=="DONE").length, color: "#f59e0b" },
        ].map(k => (
          <div key={k.label} style={{ padding: "10px 18px", borderRight: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT: RACK + WALL ── */}
        <div style={{ flex: 1, padding: 20, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* AMR docking status */}
          {station.status === "ACTIVE" ? (
            <AMRDockingView station={station} amrColor={amrColors[station.id]}/>
          ) : (
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px dashed rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "20px",
              textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            }}>
              <span style={{ fontSize: 28 }}>🤖</span>
              <div>
                <div style={{ fontFamily: "'Courier New',monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 4 }}>
                  NO AMR DOCKED
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
                  Simulate an AMR arriving with a rack
                </div>
              </div>
              <button
                onClick={() => simulateAMRArrival(station.id)}
                style={{
                  padding: "10px 20px",
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid #10b981",
                  borderRadius: 8, color: "#10b981",
                  fontFamily: "'Courier New',monospace",
                  fontSize: 11, letterSpacing: 1, cursor: "pointer",
                }}>
                ▶ SIMULATE AMR ARRIVAL
              </button>
            </div>
          )}

          {/* Two shelf layout */}
          {station.status === "ACTIVE" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Rack */}
              <Rack3D
                shelves={station.rack}
                onSlotClick={handleSlotClick}
                selectedSlot={selectedSlot}
              />
              {/* Wall */}
              <PickToWall
                slots={station.wall}
                highlightedSlot={highlightedWall}
                onSlotClick={handleWallClick}
              />
            </div>
          )}

          {/* Pick action bar */}
          {station.status === "ACTIVE" && selectedSlot !== null && (
            <div style={{
              background: "#0a1428",
              border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: 10,
              padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            }}>
              {/* Selected item info */}
              {(() => {
                const shelf = station.rack[selectedSlot.shelf]
                const slot = shelf?.slots[selectedSlot.slot]
                if (!slot) return null
                return (
                  <>
                    <div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>ITEM SELECTED</div>
                      <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{slot.sku}</div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                        From: {slot.id} · {slot.weight}kg each
                      </div>
                    </div>

                    <div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>WALL TARGET</div>
                      <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: highlightedWall ? "#f59e0b" : "rgba(255,255,255,0.2)" }}>
                        {highlightedWall || "— Select wall slot"}
                      </div>
                    </div>

                    {/* Qty picker */}
                    <div>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>PICK QTY</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => setPickQty(q => Math.max(1, q - 1))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 16 }}>−</button>
                        <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#fff", width: 32, textAlign: "center" }}>{pickQty}</span>
                        <button onClick={() => setPickQty(q => Math.min(slot.qty, q + 1))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 16 }}>+</button>
                        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>max {slot.qty}</span>
                      </div>
                    </div>

                    <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                      <button onClick={() => { setSelectedSlot(null); setHighlightedWall(null) }} style={{
                        padding: "10px 18px",
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 7, color: "#ef4444",
                        fontFamily: "'Courier New',monospace", fontSize: 11, cursor: "pointer",
                      }}>
                        ✕ CANCEL
                      </button>
                      <button
                        onClick={confirmPick}
                        disabled={!highlightedWall}
                        style={{
                          padding: "10px 24px",
                          background: highlightedWall ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${highlightedWall ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 7,
                          color: highlightedWall ? "#10b981" : "rgba(255,255,255,0.2)",
                          fontFamily: "'Courier New',monospace", fontSize: 12,
                          letterSpacing: 1, cursor: highlightedWall ? "pointer" : "not-allowed",
                          fontWeight: 700,
                        }}>
                        ✓ CONFIRM PICK
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Release AMR button */}
          {station.status === "ACTIVE" && (
            <button onClick={() => releaseAMR(station.id)} style={{
              padding: "10px",
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 8, color: "#f59e0b",
              fontFamily: "'Courier New',monospace", fontSize: 11,
              letterSpacing: 1, cursor: "pointer", width: "100%",
            }}>
              ⟵ RELEASE AMR — SEND BACK TO WAREHOUSE
            </button>
          )}
        </div>

        {/* ── RIGHT: LOG + HISTORY ── */}
        <div style={{
          width: 280, flexShrink: 0,
          background: "#080d1a",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>

          {/* Picked items history */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
              Pick History — {station.label}
            </div>
            {station.pickedItems.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>
                No picks yet
              </div>
            )}
            {station.pickedItems.map((item, i) => (
              <div key={i} style={{
                background: "rgba(16,185,129,0.05)",
                border: "1px solid rgba(16,185,129,0.15)",
                borderRadius: 7,
                padding: "8px 10px",
                marginBottom: 6,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <div style={{ fontSize: 16 }}>📦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                    {item.sku}
                  </div>
                  <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    ×{item.qty} · {item.from} → Wall {item.to}
                  </div>
                </div>
                <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#10b981" }}>✓</div>
              </div>
            ))}
          </div>

          {/* Event log */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px", maxHeight: 220, overflowY: "auto" }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              Station Log
            </div>
            {log.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
                No events yet
              </div>
            )}
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