import React from "react"

export default function Shell({ title, subtitle, right, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-50 to-cyan-100">
      <div className="max-w-6xl mx-auto p-4">
        <div className="navbar bg-white/60 backdrop-blur rounded-2xl shadow border border-white/70">
          <div className="flex-1">
            <div>
              <div className="text-xl font-black tracking-tight">{title}</div>
              {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
            </div>
          </div>
          <div className="flex-none">{right}</div>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}