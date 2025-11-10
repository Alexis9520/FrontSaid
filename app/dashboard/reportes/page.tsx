"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Calendar,
  FileBarChart2,
  Users,
  ShoppingBag,
  Boxes,
  Download,
  TrendingUp,
  FileText,
  WalletMinimal,
  PieChart,
  Info,
  HandCoins,
  Banknote,
  ArrowDownRight,
  Percent,
  Ticket,
  Package,
} from "lucide-react"
import { DateRangePicker } from "@/components/reportes/DateRangePicker"
import { StatCard } from "@/components/reportes/StatCard"
import { DataTable, Column } from "@/components/reportes/DataTable"
import { InventoryTable } from "@/components/reportes/InventoryTable"
import CustomersTable from "@/components/reportes/CustomersTable"
import Spinner from "@/components/ui/Spinner"
import {
  getSalesSummary, getSalesByDay, getTopProducts, getPaymentMix,
  exportSalesByDay, exportSalesByProduct,
  getCajaSummary,
  exportInventoryProfessional,
  type SalesSummary, type SalesByDay, type TopProduct, type PaymentMix,
} from "@/lib/api"

const fmtMoney = (n?: number | null) =>
  typeof n === "number" ? n.toLocaleString("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 }) : "—"

function toNumber(v: any): number {
  if (v == null) return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/* ---------- Modal de ayuda: explica métricas con íconos y datos reales ---------- */
function ExplainerModal({
  open,
  onClose,
  data,
}: {
  open: boolean
  onClose: () => void
  data: {
    ventasTotal: number
    tickets: number
    upt: number
    ticketPromedio: number
    ingresosTotales: number
    ingresosManuales: number
    ventasEfectivo: number
    egresos: number
    neto: number
    margenPct: number
    payMix: PaymentMix[]
  }
}) {
  const { ventasTotal, tickets, upt, ticketPromedio, ingresosTotales, ingresosManuales, ventasEfectivo, egresos, neto, margenPct, payMix } = data

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const sumMix = payMix.reduce((acc, it) => acc + toNumber(it.total), 0)
  const colors = ["#10b981", "#60a5fa", "#f472b6", "#f59e0b", "#a78bfa"]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explainer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative z-10 max-w-3xl w-full bg-slate-900 border rounded-lg shadow-lg p-6 text-sm text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="explainer-title" className="text-lg font-semibold">Guía rápida de este reporte</h3>
            <p className="text-xs text-muted-foreground mt-1">Significado de cada dato con números reales del período.</p>
          </div>
          <button aria-label="Cerrar" onClick={onClose} className="text-slate-300 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Izquierda: Caja y Ventas */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Caja</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <WalletMinimal className="w-4 h-4 text-emerald-400 mt-[2px]" />
                <div>
                  <div className="font-medium">Ingresos (total) {fmtMoney(ingresosTotales)}</div>
                  <div className="text-xs text-muted-foreground">Ventas + ingresos manuales del período.</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <HandCoins className="w-4 h-4 text-emerald-300 mt-[2px]" />
                <div>
                  <div className="font-medium">Ingresos manuales {fmtMoney(ingresosManuales)}</div>
                  <div className="text-xs text-muted-foreground">Entradas registradas manualmente (aportes, ajustes, etc.).</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Banknote className="w-4 h-4 text-emerald-500 mt-[2px]" />
                <div>
                  <div className="font-medium">Ventas en efectivo {fmtMoney(ventasEfectivo)}</div>
                  <div className="text-xs text-muted-foreground">Parte de las ventas pagadas en efectivo (útil para conciliar caja).</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <ArrowDownRight className="w-4 h-4 text-rose-400 mt-[2px]" />
                <div>
                  <div className="font-medium">Egresos {fmtMoney(egresos)}</div>
                  <div className="text-xs text-muted-foreground">Salidas de dinero (pagos, retiros, compras menores, etc.).</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-sky-300 mt-[2px]" />
                <div>
                  <div className="font-medium">Neto {fmtMoney(neto)}</div>
                  <div className="text-xs text-muted-foreground">Ingresos totales menos egresos.</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Percent className="w-4 h-4 text-fuchsia-400 mt-[2px]" />
                <div>
                  <div className="font-medium">Margen Neto {margenPct > 0 ? `${margenPct.toFixed(1)}%` : "—"}</div>
                  <div className="text-xs text-muted-foreground">Relación Neto / Ingresos. Mientras más alto, mejor.</div>
                </div>
              </li>
            </ul>

            <h4 className="text-sm font-semibold mt-5">Ventas</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <ShoppingBag className="w-4 h-4 text-emerald-400 mt-[2px]" />
                <div>
                  <div className="font-medium">Ventas totales {fmtMoney(ventasTotal)}</div>
                  <div className="text-xs text-muted-foreground">Monto vendido en el período (todas las formas de pago).</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Ticket className="w-4 h-4 text-blue-300 mt-[2px]" />
                <div>
                  <div className="font-medium">Tickets {tickets.toLocaleString("es-PE")}</div>
                  <div className="text-xs text-muted-foreground">Número de boletas/facturas emitidas.</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Package className="w-4 h-4 text-indigo-300 mt-[2px]" />
                <div>
                  <div className="font-medium">UPT {Number.isFinite(upt) ? upt.toFixed(2) : "—"}</div>
                  <div className="text-xs text-muted-foreground">Unidades por ticket: unidades vendidas / tickets.</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <TrendingUp className="w-4 h-4 text-lime-300 mt-[2px]" />
                <div>
                  <div className="font-medium">Ticket promedio {fmtMoney(ticketPromedio)}</div>
                  <div className="text-xs text-muted-foreground">Promedio monetario por ticket.</div>
                </div>
              </li>
            </ul>
          </div>

          {/* Derecha: Canales de pago con breakdown real */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2"><PieChart className="w-4 h-4 text-fuchsia-400" /> Canales de pago</h4>
            <div className="text-xs text-muted-foreground">Cómo se distribuyen tus ventas por método.</div>
            <ul className="space-y-3 text-sm">
              {payMix.length === 0 ? (
                <li className="text-xs text-muted-foreground">Sin datos</li>
              ) : (
                payMix.map((m, i) => {
                  const amount = toNumber(m.total)
                  const pct = sumMix > 0 ? (amount / sumMix) * 100 : 0
                  return (
                    <li key={i} className="flex items-center justify-between">
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
                })
              )}
            </ul>
            <div className="text-xs text-muted-foreground pt-2">Suma total: <span className="font-medium text-slate-200">{fmtMoney(sumMix)}</span></div>
            
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 border rounded text-sm hover:bg-slate-700">
            Entendido
          </button>
        </div>
      </div>
      
    </div>
  )
}

/* ---------- Página Reportes ---------- */
export default function ReportesPage() {
  const [from, setFrom] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d })
  const [to, setTo] = useState<Date>(() => { const d = new Date(); d.setHours(23,59,59,999); return d })
  const [tab, setTab] = useState("resumen")

  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [payMix, setPayMix] = useState<PaymentMix[]>([])
  const [caja, setCaja] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  const [helpOpen, setHelpOpen] = useState(false)
  const [exportingInventory, setExportingInventory] = useState(false)

  // Valores de caja (acepta DTO desagregado o antiguo)
  const ingresosVentas = toNumber(caja?.ingresosVentas ?? caja?.ingresos ?? caja?.ventas ?? 0)
  const ingresosManuales = toNumber(caja?.ingresosManuales ?? caja?.ingresos_manuales ?? 0)
  const ventasEfectivo = toNumber(caja?.ventasEfectivo ?? caja?.ventas_efectivo ?? 0)
  const cajaEgresosRaw = toNumber(caja?.egresos ?? caja?.egreso ?? 0)
  const cajaNetoRaw = toNumber(caja?.neto ?? (ingresosVentas + ingresosManuales - cajaEgresosRaw))

  // Combinados para visualización
  const cajaEgresos = cajaEgresosRaw < 0 ? Math.abs(cajaEgresosRaw) : cajaEgresosRaw
  const cajaIngresosTotal = ingresosVentas + ingresosManuales
  const cajaTotal = Math.max(0, cajaIngresosTotal + cajaEgresos)
  const cajaIngresosPct = cajaTotal > 0 ? Math.round((cajaIngresosTotal / cajaTotal) * 100) : 0
  const cajaEgresosPct = cajaTotal > 0 ? Math.round((cajaEgresos / cajaTotal) * 100) : 0
  const cajaMarginPct = cajaIngresosTotal > 0 ? ((cajaNetoRaw / cajaIngresosTotal) * 100) : 0

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [s, byDay, tprod, mix, cash] = await Promise.allSettled([
          getSalesSummary({ from, to }),
          getSalesByDay({ from, to }),
          getTopProducts({ from, to, limit: 10 }),
          getPaymentMix({ from, to }),
          getCajaSummary({ from, to }),
        ])
        if (!mounted) return
        setSummary(s.status === "fulfilled" ? s.value : null)
        setSalesByDay(byDay.status === "fulfilled" ? byDay.value : [])
        setTopProducts(tprod.status === "fulfilled" ? tprod.value : [])
        setPayMix(mix.status === "fulfilled" ? mix.value : [])
        if (cash.status === "fulfilled") {
          console.debug("getCajaSummary response:", cash.value)
          setCaja(cash.value)
        } else {
          console.warn("getCajaSummary failed:", cash)
          setCaja(null)
        }
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
    <div className="flex flex-col gap-6 py-6 max-w-7xl mx-auto relative">
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
        <div className="flex items-center justify-between gap-3">
          <TabsList className="bg-muted/50 backdrop-blur flex-wrap p-1 rounded-lg gap-2">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="ventas">Ventas</TabsTrigger>
            <TabsTrigger value="inventario">Inventario</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
          </TabsList>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setHelpOpen(true)}
                  className="gap-2 text-muted-foreground hover:text-white"
                >
                  <Info className="w-4 h-4" />
                  ¿Qué es esto?
                </Button>
            </DialogTrigger>
            
          </Dialog>
        </div>

        <TabsContent value="resumen">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <StatCard icon={FileText} title="Ventas" value={fmtMoney(summary?.ventas)} hint="Total período" loading={loading} />
            <StatCard icon={ShoppingBag} title="Tickets" value={summary?.tickets?.toLocaleString() ?? "—"} hint="Cantidad" loading={loading} />
            <StatCard icon={TrendingUp} title="Ticket prom." value={fmtMoney(summary?.ticket_promedio)} hint="Promedio por ticket" loading={loading} />
            <StatCard icon={FileBarChart2} title="UPT" value={summary?.upt?.toFixed(2) ?? "—"} hint="Unidades por ticket" loading={loading} />
          </div>

          {/* Caja + Canales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card className="h-full">
              <CardHeader className="pb-2 flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><WalletMinimal className="w-5 h-5 text-emerald-500" /> Caja</CardTitle>
                  <CardDescription>Desglose: ingresos manuales, ventas en efectivo y egresos</CardDescription>
                </div>
                {/* Botón de ayuda ubicado en el header, visible y accesible */}
                
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* KPIs compactos */}
                <div className="flex gap-3">
                  <KpiCompact title="Ingresos (total)" value={cajaIngresosTotal} />
                  <KpiCompact title="Egresos" value={cajaEgresos} />
                  <KpiCompact title="Neto" value={cajaNetoRaw} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Lista + distribución */}
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">Movimientos y efectivo</div>
                    <div className="space-y-2 text-sm">
                      <Row label="Ingresos manuales" value={fmtMoney(ingresosManuales)} />
                      <Row label="Ventas en efectivo" value={fmtMoney(ventasEfectivo)} />
                      <Row label="Egresos" value={fmtMoney(cajaEgresos)} danger />
                    </div>

                    <div className="pt-3">
                      <div className="text-xs text-muted-foreground mb-2">Distribución</div>
                      <div className="space-y-2 text-sm">
                        <Row label="Ingresos" value={fmtMoney(cajaIngresosTotal)} />
                        <div className="h-2 bg-muted rounded overflow-hidden">
                          <div className="bg-emerald-500 h-2" style={{ width: `${cajaIngresosPct}%` }} />
                        </div>
                        <Row className="mt-2" label="Egresos" value={fmtMoney(cajaEgresos)} />
                        <div className="h-2 bg-muted rounded overflow-hidden">
                          <div className="bg-rose-500 h-2" style={{ width: `${cajaEgresosPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Margen Neto compacto */}
                  <div className="flex items-center justify-center border rounded p-4">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Margen Neto</div>
                      <div className="text-2xl font-semibold mt-2">{cajaIngresosTotal > 0 ? `${cajaMarginPct.toFixed(1)}%` : "—"}</div>
                      <div className="text-xs text-muted-foreground mt-1">Neto / Ingresos</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2"><PieChart className="w-5 h-5 text-fuchsia-500" /> Canales de pago</CardTitle>
                <CardDescription>Distribución por método</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div className="w-36 h-36 flex-shrink-0">
                    <PaymentDonut mix={payMix} compact />
                  </div>
                  <div className="flex-1">
                    <Legend mix={payMix} />
                  </div>
                </div>
              </CardContent>
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

      {/* Modal con datos reales del período */}
      <ExplainerModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        data={{
          ventasTotal: toNumber(summary?.ventas),
          tickets: Number(summary?.tickets ?? 0),
          upt: Number(summary?.upt ?? 0),
          ticketPromedio: toNumber(summary?.ticket_promedio),
          ingresosTotales: cajaIngresosTotal,
          ingresosManuales,
          ventasEfectivo,
          egresos: cajaEgresos,
          neto: cajaNetoRaw,
          margenPct: cajaMarginPct,
          payMix,
        }}
      />
    </div>
  )
}

/* ---------- Auxiliares UI ---------- */
function KpiCompact({ title, value }: { title: string; value: number }) {
  return (
    <div className="flex-1 border rounded p-3 bg-muted/5">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-lg font-semibold">{fmtMoney(value)}</div>
    </div>
  )
}

function Row({ label, value, danger, className = "" }: { label: string; value: string; danger?: boolean; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${danger ? "text-rose-400" : ""}`}>{value}</span>
    </div>
  )
}

/* Donut compacto para evitar huecos */
function PaymentDonut({ mix, compact }: { mix: PaymentMix[]; compact?: boolean }) {
  const totals = mix.map(m => toNumber(m.total))
  const sum = totals.reduce((a, b) => a + b, 0)
  const parts = sum > 0 ? totals.map(v => (v / sum) * 100) : [100]
  const colors = ["#10b981", "#60a5fa", "#f472b6", "#f59e0b", "#a78bfa"]
  let acc = 0
  return (
    <div className={`flex ${compact ? "items-center justify-center" : "items-center gap-4"}`}>
      <div className="relative w-full h-full" style={{ width: compact ? 144 : 160, height: compact ? 144 : 160 }}>
        <svg viewBox="0 0 36 36" className="w-full h-full">
          {parts.map((p, i) => {
            const dashArray = `${p} ${100 - p}`
            const rot = (acc / 100) * 360; acc += p
            return (
              <circle key={i} cx="18" cy="18" r="15.9155" fill="transparent" stroke={colors[i % colors.length]} strokeWidth="3"
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
    </div>
  )
}

function Legend({ mix }: { mix: PaymentMix[] }) {
  const colors = ["#10b981", "#60a5fa", "#f472b6", "#f59e0b", "#a78bfa"]
  const sum = mix.reduce((acc, it) => acc + toNumber(it.total), 0)
  if (mix.length === 0) return <div className="text-xs text-muted-foreground">Sin datos</div>
  return (
    <ul className="space-y-3 text-sm">
      {mix.map((m, i) => {
        const amount = toNumber(m.total)
        const pct = sum > 0 ? (amount / sum) * 100 : 0
        return (
          <li key={i} className="flex items-center justify-between">
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
  )
}