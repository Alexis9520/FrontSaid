"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Calendar, FileBarChart2, Users, ShoppingBag, Boxes, Download, TrendingUp, FileText, WalletMinimal, BarChart2, PieChart,
} from "lucide-react"
import { DateRangePicker } from "@/components/reportes/DateRangePicker"
import { StatCard } from "@/components/reportes/StatCard"
import { DataTable, Column } from "@/components/reportes/DataTable"
import { InventoryTable } from "@/components/reportes/InventoryTable"
import CustomersTable from "@/components/reportes/CustomersTable"
import {
  getSalesSummary, getSalesByDay, getSalesByHour, getTopProducts, getPaymentMix,
  exportSalesByDay, exportSalesByProduct,
  getCajaSummary,
  exportInventoryProfessional,
  type SalesSummary, type SalesByDay, type SalesByHour, type TopProduct, type PaymentMix, type CajaSummary,
} from "@/lib/api"

const fmtMoney = (n?: number | null) =>
  typeof n === "number" ? n.toLocaleString("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 }) : "—"

export default function ReportesPage() {
  const [from, setFrom] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d })
  const [to, setTo] = useState<Date>(() => { const d = new Date(); d.setHours(23,59,59,999); return d })
  const [tab, setTab] = useState("resumen")

  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [payMix, setPayMix] = useState<PaymentMix[]>([])
  const [byHour, setByHour] = useState<SalesByHour[]>([])
  const [caja, setCaja] = useState<CajaSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [s, byDay, tprod, mix, hour, cash] = await Promise.allSettled([
          getSalesSummary({ from, to }),
          getSalesByDay({ from, to }),
          getTopProducts({ from, to, limit: 10 }),
          getPaymentMix({ from, to }),
          getSalesByHour({ from, to }),
          getCajaSummary({ from, to }),
        ])
        if (!mounted) return
        setSummary(s.status === "fulfilled" ? s.value : null)
        setSalesByDay(byDay.status === "fulfilled" ? byDay.value : [])
        setTopProducts(tprod.status === "fulfilled" ? tprod.value : [])
        setPayMix(mix.status === "fulfilled" ? mix.value : [])
        setByHour(hour.status === "fulfilled" ? hour.value : [])
        setCaja(cash.status === "fulfilled" ? cash.value : null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [from, to])

  const salesByDayCols = useMemo<Column<SalesByDay>[]>(() => [
    { key: "fecha", header: "Fecha" },
    { key: "tickets", header: "Tickets", align: "right" },
    { key: "unidades", header: "Unidades", align: "right" },
    { key: "ventas", header: "Ventas", align: "right", render: (r) => fmtMoney(r.ventas) },
    { key: "ticket_promedio", header: "Ticket Prom.", align: "right", render: (r) => fmtMoney(r.ticket_promedio) },
    { key: "upt", header: "UPT", align: "right" },
  ], [])
  const topProdCols = useMemo<Column<TopProduct>[]>(() => [
    { key: "codigo_barras", header: "Código" },
    { key: "nombre", header: "Producto", grow: true },
    { key: "categoria", header: "Categoría" },
    { key: "unidades", header: "Unidades", align: "right" },
    { key: "ventas", header: "Ventas", align: "right", render: (r) => fmtMoney(r.ventas) },
  ], [])

  return (
    <div className="flex flex-col gap-8 py-6 max-w-7xl mx-auto relative min-h-[65vh]">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-fuchsia-500 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <FileBarChart2 className="w-7 h-7 text-fuchsia-400" />
            Reportes y Análisis
          </h1>
          <p className="text-muted-foreground mt-1">Explora, filtra y descarga información clave de tu farmacia.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          <Button variant="secondary" className="gap-2" disabled>
            <Calendar className="w-4 h-4" />
            Filtros
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 backdrop-blur flex-wrap p-1 rounded-lg gap-2">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <StatCard icon={FileText} title="Ventas" value={fmtMoney(summary?.ventas)} hint="Total período" loading={loading} />
            <StatCard icon={ShoppingBag} title="Tickets" value={summary?.tickets?.toLocaleString() ?? "—"} hint="Cantidad" loading={loading} />
            <StatCard icon={TrendingUp} title="Ticket prom." value={fmtMoney(summary?.ticket_promedio)} hint="Promedio por ticket" loading={loading} />
            <StatCard icon={FileBarChart2} title="UPT" value={summary?.upt?.toFixed(2) ?? "—"} hint="Unidades por ticket" loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><WalletMinimal className="w-5 h-5 text-emerald-500" /> Caja</CardTitle>
                <CardDescription>Ingresos, egresos y neto</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <Kpi title="Ingresos" value={fmtMoney(caja?.ingresos ?? 0)} />
                  <Kpi title="Egresos" value={fmtMoney(caja?.egresos ?? 0)} />
                  <Kpi title="Neto" value={fmtMoney(caja?.neto ?? 0)} />
                </div>
                <div className="mt-4 space-y-2">
                  <ProgressPair label="Ingresos" value={Number(caja?.ingresos ?? 0)} total={Number((caja?.ingresos ?? 0) + (caja?.egresos ?? 0))} color="bg-emerald-500" />
                  <ProgressPair label="Egresos" value={Number(caja?.egresos ?? 0)} total={Number((caja?.ingresos ?? 0) + (caja?.egresos ?? 0))} color="bg-rose-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart2 className="w-5 h-5 text-blue-500" /> Tickets por hora</CardTitle>
                <CardDescription>Distribución en el día</CardDescription>
              </CardHeader>
              <CardContent><HourBars data={byHour} /></CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><PieChart className="w-5 h-5 text-fuchsia-500" /> Canales de pago</CardTitle>
                <CardDescription>Efectivo / Tarjeta / Yape-Plin</CardDescription>
              </CardHeader>
              <CardContent><PaymentDonut mix={payMix} /></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ventas">
          <Card className="mt-6">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-blue-400" />
                  Reporte de Ventas
                </CardTitle>
                <CardDescription>Ventas por día y top productos</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportSalesByDay({ from, to })}>
                  <Download className="w-4 h-4 mr-1" /> Descargar ventas (día)
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportSalesByProduct({ from, to })}>
                  <Download className="w-4 h-4 mr-1" /> Descargar por producto
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <DataTable columns={salesByDayCols} data={salesByDay} />
              <div className="pt-2">
                <h3 className="text-sm text-muted-foreground mb-2">Top productos</h3>
                <DataTable columns={topProdCols} data={topProducts} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventario">
          <Card className="mt-6">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-emerald-400" />
                  Inventario completo
                </CardTitle>
                <CardDescription>Todos los productos, lotes y métricas de stock</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportInventoryProfessional()}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Descargar Inventario Avanzado
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <InventoryTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes">
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-fuchsia-400" />
                Reporte de Clientes
              </CardTitle>
              <CardDescription>Top clientes por ventas y frecuencia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <CustomersTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}

function ProgressPair({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1"><span className="text-muted-foreground">{label}</span><span>{pct.toFixed(0)}%</span></div>
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div className={`${color} h-2`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function HourBars({ data }: { data: SalesByHour[] }) {
  const max = Math.max(...data.map(d => d.tickets), 1)
  return (
    <div className="flex items-end gap-1 h-28">
      {Array.from({ length: 24 }).map((_, hour) => {
        const item = data.find(d => d.hora === hour)
        const v = item?.tickets ?? 0
        const h = Math.max(3, (v / max) * 100)
        return (
          <div key={hour} className="flex-1">
            <div className="w-full bg-blue-500/80 rounded-t" style={{ height: `${h}%` }} title={`${hour}:00 — ${v} tickets`} />
          </div>
        )
      })}
    </div>
  )
}

function PaymentDonut({ mix }: { mix: PaymentMix[] }) {
  const totals = mix.map(m => Number(m.total || 0))
  const sum = totals.reduce((a, b) => a + b, 0)
  const parts = sum > 0 ? totals.map(v => (v / sum) * 100) : [100]
  const colors = ["#10b981", "#60a5fa", "#f472b6", "#f59e0b", "#a78bfa"]
  let acc = 0
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 36 36" className="w-full h-full">
          {parts.map((p, i) => {
            const dashArray = `${p} ${100 - p}`
            const rot = (acc / 100) * 360; acc += p
            return (
              <circle key={i} cx="18" cy="18" r="15.9155" fill="transparent" stroke={colors[i % colors.length]} strokeWidth="4"
                strokeDasharray={dashArray} transform={`rotate(${rot} 18 18)`} />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {sum > 0 ? (
            <>
              <div className="text-sm font-medium">Total</div>
              <div className="text-xs font-semibold">{fmtMoney(sum)}</div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Sin datos</div>
          )}
        </div>
      </div>

      {/* Leyenda con monto y porcentaje */}
      <div className="flex-1 min-w-[140px]">
        {mix.length === 0 ? (
          <div className="text-xs text-muted-foreground">Sin datos</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {mix.map((m, i) => {
              const amount = Number(m.total || 0)
              const pct = sum > 0 ? (amount / sum) * 100 : 0
              return (
                <li key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded" style={{ background: colors[i % colors.length] }} />
                    <span className="truncate">{m.metodo_pago}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{fmtMoney(amount)}</div>
                    <div className="text-xs text-muted-foreground">{pct.toFixed(1)}%</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}