import { create } from 'zustand'

let _orderId = 1
let _taskId = 1
let _amrId = 1

const PRIORITIES = ["CRITICAL","HIGH","MEDIUM","LOW"]
const PRIORITY_SCORE = { CRITICAL:4, HIGH:3, MEDIUM:2, LOW:1 }
const SKUS = [
  "SKU-1042","SKU-2381","SKU-4917","SKU-3205","SKU-8834",
  "SKU-6612","SKU-7743","SKU-9901","SKU-5523","SKU-4410",
]
const AMR_COLORS = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#f97316"]
const AMR_MODELS = ["MiR100","Geek+ P800","Fetch Cart","GreyOrange"]

const AISLE_COLS = [0,4,8,12,16,20,23]
const COLS = 24
const ROWS = 20

// Station waypoints — where AMRs present the rack (grid position)
// Queue positions — where other AMRs wait behind the presenting AMR
const STATIONS_CONFIG = {
  S1: {
    row:2, col:0, side:"left",
    queuePositions: [{row:2,col:1},{row:2,col:2},{row:2,col:3}]
  },
  S2: {
    row:12, col:0, side:"left",
    queuePositions: [{row:12,col:1},{row:12,col:2},{row:12,col:3}]
  },
  S3: {
    row:2, col:23, side:"right",
    queuePositions: [{row:2,col:22},{row:2,col:21},{row:2,col:20}]
  },
  S4: {
    row:12, col:23, side:"right",
    queuePositions: [{row:12,col:22},{row:12,col:21},{row:12,col:20}]
  },
}

function makeOrder() {
  const priority = PRIORITIES[Math.floor(Math.random()*PRIORITIES.length)]
  const itemCount = Math.floor(2 + Math.random()*4) // 2-5 items
  return {
    id: `ORD-${String(_orderId++).padStart(5,"0")}`,
    customer: `CUST-${Math.floor(100+Math.random()*900)}`,
    priority,
    status: "RECEIVED",
    createdAt: Date.now(),
    completedAt: null,
    items: Array.from({length:itemCount},()=>({
      sku: SKUS[Math.floor(Math.random()*SKUS.length)],
      qty: Math.floor(1+Math.random()*10),
      location: `A${Math.floor(1+Math.random()*9)}-B${Math.floor(1+Math.random()*20)}`,
      picked: false,
    })),
  }
}

function makeTasks(order) {
  return order.items.map((item,i) => ({
    id: `TSK-${String(_taskId++).padStart(5,"0")}`,
    orderId: order.id,
    type: "PICK",
    priority: order.priority,
    sku: item.sku,
    qty: item.qty,
    location: item.location,
    from: [
      Math.floor(2+Math.random()*(ROWS-4)),
      Math.floor(2+Math.random()*(COLS-4)),
    ],
    status: "WMS_QUEUED",
    assignedTo: null,
    stationId: null,
    queuePosition: null,   // 0 = presenting, 1,2,3 = queued behind
    weight: Math.floor(5+Math.random()*80),
    createdAt: Date.now(),
    wcsProcessed: false,
    g2pStatus: "WMS_QUEUED",
    pickStartedAt: null,
    pickCompletedAt: null,
    completedAt: null,
  }))
}

function makeAMR(index) {
  const col = AISLE_COLS[index % AISLE_COLS.length]
  return {
    id: `AMR-${String(_amrId++).padStart(3,"0")}`,
    color: AMR_COLORS[index%AMR_COLORS.length],
    model: AMR_MODELS[index%AMR_MODELS.length],
    status: "IDLE",
    phase: "IDLE",  // IDLE|TO_RACK|TO_STATION|PRESENTING|QUEUED|RETURNING|CHARGING
    battery: 80+Math.random()*20,
    row: 0, col,
    homeRow: 0, homeCol: col,
    taskId: null,
    stationId: null,
    queuePosition: null,
    carryingRack: false,
    rackId: null,
    completedTasks: 0,
    totalDist: 0,
    path: [],
    targetRow: 0,
    targetCol: col,
  }
}

function stepToward(row, col, targetRow, targetCol) {
  let nr = row, nc = col
  const inAisle = AISLE_COLS.includes(col)
  if (!inAisle && row !== targetRow) {
    const nearest = AISLE_COLS.reduce((a,b) => Math.abs(a-col)<Math.abs(b-col)?a:b)
    nc = col+(nearest>col?1:-1)
  } else if (row !== targetRow) {
    nr = row+(targetRow>row?1:-1)
  } else if (col !== targetCol) {
    nc = col+(targetCol>col?1:-1)
  }
  return {
    row: Math.max(0,Math.min(ROWS-1,nr)),
    col: Math.max(0,Math.min(COLS-1,nc)),
  }
}

function atTarget(row,col,tr,tc) {
  return Math.abs(row-tr)<=1 && Math.abs(col-tc)<=1
}

export const useStore = create((set,get) => ({

  // ── STATE ──
  orders: [],
  tasks: [],
  amrs: Array.from({length:4},(_,i) => makeAMR(i)),
  logs: [],
  wcsRules: [
    {id:"R1",name:"Battery Priority",  desc:"Route low-battery AMRs to charge first",     active:true },
    {id:"R2",name:"Zone Balancing",    desc:"Distribute tasks evenly across zones",        active:true },
    {id:"R3",name:"Critical Fast-lane",desc:"CRITICAL tasks skip queue immediately",       active:true },
    {id:"R4",name:"Batch Grouping",    desc:"Cluster nearby picks into single AMR run",    active:false},
    {id:"R5",name:"Shift Handover",    desc:"Complete in-progress tasks before shift end", active:true },
    {id:"R6",name:"Traffic Avoidance", desc:"Reroute AMRs around congestion zones",        active:false},
  ],

  // Stations — status tracks the full G2P lifecycle
  stations: Object.entries(STATIONS_CONFIG).map(([id,cfg]) => ({
    id,
    label: `Station ${id.replace("S","")} — ${cfg.side==="left"?"Left":"Right"}`,
    side: cfg.side,
    waypoint: {row:cfg.row, col:cfg.col},
    queuePositions: cfg.queuePositions,
    status: "IDLE",       // IDLE|ACTIVE|PRESENTING
    loggedIn: false,      // user is at this station
    amrQueue: [],         // [amrId, ...] — index 0 = presenting, rest = queued
    taskQueue: [],        // [taskId, ...] — tasks assigned to this station
    currentTaskId: null,  // task currently being picked
    picksCompleted: 0,
    totalPicks: 0,
  })),

  // ── LOGGING ──
  addLog: (msg,color="#00e5ff",layer="SYS") =>
    set(s => ({
      logs:[{msg,color,layer,t:new Date().toLocaleTimeString("en-AU",{hour12:false})},...s.logs].slice(0,200)
    })),

  // ── WMS ──
  injectOrder: () => {
    const order = makeOrder()
    const tasks = makeTasks(order)
    set(s => ({
      orders:[order,...s.orders].slice(0,60),
      tasks:[...s.tasks,...tasks],
    }))
    get().addLog(`WMS → ${order.id} | ${order.items.length} lines | ${order.priority}`,"#00e5ff","WMS")
  },

  injectBatch: (count=5) => {
    for(let i=0;i<count;i++) setTimeout(()=>get().injectOrder(),i*120)
  },

  // ── WCS ──
  toggleRule: (id) =>
    set(s => ({wcsRules:s.wcsRules.map(r=>r.id===id?{...r,active:!r.active}:r)})),

  processWCS: () => {
    const {tasks,wcsRules,addLog} = get()
    const rules = wcsRules.filter(r=>r.active)
    let changed = false
    const updated = tasks.map(t => {
      if(t.status!=="WMS_QUEUED") return t
      changed = true
      const rule = rules.find(r=>r.id==="R3")&&t.priority==="CRITICAL"
        ?"Critical Fast-lane":"Standard Route"
      addLog(`WCS → ${t.id} [${t.priority}] via ${rule}`,"#ffb300","WCS")
      return {...t,status:"WCS_DISPATCHED",g2pStatus:"WCS_DISPATCHED",wcsProcessed:true,wcsRule:rule}
    })
    if(changed) set({tasks:updated})
  },

  // ── STATION LOGIN/LOGOUT ──
  loginStation: (stationId) => {
    set(s => ({
      stations: s.stations.map(st =>
        st.id===stationId ? {...st,loggedIn:true,status:"ACTIVE"} : st
      )
    }))
    get().addLog(`Operator logged in at ${stationId}`,"#10b981","STATION")
  },

  logoutStation: (stationId) => {
    set(s => ({
      stations: s.stations.map(st =>
        st.id===stationId ? {...st,loggedIn:false,status:"IDLE"} : st
      )
    }))
    get().addLog(`Operator logged out from ${stationId}`,"#f59e0b","STATION")
  },

  // ── PICKING CONFIRMED — move to next rack ──
  confirmPickComplete: (stationId) => {
    const state = get()
    const station = state.stations.find(s=>s.id===stationId)
    if(!station) return

    const currentTaskId = station.currentTaskId
    const amrQueue = [...station.amrQueue]
    const taskQueue = [...station.taskQueue]

    // Mark current task as DONE
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id===currentTaskId
          ? {...t,status:"DONE",g2pStatus:"DONE",pickCompletedAt:Date.now(),completedAt:Date.now()}
          : t
      )
    }))

    // Find the AMR that was presenting and send it back
    const presentingAmrId = amrQueue[0]
    if(presentingAmrId) {
      const presentingAmr = state.amrs.find(a=>a.id===presentingAmrId)
      if(presentingAmr) {
        const task = state.tasks.find(t=>t.id===currentTaskId)
        get().addLog(`${presentingAmrId} returning rack → storage`,"#3b82f6","RMS")
        set(s => ({
          amrs: s.amrs.map(a =>
            a.id===presentingAmrId
              ? {
                  ...a,
                  phase:"RETURNING",
                  status:"EN_ROUTE",
                  stationId:null,
                  queuePosition:null,
                  taskId:null,
                  targetRow: task?.from[0]||a.homeRow,
                  targetCol: task?.from[1]||a.homeCol,
                }
              : a
          )
        }))
      }
    }

    // Remove presented AMR from queue
    const newAmrQueue = amrQueue.slice(1)
    const newTaskQueue = taskQueue.slice(1)

    // Check if all tasks for this station are done
    const allStationTasksDone = newTaskQueue.length===0 && newAmrQueue.length===0

    if(allStationTasksDone) {
      // Check if all tasks for associated orders are done — notify WMS
      get().checkOrderCompletion()
      get().addLog(`✅ All picks complete at ${stationId} — WMS notified`,"#10b981","WMS")
      set(s => ({
        stations: s.stations.map(st =>
          st.id===stationId
            ? {...st,amrQueue:[],taskQueue:[],currentTaskId:null,status:st.loggedIn?"ACTIVE":"IDLE",picksCompleted:0,totalPicks:0}
            : st
        )
      }))
      return
    }

    // Advance to next AMR in queue — it becomes the presenter
    const nextTaskId = newTaskQueue[0]||null
    const nextAmrId = newAmrQueue[0]||null

    // Move next AMR to presenting position
    if(nextAmrId) {
      const cfg = STATIONS_CONFIG[stationId]
      set(s => ({
        amrs: s.amrs.map(a =>
          a.id===nextAmrId
            ? {...a,phase:"PRESENTING",queuePosition:0,targetRow:cfg.row,targetCol:cfg.col}
            : a
        )
      }))
    }

    set(s => ({
      stations: s.stations.map(st =>
        st.id===stationId
          ? {...st,amrQueue:newAmrQueue,taskQueue:newTaskQueue,currentTaskId:nextTaskId,picksCompleted:st.picksCompleted+1}
          : st
      )
    }))

    if(nextTaskId) {
      set(s => ({
        tasks: s.tasks.map(t =>
          t.id===nextTaskId ? {...t,status:"AT_STATION",g2pStatus:"AT_STATION",pickStartedAt:Date.now()} : t
        )
      }))
      get().addLog(`Next rack presenting at ${stationId} — task ${nextTaskId}`,"#10b981","STATION")
    }
  },

  // ── CHECK IF ENTIRE ORDER IS DONE — NOTIFY WMS ──
  checkOrderCompletion: () => {
    const {tasks,orders,addLog} = get()
    const updatedOrders = orders.map(order => {
      if(order.status==="SHIPPED") return order
      const orderTasks = tasks.filter(t=>t.orderId===order.id)
      if(orderTasks.length===0) return order
      const allDone = orderTasks.every(t=>t.status==="DONE"||t.completedAt)
      if(allDone) {
        addLog(`📦 WMS: Order ${order.id} COMPLETE — all picks done → SHIPPED`,"#00e5ff","WMS")
        return {...order,status:"SHIPPED",completedAt:Date.now()}
      }
      return order
    })
    set({orders:updatedOrders})
  },

  // ── FLEET ──
  setFleetSize: (size) => {
    _amrId=1
    set({amrs:Array.from({length:size},(_,i)=>makeAMR(i))})
  },

  updateStationProgress: (stationId,progress,total) => {
    set(s => ({
      stations: s.stations.map(st =>
        st.id===stationId?{...st,picksCompleted:progress,totalPicks:total}:st
      )
    }))
  },

  // ── MAIN AUTOMATION TICK ──
  automationTick: () => {
    const {addLog} = get()

    // STEP 1 — Auto WCS
    const s1=get()
    if(s1.tasks.some(t=>t.status==="WMS_QUEUED")) {
      set(s=>({
        tasks:s.tasks.map(t=>
          t.status==="WMS_QUEUED"
            ?{...t,status:"WCS_DISPATCHED",g2pStatus:"WCS_DISPATCHED",wcsProcessed:true,wcsRule:"Auto Route"}
            :t
        )
      }))
    }

    // STEP 2 — Distribute tasks to logged-in stations
    const s2=get()
    const loggedInStations = s2.stations.filter(s=>s.loggedIn)
    if(loggedInStations.length===0) {
      // No stations active — skip assignment
    } else {
      const unassignedTasks = s2.tasks
        .filter(t=>t.status==="WCS_DISPATCHED"&&!t.stationId)
        .sort((a,b)=>PRIORITY_SCORE[b.priority]-PRIORITY_SCORE[a.priority])

      if(unassignedTasks.length>0) {
        // Round-robin distribute tasks across logged-in stations
        const taskUpdates = {}
        const stationUpdates = {}

        unassignedTasks.forEach((task,idx) => {
          const station = loggedInStations[idx%loggedInStations.length]
          const currentQueue = stationUpdates[station.id]?.taskQueue||[...station.taskQueue]
          currentQueue.push(task.id)
          stationUpdates[station.id] = {
            ...station,
            ...(stationUpdates[station.id]||{}),
            taskQueue: currentQueue,
            totalPicks: currentQueue.length,
          }
          taskUpdates[task.id] = {...task,stationId:station.id,status:"STATION_ASSIGNED",g2pStatus:"STATION_ASSIGNED"}
          addLog(`Task ${task.id} [${task.priority}] → ${station.id}`,"#ffb300","WCS")
        })

        set(s=>({
          tasks: s.tasks.map(t=>taskUpdates[t.id]||t),
          stations: s.stations.map(st=>
            stationUpdates[st.id]
              ?{...st,...stationUpdates[st.id]}
              :st
          )
        }))
      }
    }

    // STEP 3 — For each station with tasks, dispatch idle AMRs to pick racks
    const s3=get()
    s3.stations.forEach(station => {
      if(!station.loggedIn) return
      const stationTaskQueue = station.taskQueue
      const stationAmrQueue  = station.amrQueue
      const cfg = STATIONS_CONFIG[station.id]

      // How many AMRs can queue here (max 3 waiting + 1 presenting = 4)
      const maxQueue = 4
      const slotsAvailable = maxQueue - stationAmrQueue.length

      // Tasks that need an AMR dispatched
      const tasksNeedingAMR = stationTaskQueue
        .filter(tid => {
          const task = s3.tasks.find(t=>t.id===tid)
          return task && task.status==="STATION_ASSIGNED"
        })
        .slice(0,slotsAvailable)

      if(tasksNeedingAMR.length===0) return

      const idleAmrs = get().amrs.filter(a=>a.status==="IDLE"&&a.battery>15)

      tasksNeedingAMR.forEach((taskId,slotIdx) => {
        if(slotIdx>=idleAmrs.length) return
        const amr = idleAmrs[slotIdx]
        const task = s3.tasks.find(t=>t.id===taskId)
        if(!amr||!task) return

        // Queue position: 0=presenting,1=first in line,etc
        const queuePos = stationAmrQueue.length+slotIdx
        // Target: go to rack first
        addLog(`${amr.id} → rack[${task.from}] then queue@${station.id}[${queuePos}]`,"#e040fb","RMS")

        set(s=>({
          tasks: s.tasks.map(t=>
            t.id===taskId
              ?{...t,status:"AMR_ASSIGNED",g2pStatus:"AMR_ASSIGNED",assignedTo:amr.id,queuePosition:queuePos}
              :t
          ),
          amrs: s.amrs.map(a=>
            a.id===amr.id
              ?{
                  ...a,
                  status:"EN_ROUTE",
                  phase:"TO_RACK",
                  taskId,
                  stationId:station.id,
                  queuePosition:queuePos,
                  carryingRack:false,
                  targetRow:task.from[0],
                  targetCol:task.from[1],
                }
              :a
          ),
          stations: s.stations.map(st=>
            st.id===station.id
              ?{...st,amrQueue:[...st.amrQueue,amr.id]}
              :st
          )
        }))
      })
    })

    // STEP 4 — Move AMRs
    const s4=get()
    const newAmrs = s4.amrs.map(amr=>{
      let {row,col,phase,status,battery,targetRow,targetCol,path,totalDist,taskId,stationId,queuePosition,carryingRack,homeRow,homeCol} = amr

      battery = Math.max(0,battery-0.05)

      // Low battery
      if(battery<8&&status!=="CHARGING") {
        if(stationId) {
          set(s=>({
            stations:s.stations.map(st=>
              st.id===stationId
                ?{...st,amrQueue:st.amrQueue.filter(id=>id!==amr.id),taskQueue:st.taskQueue.filter(id=>id!==taskId)}
                :st
            ),
            tasks:taskId?s.tasks.map(t=>t.id===taskId?{...t,status:"STATION_ASSIGNED",g2pStatus:"STATION_ASSIGNED",assignedTo:null}:t):s.tasks,
          }))
        }
        addLog(`⚡ ${amr.id} low battery → charging`,"#8b5cf6","RMS")
        return{...amr,battery,status:"CHARGING",phase:"CHARGING",taskId:null,stationId:null,carryingRack:false,targetRow:homeRow,targetCol:homeCol}
      }

      if(status==="CHARGING") {
        battery=Math.min(100,battery+2)
        if(battery>=95) return{...amr,battery,status:"IDLE",phase:"IDLE",row:homeRow,col:homeCol}
        return{...amr,battery}
      }

      if(status==="IDLE"||phase==="PRESENTING"||phase==="QUEUED") {
        return{...amr,battery}
      }

      // Move
      const moved = stepToward(row,col,targetRow,targetCol)
      const newPath=[...path,{row:moved.row,col:moved.col}].slice(-12)
      const arrived = atTarget(moved.row,moved.col,targetRow,targetCol)

      // TO_RACK
      if(phase==="TO_RACK") {
        if(arrived) {
          const station = get().stations.find(s=>s.id===stationId)
          const cfg = STATIONS_CONFIG[stationId]
          if(!station||!cfg) return{...amr,battery}

          // Determine target position — queue position 0=station waypoint, 1,2,3=queue slots
          const qpos = queuePosition||0
          const targetPos = qpos===0
            ? {row:cfg.row,col:cfg.col}
            : cfg.queuePositions[qpos-1]||cfg.queuePositions[0]

          const rackId=`RACK-${Math.floor(100+Math.random()*900)}`
          addLog(`${amr.id} rack picked → queuing at ${stationId}[pos ${qpos}]`,"#f59e0b","RMS")

          set(s=>({
            tasks:s.tasks.map(t=>t.id===taskId?{...t,status:"AMR_MOVING",g2pStatus:"AMR_MOVING"}:t)
          }))

          return{
            ...amr,battery,
            row:moved.row,col:moved.col,
            phase:"TO_STATION",
            carryingRack:true,
            rackId,
            targetRow:targetPos.row,
            targetCol:targetPos.col,
            path:newPath,
            totalDist:totalDist+1,
          }
        }
        return{...amr,battery,row:moved.row,col:moved.col,path:newPath,totalDist:totalDist+1}
      }

      // TO_STATION
      if(phase==="TO_STATION") {
        if(arrived) {
          const qpos = queuePosition||0
          const isPresenting = qpos===0

          addLog(`${amr.id} ${isPresenting?"PRESENTING at":"QUEUED at"} ${stationId}[pos ${qpos}]`,isPresenting?"#10b981":"#f59e0b","RMS")

          if(isPresenting) {
            // This AMR is now presenting — activate station picking
            set(s=>({
              tasks:s.tasks.map(t=>t.id===taskId?{...t,status:"AT_STATION",g2pStatus:"AT_STATION",pickStartedAt:Date.now()}:t),
              stations:s.stations.map(st=>
                st.id===stationId
                  ?{...st,status:"PRESENTING",currentTaskId:taskId}
                  :st
              )
            }))
            return{...amr,battery,row:moved.row,col:moved.col,phase:"PRESENTING",status:"AT_STATION",path:newPath}
          } else {
            // Queued — wait here
            return{...amr,battery,row:moved.row,col:moved.col,phase:"QUEUED",status:"AT_STATION",path:newPath}
          }
        }
        return{...amr,battery,row:moved.row,col:moved.col,path:newPath,totalDist:totalDist+1}
      }

      // RETURNING
      if(phase==="RETURNING") {
        if(arrived) {
          addLog(`✅ ${amr.id} rack returned → IDLE`,"#10b981","RMS")
          set(s=>({
            tasks:s.tasks.map(t=>
              t.id===taskId&&t.status!=="DONE"
                ?{...t,status:"DONE",g2pStatus:"DONE",completedAt:Date.now()}
                :t
            )
          }))
          get().checkOrderCompletion()
          return{
            ...amr,battery,
            status:"IDLE",phase:"IDLE",
            taskId:null,stationId:null,queuePosition:null,
            carryingRack:false,rackId:null,
            row:homeRow,col:homeCol,
            completedTasks:amr.completedTasks+1,
          }
        }
        return{...amr,battery,row:moved.row,col:moved.col,path:newPath,totalDist:totalDist+1}
      }

      return{...amr,battery,row:moved.row,col:moved.col,path:newPath,totalDist:totalDist+1}
    })

    set({amrs:newAmrs})
  },

  completeTask:(taskId)=>set(s=>({tasks:s.tasks.map(t=>t.id===taskId?{...t,status:"DONE",g2pStatus:"DONE",completedAt:Date.now()}:t)})),
  processRMS:()=>{},
  clearLogs:()=>set({logs:[]}),
}))