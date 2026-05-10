import { create } from 'zustand'

let _orderId = 1
let _taskId = 1

const TASK_TYPES = ["PICK", "REPLENISH", "TRANSPORT", "INVENTORY", "QC", "RETURN"]
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
const PRIORITY_SCORE = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

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
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      qty: Math.floor(1 + Math.random() * 10),
      location: `A${Math.floor(1 + Math.random() * 9)}-B${Math.floor(1 + Math.random() * 20)}`,
    })),
  }
}

function makeTasks(order) {
  return order.items.map(item => ({
    id: `TSK-${String(_taskId++).padStart(5, "0")}`,
    orderId: order.id,
    type: TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)],
    priority: order.priority,
    sku: item.sku,
    qty: item.qty,
    location: item.location,
    from: [Math.floor(2 + Math.random() * 12), Math.floor(1 + Math.random() * 18)],
    to:   [Math.floor(2 + Math.random() * 12), Math.floor(1 + Math.random() * 18)],
    status: "WMS_QUEUED",
    assignedTo: null,
    weight: Math.floor(5 + Math.random() * 80),
    createdAt: Date.now(),
    wcsProcessed: false,
    wcsRule: null,
    completedAt: null,
  }))
}

export const useStore = create((set, get) => ({
  // ── Data ──
  orders: [],
  tasks: [],
  logs: [],
  wcsRules: [
    { id: "R1", name: "Battery Priority",  desc: "Route low-battery AMRs to charge first",         active: true  },
    { id: "R2", name: "Zone Balancing",    desc: "Distribute tasks evenly across zones",            active: true  },
    { id: "R3", name: "Critical Fast-lane",desc: "CRITICAL tasks skip queue immediately",          active: true  },
    { id: "R4", name: "Batch Grouping",    desc: "Cluster nearby picks into single AMR run",       active: false },
    { id: "R5", name: "Shift Handover",    desc: "Complete in-progress tasks before shift end",    active: true  },
    { id: "R6", name: "Traffic Avoidance", desc: "Reroute AMRs around congestion zones",           active: false },
  ],

  // ── Logging ──
  addLog: (msg, color = "#00e5ff", layer = "SYS") =>
    set(s => ({
      logs: [
        { msg, color, layer, t: new Date().toLocaleTimeString("en-AU", { hour12: false }) },
        ...s.logs,
      ].slice(0, 100),
    })),

  // ── WMS Actions ──
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

  // ── WCS Actions ──
  toggleRule: (id) =>
    set(s => ({
      wcsRules: s.wcsRules.map(r => r.id === id ? { ...r, active: !r.active } : r),
    })),

  processWCS: () => {
    const { tasks, wcsRules, addLog } = get()
    const rules = wcsRules.filter(r => r.active)
    let changed = false
    const updated = tasks.map(t => {
      if (t.status !== "WMS_QUEUED") return t
      changed = true
      const rule =
        rules.find(r => r.id === "R3") && t.priority === "CRITICAL"
          ? "Critical Fast-lane"
          : "Standard Route"
      addLog(`WCS → ${t.id} [${t.priority}] via ${rule}`, "#ffb300", "WCS")
      return { ...t, status: "WCS_DISPATCHED", wcsProcessed: true, wcsRule: rule }
    })
    if (changed) set({ tasks: updated })
  },

  // ── RMS Actions ──
  processRMS: (amrs, setAmrs) => {
    const { tasks, addLog } = get()
    const queued = [...tasks.filter(t => t.status === "WCS_DISPATCHED")]
      .sort((a, b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority])
    const idle = amrs.filter(a => a.status === "IDLE" && a.battery > 12)
    if (!queued.length || !idle.length) return

    const taskUpdates = {}
    const amrUpdates  = {}
    const usedAmrs    = new Set()

    for (const task of queued) {
      const available = idle.filter(a => !usedAmrs.has(a.id))
      if (!available.length) break
      const best = available[0]
      usedAmrs.add(best.id)
      taskUpdates[task.id] = { ...task, status: "ASSIGNED", assignedTo: best.id }
      amrUpdates[best.id]  = { ...best, status: "EN_ROUTE", taskId: task.id }
      addLog(`RMS → ${task.id} ⟶ ${best.id} [${task.priority}]`, "#e040fb", "RMS")
    }

    if (Object.keys(taskUpdates).length) {
      set(s => ({ tasks: s.tasks.map(t => taskUpdates[t.id] || t) }))
      setAmrs((prev) => prev.map(a => amrUpdates[a.id] || a))
    }
  },

  // ── Task completion ──
  completeTask: (taskId) => {
    const { tasks, orders, addLog } = get()
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // mark task done
    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, status: "DONE", completedAt: Date.now() } : t
    )

    // check if all tasks for this order are done → mark order shipped
    const orderTasks = updatedTasks.filter(t => t.orderId === task.orderId)
    const allDone    = orderTasks.every(t => t.status === "DONE")
    const updatedOrders = orders.map(o =>
      o.id === task.orderId
        ? { ...o, status: allDone ? "SHIPPED" : "PROCESSING" }
        : o
    )

    set({ tasks: updatedTasks, orders: updatedOrders })
    addLog(`✓ ${taskId} DONE${allDone ? ` · Order ${task.orderId} SHIPPED` : ""}`, "#69ff47", "AMR")
  },

  // ── Auto-process pipeline ──
  autoTick: () => {
    const { tasks, wcsRules } = get()

    // Auto WCS: process any WMS_QUEUED tasks
    const rules = wcsRules.filter(r => r.active)
    let wcsChanged = false
    const afterWCS = tasks.map(t => {
      if (t.status !== "WMS_QUEUED") return t
      wcsChanged = true
      const rule =
        rules.find(r => r.id === "R3") && t.priority === "CRITICAL"
          ? "Critical Fast-lane" : "Standard Route"
      return { ...t, status: "WCS_DISPATCHED", wcsProcessed: true, wcsRule: rule }
    })
    if (wcsChanged) set({ tasks: afterWCS })
  },

  clearLogs: () => set({ logs: [] }),
}))