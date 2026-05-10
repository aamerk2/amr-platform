"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"

// ── GRID CONFIG ──
const COLS = 16
const ROWS = 12
const AISLE_COLS = [3, 7, 11]
const AISLE_ROWS = [3, 7]
const AMR_COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316"]

// ── 4 G2P STATIONS (2 each side) ──
const STATIONS = [
  { id: "S1", label: "Station 1", side: "left",  row: 2,  col: -2, active: false },
  { id: "S2", label: "Station 2", side: "left",  row: 7,  col: -2, active: false },
  { id: "S3", label: "Station 3", side: "right", row: 2,  col: COLS + 1, active: false },
  { id: "S4", label: "Station 4", side: "right", row: 7,  col: COLS + 1, active: false },
]

const SKUS = ["SKU-1042","SKU-2381","SKU-4917","SKU-3205","SKU-8834","SKU-6612","SKU-7743","SKU-9901","SKU-5523","SKU-4410"]
const WALL_SLOTS = ["A1","A2","A3","B1","B2","B3","C1","C2","C3","D1"]

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
  carryingRack: boolean
  targetStation: string | null
  atStation: string | null
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

interface Station {
  id: string
  label: string
  side: string
  row: number
  col: number
  active: boolean
  amrId?: string
  rackItems?: RackItem[]
  wallSlots?: WallSlot[]
}

interface RackItem {
  sku: string
  qty: number
  level: number
  slot: number
  picked: boolean
  highlighted: boolean
}

interface WallSlot {
  id: string
  sku: string | null
  qty: number
  filled: boolean
  target: boolean
}

const PRI_COL: Record<string,string> = {
  CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#eab308", LOW:"#6b7280"
}

function generateRackItems(): RackItem[] {
  return Array.from({length: 9}, (_, i) => ({
    sku: SKUS[Math.floor(Math.random() * SKUS.length)],
    qty: Math.floor(1 + Math.random() * 20),
    level: Math.floor(i / 3),
    slot: i % 3,
    picked: false,
    highlighted: i === 0,
  }))
}

function generateWallSlots(): WallSlot[] {
  return WALL_SLOTS.map((id, i) => ({
    id,
    sku: i < 3 ? SKUS[Math.floor(Math.random() * SKUS.length)] : null,
    qty: i < 3 ? Math.floor(1 + Math.random() * 5) : 0,
    filled: false,
    target: i === 0,
  }))
}

// ── ISOMETRIC HELPERS ──
function toIso(col: number, row: number, cellW: number, cellH: number) {
  const x = (col - row) * (cellW / 2)
  const y = (col + row) * (cellH / 2)
  return { x, y }
}

// ── ROBOT SVG ──
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

// ── PICKING STATION MODAL ──
function StationModal({
  station, amr, onClose, onConfirmPick
}: {
  station: Station
  amr: AMR | undefined
  onClose: () => void
  onConfirmPick: (stationId: string, itemIdx: number, wallSlotIdx: number) => void
}) {
  const [selectedItem, setSelectedItem] = useState<number>(0)
  const [selectedWall, setSelectedWall] = useState<number>(0)
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set())
  const items = station.rackItems || []
  const wall  = station.wallSlots || []

  const handleConfirm = () => {
    onConfirmPick(station.id, selectedItem, selectedWall)
    setConfirmed(prev => new Set([...prev, selectedItem]))
    setSelectedItem(prev => Math.min(prev + 1, items.length - 1))
    setSelectedWall(prev => Math.min(prev + 1, wall.length - 1))
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "#0a0f1e", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16, width: "100%", maxWidth: 900,
        boxShadow: "0 0 60px rgba(0,0,0,0.8)",
        overflow: "hidden",
      }}>

        {/* Modal header */}
        <div style={{
          background: "#0d1424", borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#10b981", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
              Goods-to-Person · {station.label}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#fff" }}>
              Picking Station Active {amr ? `— ${amr.id}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid #10b981", borderRadius: 6, padding: "6px 12px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }}/>
              <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "#10b981" }}>STATION ACTIVE</span>
            </div>
            <button onClick={onClose} style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444",
              borderRadius: 6, padding: "6px 14px", color: "#ef4444",
              fontFamily: "'Courier New',monospace", fontSize: 10, cursor: "pointer",
            }}>✕ CLOSE</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ padding: "8px 20px", background: "#080d1a", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>PICK PROGRESS</span>
            <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#10b981" }}>{confirmed.size} / {items.length} items</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(confirmed.size / Math.max(1, items.length)) * 100}%`, background: "#10b981", borderRadius: 2, transition: "width 0.4s" }}/>
          </div>
        </div>

        {/* Two shelf view */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>

          {/* LEFT — Rack presented by AMR */}
          <div style={{ padding: 20, borderRight: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 6px #3b82f6" }}/>
              <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#3b82f6", letterSpacing: 2, textTransform: "uppercase" }}>
                Rack Presented by {amr?.id || "AMR"}
              </span>
            </div>

            {/* 3D rack visual */}
            <div style={{
              background: "#060c18", border: "2px solid #1e3a6e",
              borderRadius: 10, padding: 12, marginBottom: 14,
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)",
            }}>
              {/* Rack levels */}
              {[2, 1, 0].map(level => (
                <div key={level} style={{ marginBottom: 6 }}>
                  <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: 1, marginBottom: 4 }}>
                    LEVEL {level === 2 ? "TOP" : level === 1 ? "MID" : "BOT"}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {items.filter(it => it.level === level).map((item, slotIdx) => {
                      const globalIdx = items.indexOf(item)
                      const isSelected = globalIdx === selectedItem
                      const isDone = confirmed.has(globalIdx)
                      return (
                        <div
                          key={slotIdx}
                          onClick={() => !isDone && setSelectedItem(globalIdx)}
                          style={{
                            background: isDone ? "rgba(16,185,129,0.1)" : isSelected ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${isDone ? "#10b981" : isSelected ? "#3b82f6" : "rgba(255,255,255,0.1)"}`,
                            borderRadius: 6, padding: "8px 6px",
                            cursor: isDone ? "default" : "pointer",
                            transition: "all 0.2s",
                            textAlign: "center",
                            boxShadow: isSelected ? "0 0 12px rgba(59,130,246,0.4)" : "none",
                          }}>
                          {isDone ? (
                            <div style={{ fontSize: 14, marginBottom: 2 }}>✅</div>
                          ) : (
                            <div style={{ fontSize: 14, marginBottom: 2 }}>📦</div>
                          )}
                          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: isDone ? "#10b981" : isSelected ? "#3b82f6" : "rgba(255,255,255,0.5)", letterSpacing: 0.5 }}>
                            {item.sku.replace("SKU-","")}
                          </div>
                          <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: isDone ? "#10b981" : "#fff", marginTop: 2 }}>
                            ×{item.qty}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected item detail */}
            {items[selectedItem] && (
              <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, padding: 12 }}>
                <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#3b82f6", letterSpacing: 2, marginBottom: 8 }}>SELECTED ITEM</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { l: "SKU",      v: items[selectedItem].sku },
                    { l: "Quantity", v: `×${items[selectedItem].qty}` },
                    { l: "Level",    v: items[selectedItem].level === 2 ? "TOP" : items[selectedItem].level === 1 ? "MID" : "BOT" },
                    { l: "Slot",     v: `Slot ${items[selectedItem].slot + 1}` },
                  ].map(f => (
                    <div key={f.l}>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{f.l}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#fff" }}>{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Pick to Wall */}
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b" }}/>
              <span style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase" }}>
                Pick-to-Wall
              </span>
            </div>

            {/* Wall grid */}
            <div style={{
              background: "#060c18", border: "2px solid #2d1b00",
              borderRadius: 10, padding: 12, marginBottom: 14,
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)",
            }}>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: 1, marginBottom: 8 }}>WALL SLOTS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {wall.map((slot, idx) => {
                  const isTarget = idx === selectedWall
                  const isFilled = confirmed.size > idx
                  return (
                    <div
                      key={slot.id}
                      onClick={() => setSelectedWall(idx)}
                      style={{
                        background: isFilled ? "rgba(16,185,129,0.1)" : isTarget ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isFilled ? "#10b981" : isTarget ? "#f59e0b" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 6, padding: "10px 8px",
                        cursor: "pointer", transition: "all 0.2s",
                        boxShadow: isTarget ? "0 0 12px rgba(245,158,11,0.3)" : "none",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: isFilled ? "#10b981" : isTarget ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
                          {slot.id}
                        </span>
                        {isFilled && <span style={{ fontSize: 12 }}>✅</span>}
                        {isTarget && !isFilled && <span style={{ fontSize: 10 }}>👈</span>}
                      </div>
                      {slot.sku ? (
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.4)" }}>{slot.sku}</div>
                      ) : (
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.15)" }}>EMPTY</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Confirm pick button */}
            <button
              onClick={handleConfirm}
              disabled={confirmed.has(selectedItem)}
              style={{
                width: "100%", padding: "14px",
                background: confirmed.has(selectedItem) ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.2)",
                border: `1px solid ${confirmed.has(selectedItem) ? "rgba(255,255,255,0.1)" : "#10b981"}`,
                borderRadius: 8, color: confirmed.has(selectedItem) ? "rgba(255,255,255,0.3)" : "#10b981",
                fontFamily: "'Courier New',monospace", fontSize: 13, letterSpacing: 2,
                cursor: confirmed.has(selectedItem) ? "not-allowed" : "pointer",
                fontWeight: 700, transition: "all 0.2s",
                marginBottom: 10,
              }}>
              {confirmed.has(selectedItem) ? "✓ PICKED" : "✓ CONFIRM PICK"}
            </button>

            {/* Instructions */}
            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#f59e0b", letterSpacing: 1, marginBottom: 6 }}>INSTRUCTIONS</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                1. Select item from rack (left)<br/>
                2. Select target wall slot (right)<br/>
                3. Pick item and place in slot<br/>
                4. Press CONFIRM PICK<br/>
                5. Repeat for all items
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ISOMETRIC WAREHOUSE MAP ──
function IsoMap({ amrs, tasks, stations, onStationClick }: {
  amrs: AMR[]
  tasks: Task[]
  stations: Station[]
  onStationClick: (s: Station) => void
}) {
  const CW = 64  // cell width
  const CH = 32  // cell height
  const RACK_H = 28  // rack height for 3D effect
  const mapW = (COLS + ROWS) * (CW / 2) + CW
  const mapH = (COLS + ROWS) * (CH / 2) + RACK_H + 60

  function cellColor(row: number, col: number) {
    if (AISLE_COLS.includes(col) || AISLE_ROWS.includes(row)) return { top: "#0d1628", side: "#0a1020" }
    if (row === ROWS - 1) return { top: "#1a0e00", side: "#120900" }
    return { top: "#0f1e36", side: "#081428" }
  }

  const offsetX = (ROWS * CW) / 2 + 40
  const offsetY = 40

  return (
    <div style={{ position: "relative", width: mapW, height: mapH, margin: "0 auto" }}>
      <svg width={mapW} height={mapH} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── FLOOR TILES ── */}
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => {
            const { x, y } = toIso(c, r, CW, CH)
            const colors = cellColor(r, c)
            const isAisle = AISLE_COLS.includes(c) || AISLE_ROWS.includes(r)
            const cx = x + offsetX
            const cy = y + offsetY

            // Top face (diamond)
            const topPts = [
              `${cx},${cy}`,
              `${cx + CW/2},${cy + CH/2}`,
              `${cx},${cy + CH}`,
              `${cx - CW/2},${cy + CH/2}`,
            ].join(" ")

            if (isAisle) {
              return (
                <g key={`${r}-${c}`}>
                  <polygon points={topPts} fill={colors.top} stroke="#0a1428" strokeWidth="0.5"/>
                  {/* Aisle markings */}
                  <line
                    x1={cx - CW/4} y1={cy + CH*0.75}
                    x2={cx + CW/4} y2={cy + CH*0.75}
                    stroke="#1e3a6e" strokeWidth="1" strokeDasharray="4,4"
                  />
                </g>
              )
            }

            // Rack (3D box)
            const rackTop = [
              `${cx},${cy - RACK_H}`,
              `${cx + CW/2},${cy + CH/2 - RACK_H}`,
              `${cx},${cy + CH - RACK_H}`,
              `${cx - CW/2},${cy + CH/2 - RACK_H}`,
            ].join(" ")
            const rackRight = [
              `${cx + CW/2},${cy + CH/2 - RACK_H}`,
              `${cx + CW/2},${cy + CH/2}`,
              `${cx},${cy + CH}`,
              `${cx},${cy + CH - RACK_H}`,
            ].join(" ")
            const rackLeft = [
              `${cx - CW/2},${cy + CH/2 - RACK_H}`,
              `${cx - CW/2},${cy + CH/2}`,
              `${cx},${cy + CH}`,
              `${cx},${cy + CH - RACK_H}`,
            ].join(" ")

            const hasTask = tasks.some(t =>
              (t.status === "ASSIGNED" || t.status === "WCS_DISPATCHED") &&
              t.from && t.from[0] === r && t.from[1] === c
            )

            return (
              <g key={`${r}-${c}`}>
                {/* Floor */}
                <polygon points={topPts} fill={colors.top} stroke="#0a1428" strokeWidth="0.5"/>
                {/* Left wall */}
                <polygon points={rackLeft} fill="#081020" stroke="#0a1428" strokeWidth="0.5"/>
                {/* Right wall */}
                <polygon points={rackRight} fill="#0a1830" stroke="#0a1428" strokeWidth="0.5"/>
                {/* Rack top face */}
                <polygon points={rackTop} fill={hasTask ? "#1a2e10" : "#0f2040"} stroke={hasTask ? "#4ade80" : "#1e3a6e"} strokeWidth="0.8"/>
                {/* Shelf lines on rack face */}
                {[0.33, 0.66].map((frac, i) => (
                  <line key={i}
                    x1={cx - CW/2} y1={cy + CH/2 - RACK_H * frac}
                    x2={cx} y2={cy + CH - RACK_H * frac}
                    stroke="#1e3a6e" strokeWidth="0.5" opacity="0.6"
                  />
                ))}
                {hasTask && (
                  <circle cx={cx} cy={cy - RACK_H - 6} r="4" fill="#4ade80" filter="url(#glow)"/>
                )}
              </g>
            )
          })
        )}

        {/* ── DOCK ROW (bottom) ── */}
        {Array.from({ length: COLS }, (_, c) => {
          const r = ROWS - 1
          const { x, y } = toIso(c, r, CW, CH)
          const cx = x + offsetX
          const cy = y + offsetY
          const topPts = [
            `${cx},${cy}`,
            `${cx + CW/2},${cy + CH/2}`,
            `${cx},${cy + CH}`,
            `${cx - CW/2},${cy + CH/2}`,
          ].join(" ")
          return (
            <g key={`dock-${c}`}>
              <polygon points={topPts} fill="#1a0e00" stroke="#78350f" strokeWidth="1"/>
              <text x={cx} y={cy + CH * 0.6} textAnchor="middle"
                fontFamily="monospace" fontSize="8" fill="#b45309" opacity="0.8">
                DOCK
              </text>
            </g>
          )
        })}

        {/* ── G2P STATIONS ── */}
        {stations.map(station => {
          const r = station.row
          const stationC = station.side === "left" ? -1 : COLS
          const { x, y } = toIso(stationC, r, CW, CH)
          const cx = x + offsetX
          const cy = y + offsetY
          const isActive = station.active
          const color = isActive ? "#10b981" : "#6b7280"

          const topPts = [
            `${cx},${cy - 20}`,
            `${cx + CW/2},${cy + CH/2 - 20}`,
            `${cx},${cy + CH - 20}`,
            `${cx - CW/2},${cy + CH/2 - 20}`,
          ].join(" ")
          const frontPts = [
            `${cx},${cy + CH - 20}`,
            `${cx - CW/2},${cy + CH/2 - 20}`,
            `${cx - CW/2},${cy + CH/2}`,
            `${cx},${cy + CH}`,
          ].join(" ")

          return (
            <g key={station.id} onClick={() => isActive && onStationClick(station)} style={{ cursor: isActive ? "pointer" : "default" }}>
              <polygon points={topPts} fill={isActive ? "rgba(16,185,129,0.3)" : "rgba(107,114,128,0.2)"} stroke={color} strokeWidth="1.5"/>
              <polygon points={frontPts} fill={isActive ? "rgba(16,185,129,0.15)" : "rgba(107,114,128,0.1)"} stroke={color} strokeWidth="1"/>
              {/* Station label */}
              <text x={cx} y={cy - 28} textAnchor="middle"
                fontFamily="Courier New" fontSize="9" fill={color} fontWeight="bold">
                {station.label}
              </text>
              {/* Active indicator */}
              {isActive && (
                <circle cx={cx} cy={cy - 38} r="5" fill="#10b981" filter="url(#glow)"/>
              )}
              {/* Screen on station */}
              <rect
                x={cx - 12} y={cy - 18}
                width={24} height={16}
                rx="2" fill={isActive ? "#0a2a18" : "#111"}
                stroke={color} strokeWidth="1"
              />
              {isActive && (
                <>
                  <line x1={cx-8} y1={cy-14} x2={cx+8} y2={cy-14} stroke="#10b981" strokeWidth="1" opacity="0.6"/>
                  <line x1={cx-8} y1={cy-10} x2={cx+4} y2={cy-10} stroke="#10b981" strokeWidth="1" opacity="0.4"/>
                  <line x1={cx-8} y1={cy-6} x2={cx+6} y2={cy-6} stroke="#10b981" strokeWidth="1" opacity="0.4"/>
                </>
              )}
            </g>
          )
        })}

        {/* ── AMRs ── */}
        {amrs.map(amr => {
          const { x, y } = toIso(amr.col, amr.row, CW, CH)
          const cx = x + offsetX
          const cy = y + offsetY - 10
          return (
            <g key={amr.id} filter="url(#glow)">
              {/* AMR body */}
              <rect x={cx - 10} y={cy - 8} width={20} height={16} rx="3"
                fill={`${amr.color}30`} stroke={amr.color} strokeWidth="1.5"/>
              {/* Wheels */}
              <ellipse cx={cx - 8} cy={cy + 8} rx="3" ry="2" fill={amr.color} opacity="0.7"/>
              <ellipse cx={cx + 8} cy={cy + 8} rx="3" ry="2" fill={amr.color} opacity="0.7"/>
              {/* Sensor */}
              <circle cx={cx} cy={cy - 4} r="2" fill={amr.color}/>
              {/* Rack being carried */}
              {amr.carryingRack && (
                <rect x={cx - 9} y={cy - 24} width={18} height={14} rx="1"
                  fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2,2"/>
              )}
              {/* AMR label */}
              <text x={cx} y={cy - 28} textAnchor="middle"
                fontFamily="Courier New" fontSize="8" fill={amr.color} fontWeight="bold">
                {amr.id}
              </text>
              {/* Status dot */}
              <circle cx={cx + 12} cy={cy - 12} r="3"
                fill={amr.status === "IDLE" ? "#10b981" : amr.status === "CHARGING" ? "#8b5cf6" : amr.color}
                filter="url(#glow)"
              />
              {/* Path trail */}
              {amr.path.length > 1 && amr.path.slice(-4).map((p, i, arr) => {
                if (i === 0) return null
                const prev = arr[i-1]
                const { x: x1, y: y1 } = toIso(prev.col, prev.row, CW, CH)
                const { x: x2, y: y2 } = toIso(p.col, p.row, CW, CH)
                return (
                  <line key={i}
                    x1={x1 + offsetX} y1={y1 + offsetY}
                    x2={x2 + offsetX} y2={y2 + offsetY}
                    stroke={amr.color} strokeWidth="1.5"
                    opacity={0.15 + (i / arr.length) * 0.4}
                    strokeDasharray="3,3"
                  />
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── SPAWN AMR ──
let _aid = 1
function spawnAMR(index: number): AMR {
  const startCol = AISLE_COLS[index % AISLE_COLS.length]
  return {
    id: `AMR-${String(_aid++).padStart(3, "0")}`,
    color: AMR_COLORS[index % AMR_COLORS.length],
    status: "IDLE",
    battery: 75 + Math.random() * 25,
    row: 0, col: startCol,
    taskId: null,
    completedTasks: 0,
    totalDist: 0,
    model: ["MiR100","Geek+ P800","Fetch Cart","GreyOrange"][index % 4],
    maxPayload: 200 + Math.floor(Math.random() * 300),
    targetRow: Math.floor(1 + Math.random() * (ROWS - 2)),
    targetCol: AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)],
    path: [],
    carryingRack: false,
    targetStation: null,
    atStation: null,
  }
}

function moveAMR(amr: AMR): AMR {
  let { row, col, targetRow, targetCol, path, totalDist, battery, status } = amr
  battery = Math.max(0, battery - 0.1)

  if (battery < 10 && status !== "CHARGING") {
    return { ...amr, battery, status: "CHARGING", taskId: null, carryingRack: false, targetStation: null, atStation: null, targetRow: 0, targetCol: AISLE_COLS[0] }
  }
  if (status === "CHARGING") {
    battery = Math.min(100, battery + 2)
    if (battery >= 95) return { ...amr, battery, status: "IDLE", taskId: null }
    return { ...amr, battery }
  }
  if (status === "IDLE") {
    return { ...amr, battery, status: "EN_ROUTE",
      targetRow: Math.floor(1 + Math.random() * (ROWS - 2)),
      targetCol: AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)],
    }
  }

  let newRow = row, newCol = col
  const inAisleCol = AISLE_COLS.includes(col)
  const inAisleRow = AISLE_ROWS.includes(row)

  if (!inAisleCol && !inAisleRow) {
    const nearestAC = AISLE_COLS.reduce((a, b) => Math.abs(a-col) < Math.abs(b-col) ? a : b)
    newCol = col + (nearestAC > col ? 1 : -1)
  } else if (inAisleCol && row !== targetRow) {
    newRow = row + (targetRow > row ? 1 : -1)
  } else if (row === targetRow && col !== targetCol) {
    if (inAisleRow || AISLE_COLS.includes(targetCol)) {
      newCol = col + (targetCol > col ? 1 : -1)
    } else {
      const nearestAR = AISLE_ROWS.reduce((a, b) => Math.abs(a-row) < Math.abs(b-row) ? a : b)
      newRow = row + (nearestAR > row ? 1 : -1)
    }
  }

  newRow = Math.max(0, Math.min(ROWS - 1, newRow))
  newCol = Math.max(0, Math.min(COLS - 1, newCol))
  totalDist += 1
  const newPath = [...path, { row: newRow, col: newCol }].slice(-8)
  return { ...amr, battery, row: newRow, col: newCol, totalDist, path: newPath }
}

// ── MAIN PAGE ──
export default function RMSPage() {
  const { tasks, completeTask, addLog } = useStore()
  const [amrs, setAmrs] = useState<AMR[]>(() => Array.from({ length: 4 }, (_, i) => spawnAMR(i)))
  const [stations, setStations] = useState<Station[]>(STATIONS.map(s => ({
    ...s,
    rackItems: generateRackItems(),
    wallSlots: generateWallSlots(),
  })))
  const [running, setRunning] = useState(false)
  const [fleetSize, setFleetSize] = useState(4)
  const [zoom, setZoom] = useState(0.85)
  const [activeStation, setActiveStation] = useState<Station | null>(null)
  const [activeAmr, setActiveAmr] = useState<AMR | undefined>(undefined)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    _aid = 1
    setAmrs(Array.from({ length: fleetSize }, (_, i) => spawnAMR(i)))
  }, [fleetSize])

  useEffect(() => {
    if (!running) { if (tickRef.current) clearInterval(tickRef.current); return }

    tickRef.current = setInterval(() => {
      const state = useStore.getState()
      const currentTasks: Task[] = state.tasks

      // Auto WCS
      const hasQueued = currentTasks.some((t: Task) => t.status === "WMS_QUEUED")
      if (hasQueued) {
        useStore.setState((s: { tasks: Task[] }) => ({
          tasks: s.tasks.map((t: Task) =>
            t.status === "WMS_QUEUED"
              ? { ...t, status: "WCS_DISPATCHED", wcsProcessed: true, wcsRule: "Auto Route" }
              : t
          )
        }))
      }

      // Assign tasks to idle AMRs
      setAmrs(prev => {
        const freshTasks: Task[] = useStore.getState().tasks
        const dispatched = freshTasks.filter((t: Task) => t.status === "WCS_DISPATCHED")
        const idleAmrs = prev.filter(a => a.status === "IDLE" && a.battery > 12)
        if (!dispatched.length || !idleAmrs.length) return prev

        const taskUpdates: Record<string, Task> = {}
        const amrUpdates: Record<string, Partial<AMR>> = {}
        const usedAmrs = new Set<string>()

        for (const task of dispatched) {
          const available = idleAmrs.filter(a => !usedAmrs.has(a.id))
          if (!available.length) break
          const amr = available[0]
          usedAmrs.add(amr.id)
          taskUpdates[task.id] = { ...task, status: "ASSIGNED", assignedTo: amr.id }

          // Pick a random station to send AMR to
          const targetStation = STATIONS[Math.floor(Math.random() * STATIONS.length)]
          amrUpdates[amr.id] = {
            status: "EN_ROUTE",
            taskId: task.id,
            carryingRack: true,
            targetStation: targetStation.id,
            targetRow: targetStation.row,
            targetCol: AISLE_COLS[Math.floor(Math.random() * AISLE_COLS.length)],
          }
          state.addLog(`RMS → ${task.id} ⟶ ${amr.id} → ${targetStation.label}`, "#e040fb", "RMS")
        }

        if (Object.keys(taskUpdates).length > 0) {
          useStore.setState((s: { tasks: Task[] }) => ({
            tasks: s.tasks.map((t: Task) => taskUpdates[t.id] ? taskUpdates[t.id] : t)
          }))
        }
        return prev.map(a => amrUpdates[a.id] ? { ...a, ...amrUpdates[a.id] } : a)
      })

      // Move AMRs + check station arrival
      setAmrs(prev => prev.map((amr: AMR) => {
        const moved = moveAMR(amr)

        // Check if arrived near target station
        if (amr.taskId && amr.carryingRack && amr.targetStation && Math.random() < 0.04) {
          const station = STATIONS.find(s => s.id === amr.targetStation)
          if (station) {
            // Activate station
            setStations(prev => prev.map(s =>
              s.id === station.id
                ? { ...s, active: true, amrId: amr.id, rackItems: generateRackItems(), wallSlots: generateWallSlots() }
                : s
            ))
            state.addLog(`✓ ${amr.id} arrived at ${station.label}`, "#10b981", "AMR")
          }
          return { ...moved, atStation: amr.targetStation }
        }

        // Complete task
        if (amr.taskId && amr.status === "EN_ROUTE" && Math.random() < 0.03) {
          useStore.getState().completeTask(amr.taskId)
          state.addLog(`✓ ${amr.id} task complete`, "#10b981", "AMR")

          // Deactivate station
          if (amr.targetStation) {
            setStations(prev => prev.map(s =>
              s.id === amr.targetStation ? { ...s, active: false, amrId: undefined } : s
            ))
          }

          return {
            ...moved, status: "IDLE", taskId: null,
            carryingRack: false, targetStation: null, atStation: null,
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
    active:    amrs.filter(a => a.status === "EN_ROUTE").length,
    charging:  amrs.filter(a => a.status === "CHARGING").length,
    avgBatt:   Math.round(amrs.reduce((s, a) => s + a.battery, 0) / Math.max(1, amrs.length)),
    completed: amrs.reduce((s, a) => s + a.completedTasks, 0),
    done:      typedTasks.filter(t => t.status === "DONE").length,
    remaining: typedTasks.filter(t => t.status !== "DONE").length,
    activeStations: stations.filter(s => s.active).length,
  }

  const handleStationClick = (station: Station) => {
    const amr = amrs.find(a => a.targetStation === station.id || a.atStation === station.id)
    setActiveStation(station)
    setActiveAmr(amr)
  }

  const handleConfirmPick = (stationId: string, itemIdx: number, wallSlotIdx: number) => {
    setStations(prev => prev.map(s => {
      if (s.id !== stationId || !s.rackItems || !s.wallSlots) return s
      const newItems = s.rackItems.map((item, i) => i === itemIdx ? { ...item, picked: true, highlighted: false } : item)
      const newWall = s.wallSlots.map((slot, i) => i === wallSlotIdx ? { ...slot, filled: true } : slot)
      return { ...s, rackItems: newItems, wallSlots: newWall }
    }))
    addLog(`Pick confirmed at ${stationId} · Item ${itemIdx + 1} → Wall slot ${wallSlotIdx + 1}`, "#10b981", "AMR")
  }

  return (
    <div style={{ background: "#040810", minHeight: "100vh", color: "#fff", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{
        background: "#080d1a", borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "12px 20px", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: "'Courier New',monospace", fontSize: 9, color: "#8b5cf6", letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>
            MyRoboCloud · RMS · Goods-to-Person
          </div>
          <h1 style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, margin: 0, color: "#fff" }}>
            Live Isometric Warehouse — G2P Mode
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setZoom(z => Math.max(0.4, +(z-0.1).toFixed(1)))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 16 }}>−</button>
          <span style={{ fontFamily: "'Courier New',monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", width: 36, textAlign: "center" }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, +(z+0.1).toFixed(1)))} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 16 }}>+</button>
          <div style={{ width: 8, height: 8, borderRadius: "50%", marginLeft: 8, background: running ? "#10b981" : "#ef4444", boxShadow: running ? "0 0 8px #10b981" : "none" }}/>
          <button onClick={() => setRunning(r => !r)} style={{
            padding: "8px 20px",
            background: running ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
            border: `1px solid ${running ? "#ef4444" : "#10b981"}`,
            borderRadius: 7, color: running ? "#ef4444" : "#10b981",
            fontFamily: "'Courier New',monospace", fontSize: 11, letterSpacing: 1, cursor: "pointer", fontWeight: 700,
          }}>
            {running ? "⏸ PAUSE" : "▶ RUN SIM"}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "auto", background: "#080d1a" }}>
        {[
          { label: "IDLE",      value: stats.idle,           color: "#10b981" },
          { label: "ACTIVE",    value: stats.active,         color: "#3b82f6" },
          { label: "CHARGING",  value: stats.charging,       color: "#8b5cf6" },
          { label: "AVG BATT",  value: `${stats.avgBatt}%`,  color: stats.avgBatt > 40 ? "#10b981" : "#ef4444" },
          { label: "COMPLETED", value: stats.completed,      color: "#10b981" },
          { label: "TASKS DONE",value: stats.done,           color: "#10b981" },
          { label: "REMAINING", value: stats.remaining,      color: "#f59e0b" },
          { label: "G2P ACTIVE",value: stats.activeStations, color: "#10b981" },
        ].map(k => (
          <div key={k.label} style={{ background: "#080d1a", padding: "10px 18px", borderRight: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 3 }}>{k.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Isometric map */}
        <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#040810" }}>

          {/* Station buttons */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {stations.map(s => (
              <button key={s.id}
                onClick={() => s.active && handleStationClick(s)}
                style={{
                  padding: "8px 16px",
                  background: s.active ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${s.active ? "#10b981" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 7, color: s.active ? "#10b981" : "rgba(255,255,255,0.3)",
                  fontFamily: "'Courier New',monospace", fontSize: 10, letterSpacing: 1,
                  cursor: s.active ? "pointer" : "default",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.active ? "#10b981" : "#374151", boxShadow: s.active ? "0 0 6px #10b981" : "none" }}/>
                {s.label} {s.active ? "● ACTIVE — CLICK TO PICK" : "○ IDLE"}
              </button>
            ))}
          </div>

          {/* Isometric map */}
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.2s" }}>
            <IsoMap
              amrs={amrs}
              tasks={typedTasks}
              stations={stations}
              onStationClick={handleStationClick}
            />
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: 260, flexShrink: 0, background: "#080d1a",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", overflow: "hidden",
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
              const activeTask = typedTasks.find(t => t.id === amr.taskId)
              return (
                <div key={amr.id} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(255,255,255,0.07)`,
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
                    <span style={{ background: `${statusColor}18`, border: `1px solid ${statusColor}40`, borderRadius: 4, padding: "1px 6px", fontFamily: "'Courier New',monospace", fontSize: 8, color: statusColor }}>
                      {amr.status.replace("_"," ")}
                    </span>
                  </div>

                  <div style={{ marginBottom: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.3)" }}>BATTERY</span>
                      <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: battColor }}>{Math.round(amr.battery)}%</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${amr.battery}%`, background: battColor, borderRadius: 2, transition: "width 0.5s" }}/>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {[
                      { l: "Done",    v: amr.completedTasks },
                      { l: "Rack",    v: amr.carryingRack ? "YES" : "NO" },
                    ].map(f => (
                      <div key={f.l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "4px 6px" }}>
                        <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: 1, textTransform: "uppercase" }}>{f.l}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{f.v}</div>
                      </div>
                    ))}
                  </div>

                  {amr.targetStation && (
                    <div style={{ marginTop: 6, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 5, padding: "4px 8px" }}>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: "#10b981", letterSpacing: 1, marginBottom: 1 }}>HEADING TO</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{amr.targetStation}</div>
                    </div>
                  )}

                  {activeTask && (
                    <div style={{ marginTop: 6, background: `${amr.color}10`, border: `1px solid ${amr.color}25`, borderRadius: 5, padding: "4px 8px" }}>
                      <div style={{ fontFamily: "'Courier New',monospace", fontSize: 7, color: amr.color, letterSpacing: 1, marginBottom: 1 }}>TASK</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{activeTask.id} · {activeTask.sku}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Task queue */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", maxHeight: 200, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase" }}>Tasks</div>
              <div style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "#10b981" }}>{stats.done}/{typedTasks.length}</div>
            </div>
            {typedTasks.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontStyle: "italic", padding: "8px 0", textAlign: "center" }}>
                Go to WMS → inject orders
              </div>
            )}
            {[...typedTasks].reverse().slice(0, 12).map(t => {
              const sc: Record<string,string> = { WMS_QUEUED:"#3b82f6", WCS_DISPATCHED:"#f59e0b", ASSIGNED:"#8b5cf6", DONE:"#10b981" }
              const color = sc[t.status] || "#fff"
              return (
                <div key={t.id} style={{ display: "flex", gap: 5, alignItems: "center", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", opacity: t.status === "DONE" ? 0.5 : 1 }}>
                  <span style={{ fontFamily: "'Courier New',monospace", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>{t.id}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#fff", flex: 1 }}>{t.type}</span>
                  <span style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 3, padding: "0 4px", fontFamily: "'Courier New',monospace", fontSize: 7, color }}>{t.status.replace(/_/g," ")}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Station picking modal */}
      {activeStation && (
        <StationModal
          station={activeStation}
          amr={activeAmr}
          onClose={() => setActiveStation(null)}
          onConfirmPick={handleConfirmPick}
        />
      )}
    </div>
  )
}