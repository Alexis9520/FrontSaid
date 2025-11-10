"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Search, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getTopCustomers,
  exportCustomers,
  type TopCustomer,
} from "@/lib/api"

const PEN = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 })

export default function CustomersTable() {
  // Puedes conectar estos con un DateRangePicker si quieres
  const [from, setFrom] = useState<Date | null>(null)
  const [to, setTo] = useState<Date | null>(null)
  const [limit, setLimit] = useState(50)
  const [sortBy, setSortBy] = useState<"ventas" | "tickets">("ventas")
  const [search, setSearch] = useState("")

  const [rows, setRows] = useState<TopCustomer[]>([])
  const [loading, setLoading] = useState(false)

  const filters = useMemo(() => ({
    from: from ?? undefined,
    to: to ?? undefined,
    limit,
    sortBy
  }), [from, to, limit, sortBy])

  // Datos demo si el endpoint falla (UI no se bloquea)
  const demo: TopCustomer[] = Array.from({ length: 10 }).map((_, i) => ({
    dni: `0000000${i}`,
    nombre: `Cliente demo ${i + 1}`,
    tickets: Math.floor(Math.random() * 10) + 1,
    unidades: Math.floor(Math.random() * 30) + 5,
    ventas: Math.round((Math.random() * 200 + 50) * 100) / 100,
    ultima_compra: new Date().toISOString()
  }))

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await getTopCustomers(filters)
        if (!mounted) return
        setRows(Array.isArray(data) ? data : [])
      } catch {
        if (!mounted) return
        setRows(demo)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [filters])

  const filtered = useMemo<TopCustomer[]>(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(r =>
      (r.dni || "").toLowerCase().includes(term) ||
      (r.nombre || "").toLowerCase().includes(term)
    )
  }, [rows, search])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UsersRound className="w-5 h-5 text-blue-500" />
          <div className="text-sm text-muted-foreground">Top clientes por ventas y frecuencia</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border rounded px-2 py-1">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              className="bg-transparent outline-none text-sm"
              placeholder="Buscar DNI o nombre"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="border rounded px-2 py-1 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="ventas">Ordenar: Ventas</option>
            <option value="tickets">Ordenar: Tickets</option>
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try { await exportCustomers({ from: filters.from as any, to: filters.to as any }) }
              catch (e: any) { alert(e?.message || "No se pudo exportar") }
            }}
          >
            <Download className="w-4 h-4 mr-1" /> Exportar
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="px-2 py-2 text-left">DNI</th>
              <th className="px-2 py-2 text-left">Nombre</th>
              <th className="px-2 py-2 text-right">Tickets</th>
              <th className="px-2 py-2 text-right">Unidades</th>
              <th className="px-2 py-2 text-right">Ventas</th>
              <th className="px-2 py-2 text-left">Última compra</th>
            </tr>
          </thead>
          <tbody>
            
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sin datos</td></tr>
            )}
            {!loading && filtered.map((r) => (
              <tr key={r.dni || r.nombre || Math.random().toString(36)} className="border-t">
                <td className="px-2 py-2 font-mono">{r.dni || "—"}</td>
                <td className="px-2 py-2">{r.nombre || "—"}</td>
                <td className="px-2 py-2 text-right">{r.tickets.toLocaleString()}</td>
                <td className="px-2 py-2 text-right">{r.unidades.toLocaleString()}</td>
                <td className="px-2 py-2 text-right">{PEN.format(r.ventas || 0)}</td>
                <td className="px-2 py-2">{r.ultima_compra ? new Date(r.ultima_compra).toLocaleString("es-PE") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}