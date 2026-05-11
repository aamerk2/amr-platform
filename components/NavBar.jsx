"use client"
import { useRouter, usePathname } from "next/navigation"
import { useState } from "react"

const NAV_ITEMS = [
  { href: "/",        icon: "⊞",  label: "Dashboard" },
  { href: "/wms",     icon: "📋", label: "WMS"        },
  { href: "/wcs",     icon: "⚙️",  label: "WCS / WES"  },
  { href: "/rms",     icon: "🗺️",  label: "RMS + Map"  },
  { href: "/station", icon: "🏭", label: "Stations"   },
]

export default function NavBar() {
  const router = useRouter()
  const path   = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{
      width: collapsed ? 64 : 220,
      minHeight: "100vh",
      background: "#1e293b",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column",
      position: "fixed",
      top: 0, left: 0, bottom: 0,
      zIndex: 200,
      transition: "width 0.2s ease",
    }}>

      {/* Logo */}
      <div style={{
        padding: "0 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        height: 64, flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => router.push("/")}>
            <div style={{
              width: 32, height: 32, background: "#f97316",
              borderRadius: 8, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700,
            }}>R</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2 }}>MyRoboCloud</div>
              <div style={{ fontSize: 10, color: "#475569" }}>Warehouse Platform</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: 32, height: 32, background: "#f97316",
            borderRadius: 8, display: "flex", alignItems: "center",
            justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
          }} onClick={() => router.push("/")}>R</div>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} style={{
            background: "none", border: "none",
            color: "#475569", cursor: "pointer", fontSize: 16, padding: 4,
          }}>←</button>
        )}
      </div>

      {/* Expand when collapsed */}
      {collapsed && (
        <button onClick={() => setCollapsed(false)} style={{
          background: "none", border: "none",
          color: "#475569", cursor: "pointer",
          fontSize: 14, padding: "8px 0", textAlign: "center",
        }}>→</button>
      )}

      {/* Add New button */}
      {!collapsed && (
        <div style={{ padding: "16px 14px 8px" }}>
          <button style={{
            width: "100%", padding: "10px 14px",
            background: "#f97316", border: "none", borderRadius: 10,
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
          }}>
            <span style={{ fontSize: 16 }}>+</span> Add New Item
          </button>
        </div>
      )}
      {collapsed && <div style={{ height: 8 }}/>}

      {/* Nav links */}
      <nav style={{ flex: 1, padding: collapsed ? "8px 8px" : "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(item => {
          const active = path === item.href
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              title={collapsed ? item.label : undefined}
              style={{
                width: "100%",
                display: "flex", alignItems: "center",
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "10px 0" : "10px 12px",
                background: active ? "rgba(249,115,22,0.15)" : "transparent",
                border: "none", borderRadius: 10,
                color: active ? "#f97316" : "#64748b",
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s",
                fontFamily: "'DM Sans', sans-serif",
              }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && active && (
                <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#f97316" }}/>
              )}
            </button>
          )
        })}
      </nav>

      {/* User profile */}
      {!collapsed && (
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#f97316",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 12, fontWeight: 700,
            }}>JK</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Jawwad Khan</div>
              <div style={{ fontSize: 10, color: "#475569" }}>Admin</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}