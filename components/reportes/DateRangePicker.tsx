"use client"

import { addDays, endOfDay, startOfDay } from "date-fns"
import { Button } from "@/components/ui/button"

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: Date
  to: Date
  onChange: (from: Date, to: Date) => void
}) {
  const setQuick = (days: number) => {
    const now = new Date()
    const f = startOfDay(addDays(now, -(days - 1)))
    const t = endOfDay(now)
    onChange(f, t)
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        className="border rounded px-2 py-1 text-sm bg-background"
        value={toInput(from)}
        onChange={(e) => {
          const d = startOfDay(new Date(e.target.value))
          onChange(d, to)
        }}
      />
      <span className="text-muted-foreground text-sm">a</span>
      <input
        type="date"
        className="border rounded px-2 py-1 text-sm bg-background"
        value={toInput(to)}
        onChange={(e) => {
          const d = endOfDay(new Date(e.target.value))
          onChange(from, d)
        }}
      />
      <div className="hidden md:flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={() => setQuick(1)}>Hoy</Button>
        <Button size="sm" variant="outline" onClick={() => setQuick(7)}>7d</Button>
        <Button size="sm" variant="outline" onClick={() => setQuick(30)}>30d</Button>
      </div>
    </div>
  )
}

function toInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}