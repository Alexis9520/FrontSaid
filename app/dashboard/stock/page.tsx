"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Package,
  Calendar,
  Layers,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Filter
} from "lucide-react"
import { useToast } from "@/lib/use-toast"
import { fetchWithAuth } from "@/lib/api"
import { apiUrl } from "@/components/config"
import clsx from "clsx"

/* --------- TIPOS ORIGINALES (lotes) ---------- */
type LoteRaw = {
  id: number
  codigoStock?: string
  codigoBarras: string
  nombre: string
  concentracion: string
  cantidadUnidades: number
  cantidadMinima: number
  precioCompra: number
  precioVenta: number
  fechaVencimiento: string | null
  laboratorio: string
  categoria: string
}

/* --------- TIPOS DERIVADOS ---------- */
type ProductSummary = {
  codigoBarras: string
  nombre: string
  concentracion: string
  laboratorio: string
  categoria: string
  cantidadMinima: number
  cantidadGeneral: number
  unidadesVencidas: number
  unidadesRiesgo30d: number
  unidadesVigentes: number
  diasHastaPrimerVencimiento: number | null
  numeroLotes: number
  costoTotal: number
  costoPromedioUnit: number
  precioVentaUnd: number
  margenUnit: number
  margenPct: number
  valorVentaTeorico: number
  porcentajeEnRiesgo: number
  lotes: LoteRaw[]
}

/* --------- UTILIDADES ---------- */
function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null
  const f = new Date(fecha)
  if (isNaN(f.getTime())) return null
  const hoy = new Date()
  hoy.setHours(0,0,0,0)
  f.setHours(0,0,0,0)
  return Math.ceil((f.getTime() - hoy.getTime()) / 86400000)
}

function buildSummaries(lotes: LoteRaw[]): ProductSummary[] {
  const group: Record<string, LoteRaw[]> = {}
  lotes.forEach(l => {
    if (!group[l.codigoBarras]) group[l.codigoBarras] = []
    group[l.codigoBarras].push(l)
  })

  const summaries: ProductSummary[] = Object.values(group).map(productLotes => {
    const base = productLotes[0]
    const cantidadGeneral = productLotes.reduce((s,l)=> s + l.cantidadUnidades, 0)
    const costoTotal = productLotes.reduce((s,l)=> s + l.cantidadUnidades * l.precioCompra, 0)
    const costoPromedioUnit = cantidadGeneral > 0 ? costoTotal / cantidadGeneral : 0
    const precioVentaUnd = base.precioVenta || 0
    const margenUnit = precioVentaUnd - costoPromedioUnit
    const margenPct = costoPromedioUnit > 0 ? (margenUnit / costoPromedioUnit) * 100 : 0
    const valorVentaTeorico = cantidadGeneral * precioVentaUnd

    let unidadesVencidas = 0
    let unidadesRiesgo30d = 0
    let minDias: number | null = null

    productLotes.forEach(l => {
      const d = diasHasta(l.fechaVencimiento)
      if (d === null) return
      if (minDias === null || d < minDias) minDias = d
      if (d <= 0) unidadesVencidas += l.cantidadUnidades
      else if (d <= 30) unidadesRiesgo30d += l.cantidadUnidades
    })

    const unidadesVigentes = cantidadGeneral - unidadesVencidas - unidadesRiesgo30d
    const porcentajeEnRiesgo = cantidadGeneral > 0
      ? ((unidadesVencidas + unidadesRiesgo30d) / cantidadGeneral) * 100
      : 0

    return {
      codigoBarras: base.codigoBarras,
      nombre: base.nombre,
      concentracion: base.concentracion,
      laboratorio: base.laboratorio,
      categoria: base.categoria,
      cantidadMinima: base.cantidadMinima,
      cantidadGeneral,
      unidadesVencidas,
      unidadesRiesgo30d,
      unidadesVigentes,
      diasHastaPrimerVencimiento: minDias,
      numeroLotes: productLotes.length,
      costoTotal,
      costoPromedioUnit,
      precioVentaUnd,
      margenUnit,
      margenPct,
      valorVentaTeorico,
      porcentajeEnRiesgo,
      lotes: productLotes
    }
  })

  return summaries.sort((a,b)=> a.nombre.localeCompare(b.nombre))
}

function formatMoney(n:number) {
  return "S/ " + n.toFixed(2)
}

/* --------- COMPONENTE --------- */
export default function StockPage() {
  const { toast } = useToast()
  const [lotes, setLotes] = useState<LoteRaw[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros (se enviarán al backend)
  const [busqueda, setBusqueda] = useState("")
  const [filterLab, setFilterLab] = useState("todos")
  const [filterCat, setFilterCat] = useState("todos")

  // UI
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [densityCompact, setDensityCompact] = useState(false)

  // Paginación (UI 1-based)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0) // total del backend

  // Carga completa (para filtros y tabs especiales)
  const [allLotes, setAllLotes] = useState<LoteRaw[] | null>(null)
  const [allLoading, setAllLoading] = useState(false)

  // Carga desde backend (PAGINADO)
  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const q = busqueda.trim() ? encodeURIComponent(busqueda.trim()) : ""
      const lab = filterLab !== "todos" ? encodeURIComponent(filterLab) : ""
      const cat = filterCat !== "todos" ? encodeURIComponent(filterCat) : ""
      const params = new URLSearchParams()
      params.set("page", String(page - 1)) // backend 0-based
      params.set("size", String(pageSize))
      if (q) params.set("q", q)
      if (lab) params.set("lab", lab)
      if (cat) params.set("cat", cat)

      const res = await fetchWithAuth(apiUrl(`/api/stock?${params.toString()}`))
      // Esperado: { content: LoteRaw[], total|totalElements, page, size, totalPages }
      const content: LoteRaw[] = Array.isArray(res?.content) ? res.content : []
      const totalElements: number = typeof res?.totalElements === "number"
        ? res.totalElements
        : (typeof res?.total === "number" ? res.total : content.length)

      setLotes(content)
      setTotal(totalElements)
    } catch (e:any) {
      setLotes([])
      setTotal(0)
      toast({
        title: "Error",
        description: "No se pudo cargar el stock",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [busqueda, filterLab, filterCat, page, pageSize, toast])

  useEffect(()=> {
    cargar()
  }, [cargar])

  // Cargar todos los lotes (por lotes) para cálculos globales / filtros y tabs
  const cargarTodos = useCallback(async () => {
    try {
      setAllLoading(true)
      const q = busqueda.trim() ? encodeURIComponent(busqueda.trim()) : ""
      const lab = filterLab !== "todos" ? encodeURIComponent(filterLab) : ""
      const cat = filterCat !== "todos" ? encodeURIComponent(filterCat) : ""

      // pedir 1 elemento para conocer total
      const params0 = new URLSearchParams()
      params0.set("page", "0")
      params0.set("size", "1")
      if (q) params0.set("q", q)
      if (lab) params0.set("lab", lab)
      if (cat) params0.set("cat", cat)

      const info = await fetchWithAuth(apiUrl(`/api/stock?${params0.toString()}`))
      const totalElements: number = typeof info?.totalElements === 'number' ? info.totalElements : (typeof info?.total === 'number' ? info.total : (Array.isArray(info?.content) ? info.content.length : 0))

      if (!totalElements) {
        setAllLotes([])
        return
      }

      const lote = 500
      const pages = Math.max(1, Math.ceil(totalElements / lote))
      let all: LoteRaw[] = []
      for (let p = 0; p < pages; p++) {
        const params = new URLSearchParams()
        params.set("page", String(p))
        params.set("size", String(lote))
        if (q) params.set("q", q)
        if (lab) params.set("lab", lab)
        if (cat) params.set("cat", cat)
        const res = await fetchWithAuth(apiUrl(`/api/stock?${params.toString()}`))
        const content: LoteRaw[] = Array.isArray(res?.content) ? res.content : []
        all = all.concat(content)
      }

      setAllLotes(all)
    } catch (err) {
      console.error('Error cargarTodos:', err)
      setAllLotes(null)
    } finally {
      setAllLoading(false)
    }
  }, [busqueda, filterLab, filterCat])

  useEffect(() => {
    // cargar dataset completo para filtros y tabs especiales
    cargarTodos()
  }, [cargarTodos])

  // Resúmenes (sobre la página actual)
  const productosResumen: ProductSummary[] = useMemo(()=> buildSummaries(lotes), [lotes])

  // Opciones de filtros: preferimos derivarlas del dataset completo cuando esté disponible
  const allSummaries = useMemo(() => allLotes ? buildSummaries(allLotes) : null, [allLotes])
  const laboratorios = useMemo(() => {
    const source = allSummaries ?? productosResumen
    return ["todos", ...Array.from(new Set(source.map(p => p.laboratorio).filter(Boolean)) )]
  }, [allSummaries, productosResumen])
  const categorias = useMemo(() => {
    const source = allSummaries ?? productosResumen
    return ["todos", ...Array.from(new Set(source.map(p => p.categoria).filter(Boolean)) )]
  }, [allSummaries, productosResumen])

  // NOTA: los filtros ahora los aplica el backend, así que no filtramos en el front.
  const filtrados = productosResumen

  // Derivados Tabs: preferimos usar el dataset completo (allSummaries) si está disponible,
  // y aplicamos paginación en el front para cada tab.
  const sourceForTabs = allSummaries ?? filtrados

  const criticosFull = useMemo(() => sourceForTabs.filter(p => p.cantidadGeneral <= p.cantidadMinima), [sourceForTabs])
  const proximosFull = useMemo(() => sourceForTabs.filter(p => {
    const d = p.diasHastaPrimerVencimiento
    return d !== null && d > 0 && d <= 30
  }), [sourceForTabs])
  const vencidosFull = useMemo(() => sourceForTabs.filter(p => p.unidadesVencidas > 0), [sourceForTabs])
  const riesgoFull = useMemo(() => sourceForTabs.filter(p => p.porcentajeEnRiesgo > 0).sort((a,b)=> b.porcentajeEnRiesgo - a.porcentajeEnRiesgo), [sourceForTabs])

  // Paginación del front para tabs especiales
  const [critPage, setCritPage] = useState(1)
  const [critPageSize, setCritPageSize] = useState(10)
  const [vencPage, setVencPage] = useState(1)
  const [vencPageSize, setVencPageSize] = useState(10)
  const [proxPage, setProxPage] = useState(1)
  const [proxPageSize, setProxPageSize] = useState(10)
  const [riesgoPage, setRiesgoPage] = useState(1)
  const [riesgoPageSize, setRiesgoPageSize] = useState(10)

  const critTotal = criticosFull.length
  const critTotalPages = Math.max(1, Math.ceil(critTotal / critPageSize))
  useEffect(() => { if (critPage > critTotalPages) setCritPage(1) }, [critTotalPages, critPage])
  const critSlice = criticosFull.slice((critPage-1)*critPageSize, (critPage-1)*critPageSize + critPageSize)

  const proxTotal = proximosFull.length
  const proxTotalPages = Math.max(1, Math.ceil(proxTotal / proxPageSize))
  useEffect(() => { if (proxPage > proxTotalPages) setProxPage(1) }, [proxTotalPages, proxPage])
  const proxSlice = proximosFull.slice((proxPage-1)*proxPageSize, (proxPage-1)*proxPageSize + proxPageSize)

  const vencTotal = vencidosFull.length
  const vencTotalPages = Math.max(1, Math.ceil(vencTotal / vencPageSize))
  useEffect(() => { if (vencPage > vencTotalPages) setVencPage(1) }, [vencTotalPages, vencPage])
  const vencSlice = vencidosFull.slice((vencPage-1)*vencPageSize, (vencPage-1)*vencPageSize + vencPageSize)

  const riesgoTotal = riesgoFull.length
  const riesgoTotalPages = Math.max(1, Math.ceil(riesgoTotal / riesgoPageSize))
  useEffect(() => { if (riesgoPage > riesgoTotalPages) setRiesgoPage(1) }, [riesgoTotalPages, riesgoPage])
  const riesgoSlice = riesgoFull.slice((riesgoPage-1)*riesgoPageSize, (riesgoPage-1)*riesgoPageSize + riesgoPageSize)

  // Paginación (servidor): total viene del backend; la página muestra todos los items de esta página
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => { if (page > totalPages) setPage(1) }, [totalPages, page])
  const pageItems = productosResumen // ya son los ítems de esta página
  const shownCount = pageItems.length
  const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + (shownCount > 0 ? 1 : 0)
  const toIdx = (page - 1) * pageSize + shownCount

  function toggleExpand(codigo: string) {
    setExpanded(prev => ({ ...prev, [codigo]: !prev[codigo] }))
  }

  function estadoStock(p: ProductSummary): { variant: "default" | "destructive" | "outline" | "secondary", texto: string } {
    if (p.cantidadGeneral === 0) return { variant: "destructive", texto: "Agotado" }
    if (p.cantidadGeneral <= p.cantidadMinima) return { variant: "destructive", texto: "Crítico" }
    if (p.cantidadGeneral <= p.cantidadMinima * 2) return { variant: "secondary", texto: "Bajo" }
    return { variant: "outline", texto: "Normal" }
  }

  function barraStock(p: ProductSummary) {
    const min = p.cantidadMinima
    const current = p.cantidadGeneral
    const pct = min > 0 ? Math.min(100, Math.round((current / (min * 2)) * 100)) : 100
    const color =
      current === 0 ? "bg-red-600"
      : current <= min ? "bg-red-500"
      : current <= min * 2 ? "bg-amber-500"
      : "bg-emerald-500"
    return (
      <div className="space-y-1 w-32">
        <div className="h-1.5 w-full bg-gradient-to-r from-zinc-200/60 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 rounded overflow-hidden">
          <div className={clsx("h-full transition-all duration-500 ease-out", color)} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{current} u</span>
          {min > 0 && <span>Min {min}</span>}
        </div>
      </div>
    )
  }

  function barraEstadosLotes(p: ProductSummary) {
    const totalU = p.cantidadGeneral || 1
    const venc = p.unidadesVencidas
    const riesgo30 = p.unidadesRiesgo30d
    const vig = Math.max(0, totalU - venc - riesgo30)
    return (
      <div className="w-40">
        <div className="h-2 flex rounded overflow-hidden ring-1 ring-border/50">
          <div className="bg-emerald-500/80 backdrop-blur-sm" style={{ width: `${(vig/totalU)*100}%` }} />
          <div className="bg-amber-400/80 backdrop-blur-sm" style={{ width: `${(riesgo30/totalU)*100}%` }} />
          <div className="bg-red-500/80 backdrop-blur-sm" style={{ width: `${(venc/totalU)*100}%` }} />
        </div>
        <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
          <span>Vig {vig}</span>
          <span>30d {riesgo30}</span>
          <span>Venc {venc}</span>
        </div>
      </div>
    )
  }

  /* ---------------- KPIs (sobre la página actual) ---------------- */
  const kpis = useMemo(()=> {
    const totalProductos = productosResumen.length
    const productosCriticos = productosResumen.filter(p => p.cantidadGeneral <= p.cantidadMinima).length
    const productosConVencimiento30d = productosResumen.filter(p =>
      p.diasHastaPrimerVencimiento !== null &&
      p.diasHastaPrimerVencimiento > 0 &&
      p.diasHastaPrimerVencimiento <= 30
    ).length
    const productosVencidos = productosResumen.filter(p => p.unidadesVencidas > 0).length
    const valorInventarioCosto = productosResumen.reduce((s,p)=> s + p.costoTotal, 0)
    const valorInventarioVenta = productosResumen.reduce((s,p)=> s + p.valorVentaTeorico, 0)
    const margenPotencialTotal = valorInventarioVenta - valorInventarioCosto
    const totalUnidades = productosResumen.reduce((s,p)=> s + p.cantidadGeneral, 0)
    const totalRiesgoUnits = productosResumen.reduce((s,p)=> s + (p.unidadesRiesgo30d + p.unidadesVencidas), 0)
    const porcentajeStockEnRiesgo = totalUnidades > 0 ? (totalRiesgoUnits / totalUnidades) * 100 : 0

    return {
      totalProductos,
      productosCriticos,
      productosConVencimiento30d,
      productosVencidos,
      valorInventarioCosto,
      valorInventarioVenta,
      margenPotencialTotal,
      porcentajeStockEnRiesgo
    }
  }, [productosResumen])

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Fondo gradiente moderno */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(circle_at_80%_70%,hsl(var(--secondary)/0.10),transparent_55%)]" />

      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
            Gestión de Stock
          </h1>
          <p className="text-muted-foreground text-sm">
            Vista agregada de inventario (paginado). Fuente: /api/stock
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center rounded-full border bg-background/80 backdrop-blur px-1">
            <Button
              size="icon"
              variant={densityCompact ? "ghost" : "secondary"}
              className="h-8 w-8 rounded-full"
              onClick={() => setDensityCompact(false)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={densityCompact ? "secondary" : "ghost"}
              className="h-8 w-8 rounded-full"
              onClick={() => setDensityCompact(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={cargar}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCcw className={clsx("h-4 w-4", loading && "animate-spin")} />
            {loading ? "Actualizando..." : "Refrescar"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Productos</CardTitle>
            <Package className="h-4 w-4 text-primary/70" />
          </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{kpis.totalProductos}</div>
              <p className="text-xs text-muted-foreground mt-1">Total en esta página</p>
            </CardContent>
        </Card>
        <Card className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Críticos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-red-600 tabular-nums">{kpis.productosCriticos}</div>
            <p className="text-xs text-muted-foreground mt-1">Stock ≤ mínimo (página)</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Próx. Venc.</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-orange-600 tabular-nums">{kpis.productosConVencimiento30d}</div>
            <p className="text-xs text-muted-foreground mt-1">≤ 30 días (página)</p>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor (Costo)</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-emerald-600">{formatMoney(kpis.valorInventarioCosto)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Venta: {formatMoney(kpis.valorInventarioVenta)} — Margen: {formatMoney(kpis.margenPotencialTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-4 mx-auto md:mx-0">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="criticos">Críticos</TabsTrigger>
          <TabsTrigger value="vencimientos">Venc.</TabsTrigger>
          <TabsTrigger value="riesgo">Riesgo</TabsTrigger>
        </TabsList>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto, código, laboratorio..."
              className="pl-8 w-72"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPage(1)}}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="border rounded h-9 px-2 text-sm bg-background/70 backdrop-blur"
              value={filterLab}
              onChange={e => { setFilterLab(e.target.value); setPage(1)}}
            >
              {laboratorios.map(l => (
                <option key={l} value={l}>{l === "todos" ? "Todos los laboratorios" : l}</option>
              ))}
            </select>
            <select
              className="border rounded h-9 px-2 text-sm bg-background/70 backdrop-blur"
              value={filterCat}
              onChange={e => { setFilterCat(e.target.value); setPage(1)}}
            >
              {categorias.map(c => (
                <option key={c} value={c}>{c === "todos" ? "Todas las categorías" : c}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted/50">
            {total} resultados
          </div>
        </div>

        {/* TAB RESUMEN */}
        <TabsContent value="resumen">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inventario General</CardTitle>
              <CardDescription>
                
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="space-y-2 py-6">
                  <div className="h-8 w-40 bg-muted/50 rounded animate-pulse" />
                  <div className="h-6 w-full bg-muted/30 rounded animate-pulse" />
                  <div className="h-6 w-full bg-muted/30 rounded animate-pulse" />
                  <div className="h-6 w-3/4 bg-muted/30 rounded animate-pulse" />
                </div>
              )}
              <div className="rounded-xl border bg-card/70 backdrop-blur-sm overflow-x-auto shadow-sm">
                <Table className={clsx("transition-all", densityCompact && "[&_td]:py-1 [&_th]:py-2 text-sm")}>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8" />
                      <TableHead>Código</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Clasificación</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Estados</TableHead>
                      <TableHead>Próx. Venc.</TableHead>
                      <TableHead>Margen %</TableHead>
                      <TableHead>Valor (C/V)</TableHead>
                      <TableHead>Riesgo %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loading && pageItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                          No hay resultados con los filtros actuales
                        </TableCell>
                      </TableRow>
                    )}
                    {pageItems.map(p => {
                      const exp = expanded[p.codigoBarras]
                      const est = estadoStock(p)
                      const marginColor =
                        p.margenPct < 0 ? "text-red-600" :
                          p.margenPct < 15 ? "text-amber-600" : "text-emerald-600"
                      const riesgoColor =
                        p.porcentajeEnRiesgo > 50 ? "text-red-600" :
                          p.porcentajeEnRiesgo > 20 ? "text-amber-500" : "text-muted-foreground"

                      return (
                        <FragmentRows key={p.codigoBarras}>
                          <TableRow
                            className={clsx(
                              "group cursor-pointer transition-colors",
                              exp && "bg-muted/40",
                              "hover:bg-muted/30"
                            )}
                            onClick={() => toggleExpand(p.codigoBarras)}
                          >
                            <TableCell className="p-0 pl-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); toggleExpand(p.codigoBarras) }}
                                aria-label={exp ? "Contraer" : "Expandir"}
                              >
                                {exp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium tabular-nums">{p.codigoBarras}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium leading-tight">{p.nombre}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {p.concentracion || "—"}
                                </span>
                                <Badge
                                  variant={est.variant}
                                  className="w-fit mt-1 text-[10px] px-1.5 rounded-full"
                                >
                                  {est.texto}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-[11px] space-y-0.5">
                                <span className="font-medium">{p.categoria || "—"}</span>
                                <div className="text-muted-foreground">
                                  {p.laboratorio || "—"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{barraStock(p)}</TableCell>
                            <TableCell>{barraEstadosLotes(p)}</TableCell>
                            <TableCell>
                              {p.diasHastaPrimerVencimiento === null ? (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              ) : p.diasHastaPrimerVencimiento <= 0 ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 rounded-full">
                                  Vencido
                                </Badge>
                              ) : (
                                <Badge
                                  variant={p.diasHastaPrimerVencimiento <= 30 ? "secondary" : "outline"}
                                  className="text-[10px] px-1.5 rounded-full"
                                >
                                  {p.diasHastaPrimerVencimiento} d
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className={clsx("text-xs font-semibold tabular-nums", marginColor)}>
                                {p.margenPct.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="text-[11px] tabular-nums">
                                <div>{formatMoney(p.costoTotal)}</div>
                                <div className="text-muted-foreground">
                                  {formatMoney(p.valorVentaTeorico)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={clsx("text-xs font-bold tabular-nums", riesgoColor)}>
                                {p.porcentajeEnRiesgo.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                          {exp && (
                            <TableRow className="bg-muted/20">
                              <TableCell />
                              <TableCell colSpan={9} className="py-5">
                                <div className="grid md:grid-cols-3 gap-6">
                                  <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-1 text-sm">
                                      <Package className="h-4 w-4" /> Lotes
                                    </h4>
                                    <div className="border rounded-lg max-h-56 overflow-auto bg-background/50 backdrop-blur-sm">
                                      <Table className="text-xs">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="py-1">Lote</TableHead>
                                            <TableHead className="py-1">Unid</TableHead>
                                            <TableHead className="py-1">Venc</TableHead>
                                            <TableHead className="py-1">Compra</TableHead>
                                            <TableHead className="py-1">Estado</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {p.lotes.map(l => {
                                            const d = diasHasta(l.fechaVencimiento)
                                            let estado = "—"
                                            let variant: "outline" | "secondary" | "destructive" = "outline"
                                            if (d !== null) {
                                              if (d <= 0) { estado = "Vencido"; variant = "destructive" }
                                              else if (d <= 30) { estado = "Pronto"; variant = "secondary" }
                                              else { estado = "Vigente"; variant = "outline" }
                                            }
                                            return (
                                              <TableRow key={l.id} className="hover:bg-muted/40">
                                                <TableCell className="py-1">{l.codigoStock || l.id}</TableCell>
                                                <TableCell className="py-1 tabular-nums">{l.cantidadUnidades}</TableCell>
                                                <TableCell className="py-1">
                                                  {l.fechaVencimiento
                                                    ? new Date(l.fechaVencimiento).toLocaleDateString()
                                                    : "—"}
                                                </TableCell>
                                                <TableCell className="py-1 tabular-nums">
                                                  {l.precioCompra.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="py-1">
                                                  <Badge variant={variant} className="text-[10px] rounded-full">
                                                    {estado}{d !== null && d > 0 && ` (${d}d)`}
                                                  </Badge>
                                                </TableCell>
                                              </TableRow>
                                            )
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-1 text-sm">
                                      <Layers className="h-4 w-4" /> Resumen Inventario
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                      <InfoBox label="Total" value={`${p.cantidadGeneral} u`} />
                                      <InfoBox label="Lotes" value={p.numeroLotes} />
                                      <InfoBox label="Vencidas" value={p.unidadesVencidas} accent="text-red-600" />
                                      <InfoBox label="≤30d" value={p.unidadesRiesgo30d} accent="text-amber-500" />
                                      <InfoBox wide label="Costo Total" value={formatMoney(p.costoTotal)} />
                                      <InfoBox wide label="Valor Venta" value={formatMoney(p.valorVentaTeorico)} />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-1 text-sm">
                                      <TrendingUp className="h-4 w-4" /> Margen / Riesgo
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                      <InfoBox label="Costo Prom" value={p.costoPromedioUnit.toFixed(2)} />
                                      <InfoBox label="Precio Venta" value={p.precioVentaUnd.toFixed(2)} />
                                      <InfoBox label="Margen Unit" value={p.margenUnit.toFixed(2)} />
                                      <InfoBox label="Margen %" value={`${p.margenPct.toFixed(1)}%`} />
                                      <InfoBox wide label="% Riesgo" value={`${p.porcentajeEnRiesgo.toFixed(1)}%`} />
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </FragmentRows>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {fromIdx}-{toIdx}
                  </span>
                  <span className="opacity-60">de</span>
                  <span>{total}</span>
                  <select
                    className="border rounded h-7 px-2 text-xs bg-background/70 backdrop-blur"
                    value={pageSize}
                    onChange={e=> { setPageSize(Number(e.target.value)); setPage(1)}}
                  >
                    {[5,10,25,50,100].map(s => <option key={s} value={s}>{s} / pág</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={()=> setPage(p => Math.max(1, p-1))}>
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={page}
                      onChange={e => {
                        const val = Number(e.target.value)
                        if (!Number.isNaN(val)) setPage(Math.min(Math.max(1, val), totalPages))
                      }}
                      className="w-14 h-8 text-center"
                    />
                    <span className="text-xs text-muted-foreground">
                      / {totalPages}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={()=> setPage(p=> Math.min(totalPages, p+1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB CRÍTICOS */}
        <TabsContent value="criticos">
          <Card>
            <CardHeader>
              <CardTitle>Stock Crítico</CardTitle>
              <CardDescription>Productos con stock ≤ mínimo</CardDescription>
            </CardHeader>
            <CardContent>
              {allLoading ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Cargando...</div>
              ) : critTotal === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No hay productos críticos</div>
              ) : (
                <>
                  <div className="rounded-xl border overflow-x-auto bg-card/70 backdrop-blur-sm">
                    <Table className="text-sm min-w-[650px]">
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Mínimo</TableHead>
                          <TableHead>Faltante</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {critSlice.map((p: ProductSummary) => (
                          <TableRow key={p.codigoBarras}>
                            <TableCell>{p.codigoBarras}</TableCell>
                            <TableCell className="font-medium">{p.nombre}</TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="rounded-full">
                                {p.cantidadGeneral} u
                              </Badge>
                            </TableCell>
                            <TableCell>{p.cantidadMinima}</TableCell>
                            <TableCell className="text-red-600 font-semibold">
                              {p.cantidadMinima - p.cantidadGeneral} u
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginación frontal para Críticos */}
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <div className="text-xs text-muted-foreground">
                      {((critPage-1)*critPageSize)+1}-{Math.min(critPage*critPageSize, critTotal)} de {critTotal}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={critPage === 1} onClick={()=> setCritPage(p => Math.max(1, p-1))}>Anterior</Button>
                      <div className="flex items-center gap-1">
                        <Input className="w-16 h-8" type="number" min={1} max={critTotalPages} value={critPage} onChange={e=> { const v=Number(e.target.value); if(!Number.isNaN(v)) setCritPage(Math.min(Math.max(1,v), critTotalPages)) }} />
                        <span className="text-xs text-muted-foreground">/ {critTotalPages}</span>
                      </div>
                      <Button size="sm" variant="outline" disabled={critPage === critTotalPages} onClick={()=> setCritPage(p=> Math.min(critTotalPages, p+1))}>Siguiente</Button>
                      <select className="border rounded h-7 px-2 text-xs bg-background/70" value={critPageSize} onChange={e=> { setCritPageSize(Number(e.target.value)); setCritPage(1)}}>
                        {[5,10,25,50].map(s => <option key={s} value={s}>{s} / pág</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB VENCIMIENTOS */}
        <TabsContent value="vencimientos">
          <Card>
            <CardHeader>
              <CardTitle>Vencimientos</CardTitle>
              <CardDescription>Próximos (≤30d) y Vencidos</CardDescription>
            </CardHeader>
            <CardContent>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                <Calendar className="h-4 w-4 text-orange-500" /> Próximos (≤30 días)
              </h4>
              {allLoading ? (
                <div className="text-xs text-muted-foreground mb-6">Cargando...</div>
              ) : proxTotal === 0 ? (
                <div className="text-xs text-muted-foreground mb-6">Sin productos próximos a vencer</div>
              ) : (
                <>
                  <div className="rounded-xl border overflow-x-auto bg-card/70 backdrop-blur-sm mb-8">
                    <Table className="text-sm min-w-[600px]">
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Próx. Venc (d)</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Riesgo %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {proxSlice.map((p: ProductSummary) => (
                          <TableRow key={p.codigoBarras}>
                            <TableCell>{p.codigoBarras}</TableCell>
                            <TableCell>{p.nombre}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="rounded-full">
                                {p.diasHastaPrimerVencimiento} d
                              </Badge>
                            </TableCell>
                            <TableCell>{p.cantidadGeneral} u</TableCell>
                            <TableCell>{p.porcentajeEnRiesgo.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginación frontal para Próximos */}
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="text-xs text-muted-foreground">{((proxPage-1)*proxPageSize)+1}-{Math.min(proxPage*proxPageSize, proxTotal)} de {proxTotal}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={proxPage === 1} onClick={()=> setProxPage(p=> Math.max(1,p-1))}>Anterior</Button>
                      <div className="flex items-center gap-1">
                        <Input className="w-16 h-8" type="number" min={1} max={proxTotalPages} value={proxPage} onChange={e=> { const v=Number(e.target.value); if(!Number.isNaN(v)) setProxPage(Math.min(Math.max(1,v), proxTotalPages)) }} />
                        <span className="text-xs text-muted-foreground">/ {proxTotalPages}</span>
                      </div>
                      <Button size="sm" variant="outline" disabled={proxPage === proxTotalPages} onClick={()=> setProxPage(p=> Math.min(proxTotalPages, p+1))}>Siguiente</Button>
                      <select className="border rounded h-7 px-2 text-xs bg-background/70" value={proxPageSize} onChange={e=> { setProxPageSize(Number(e.target.value)); setProxPage(1)}}>
                        {[5,10,25,50].map(s => <option key={s} value={s}>{s} / pág</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-red-600" /> Vencidos
              </h4>
              {allLoading ? (
                <div className="text-xs text-muted-foreground">Cargando...</div>
              ) : vencTotal === 0 ? (
                <div className="text-xs text-muted-foreground">No hay productos vencidos</div>
              ) : (
                <>
                  <div className="rounded-xl border overflow-x-auto bg-card/70 backdrop-blur-sm">
                    <Table className="text-sm min-w-[600px]">
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Unid Vencidas</TableHead>
                          <TableHead>Stock Total</TableHead>
                          <TableHead>Riesgo %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vencSlice.map((p: ProductSummary) => (
                          <TableRow key={p.codigoBarras}>
                            <TableCell>{p.codigoBarras}</TableCell>
                            <TableCell>{p.nombre}</TableCell>
                            <TableCell className="text-red-600 font-semibold">{p.unidadesVencidas}</TableCell>
                            <TableCell>{p.cantidadGeneral}</TableCell>
                            <TableCell>{p.porcentajeEnRiesgo.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginación frontal para Vencidos */}
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <div className="text-xs text-muted-foreground">{((vencPage-1)*vencPageSize)+1}-{Math.min(vencPage*vencPageSize, vencTotal)} de {vencTotal}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={vencPage === 1} onClick={()=> setVencPage(p => Math.max(1, p-1))}>Anterior</Button>
                      <div className="flex items-center gap-1">
                        <Input className="w-16 h-8" type="number" min={1} max={vencTotalPages} value={vencPage} onChange={e=> { const v=Number(e.target.value); if(!Number.isNaN(v)) setVencPage(Math.min(Math.max(1,v), vencTotalPages)) }} />
                        <span className="text-xs text-muted-foreground">/ {vencTotalPages}</span>
                      </div>
                      <Button size="sm" variant="outline" disabled={vencPage === vencTotalPages} onClick={()=> setVencPage(p=> Math.min(vencTotalPages, p+1))}>Siguiente</Button>
                      <select className="border rounded h-7 px-2 text-xs bg-background/70" value={vencPageSize} onChange={e=> { setVencPageSize(Number(e.target.value)); setVencPage(1)}}>
                        {[5,10,25,50].map(s => <option key={s} value={s}>{s} / pág</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB RIESGO */}
        <TabsContent value="riesgo">
          <Card>
            <CardHeader>
              <CardTitle>Riesgo de Vencimiento</CardTitle>
              <CardDescription>% de stock vencido + próximo a vencer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-x-auto bg-card/70 backdrop-blur-sm">
                <Table className="text-sm min-w-[700px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Riesgo %</TableHead>
                      <TableHead>Unid Riesgo</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Vencidas</TableHead>
                      <TableHead>≤30d</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Cargando...</TableCell>
                      </TableRow>
                    ) : riesgoTotal === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No hay stock en riesgo</TableCell>
                      </TableRow>
                    ) : (
                      riesgoSlice.map((p: ProductSummary) => (
                        <TableRow key={p.codigoBarras}>
                          <TableCell>{p.codigoBarras}</TableCell>
                          <TableCell>{p.nombre}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                p.porcentajeEnRiesgo > 50
                                  ? "destructive"
                                  : p.porcentajeEnRiesgo > 20
                                    ? "secondary"
                                    : "outline"
                              }
                              className="rounded-full"
                            >
                              {p.porcentajeEnRiesgo.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>{p.unidadesVencidas + p.unidadesRiesgo30d}</TableCell>
                          <TableCell>{p.cantidadGeneral}</TableCell>
                          <TableCell className="text-red-600">{p.unidadesVencidas}</TableCell>
                          <TableCell className="text-amber-500">{p.unidadesRiesgo30d}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación frontal para Riesgo */}
              { !allLoading && riesgoTotal > 0 && (
                <div className="flex items-center justify-between gap-3 mt-3">
                  <div className="text-xs text-muted-foreground">{((riesgoPage-1)*riesgoPageSize)+1}-{Math.min(riesgoPage*riesgoPageSize, riesgoTotal)} de {riesgoTotal}</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={riesgoPage === 1} onClick={()=> setRiesgoPage(p => Math.max(1, p-1))}>Anterior</Button>
                    <div className="flex items-center gap-1">
                      <Input className="w-16 h-8" type="number" min={1} max={riesgoTotalPages} value={riesgoPage} onChange={e=> { const v=Number(e.target.value); if(!Number.isNaN(v)) setRiesgoPage(Math.min(Math.max(1,v), riesgoTotalPages)) }} />
                      <span className="text-xs text-muted-foreground">/ {riesgoTotalPages}</span>
                    </div>
                    <Button size="sm" variant="outline" disabled={riesgoPage === riesgoTotalPages} onClick={()=> setRiesgoPage(p=> Math.min(riesgoTotalPages, p+1))}>Siguiente</Button>
                    <select className="border rounded h-7 px-2 text-xs bg-background/70" value={riesgoPageSize} onChange={e=> { setRiesgoPageSize(Number(e.target.value)); setRiesgoPage(1)}}>
                      {[5,10,25,50].map(s => <option key={s} value={s}>{s} / pág</option>)}
                    </select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* --------- COMPONENTES AUXILIARES ---------- */
function InfoBox({ label, value, accent, wide }: { label: string, value: any, accent?: string, wide?: boolean }) {
  return (
    <div className={clsx("p-2 border rounded-lg bg-background/50 backdrop-blur-sm flex flex-col gap-0.5",
      "hover:shadow-sm transition-shadow",
      wide && "col-span-2"
    )}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={clsx("text-xs font-semibold tabular-nums", accent)}>{value}</div>
    </div>
  )
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}