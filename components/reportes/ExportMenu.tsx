"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { exportInventory, exportInventoryFull } from "@/lib/api" // Import unificado

type Props = {
  search?: string
  categoria?: string
  activo?: boolean
  nearExpiryDays?: number
}

export function ExportMenu({ search, categoria, activo, nearExpiryDays = 30 }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await exportInventoryFull({ search, categoria, activo })
          } catch (e: any) {
            alert(e?.message || "No se pudo exportar (¿permisos de Admin?)")
          }
        }}
      >
        <Download className="w-4 h-4 mr-1" /> Inventario FULL (productos + lotes)
      </Button>

      <Button size="sm" variant="outline" onClick={() => exportInventory("all")}>
        <Download className="w-4 h-4 mr-1" /> Inventario (resumen)
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportInventory("low")}>
        <Download className="w-4 h-4 mr-1" /> Bajo mínimo
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportInventory("near-expiry", nearExpiryDays)}>
        <Download className="w-4 h-4 mr-1" /> Próx. a vencer
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportInventory("out-of-stock")}>
        <Download className="w-4 h-4 mr-1" /> Sin stock
      </Button>
    </div>
  )
}