"use client"
import { useEffect } from "react"
import { useStore } from "./store"

export function useCrossTabSync() {
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "myrobocloud-store" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          const state  = parsed.state
          if (!state) return
          useStore.setState({
            orders:   state.orders,
            tasks:    state.tasks,
            amrs:     state.amrs,
            stations: state.stations,
            logs:     state.logs,
          })
        } catch {}
      }
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])
}