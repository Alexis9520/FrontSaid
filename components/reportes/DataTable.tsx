"use client"

import React from "react"
import { cn } from "@/lib/utils"

export type Column<T> = {
  key: keyof T | string
  header: string
  align?: "left" | "right" | "center"
  grow?: boolean
  render?: (row: T) => React.ReactNode
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = "Sin datos",
  dense = false,
}: {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  dense?: boolean
}) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className={cn("w-full text-sm", dense && "text-[12.5px]")}>
        <thead>
          <tr className="bg-muted/40">
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className={cn("px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap", alignClass(c.align))}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.length ? (
            data.map((row, idx) => (
              <tr key={idx} className="border-t hover:bg-muted/20">
                {columns.map((c) => (
                  <td key={String(c.key)} className={cn("px-3 py-2 whitespace-nowrap", alignClass(c.align), c.grow && "w-full")}>
                    {c.render ? c.render(row) : String(row[c.key as keyof T] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function alignClass(a?: "left" | "right" | "center") {
  if (a === "right") return "text-right"
  if (a === "center") return "text-center"
  return "text-left"
}