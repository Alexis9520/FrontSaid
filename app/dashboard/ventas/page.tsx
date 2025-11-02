"use client"

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react"
import {
  Receipt,
  Search,
  Download,
  FileText,
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  User2,
  Users,
  Loader2,
  CalendarClock,
  RefreshCcw,
  Filter,
  X,
  Columns,
  Hash,
  AlignLeft
} from "lucide-react"

import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/date-range-picker"
import { cn } from "@/lib/utils"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// API (asegúrate de tener estas funciones exportadas desde "@/lib/api")
import { getBoletasPage, getBoletaById } from "@/lib/api"

/* ------------------------------ Tipos ------------------------------ */
type ProductoVendido = {
  codBarras: string
  nombre: string
  cantidad: number
  precio: string | number
}

type Boleta = {
  id: number
  numero: string
  fecha: string
  cliente: string
  metodoPago?: string
  total?: string | number
  totalCompra?: string | number
  vuelto?: string | number
  usuario?: string
  productos?: ProductoVendido[]
}

type Rango = { from: Date | undefined; to: Date | undefined }

/* ------------------------------ Utilidades export / formato ------------------------------ */
function arrayToCSV(rows: string[][]) {
  return rows
    .map(row => row.map(cell => `"${(cell ?? "").toString().replace(/"/g, '""')}"`).join(","))
    .join("\n")
}
function downloadCSV(filename: string, rows: string[][]) {
  const BOM = "\uFEFF"
  const csv = arrayToCSV(rows)
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
function normalizeToDate(fechaString: string) {
  if (!fechaString) return null
  // Backend envía "yyyy-MM-dd HH:mm:ss"; normalizamos a ISO con "T"
  const normalized = fechaString.includes(" ") && !fechaString.includes("T")
    ? fechaString.replace(" ", "T")
    : fechaString
  const d = new Date(normalized)
  return isNaN(d.getTime()) ? null : d
}
function formatFechaHora(fechaString: string) {
  const fecha = normalizeToDate(fechaString)
  if (!fecha) return fechaString || ""
  return `${fecha.getDate().toString().padStart(2, "0")}/${(fecha.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${fecha.getFullYear()} ${fecha
    .getHours()
    .toString()
    .padStart(2, "0")}:${fecha.getMinutes().toString().padStart(2, "0")}`
}
function safeTime(f: string) {
  const d = normalizeToDate(f)
  return d ? d.getTime() : 0
}
function exportarBoletasPDF(boletasFiltradas: Boleta[]) {
  const doc = new jsPDF()
  doc.setFont("helvetica", "normal")
  doc.setFontSize(16)
  doc.text("Listado de Boletas", 14, 16)
  autoTable(doc, {
    startY: 24,
    styles: { fontSize: 10, cellPadding: 2 },
    head: [["Número", "Fecha", "Cliente", "Método", "Total Compra", "Vuelto", "Usuario"]],
    body: boletasFiltradas.map(b => [
      b.numero,
      formatFechaHora(b.fecha),
      b.cliente,
      b.metodoPago ?? "",
      (b.totalCompra ?? b.total ?? "").toString(),
      (b.vuelto ?? "").toString(),
      b.usuario ?? ""
    ]),
    theme: "grid",
    headStyles: { fillColor: [32, 110, 237], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  })
  doc.save("boletas.pdf")
}
function formatFechaDDMM(d: Date) {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`
}

/* ------------------------------ Componente principal ------------------------------ */
export default function VentasPage() {
  const router = useRouter()

  const [boletas, setBoletas] = useState<Boleta[]>([])
  const [totalBoletas, setTotalBoletas] = useState(0)
  const [loading, setLoading] = useState(false)

  // paginación UI (1-based)
  const [paginaActual, setPaginaActual] = useState(1)
  const [tamanoPagina, setTamanoPagina] = useState(10)

  const [boletaExpandida, setBoletaExpandida] = useState<number | null>(null)
  const [busquedaBoletas, setBusquedaBoletas] = useState("")
  const [rangoFechasBoletas, setRangoFechasBoletas] = useState<Rango>({
    from: undefined,
    to: undefined
  })
  const [ordenDesc, setOrdenDesc] = useState(true)
  const [columnasCompactas, setColumnasCompactas] = useState(false)
  const [autoRefrescar, setAutoRefrescar] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  // Auto refresh
  useEffect(() => {
    if (!autoRefrescar) return
    const id = setInterval(() => {
      fetchBoletas()
    }, 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefrescar, paginaActual, tamanoPagina, busquedaBoletas, rangoFechasBoletas, ordenDesc])

  // Cambios de filtros → vuelve a página 1
  useEffect(() => {
    setPaginaActual(1)
  }, [busquedaBoletas, rangoFechasBoletas, tamanoPagina])

  useEffect(() => {
    fetchBoletas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaActual, tamanoPagina, busquedaBoletas, rangoFechasBoletas, ordenDesc])

  const fetchBoletas = useCallback(async () => {
    setLoading(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    try {
      const from = rangoFechasBoletas.from
        ? rangoFechasBoletas.from.toISOString().slice(0, 10)
        : undefined
      const to = rangoFechasBoletas.to
        ? rangoFechasBoletas.to.toISOString().slice(0, 10)
        : undefined

      // Backend es 0-based + "size"
      const data = await getBoletasPage({
        page: paginaActual - 1,
        size: tamanoPagina,
        search: busquedaBoletas,
        from,
        to
      })

      const rows = Array.isArray(data?.content) ? data.content : []
      const adaptadas: Boleta[] = rows.map((b: any) => ({
        id: b.id,
        numero: b.numero ?? b.boleta ?? "",
        fecha: b.fecha ?? b.fecha_venta ?? "",
        cliente: b.cliente ?? b.nombre_cliente ?? "",
        metodoPago: b.metodoPago ?? b.metodo_pago ?? "",
        total: b.total ?? b.total_compra ?? b.totalCompra ?? "",
        totalCompra: b.totalCompra ?? b.total_compra ?? b.total ?? "",
        vuelto: b.vuelto ?? "",
        usuario: b.usuario ?? b.usuario_nombre ?? "",
        // Listado general no trae productos; se cargarán bajo demanda
        productos: b.productos ?? []
      }))

      adaptadas.sort((a, b) => {
        const A = safeTime(a.fecha)
        const B = safeTime(b.fecha)
        return ordenDesc ? B - A : A - B
      })

      setBoletas(adaptadas)
      setTotalBoletas(typeof data.totalElements === "number" ? data.totalElements : adaptadas.length)
    } catch {
      setBoletas([])
      setTotalBoletas(0)
    } finally {
      setLoading(false)
    }
  }, [paginaActual, tamanoPagina, busquedaBoletas, rangoFechasBoletas, ordenDesc])

  const totalPaginas = Math.max(1, Math.ceil(totalBoletas / tamanoPagina))

  const exportarBoletas = () => {
    const rows: string[][] = [
      [
        "Número",
        "Fecha",
        "Cliente",
        "Método",
        "Total Compra",
        "Vuelto",
        "Usuario"
      ],
      ...boletas.map(b => [
        String(b.numero),
        formatFechaHora(b.fecha),
        String(b.cliente || ""),
        String(b.metodoPago || ""),
        String(b.totalCompra ?? b.total ?? ""),
        String(b.vuelto ?? ""),
        String(b.usuario ?? "")
      ])
    ]
    downloadCSV("boletas.csv", rows)
  }

  const metodoBadgeVariant = (met?: string) => {
    const m = (met || "").toLowerCase()
    if (m === "efectivo") return "default"
    if (["yape", "plin", "tarjeta", "pos", "mixto"].includes(m)) return "secondary"
    return "outline"
  }

  const onToggleExpand = async (b: Boleta) => {
    const expandida = boletaExpandida === b.id
    if (expandida) {
      setBoletaExpandida(null)
      return
    }
    setBoletaExpandida(b.id)
    // Lazy-load de productos si están vacíos
    if (!b.productos || b.productos.length === 0) {
      try {
        const full = await getBoletaById(b.id)
        setBoletas(prev =>
          prev.map(x =>
            x.id === b.id
              ? {
                  ...x,
                  productos: (full.productos ?? (full as any).detalles ?? []).map((p: any) => ({
                    codBarras: p.codBarras ?? p.codigoBarras ?? "",
                    nombre: p.nombre ?? "",
                    cantidad: p.cantidad ?? 0,
                    precio: p.precio ?? p.precioUnitario ?? 0
                  })),
                  totalCompra: (full as any).totalCompra ?? x.totalCompra,
                  vuelto: (full as any).vuelto ?? x.vuelto
                }
              : x
          )
        )
      } catch {
        // Ignorar errores puntuales de carga de detalles
      }
    }
  }

  return (
    <div className="relative flex flex-col gap-7">
      <BackgroundFX />

      <header className="relative z-10 flex flex-col lg:flex-row gap-5 justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
            Boletas
            <Receipt className="h-6 w-6 text-primary/70" />
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión avanzada y exportación de comprobantes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefrescar(a => !a)}
            className={cn(
              autoRefrescar && "border-primary/50 bg-primary/10 text-primary"
            )}
          >
            <RefreshCcw
              className={cn(
                "mr-2 h-4 w-4",
                autoRefrescar && "animate-spin-slow"
              )}
            />
            Auto {autoRefrescar ? "ON" : "OFF"}
          </Button>
        </div>
      </header>

      <Card className="relative overflow-hidden border-border/60 backdrop-blur-xl bg-gradient-to-br from-background/70 to-background/40">
        <CardHeader className="pb-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Listado de Boletas
              </CardTitle>
              <CardDescription>
                Busca, filtra, ordena y exporta tus boletas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOrdenDesc(o => !o)}
                className="gap-2"
                title="Cambiar orden"
              >
                <ArrowDownUp className="h-4 w-4" />
                {ordenDesc ? "Recientes" : "Antiguas"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setColumnasCompactas(c => !c)}
                className="gap-2"
              >
                <Columns className="h-4 w-4" />
                {columnasCompactas ? "Full" : "Compacto"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportarBoletas}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportarBoletasPDF(boletas)}
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-6">
          {/* Filtros */}
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-12">
            <div className="lg:col-span-5 relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar número, cliente, método..."
                className="pl-8"
                value={busquedaBoletas}
                onChange={e => setBusquedaBoletas(e.target.value)}
                autoFocus
              />
              {busquedaBoletas && (
                <button
                  onClick={() => setBusquedaBoletas("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="lg:col-span-4 flex items-center">
              <DateRangePicker
                value={
                  rangoFechasBoletas.from && rangoFechasBoletas.to
                    ? {
                        from: rangoFechasBoletas.from,
                        to: rangoFechasBoletas.to
                      }
                    : rangoFechasBoletas.from
                    ? {
                        from: rangoFechasBoletas.from,
                        to: rangoFechasBoletas.from
                      }
                    : undefined
                }
                onChange={range => {
                  if (range?.from && !range?.to) {
                    setRangoFechasBoletas({
                      from: range.from,
                      to: range.from
                    })
                  } else {
                    setRangoFechasBoletas({
                      from: range?.from,
                      to: range?.to
                    })
                  }
                }}
                className="w-full"
              />
            </div>
            <div className="lg:col-span-3 flex gap-3 items-center">
              <div className="ml-auto text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" /> {totalBoletas} total
                </div>
                <div className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> Pag {paginaActual}/{totalPaginas}
                </div>
              </div>
            </div>
          </div>

          {/* Paginación superior */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Rango:{" "}
                {rangoFechasBoletas.from
                  ? `${formatFechaDDMM(rangoFechasBoletas.from)}${
                      rangoFechasBoletas.to &&
                      rangoFechasBoletas.to.getTime() !==
                        rangoFechasBoletas.from.getTime()
                        ? " → " + formatFechaDDMM(rangoFechasBoletas.to)
                        : ""
                    }`
                  : "Todos"}
              </span>
              {busquedaBoletas && (
                <span className="flex items-center gap-1">
                  <AlignLeft className="h-3.5 w-3.5" /> Búsqueda: "
                  {busquedaBoletas.slice(0, 24)}
                  {busquedaBoletas.length > 24 && "..."}"
                </span>
              )}
              <span className="flex items-center gap-1">
                <User2 className="h-3.5 w-3.5" /> Exp:{" "}
                {boletaExpandida ? "#" + boletaExpandida : "Ninguna"}
              </span>
            </div>
            <PaginationControls
              paginaActual={paginaActual}
              totalPaginas={totalPaginas}
              tamanoPagina={tamanoPagina}
              setPaginaActual={setPaginaActual}
              setTamanoPagina={v => {
                setTamanoPagina(v)
                setPaginaActual(1)
              }}
            />
          </div>

          <div className="rounded-xl border bg-background/60 backdrop-blur-sm overflow-x-auto shadow-inner relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">
                    Cargando boletas...
                  </span>
                </div>
              </div>
            )}
            <Table className={cn(columnasCompactas && "[&_td]:py-1.5 [&_th]:py-2 text-sm")}>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="whitespace-nowrap">#</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="hidden md:table-cell">Vuelto</TableHead>
                  <TableHead className="hidden md:table-cell">Usuario</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && boletas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      <Receipt className="inline h-5 w-5 opacity-60 mr-2" />
                      No se encontraron boletas
                    </TableCell>
                  </TableRow>
                )}
                {boletas.map((b) => {
                  const expandida = boletaExpandida === b.id
                  return (
                    <React.Fragment key={b.id}>
                      <TableRow
                        className={cn(
                          "group cursor-pointer transition-colors",
                          expandida && "bg-primary/5"
                        )}
                        onDoubleClick={() => onToggleExpand(b)}
                      >
                        <TableCell className="font-semibold text-primary/80">
                          {b.numero}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">
                          {formatFechaHora(b.fecha)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <User2 className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[140px]">
                              {b.cliente || "-"}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={metodoBadgeVariant(b.metodoPago)}>
                            {b.metodoPago || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {b.totalCompra ?? b.total ?? "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell tabular-nums">
                          {b.vuelto || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="flex items-center gap-1 text-xs">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {b.usuario || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={e => {
                              e.stopPropagation()
                              onToggleExpand(b)
                            }}
                            title={expandida ? "Cerrar detalles" : "Ver detalles"}
                          >
                            {expandida ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandida && (
                        <TableRow className="bg-primary/3">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-4 border-t bg-gradient-to-br from-background/70 to-background/30">
                              <p className="text-sm font-semibold flex items-center gap-2 mb-3">
                                <Receipt className="h-4 w-4 text-primary" />
                                Productos vendidos
                              </p>
                              <div className="rounded-lg border overflow-x-auto bg-background/60">
                                <Table className="text-xs">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Código</TableHead>
                                      <TableHead>Nombre</TableHead>
                                      <TableHead>Cant.</TableHead>
                                      <TableHead>Precio</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(b.productos ?? []).length === 0 && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="py-4 text-muted-foreground text-center">
                                          Sin productos en esta boleta
                                        </TableCell>
                                      </TableRow>
                                    )}
                                    {b.productos?.map((p, idx) => (
                                      <TableRow key={`${p.codBarras}-${idx}`}>
                                        <TableCell className="tabular-nums">
                                          {p.codBarras}
                                        </TableCell>
                                        <TableCell>{p.nombre}</TableCell>
                                        <TableCell className="tabular-nums">
                                          {p.cantidad}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                          {p.precio}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    <TableRow>
                                      <TableCell
                                        colSpan={3}
                                        className="text-right font-semibold"
                                      >
                                        Total
                                      </TableCell>
                                      <TableCell className="font-semibold tabular-nums">
                                        {b.totalCompra ?? b.total ?? "—"}
                                      </TableCell>
                                    </TableRow>
                                    <TableRow>
                                      <TableCell
                                        colSpan={3}
                                        className="text-right font-semibold"
                                      >
                                        Vuelto
                                      </TableCell>
                                      <TableCell className="font-semibold tabular-nums">
                                        {b.vuelto ?? "—"}
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}

                {loading && boletas.length === 0 && (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SkeletonRow key={i} cols={8} compact={columnasCompactas} />
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación inferior */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t">
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Mostrando{" "}
                <b className="text-foreground">{boletas.length}</b> de{" "}
                <b className="text-foreground">{totalBoletas}</b> boletas
              </span>
              <span>
                Página <b className="text-foreground">{paginaActual}</b> /{" "}
                <b className="text-foreground">{totalPaginas}</b>
              </span>
            </div>
            <PaginationControls
              paginaActual={paginaActual}
              totalPaginas={totalPaginas}
              tamanoPagina={tamanoPagina}
              setPaginaActual={setPaginaActual}
              setTamanoPagina={v => {
                setTamanoPagina(v)
                setPaginaActual(1)
              }}
              variant="secondary"
              showSizeSelector
            />
          </div>
        </CardContent>

        <CardGlow />
      </Card>
    </div>
  )
}

/* ------------------------------ Subcomponentes ------------------------------ */
function PaginationControls({
  paginaActual,
  totalPaginas,
  tamanoPagina,
  setPaginaActual,
  setTamanoPagina,
  variant = "outline",
  showSizeSelector = false
}: {
  paginaActual: number
  totalPaginas: number
  tamanoPagina: number
  setPaginaActual: (n: number) => void
  setTamanoPagina: (n: number) => void
  variant?: "outline" | "secondary"
  showSizeSelector?: boolean
}) {
  return (
    <div className="flex gap-3 items-center flex-wrap">
      {showSizeSelector && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Por página</span>
          <select
            value={tamanoPagina}
            onChange={e => setTamanoPagina(Number(e.target.value))}
            className="h-8 rounded-md bg-background/70 border border-border/60 text-xs px-2"
          >
            {[5, 10, 20, 50, 100].map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={variant}
          onClick={() => setPaginaActual(1)}
          disabled={paginaActual === 1}
          className="h-8 px-3"
        >
          «
        </Button>
        <Button
          size="sm"
          variant={variant}
          onClick={() => setPaginaActual(Math.max(1, paginaActual - 1))}
          disabled={paginaActual === 1}
          className="h-8 px-3"
        >
          Prev
        </Button>
        <span className="text-xs text-muted-foreground px-1 tabular-nums">
          {paginaActual} / {totalPaginas}
        </span>
        <Button
          size="sm"
          variant={variant}
          onClick={() =>
            setPaginaActual(Math.min(totalPaginas, paginaActual + 1))
          }
          disabled={paginaActual === totalPaginas}
          className="h-8 px-3"
        >
          Next
        </Button>
        <Button
          size="sm"
          variant={variant}
          onClick={() => setPaginaActual(totalPaginas)}
          disabled={paginaActual === totalPaginas}
          className="h-8 px-3"
        >
          »
        </Button>
      </div>
    </div>
  )
}

function SkeletonRow({ cols, compact }: { cols: number; compact?: boolean }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i} className={cn(compact ? "py-1.5" : "py-3")}>
          <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
        </TableCell>
      ))}
    </TableRow>
  )
}

/* ------------------------------ FX / Decoración ------------------------------ */
function BackgroundFX() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--primary)/0.12),transparent_55%),radial-gradient(circle_at_85%_70%,hsl(var(--secondary)/0.12),transparent_55%)]" />
      <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl opacity-50 animate-pulse" />
      <div className="absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-secondary/25 to-transparent blur-3xl opacity-40 animate-pulse" />
    </div>
  )
}
function CardGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-border/40 [mask-image:linear-gradient(to_bottom,rgba(255,255,255,0.65),rgba(255,255,255,0.1))]" />
  )
}