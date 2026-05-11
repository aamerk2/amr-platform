import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "MyRoboCloud — Warehouse Platform",
  description: "WMS, WCS and RMS for AMR warehouses",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      </head>
      <body style={{
        margin: 0, padding: 0,
        background: "#f8fafc",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        display: "flex",
      }}>
        {/* Sidebar — imported dynamically to stay client */}
        <SidebarWrapper/>
        {/* Main content — offset by sidebar */}
        <main style={{
          marginLeft: 220,
          flex: 1,
          minHeight: "100vh",
          background: "#f8fafc",
          transition: "margin-left 0.2s ease",
        }}>
          {/* Top bar */}
          <div style={{
            height: 64,
            background: "#ffffff",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}>
            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "8px 14px",
              width: 320,
            }}>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>🔍</span>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Search items, orders, workers...</span>
            </div>

            {/* Right side */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Date */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 8, padding: "6px 12px",
                fontSize: 12, color: "#64748b",
              }}>
                📅 {new Date().toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })}
              </div>

              {/* Alert bell */}
              <div style={{ position: "relative", cursor: "pointer" }}>
                <span style={{ fontSize: 18, color: "#64748b" }}>🔔</span>
                <div style={{
                  position: "absolute", top: -4, right: -4,
                  width: 14, height: 14,
                  background: "#ef4444",
                  borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, color: "#fff", fontWeight: 700,
                }}>2</div>
              </div>

              {/* User avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "#f97316",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12, fontWeight: 700,
                }}>JK</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>Jawwad Khan</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>Admin ▾</div>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div style={{ padding: "0" }}>
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}

function SidebarWrapper() {
  const NavBar = require("@/components/NavBar").default
  return <NavBar/>
}