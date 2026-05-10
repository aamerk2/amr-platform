import { create } from 'zustand'

let _orderId = 1
let _taskId = 1
let _amrId = 1

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
const PRIORITY_SCORE = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
const SKUS = [
  "SKU-1042","SKU-2381","SKU-4917","SKU-3205","SKU-8834",
  "SKU-6612","SKU-7743","SKU-9901","SKU-5523","SKU-4410",
]
const AMR_COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316"]
const AMR_MODELS = ["MiR100","Geek+ P800","Fetch Cart","GreyOrange"]

// Grid config
const AISLE_COLS = [3, 7, 11]
const COLS = 16
const ROWS = 12

// Station waypoints — these are REAL grid positions AMRs navigate to
const STATION_WAYPOINTS = {
  S1: { row: 2,  col: 1  },  // left side row 2
  S2: { row: 7,  col: 1  },  // left side row 7
  S3: { row: 2,  col: 13 },  // right side row 2
  S4: { row: 7,  col: 13 },  // right side row 7
}

function makeOrder() {
  const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)]
  const itemCount = Math.floor(1 + Math.random() * 4)
  return {
    id: `ORD-${String(_orderId++).padStart(5,"0")}`,
    customer: `CUST-${Math.floor(100 + Math.random() * 900)}`,
    priority,
    status: "RECEIVED",
    createdAt: Date.now(),
    items: Array.from({ length: itemCount }, () => ({
      sku: SKUS[Math.floor(Math.random() * SKUS.length)],
      qty: Math.floor(1 + Math.random() * 10),
      location: `A${Math.floor(1+Math.random()*9)}-B${Math.floor(1+Math.random()*20)}`,
    })),
  }
}

function makeTasks(order) {
  return order.items.map(item => ({
    id: `TSK-${String(_taskId++).padStart(5,"0")}`,
    orderId: order.id,
    type: "PICK",
    priority: order.priority,
    sku: item.sku,
    qty: item.qty,
    location: item.location,
    // rack location — somewhere in the shelf area
    from: [
      Math.floor(2 + Math.random() * (ROWS - 4)),
      Math.floor(4 + Math.random() * (COLS - 8)),
    ],
    status: "WMS_QUEUED",
    assignedTo: null,
    assignedStation: null,
    weight: Math.floor(5 + Math.random() * 80),
    createdAt: Date.now(),
    wcsProcessed: false,
    wcsRule: null,
    completedAt: null,
    g2pStatus: "WMS_QUEUED",
    stationId: null,
    pickStartedAt: null,
    pickCompletedAt: null,
  }))
}

function makeAMR(index) {
  const col = AISLE_COLS[index % AISLE_COLS.length]
  return {
    id: `AMR-${String(_amrId++).padStart(3,"0")}`,
    color: AMR_COLORS[index % AMR_COLORS.length],
    model: AMR_MODELS[index % AMR_MODELS.length],
    status: "IDLE",
    battery: 80 + Math.random() * 20,
    row: 0,
    col,
    homeRow: 0,
    homeCol: col,
    taskId: null,
    stationId: null,
    carryingRack: false,
    rackId: null,
    completedTasks: 0,
    totalDist: 0,
    path: [],
    targetRow: 0,
    targetCol: col,
    phase: "IDLE", // IDLE | TO_RACK | TO_STATION | AT_STATION | RETURNING
  }
}

// Move one step toward target staying in aisles where possible
function stepToward(row, col, targetRow, targetCol) {
  let newRow = row
  let newCol = col

  // If not in an aisle column and not at target column, move to nearest aisle first
  const inAisle = AISLE_COLS.includes(col)

  if (!inAisle && row !== targetRow) {
    // get to nearest aisle col first
    const nearest = AISLE_COLS.reduce((a, b) =>
      Math.abs(a - col) < Math.abs(b - col) ? a : b
    )
    newCol = col + (nearest > col ? 1 : -1)
  } else if (row !== targetRow) {
    newRow = row + (targetRow > row ? 1 : -1)
  } else if (col !== targetCol) {
    newCol = col + (targetCol > col ? 1 : -1)
  }

  return {
    row: Math.max(0, Math.min(ROWS - 1, newRow)),
    col: Math.max(0, Math.min(COLS - 1, newCol)),
  }
}

function isAtTarget(row, col, targetRow, targetCol) {
  return Math.abs(row - targetRow) <= 1 && Math.abs(col - targetCol) <= 1
}

export const useStore = create((set, get) => ({

  // ── STATE ──
  orders: [],
  tasks: [],
  amrs: Array.from({ length: 4 }, (_, i) => makeAMR(i)),
  logs: [],
  wcsRules: [
    { id:"R1", name:"Battery Priority",   desc:"Route low-battery AMRs to charge first",      active:true  },
    { id:"R2", name:"Zone Balancing",     desc:"Distribute tasks evenly across zones",         active:true  },
    { id:"R3", name:"Critical Fast-lane", desc:"CRITICAL tasks skip queue immediately",        active:true  },
    { id:"R4", name:"Batch Grouping",     desc:"Cluster nearby picks into single AMR run",     active:false },
    { id:"R5", name:"Shift Handover",     desc:"Complete in-progress tasks before shift end",  active:true  },
    { id:"R6", name:"Traffic Avoidance",  desc:"Reroute AMRs around congestion zones",         active:false },
  ],
  stations: [
    { id:"S1", label:"Station 1 — Left A",  side:"left",  status:"IDLE", amrId:null, taskId:null, pickProgress:0, totalItems:0, waypoint: STATION_WAYPOINTS.S1 },
    { id:"S2", label:"Station 2 — Left B",  side:"left",  status:"IDLE", amrId:null, taskId:null, pickProgress:0, totalItems:0, waypoint: STATION_WAYPOINTS.S2 },
    { id:"S3", label:"Station 3 — Right A", side:"right", status:"IDLE", amrId:null, taskId:null, pickProgress:0, totalItems:0, waypoint: STATION_WAYPOINTS.S3 },
    { id:"S4", label:"Station 4 — Right B", side:"right", status:"IDLE", amrId:null, taskId:null, pickProgress:0, totalItems:0, waypoint: STATION_WAYPOINTS.S4 },
  ],

  // ── LOGGING ──
  addLog: (msg, color="#00e5ff", layer="SYS") =>
    set(s => ({
      logs: [
        { msg, color, layer, t: new Date().toLocaleTimeString("en-AU",{hour12:false}) },
        ...s.logs,
      ].slice(0, 150),
    })),

  // ── WMS ──
  injectOrder: () => {
    const order = makeOrder()
    const tasks = makeTasks(order)
    set(s => ({
      orders: [order, ...s.orders].slice(0, 60),
      tasks: [...s.tasks, ...tasks],
    }))
    get().addLog(`WMS → ${order.id} | ${order.items.length} lines | ${order.priority}`, "#00e5ff", "WMS")
  },

  injectBatch: (count=5) => {
    for (let i=0; i<count; i++) setTimeout(() => get().injectOrder(), i*100)
  },

  // ── WCS ──
  toggleRule: (id) =>
    set(s => ({ wcsRules: s.wcsRules.map(r => r.id===id ? {...r, active:!r.active} : r) })),

  processWCS: () => {
    const { tasks, wcsRules, addLog } = get()
    const rules = wcsRules.filter(r => r.active)
    let changed = false
    const updated = tasks.map(t => {
      if (t.status !== "WMS_QUEUED") return t
      changed = true
      const rule = rules.find(r=>r.id==="R3") && t.priority==="CRITICAL"
        ? "Critical Fast-lane" : "Standard Route"
      addLog(`WCS → ${t.id} [${t.priority}] via ${rule}`, "#ffb300", "WCS")
      return { ...t, status:"WCS_DISPATCHED", g2pStatus:"WCS_DISPATCHED", wcsProcessed:true, wcsRule:rule }
    })
    if (changed) set({ tasks: updated })
  },

  // ── FLEET ──
  setFleetSize: (size) => {
    _amrId = 1
    set({ amrs: Array.from({ length: size }, (_, i) => makeAMR(i)) })
  },

  // ── STATION ACTIONS ──
  markPickingDone: (stationId) => {
    const { stations, addLog } = get()
    const station = stations.find(s => s.id === stationId)
    if (!station) return
    set(s => ({
      stations: s.stations.map(st =>
        st.id === stationId ? { ...st, status:"PICKING_DONE" } : st
      ),
      tasks: s.tasks.map(t =>
        t.id === station.taskId
          ? { ...t, status:"PICKED", g2pStatus:"PICKED", pickCompletedAt:Date.now() }
          : t
      ),
    }))
    addLog(`Picking complete at ${stationId} — AMR returning rack`, "#10b981", "STATION")
  },

  updateStationProgress: (stationId, progress, total) => {
    set(s => ({
      stations: s.stations.map(st =>
        st.id === stationId ? { ...st, pickProgress:progress, totalItems:total } : st
      ),
    }))
  },

  completeTask: (taskId) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? { ...t, status:"DONE", g2pStatus:"DONE", completedAt:Date.now() }
          : t
      ),
    }))
  },

  // ── MAIN AUTOMATION TICK ──
  automationTick: () => {
    const { addLog } = get()

    // STEP 1 — Auto WCS: push WMS_QUEUED → WCS_DISPATCHED
    const s1 = get()
    if (s1.tasks.some(t => t.status === "WMS_QUEUED")) {
      set(s => ({
        tasks: s.tasks.map(t =>
          t.status === "WMS_QUEUED"
            ? { ...t, status:"WCS_DISPATCHED", g2pStatus:"WCS_DISPATCHED", wcsProcessed:true, wcsRule:"Auto Route" }
            : t
        ),
      }))
    }

    // STEP 2 — Assign one task per tick to idle AMR + free station
    const s2 = get()
    const dispatched = s2.tasks
      .filter(t => t.status === "WCS_DISPATCHED")
      .sort((a,b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority])
    const idleAmrs    = s2.amrs.filter(a => a.status === "IDLE" && a.battery > 15)
    const freeStations = s2.stations.filter(s => s.status === "IDLE")

    if (dispatched.length > 0 && idleAmrs.length > 0 && freeStations.length > 0) {
      const task    = dispatched[0]
      const amr     = idleAmrs[0]
      const station = freeStations[0]
      const wp      = station.waypoint

      set(s => ({
        tasks: s.tasks.map(t =>
          t.id === task.id
            ? { ...t, status:"AMR_ASSIGNED", g2pStatus:"AMR_ASSIGNED", assignedTo:amr.id, stationId:station.id }
            : t
        ),
        amrs: s.amrs.map(a =>
          a.id === amr.id
            ? {
                ...a,
                status: "EN_ROUTE",
                phase: "TO_RACK",
                taskId: task.id,
                stationId: station.id,
                targetRow: task.from[0],
                targetCol: task.from[1],
                carryingRack: false,
              }
            : a
        ),
        stations: s.stations.map(st =>
          st.id === station.id
            ? { ...st, status:"WAITING_AMR", amrId:amr.id, taskId:task.id }
            : st
        ),
      }))
      addLog(`${amr.id} dispatched → rack [${task.from}] → ${station.label}`, "#e040fb", "RMS")
    }

    // STEP 3 — Move every AMR one step
    const s3 = get()

    const newAmrs = s3.amrs.map(amr => {
      let { row, col, status, phase, battery, targetRow, targetCol,
            path, totalDist, taskId, stationId, carryingRack, homeRow, homeCol } = amr

      // Drain battery
      battery = Math.max(0, battery - 0.06)

      // Low battery → charge
      if (battery < 8 && status !== "CHARGING") {
        if (stationId) {
          set(s => ({
            stations: s.stations.map(st =>
              st.id === stationId ? { ...st, status:"IDLE", amrId:null, taskId:null } : st
            ),
            tasks: taskId
              ? s.tasks.map(t =>
                  t.id === taskId
                    ? { ...t, status:"WCS_DISPATCHED", g2pStatus:"WCS_DISPATCHED", assignedTo:null, stationId:null }
                    : t
                )
              : s.tasks,
          }))
        }
        addLog(`⚡ ${amr.id} low battery → charging`, "#8b5cf6", "RMS")
        return { ...amr, battery, status:"CHARGING", phase:"IDLE", taskId:null, stationId:null, carryingRack:false, targetRow:homeRow, targetCol:homeCol }
      }

      // Recharge
      if (status === "CHARGING") {
        battery = Math.min(100, battery + 2)
        if (battery >= 95) {
          return { ...amr, battery, status:"IDLE", phase:"IDLE", row:homeRow, col:homeCol }
        }
        return { ...amr, battery }
      }

      // IDLE — nothing to do
      if (status === "IDLE") return { ...amr, battery }

      // AT_STATION — wait for PICKING_DONE signal
      if (status === "AT_STATION" || phase === "AT_STATION") {
        const station = s3.stations.find(s => s.id === stationId)
        if (station && station.status === "PICKING_DONE") {
          const task = s3.tasks.find(t => t.id === taskId)
          const retRow = task ? task.from[0] : homeRow
          const retCol = task ? task.from[1] : homeCol
          addLog(`${amr.id} picking done → returning rack`, "#3b82f6", "RMS")
          set(s => ({
            tasks: s.tasks.map(t =>
              t.id === taskId ? { ...t, status:"AMR_RETURNING", g2pStatus:"AMR_RETURNING" } : t
            ),
            stations: s.stations.map(st =>
              st.id === stationId ? { ...st, status:"WAITING_RETURN" } : st
            ),
          }))
          return { ...amr, battery, status:"EN_ROUTE", phase:"RETURNING", targetRow:retRow, targetCol:retCol }
        }
        return { ...amr, battery }
      }

      // EN_ROUTE — move toward target
      const moved = stepToward(row, col, targetRow, targetCol)
      const newPath = [...path, { row:moved.row, col:moved.col }].slice(-10)
      const arrived = isAtTarget(moved.row, moved.col, targetRow, targetCol)

      // ── Phase: TO_RACK ──
      if (phase === "TO_RACK") {
        if (arrived) {
          // Pick up rack → now head to station
          const station = s3.stations.find(s => s.id === stationId)
          const wp = station?.waypoint || { row:2, col:1 }
          const rackId = `RACK-${Math.floor(100 + Math.random()*900)}`
          addLog(`${amr.id} picked up rack → heading to ${station?.label}`, "#f59e0b", "RMS")
          set(s => ({
            tasks: s.tasks.map(t =>
              t.id === taskId ? { ...t, status:"AMR_MOVING", g2pStatus:"AMR_MOVING" } : t
            ),
            stations: s.stations.map(st =>
              st.id === stationId ? { ...st, status:"AMR_EN_ROUTE" } : st
            ),
          }))
          return {
            ...amr, battery,
            row: moved.row, col: moved.col,
            phase: "TO_STATION",
            carryingRack: true,
            rackId,
            targetRow: wp.row,
            targetCol: wp.col,
            path: newPath,
            totalDist: totalDist + 1,
          }
        }
        return { ...amr, battery, row:moved.row, col:moved.col, path:newPath, totalDist:totalDist+1 }
      }

      // ── Phase: TO_STATION ──
      if (phase === "TO_STATION") {
        if (arrived) {
          // Arrived at station!
          addLog(`✅ ${amr.id} ARRIVED at ${stationId} — station ready for picking`, "#10b981", "RMS")
          set(s => ({
            tasks: s.tasks.map(t =>
              t.id === taskId
                ? { ...t, status:"AT_STATION", g2pStatus:"AT_STATION", pickStartedAt:Date.now() }
                : t
            ),
            stations: s.stations.map(st =>
              st.id === stationId ? { ...st, status:"ACTIVE" } : st
            ),
          }))
          return {
            ...amr, battery,
            row: moved.row, col: moved.col,
            status: "AT_STATION",
            phase: "AT_STATION",
            path: newPath,
          }
        }
        return { ...amr, battery, row:moved.row, col:moved.col, path:newPath, totalDist:totalDist+1 }
      }

      // ── Phase: RETURNING ──
      if (phase === "RETURNING") {
        if (arrived) {
          addLog(`✅ ${amr.id} rack returned — now IDLE`, "#10b981", "RMS")
          set(s => ({
            tasks: s.tasks.map(t =>
              t.id === taskId
                ? { ...t, status:"DONE", g2pStatus:"DONE", completedAt:Date.now() }
                : t
            ),
            stations: s.stations.map(st =>
              st.id === stationId
                ? { ...st, status:"IDLE", amrId:null, taskId:null, pickProgress:0, totalItems:0 }
                : st
            ),
            orders: s.orders.map(o => {
              const task = s.tasks.find(t => t.id === taskId)
              if (!task || o.id !== task.orderId) return o
              const orderTasks = get().tasks.filter(t => t.orderId === o.id)
              const allDone = orderTasks.every(t => t.id === taskId || t.status === "DONE")
              return { ...o, status: allDone ? "SHIPPED" : "PROCESSING" }
            }),
          }))
          return {
            ...amr, battery,
            status: "IDLE", phase: "IDLE",
            taskId: null, stationId: null,
            carryingRack: false, rackId: null,
            row: homeRow, col: homeCol,
            completedTasks: amr.completedTasks + 1,
          }
        }
        return { ...amr, battery, row:moved.row, col:moved.col, path:newPath, totalDist:totalDist+1 }
      }

      return { ...amr, battery, row:moved.row, col:moved.col, path:newPath, totalDist:totalDist+1 }
    })

    set({ amrs: newAmrs })
  },

  // legacy
  processRMS: () => {},
  clearLogs: () => set({ logs: [] }),
}))