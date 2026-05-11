import NavBar from "@/components/NavBar"

export const metadata = {
  title: "AusRobotics Warehouse Platform",
  description: "WMS, WCS and RMS for AMR warehouses",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        background: "#f8fafc",
        color: "#1e293b",
        minHeight: "100vh",
        fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
      }}>
        <NavBar />
        <main style={{ background: "#f8fafc", minHeight: "calc(100vh - 60px)" }}>
          {children}
        </main>
      </body>
    </html>
  )
}