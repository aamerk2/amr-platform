import NavBar from "@/components/NavBar"

export const metadata = {
  title: "AusRobotics Warehouse Platform",
  description: "WMS, WCS and RMS for AMR warehouses",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        background: "#050911",
        color: "#e8eaf0",
        minHeight: "100vh",
      }}>
        <NavBar />
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}