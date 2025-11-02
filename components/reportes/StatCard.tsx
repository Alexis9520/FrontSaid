"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

export function StatCard({
  icon: Icon,
  title,
  value,
  hint,
  loading,
}: {
  icon?: LucideIcon
  title: string
  value: string | number | null | undefined
  hint?: string
  loading?: boolean
}) {
  return (
    <Card className="border border-muted/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{title}</div>
            {loading ? (
              <div className="h-6 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-semibold">{value ?? "—"}</div>
            )}
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
          </div>
          {Icon ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400/20 to-fuchsia-400/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-blue-500" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}