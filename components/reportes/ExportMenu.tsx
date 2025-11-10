"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { exportInventory, exportInventoryFull } from "@/lib/api" // Import unificado
import React, { useState } from "react"

type Props = {
  search?: string
  categoria?: string
  activo?: boolean
  nearExpiryDays?: number
}

export function ExportMenu({ search, categoria, activo, nearExpiryDays = 30 }: Props) {
  const [exportState, setExportState] = useState<'idle'|'generating'|'downloading'>('idle')
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={exportState !== 'idle'}
        onClick={async () => {
          setExportState('generating')
          try {
            await exportInventoryFull({ search, categoria, activo }, () => setExportState('downloading'))
          } catch (e: any) {
            alert(e?.message || "No se pudo exportar (¿permisos de Admin?)")
          } finally {
            setExportState('idle')
          }
        }}
      >
        {exportState === 'idle' && (
          <>
            <Download className="w-4 h-4 mr-1" /> Inventario FULL (productos + lotes)
          </>
        )}
        {exportState === 'generating' && (
          <>
            <svg className="animate-spin w-4 h-4 mr-2 text-emerald-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Generando...
          </>
        )}
        {exportState === 'downloading' && (
          <>
            <svg className="animate-spin w-4 h-4 mr-2 text-emerald-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Descargando...
          </>
        )}
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