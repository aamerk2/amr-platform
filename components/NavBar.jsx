"use client"
import { useRouter, usePathname } from "next/navigation"

export default function NavBar() {
  const router = useRouter()
  const path = usePathname()

  const links = [
    { href: "/",        label: "Overview"  },
    { href: "/wms",     label: "WMS"       },
    { href: "/wcs",     label: "WCS / WES" },
    { href: "/rms",     label: "RMS + Map" },
    { href: "/station", label: "Stations"  },
  ]

  return (
    <nav style={{
      background: "#ffffff",
      borderBottom: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      padding: "0 28px",
      display: "flex",
      alignItems: "center",
      position: "sticky",
      top: 0,
      zIndex: 200,
      height: 60,
    }}>
      {/* Logo */}
      <div
        onClick={() => router.push("/")}
        style={{
          paddingRight: 28,
          marginRight: 28,
          borderRight: "1px solid #e2e8f0",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          color: "#6366f1",
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 2,
        }}>
          MyRoboCloud
        </div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15,
          fontWeight: 700,
          color: "#0f172a",
          letterSpacing: -0.3,
        }}>
          Warehouse Platform
        </div>
      </div>

      {/* Nav links */}
      {links.map(l => (
        <button
          key={l.href}
          onClick={() => router.push(l.href)}
          style={{
            background: path === l.href ? "#f5f3ff" : "none",
            border: "none",
            borderRadius: 8,
            color: path === l.href ? "#6366f1" : "#64748b",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: path === l.href ? 600 : 400,
            letterSpacing: 0.1,
            padding: "7px 14px",
            cursor: "pointer",
            transition: "all 0.15s",
            marginRight: 2,
          }}
        >
          {l.label}
        </button>
      ))}
    </nav>
  )
}