"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function NavBar() {
  const path = usePathname()

  const links = [
    { href: "/",    label: "Overview" },
    { href: "/wms", label: "WMS"      },
    { href: "/wcs", label: "WCS / WES"},
    { href: "/rms", label: "RMS + Map"},
  ]

  return (
    <nav style={{
      background: "rgba(5,9,17,0.97)",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      padding: "0 28px",
      display: "flex",
      alignItems: "center",
      gap: 0,
      position: "sticky",
      top: 0,
      zIndex: 200,
    }}>
      {/* Logo */}
      <div style={{
        paddingRight: 28,
        marginRight: 28,
        borderRight: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 9,
          color: "#00e5ff",
          letterSpacing: 3,
          textTransform: "uppercase",
        }}>
          AusRobotics
        </div>
        <div style={{
          fontFamily: "monospace",
          fontSize: 15,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: -0.5,
        }}>
          Warehouse Platform
        </div>
      </div>

      {/* Links */}
      {links.map(l => (
        <Link key={l.href} href={l.href} style={{
          textDecoration: "none",
          borderBottom: `2px solid ${path === l.href ? "#00e5ff" : "transparent"}`,
          color: path === l.href ? "#00e5ff" : "rgba(255,255,255,0.4)",
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          padding: "20px 16px",
          transition: "all 0.2s",
          whiteSpace: "nowrap",
        }}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}