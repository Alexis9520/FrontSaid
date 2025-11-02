"use client"

import React, { Fragment, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Download, Search, Filter, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import {
  getInventoryFull,
  getInventoryLots,
  exportInventoryFull,
  type InventoryProductFull,
  type InventoryLot,
  type PageResponse,
} from "@/lib/api" // Import unificado desde lib/api
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PEN = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 })
function money(n?: number | null) { return typeof n === "number" ? PEN.format(n) : "—" }
function dateIso(d?: string | null) { return d ? new Date(d).toLocaleDateString("es-PE") : "—" }

type SortDir = "asc" | "desc"

export function InventoryTable() {
  const [search, setSearch] = useState("")
  const [categoria, setCategoria] = useState("")
  const [activo, setActivo] = useState<"all" | "true" | "false">("all")

  const [page, setPage] = useState(0)
  const [size, setSize] = useState(50)
  const [sort, setSort] = useState("nombre")
  const [dir, setDir] = useState<SortDir>("asc")

  const [data, setData] = useState<PageResponse<InventoryProductFull> | null>(null)
  const [loading, setLoading] = useState(false)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [lotsCache, setLotsCache] = useState<Record<string, InventoryLot[]>>({})

  const params = useMemo(() => ({
    search: search.trim() || undefined,
    categoria: categoria.trim() || undefined,
    activo: activo === "all" ? undefined : activo === "true",
    page, size, sort, dir
  }), [search, categoria, activo, page, size, sort, dir])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await getInventoryFull(params)
        if (!mounted) return
        setData(res)
      } catch (e) {
        console.error("Error cargando inventario full", e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [params.page, params.size, params.sort, params.dir, params.search, params.categoria, params.activo])

  const toggleExpand = async (codigo: string) => {
    setExpanded(prev => ({ ...prev, [codigo]: !prev[codigo] }))
    if (!lotsCache[codigo]) {
      try {
        const lots = await getInventoryLots(codigo)
        setLotsCache(prev => ({ ...prev, [codigo]: lots }))
      } catch (e) {
        console.error("Error cargando lotes", e)
      }
    }
  }

  const onSort = (key: string) => {
    if (sort === key) setDir(prev => prev === "asc" ? "desc" : "asc")
    else { setSort(key); setDir("asc") }
  }

  const header = (key: string, label: string) => (
    <button className="flex items-center gap-1 hover:underline" onClick={() => onSort(key)}>
      {label}{sort === key ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </button>
  )

  const totalPages = data ? data.totalPages : 0

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 border rounded px-2 py-1">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              className="bg-transparent outline-none text-sm"
              placeholder="Buscar (código, nombre, laboratorio, categoría, principio activo)"
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value) }}
            />
          </div>
          <div className="flex items-center gap-2 border rounded px-2 py-1">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <input
              className="bg-transparent outline-none text-sm"
              placeholder="Categoría"
              value={categoria}
              onChange={(e) => { setPage(0); setCategoria(e.target.value) }}
            />
          </div>
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={activo}
            onChange={(e) => { setPage(0); setActivo(e.target.value as any) }}
          >
            <option value="all">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
          <select
            className="border rounded px-2 py-1 text-sm bg-background"
            value={size}
            onChange={(e) => { setPage(0); setSize(Number(e.target.value)) }}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await exportInventoryFull({
                  search: search.trim() || undefined,
                  categoria: categoria.trim() || undefined,
                  activo: activo === "all" ? undefined : activo === "true",
                })
              } catch (e: any) {
                alert(e?.message || "No se pudo exportar. ¿Tienes permisos de administrador?")
              }
            }}
          >
            <Download className="w-4 h-4 mr-1" /> Exportar inventario basico
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="px-2 py-2 w-10" />
              <th className="px-2 py-2">{header("codigo_barras", "Código")}</th>
              <th className="px-2 py-2">{header("nombre", "Producto")}</th>
              <th className="px-2 py-2">{header("categoria", "Clasificación")}</th>
              <th className="px-2 py-2">{header("presentacion", "Presentación")}</th>
              <th className="px-2 py-2">{header("stock_total", "Stock")}</th>
              <th className="px-2 py-2">Blister</th>
              <th className="px-2 py-2">{header("precio_venta_und", "Precio")}</th>
              <th className="px-2 py-2">Lotes</th>
              <th className="px-2 py-2">{header("activo", "Activo")}</th>
              <th className="px-2 py-2">{header("descuento", "Desc.")}</th>
              <th className="px-2 py-2">{header("laboratorio", "Laboratorio")}</th>
              <th className="px-2 py-2">{header("concentracion", "Concentración")}</th>
              <th className="px-2 py-2">{header("tipo_medicamento", "Tipo")}</th>
              <th className="px-2 py-2">{header("principio_activo", "Principio activo")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando inventario...
                </td>
              </tr>
            )}
            {!loading && data?.content?.length === 0 && (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">
                  No hay productos para mostrar.
                </td>
              </tr>
            )}

            {!loading && data?.content?.map((p) => {
              const isOpen = !!expanded[p.codigo_barras]
              return (
                <Fragment key={p.codigo_barras}>
                  <tr className="border-t hover:bg-muted/20">
                    <td className="px-2 py-2">
                      <button onClick={() => toggleExpand(p.codigo_barras)} className="p-1 rounded hover:bg-muted" aria-label="expandir">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-2 py-2 font-mono">{p.codigo_barras}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{p.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.concentracion || "—"} {p.tipo_medicamento ? <span className="ml-1 border rounded px-1">{p.tipo_medicamento}</span> : null}
                      </div>
                    </td>
                    <td className="px-2 py-2">{p.categoria || "—"}</td>
                    <td className="px-2 py-2">{p.presentacion || "—"}</td>
                    <td className="px-2 py-2">
                      <StockBar stock={p.stock_total} min={p.cantidad_minima ?? 0} proximoVenc={p.proximo_vencimiento} />
                      <div className="text-[11px] text-muted-foreground">Min: {p.cantidad_minima ?? 0}</div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-xs">{p.cantidad_unidades_blister != null ? `${p.cantidad_unidades_blister} u` : "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{money(p.precio_venta_blister)}</div>
                    </td>
                    <td className="px-2 py-2">{money(p.precio_venta_und)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs border rounded px-1">{p.lotes} lotes</span>
                        <span className={cn("text-xs border rounded px-1", p.lotes_vencidos > 0 ? "border-red-500 text-red-600" : "text-muted-foreground")}>
                          {p.lotes_vencidos} venc.
                        </span>
                      </div>
                      <div className={cn("text-[11px]", p.proximo_vencimiento ? "text-red-600" : "text-muted-foreground")}>
                        {p.proximo_vencimiento ? "Vence: " + dateIso(p.proximo_vencimiento) : "—"}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      {p.activo ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 border border-emerald-300 bg-emerald-50 rounded px-2 py-[2px] text-xs">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 border border-rose-300 bg-rose-50 rounded px-2 py-[2px] text-xs">
                          <XCircle className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">{p.descuento != null ? money(p.descuento) : "—"}</td>
                    <td className="px-2 py-2">{p.laboratorio || "—"}</td>
                    <td className="px-2 py-2">{p.concentracion || "—"}</td>
                    <td className="px-2 py-2">{p.tipo_medicamento || "—"}</td>
                    <td className="px-2 py-2">{p.principio_activo || "—"}</td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-muted/10 border-t">
                      <td colSpan={15} className="px-3 py-3">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          <section className="border rounded p-3">
                            <div className="font-medium mb-2">Detalles</div>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                              <dt className="text-muted-foreground">Principio activo</dt><dd>{p.principio_activo || "—"}</dd>
                              <dt className="text-muted-foreground">Presentación</dt><dd>{p.presentacion || "—"}</dd>
                              <dt className="text-muted-foreground">Tipo</dt><dd>{p.tipo_medicamento || "—"}</dd>
                              <dt className="text-muted-foreground">Laboratorio</dt><dd>{p.laboratorio || "—"}</dd>
                              <dt className="text-muted-foreground">Cantidad general</dt><dd>{p.cantidad_general ?? "—"}</dd>
                              <dt className="text-muted-foreground">Precio UND</dt><dd>{money(p.precio_venta_und)}</dd>
                              <dt className="text-muted-foreground">Precio BL</dt><dd>{money(p.precio_venta_blister)}</dd>
                            </dl>
                          </section>

                          <section className="border rounded p-3 overflow-auto">
                            <div className="font-medium mb-2">Lotes</div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left py-1">Lote</th>
                                  <th className="text-left py-1">Unid</th>
                                  <th className="text-left py-1">Venc</th>
                                  <th className="text-left py-1">Compra</th>
                                  <th className="text-left py-1">Estado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(lotsCache[p.codigo_barras] || []).map((l) => (
                                  <tr key={l.lote_id} className="border-t">
                                    <td className="py-1">{l.lote_id}</td>
                                    <td className="py-1">{l.cantidad_unidades}</td>
                                    <td className="py-1">{dateIso(l.fecha_vencimiento)}</td>
                                    <td className="py-1">{money(l.precio_compra)}</td>
                                    <td className="py-1">
                                      {l.estado === "VENCIDO" ? (
                                        <span className="inline-flex items-center gap-1 text-rose-700 border border-rose-300 bg-rose-50 rounded px-2 py-[2px] text-xs">
                                          <AlertTriangle className="w-3 h-3" /> Vencido
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 border border-emerald-300 bg-emerald-50 rounded px-2 py-[2px] text-xs">
                                          Ok
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {!lotsCache[p.codigo_barras]?.length && (
                                  <tr>
                                    <td colSpan={5} className="py-2 text-muted-foreground">Sin lotes</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </section>

                          <section className="border rounded p-3">
                            <div className="font-medium mb-2">Resumen</div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="border rounded p-2">
                                <div className="text-muted-foreground text-xs">UNIDADES TOTALES</div>
                                <div className="text-lg font-semibold">{p.stock_total}</div>
                              </div>
                              <div className="border rounded p-2">
                                <div className="text-muted-foreground text-xs">STOCK MÍNIMO</div>
                                <div className="text-lg font-semibold">{p.cantidad_minima ?? 0}</div>
                              </div>
                              <div className="border rounded p-2">
                                <div className="text-muted-foreground text-xs">VALOR COMPRA</div>
                                <div className="text-lg font-semibold">{money(p.valor_compra_total)}</div>
                              </div>
                              <div className="border rounded p-2">
                                <div className="text-muted-foreground text-xs">COSTO PROM.</div>
                                <div className="text-lg font-semibold">{money(p.costo_promedio)}</div>
                              </div>
                            </div>
                          </section>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {data ? `Mostrando ${data.content.length} de ${data.totalElements} productos` : "—"}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(0)}>Primero</Button>
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</Button>
          <span className="text-sm">Página {page + 1} / {Math.max(1, totalPages)}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(Math.max(0, totalPages - 1))}>Último</Button>
        </div>
      </div>
    </div>
  )
}

function StockBar({ stock, min, proximoVenc }: { stock: number; min: number; proximoVenc?: string | null }) {
  const max = Math.max(stock, min, 1)
  const pct = Math.round((stock / max) * 100)
  const critico = stock <= min
  return (
    <div className="min-w-[120px]">
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div
          className={cn("h-2", critico ? "bg-rose-500" : "bg-emerald-500")}
          style={{ width: `${pct}%` }}
          title={`Stock: ${stock} • Mín: ${min}${proximoVenc ? ` • Próx. venc: ${new Date(proximoVenc).toLocaleDateString("es-PE")}` : ""}`}
        />
      </div>
      <div className="text-xs">{stock} u {critico ? <span className="ml-1 text-rose-600 font-medium">Crítico</span> : null}</div>
    </div>
  )
}