import { create } from 'zustand'

let _orderId = 1
let _taskId = 1
let _amrId = 1

const TASK_TYPES = ["PICK", "REPLENISH", "TRANSPORT", "INVENTORY", "QC", "RETURN"]
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
const PRIORITY_SCORE = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
const SKUS = [
  "SKU-1042","SKU-2381","SKU-4917","SKU-3205","SKU-8834",
  "SKU-6612","SKU-7743","SKU-9901","SKU-5523","SKU-4410",
]
const AMR_COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316"]
const AMR_MODELS = ["MiR100","Geek+ P800","Fetch Cart","GreyOrange"]

const AISLE_COLS = [3, 7, 11]
const COLS = 16
const ROWS = 12

function makeOrder() {
  const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)]
  const itemCount = Math.floor(1 + Math.random() * 5)
  return {
    id: `ORD-${String(_orderId++).padStart(5, "0")}`,
    customer: `CUST-${Math.floor(100 + Math.random() * 900)}`,
    priority,
    status: "RECEIVED",
    createdAt: Date.now(),
    items: Array.from({ length: itemCount }, () => ({
      sku: SKUS[Math.floor(Math.random() * SKUS.length)],
      qty: Math.floor(1 + Math.random() * 10),
      location: `A${Math.floor(1 + Math.random() * 9)}-B${Math.floor(1 + Math.random() * 20)}`,
    })),
  }
}

function makeTasks(order) {
  return order.items.map(item => ({
    id: `TSK-${String(_taskId++).padStart(5, "0")}`,
    orderId: order.id,
    type: "PICK",
    priority: order.priority,
    sku: item.sku,
    qty: item.qty,
    location: item.location,
    from: [
      Math.floor(1 + Math.random() * (ROWS - 2)),
      Math.floor(1 + Math.random() * (COLS - 2)),
    ],
    to: [ROWS - 1, Math.floor(1 + Math.random() * (COLS - 2))],
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
  return {
    id: `AMR-${String(_amrId++).padStart(3, "0")}`,
    color: AMR_COLORS[index % AMR_COLORS.length],
    model: AMR_MODELS[index % AMR_MODELS.length],
    status: "IDLE",
    battery: 75 + Math.random() * 25,
    row: 0,
    col: AISLE_COLS[index % AISLE_COLS.length],
    homeRow: 0,
    homeCol: AISLE_COLS[index % AISLE_COLS.length],
    taskId: null,
    stationId: null,
    carryingRack: false,
    rackId: null,
    completedTasks: 0,
    totalDist: 0,
    path: [],
    targetRow: 0,
    targetCol: AISLE_COLS[index % AISLE_COLS.length],
  }
}

function moveStep(row, col, targetRow, targetCol) {
  let newRow = row
  let newCol = col
  const inAisleCol = AISLE_COLS.includes(col)

  if (!inAisleCol) {
    const nearestAC = AISLE_COLS.reduce((a, b) =>
      Math.abs(a - col) < Math.abs(b - col) ? a : b
    )
    newCol = col + (nearestAC > col ? 1 : -1)
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

export const useStore = create((set, get) => ({

  // ── STATE ──
  orders: [],
  tasks: [],
  amrs: Array.from({ length: 4 }, (_, i) => makeAMR(i)),
  logs: [],
  wcsRules: [
    { id: "R1", name: "Battery Priority",  desc: "Route low-battery AMRs to charge first",      active: true  },
    { id: "R2", name: "Zone Balancing",    desc: "Distribute tasks evenly across zones",         active: true  },
    { id: "R3", name: "Critical Fast-lane",desc: "CRITICAL tasks skip queue immediately",        active: true  },
    { id: "R4", name: "Batch Grouping",    desc: "Cluster nearby picks into single AMR run",     active: false },
    { id: "R5", name: "Shift Handover",    desc: "Complete in-progress tasks before shift end",  active: true  },
    { id: "R6", name: "Traffic Avoidance", desc: "Reroute AMRs around congestion zones",         active: false },
  ],
  stations: [
    { id: "S1", label: "Station 1 — Left A",  side: "left",  status: "IDLE", amrId: null, taskId: null, pickProgress: 0, totalItems: 0 },
    { id: "S2", label: "Station 2 — Left B",  side: "left",  status: "IDLE", amrId: null, taskId: null, pickProgress: 0, totalItems: 0 },
    { id: "S3", label: "Station 3 — Right A", side: "right", status: "IDLE", amrId: null, taskId: null, pickProgress: 0, totalItems: 0 },
    { id: "S4", label: "Station 4 — Right B", side: "right", status: "IDLE", amrId: null, taskId: null, pickProgress: 0, totalItems: 0 },
  ],

  // ── LOGGING ──
  addLog: (msg, color = "#00e5ff", layer = "SYS") =>
    set(s => ({
      logs: [
        { msg, color, layer, t: new Date().toLocaleTimeString("en-AU", { hour12: false }) },
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
    get().addLog(
      `WMS → ${order.id} | ${order.items.length} lines | ${order.priority}`,
      "#00e5ff", "WMS"
    )
  },

  injectBatch: (count = 5) => {
    for (let i = 0; i < count; i++) {
      setTimeout(() => get().injectOrder(), i * 100)
    }
  },

  // ── WCS ──
  toggleRule: (id) =>
    set(s => ({
      wcsRules: s.wcsRules.map(r => r.id === id ? { ...r, active: !r.active } : r)
    })),

  processWCS: () => {
    const { tasks, wcsRules, addLog } = get()
    const rules = wcsRules.filter(r => r.active)
    let changed = false
    const updated = tasks.map(t => {
      if (t.status !== "WMS_QUEUED") return t
      changed = true
      const rule = rules.find(r => r.id === "R3") && t.priority === "CRITICAL"
        ? "Critical Fast-lane" : "Standard Route"
      addLog(`WCS → ${t.id} [${t.priority}] via ${rule}`, "#ffb300", "WCS")
      return {
        ...t,
        status: "WCS_DISPATCHED",
        g2pStatus: "WCS_DISPATCHED",
        wcsProcessed: true,
        wcsRule: rule,
      }
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
        st.id === stationId ? { ...st, status: "PICKING_DONE" } : st
      ),
      tasks: s.tasks.map(t =>
        t.id === station.taskId
          ? { ...t, status: "PICKED", g2pStatus: "PICKED", pickCompletedAt: Date.now() }
          : t
      ),
    }))
    addLog(`Picking complete at ${stationId} — AMR returning rack`, "#10b981", "STATION")
  },

  updateStationProgress: (stationId, progress, total) => {
    set(s => ({
      stations: s.stations.map(st =>
        st.id === stationId
          ? { ...st, pickProgress: progress, totalItems: total }
          : st
      ),
    }))
  },

  // ── TASK COMPLETION ──
  completeTask: (taskId) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? { ...t, status: "DONE", g2pStatus: "DONE", completedAt: Date.now() }
          : t
      ),
    }))
  },

  // ── MAIN AUTOMATION TICK ──
  automationTick: () => {
    const state = get()
    const { addLog } = state

    // ── STEP 1: Auto WCS ──
    const hasQueued = state.tasks.some(t => t.status === "WMS_QUEUED")
    if (hasQueued) {
      set(s => ({
        tasks: s.tasks.map(t =>
          t.status === "WMS_QUEUED"
            ? {
                ...t,
                status: "WCS_DISPATCHED",
                g2pStatus: "WCS_DISPATCHED",
                wcsProcessed: true,
                wcsRule: "Auto Route",
              }
            : t
        ),
      }))
    }

    // ── STEP 2: Assign tasks to idle AMRs + free stations ──
    const freshState = get()
    const dispatched = freshState.tasks
      .filter(t => t.status === "WCS_DISPATCHED")
      .sort((a, b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority])

    const idleAmrs = freshState.amrs.filter(a => a.status === "IDLE" && a.battery > 15)
    const freeStations = freshState.stations.filter(s => s.status === "IDLE")

    if (dispatched.length > 0 && idleAmrs.length > 0 && freeStations.length > 0) {
      const task = dispatched[0]
      const amr = idleAmrs[0]
      const station = freeStations[0]

      set(s => ({
        tasks: s.tasks.map(t =>
          t.id === task.id
            ? {
                ...t,
                status: "AMR_ASSIGNED",
                g2pStatus: "AMR_ASSIGNED",
                assignedTo: amr.id,
                stationId: station.id,
                assignedStation: station.id,
              }
            : t
        ),
        amrs: s.amrs.map(a =>
          a.id === amr.id
            ? {
                ...a,
                status: "MOVING_TO_RACK",
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
            ? { ...st, status: "WAITING_AMR", amrId: amr.id, taskId: task.id }
            : st
        ),
      }))
      addLog(
        `AMR ${amr.id} → rack [${task.from}] → ${station.label}`,
        "#e040fb", "RMS"
      )
    }

    // ── STEP 3: Move all AMRs ──
    const currentState = get()

    const updatedAmrs = currentState.amrs.map(amr => {
      let {
        row, col, status, battery, targetRow, targetCol,
        path, totalDist, taskId, stationId, carryingRack, homeRow, homeCol,
      } = amr

      // Drain battery
      battery = Math.max(0, battery - 0.08)

      // Low battery → charge
      if (battery < 8 && status !== "CHARGING") {
        addLog(`⚡ ${amr.id} low battery → charging`, "#8b5cf6", "RMS")
        if (stationId) {
          set(s => ({
            stations: s.stations.map(st =>
              st.id === stationId
                ? { ...st, status: "IDLE", amrId: null, taskId: null }
                : st
            ),
            tasks: taskId
              ? s.tasks.map(t =>
                  t.id === taskId
                    ? { ...t, status: "WCS_DISPATCHED", g2pStatus: "WCS_DISPATCHED", assignedTo: null, stationId: null }
                    : t
                )
              : s.tasks,
          }))
        }
        return {
          ...amr, battery,
          status: "CHARGING",
          taskId: null, stationId: null,
          carryingRack: false,
          targetRow: homeRow,
          targetCol: homeCol,
        }
      }

      // Recharge
      if (status === "CHARGING") {
        battery = Math.min(100, battery + 1.5)
        if (battery >= 95) {
          return { ...amr, battery, status: "IDLE", row: homeRow, col: homeCol }
        }
        return { ...amr, battery }
      }

      // Already at target check
      const atTarget = row === targetRow && col === targetCol

      // ── MOVING TO RACK ──
      if (status === "MOVING_TO_RACK") {
        if (atTarget || Math.random() < 0.025) {
          const task = currentState.tasks.find(t => t.id === taskId)
          const station = currentState.stations.find(s => s.id === stationId)
          if (!task || !station) return { ...amr, battery }

          const stIdx = parseInt(station.id.replace("S", "")) - 1
          const stRow = stIdx < 2 ? [2, 7][stIdx] : [2, 7][stIdx - 2]
          const stCol = AISLE_COLS[0]

          addLog(`${amr.id} picked rack → heading to ${station.label}`, "#f59e0b", "RMS")

          set(s => ({
            tasks: s.tasks.map(t =>
              t.id === taskId
                ? { ...t, status: "AMR_MOVING", g2pStatus: "AMR_MOVING" }
                : t
            ),
            stations: s.stations.map(st =>
              st.id === stationId ? { ...st, status: "AMR_EN_ROUTE" } : st
            ),
          }))

          return {
            ...amr, battery,
            status: "MOVING_TO_STATION",
            carryingRack: true,
            rackId: `RACK-${Math.floor(100 + Math.random() * 900)}`,
            targetRow: stRow,
            targetCol: stCol,
            path: [...path, { row, col }].slice(-8),
            totalDist: totalDist + 1,
          }
        }

        const moved = moveStep(row, col, targetRow, targetCol)
        return {
          ...amr, battery,
          row: moved.row, col: moved.col,
          totalDist: totalDist + 1,
          path: [...path, moved].slice(-8),
        }
      }

      // ── MOVING TO STATION ──
      if (status === "MOVING_TO_STATION") {
        if (atTarget || Math.random() < 0.025) {
          addLog(`✓ ${amr.id} ARRIVED at ${stationId} — ready for picking`, "#10b981", "RMS")

          set(s => ({
            tasks: s.tasks.map(t =>
              t.id === taskId
                ? { ...t, status: "AT_STATION", g2pStatus: "AT_STATION", pickStartedAt: Date.now() }
                : t
            ),
            stations: s.stations.map(st =>
              st.id === stationId ? { ...st, status: "ACTIVE" } : st
            ),
          }))

          return {
            ...amr, battery,
            status: "AT_STATION",
            row, col,
            path: [...path, { row, col }].slice(-8),
          }
        }

        const moved = moveStep(row, col, targetRow, targetCol)
        return {
          ...amr, battery,
          row: moved.row, col: moved.col,
          totalDist: totalDist + 1,
          path: [...path, moved].slice(-8),
        }
      }

      // ── AT STATION — wait for picking to complete ──
      if (status === "AT_STATION") {
        const station = currentState.stations.find(s => s.id === stationId)
        if (station && station.status === "PICKING_DONE") {
          addLog(`${amr.id} returning rack to storage`, "#3b82f6", "RMS")
          const task = currentState.tasks.find(t => t.id === taskId)
          const retRow = task ? task.from[0] : homeRow
          const retCol = task ? task.from[1] : homeCol

          set(s => ({
            tasks: s.tasks.map(t =>
              t.id === taskId
                ? { ...t, status: "AMR_RETURNING", g2pStatus: "AMR_RETURNING" }
                : t
            ),
            stations: s.stations.map(st =>
              st.id === stationId ? { ...st, status: "WAITING_RETURN" } : st
            ),
          }))

          return {
            ...amr, battery,
            status: "RETURNING",
            targetRow: retRow,
            targetCol: retCol,
          }
        }
        return { ...amr, battery }
      }

      // ── RETURNING rack to storage ──
      if (status === "RETURNING") {
        if (atTarget || Math.random() < 0.025) {
          addLog(`✓ ${amr.id} rack returned — IDLE`, "#10b981", "RMS")
          const task = currentState.tasks.find(t => t.id === taskId)

          set(s => ({
            tasks: s.tasks.map(t =>
              t.id === taskId
                ? { ...t, status: "DONE", g2pStatus: "DONE", completedAt: Date.now() }
                : t
            ),
            stations: s.stations.map(st =>
              st.id === stationId
                ? { ...st, status: "IDLE", amrId: null, taskId: null, pickProgress: 0, totalItems: 0 }
                : st
            ),
            orders: s.orders.map(o => {
              if (!task || o.id !== task.orderId) return o
              const orderTasks = get().tasks.filter(t => t.orderId === o.id)
              const allDone = orderTasks.every(t => t.id === taskId || t.status === "DONE")
              return { ...o, status: allDone ? "SHIPPED" : "PROCESSING" }
            }),
          }))

          return {
            ...amr, battery,
            status: "IDLE",
            taskId: null, stationId: null,
            carryingRack: false, rackId: null,
            row: homeRow, col: homeCol,
            completedTasks: amr.completedTasks + 1,
          }
        }

        const moved = moveStep(row, col, targetRow, targetCol)
        return {
          ...amr, battery,
          row: moved.row, col: moved.col,
          totalDist: totalDist + 1,
          path: [...path, moved].slice(-8),
        }
      }

      // IDLE
      return { ...amr, battery }
    })

    set({ amrs: updatedAmrs })
  },

  // ── LEGACY ──
  processRMS: () => {},
  clearLogs: () => set({ logs: [] }),
}))