"use client"

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Calculator,
  DollarSign,
  Plus,
  TrendingDown,
  TrendingUp,
  RefreshCcw,
  Eye,
  Flame,
  Layers,
  Gauge,
  History,
  LibraryBig,
  Sparkles,
  ShieldCheck,
  Clock8,
  Zap,
  Workflow,
  Rocket
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/lib/use-toast"
import { apiUrl } from "@/components/config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*                                    Tipos                                   */
/* -------------------------------------------------------------------------- */
type Usuario = {
  id?: number
  nombreCompleto: string
  dni: string
  rol?: string
}

type Movimiento = {
  id: number
  fecha: string
  tipo: string
  descripcion: string
  monto: number
  usuario: string
}

type CajaResumen = {
  id?: number
  idCaja?: number
  efectivo: number
  totalYape: number
  ingresos: number
  egresos: number
  efectivoInicial: number
  efectivoFinal: number
  cajaAbierta: boolean
  ventasEfectivo: number
  ventasYape: number
  ventasMixto: number
  totalVentas: number
  movimientos?: Movimiento[]
  diferencia?: number
  fechaApertura?: string
  fechaCierre?: string
  usuarioResponsable?: string
}

type HistorialCaja = {
  id: number
  fechaApertura: string
  fechaCierre: string | null
  efectivoInicial: number
  efectivoFinal: number | null
  efectivoFinalDeclarado: number | null

  diferencia: number | null
  totalYape: number
  usuarioResponsable: string
  _key?: string
}

type UltimaCajaCerrada = {
  id: number
  fechaApertura: string
  fechaCierre: string
  movimientos: Movimiento[]
}

type PageResponse<T> = {
  content: T[]
  total: number
  page: number
  size: number
}

/* -------------------------------------------------------------------------- */
/*                              Helpers de Storage                            */
/* -------------------------------------------------------------------------- */
async function fetchWithToken(url: string, options: RequestInit = {}): Promise<any> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("token")
  const headers: HeadersInit = {
    ...(options.headers || {}),
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json"
  }
  const res = await fetch(url, { ...options, headers, credentials: "include" })
  if (res.status === 204) return null
  const ct = res.headers.get("content-type")
  if (ct && ct.includes("application/json")) return res.json()
  const txt = await res.text()
  return txt || null
}

function storeMovimientosCaja(cajaId: number, movimientos: Movimiento[]) {
  try {
    localStorage.setItem(`caja_movs_${cajaId}`, JSON.stringify({ movimientos, ts: Date.now() }))
  } catch {}
}
function loadMovimientosCajaCache(cajaId: number): Movimiento[] | null {
  try {
    const raw = localStorage.getItem(`caja_movs_${cajaId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.movimientos)) return null
    return parsed.movimientos
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*                               Componente Page                              */
/* -------------------------------------------------------------------------- */
export default function CajaPage() {
  const { toast } = useToast()

  const [usuario, setUsuario] = useState<Usuario | null>(null)

  const [cajaAbierta, setCajaAbierta] = useState(false)
  const [resumen, setResumen] = useState<CajaResumen | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [efectivoInicial, setEfectivoInicial] = useState("")
  const [efectivoFinalDeclarado, setEfectivoFinalDeclarado] = useState("")
  const [nuevoMovimiento, setNuevoMovimiento] = useState({ tipo: "", monto: "", descripcion: "" })
  const [alertaCajaAbierta, setAlertaCajaAbierta] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [movimientoSearch, setMovimientoSearch] = useState("")
  const [movimientoFiltroTipo, setMovimientoFiltroTipo] = useState("")
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [confirmMovimiento, setConfirmMovimiento] = useState(false)
  const movimientoPendiente = useRef<{ tipo: string; monto: string; descripcion: string } | null>(null)

  // Historial paginado (desde backend)
  const [histPage, setHistPage] = useState(1)        // 1-based en UI
  const [histPageSize, setHistPageSize] = useState(10)
  const [historial, setHistorial] = useState<HistorialCaja[]>([])
  const [histTotal, setHistTotal] = useState(0)
  const [histLoading, setHistLoading] = useState(false)
  const [histVueltos, setHistVueltos] = useState<Record<number, number | null>>({})

  // Histórico extendido (modal de movimientos)
  const [ultimaCajaCerrada, setUltimaCajaCerrada] = useState<UltimaCajaCerrada | null>(null)
  const [dialogHistMovsOpen, setDialogHistMovsOpen] = useState(false)
  const [cajaSeleccionada, setCajaSeleccionada] = useState<HistorialCaja | null>(null)
  const [movimientosCajaSeleccionada, setMovimientosCajaSeleccionada] = useState<Movimiento[] | null>(null)
  const [loadingMovsCajaSeleccionada, setLoadingMovsCajaSeleccionada] = useState(false)

  /* -------------------------- Carga de usuario local ------------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return
    const storedUsuario = localStorage.getItem("usuario")
    if (storedUsuario) {
      try {
        setUsuario(JSON.parse(storedUsuario) as Usuario)
      } catch {
        setUsuario(null)
      }
    }
  }, [])

  /* ------------------------------ Carga general ------------------------------ */
  const refreshCajaActualYAbiertas = useCallback(async () => {
    if (!usuario) return
    setLoading(true)
    setError(null)
    try {
      // Caja actual
      const data = await fetchWithToken(apiUrl(`/api/cajas/actual?dniUsuario=${usuario.dni}`))
      if (data) {
        const idCaja = data.id ?? data.idCaja
        const cajaEstaAbierta = !data.fechaCierre
        const resumenData: CajaResumen = {
          efectivo: data.efectivo ?? 0,
          totalYape: data.totalYape ?? 0,
          ingresos: data.ingresos ?? 0,
          egresos: data.egresos ?? 0,
          efectivoInicial: data.efectivoInicial ?? 0,
          efectivoFinal: data.efectivoFinal ?? 0,
          cajaAbierta: cajaEstaAbierta,
          ventasEfectivo: data.ventasEfectivo ?? 0,
          ventasYape: data.ventasYape ?? 0,
          ventasMixto: data.ventasMixto ?? 0,
          totalVentas: data.totalVentas ?? 0,
          movimientos: data.movimientos ?? [],
          diferencia: cajaEstaAbierta ? undefined : (data.diferencia ?? 0),
          fechaApertura: data.fechaApertura,
          fechaCierre: data.fechaCierre,
          usuarioResponsable: data.usuarioResponsable,
          id: idCaja,
          idCaja
        }
        setResumen(resumenData)
        setMovimientos(resumenData.movimientos ?? [])
        setCajaAbierta(cajaEstaAbierta)
        setEfectivoInicial(resumenData.efectivoInicial.toFixed(2))
        setEfectivoFinalDeclarado("")
      } else {
        setResumen(null)
        setCajaAbierta(false)
        if (ultimaCajaCerrada) {
          setMovimientos(ultimaCajaCerrada.movimientos)
        } else {
          setMovimientos([])
        }
      }

      // Cajas abiertas (alerta)
      const abiertas = await fetchWithToken(apiUrl("/api/cajas/abiertas"))
      setAlertaCajaAbierta(Array.isArray(abiertas) && abiertas.length > 0)
    } catch (e: any) {
      setError("Error al refrescar datos: " + (e?.message || "desconocido"))
      toast({
        title: "Error",
        description: e?.message || "No se pudo refrescar los datos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [toast, ultimaCajaCerrada, usuario])

  useEffect(() => {
    refreshCajaActualYAbiertas()
  }, [refreshCajaActualYAbiertas])

  // Auto refresh parcial (no recarga historial para no romper navegación)
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      refreshCajaActualYAbiertas()
    }, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshCajaActualYAbiertas])

  /* ------------------------- Carga de Historial (SSR) ------------------------ */
  const fetchHistorial = useCallback(async (page1: number, size: number) => {
    setHistLoading(true)
    try {
      const url = apiUrl(`/api/cajas/historial?conMovimientos=false&soloManuales=true&page=${page1 - 1}&size=${size}`)
      const res = await fetchWithToken(url)

      let content: any[] = []
      let total = 0

      if (!res) {
        content = []
        total = 0
      } else if (Array.isArray(res)) {
        // Fallback: backend aún envía TODO. No lo pintes todo.
        total = res.length
        const start = (page1 - 1) * size
        const end = start + size
        content = res.slice(start, end)
      } else if (Array.isArray(res.content)) {
        content = res.content
        // Soporta total o totalElements por compatibilidad
        total = typeof res.total === "number"
          ? res.total
          : (typeof res.totalElements === "number" ? res.totalElements : res.content.length)
      }

      const mapped: HistorialCaja[] = content.map((h: any) => ({
        id: h.id ?? h.idCaja ?? 0,
        fechaApertura: h.fechaApertura,
        fechaCierre: h.fechaCierre ?? null,
        efectivoInicial: Number(h.efectivoInicial ?? 0),
        efectivoFinal: h.efectivoFinal != null ? Number(h.efectivoFinal) : null,
        efectivoFinalDeclarado: h.efectivoFinalDeclarado != null ? Number(h.efectivoFinalDeclarado) : null,

        diferencia: h.diferencia != null ? Number(h.diferencia) : null,
        totalYape: Number(h.totalYape ?? 0),
        usuarioResponsable: h.usuarioResponsable ?? "",
        _key: h.id != null
          ? `caja-${h.id}`
          : `caja-${h.fechaApertura}-${h.fechaCierre ?? "abierta"}-${h.usuarioResponsable}`
      }))

      setHistorial(mapped)
      setHistTotal(total)
    } catch (e: any) {
      setHistorial([])
      setHistTotal(0)
      toast({
        title: "Error",
        description: e?.message || "No se pudo cargar el historial",
        variant: "destructive"
      })
    } finally {
      setHistLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // Carga historial cuando hay usuario y cambian page/size
    if (!usuario) return
    fetchHistorial(histPage, histPageSize)
  }, [usuario, histPage, histPageSize, fetchHistorial])

  /* ------------------ Rehidratación última caja cerrada local ----------------- */
  useEffect(() => {
    if (cajaAbierta || ultimaCajaCerrada) return
    try {
      const raw = localStorage.getItem("ultima_caja_cerrada")
      if (raw) {
        const parsed: UltimaCajaCerrada = JSON.parse(raw)
        if (parsed?.id && Array.isArray(parsed.movimientos)) {
          setUltimaCajaCerrada(parsed)
          if (movimientos.length === 0) setMovimientos(parsed.movimientos)
        }
      }
    } catch {}
  }, [cajaAbierta, movimientos.length, ultimaCajaCerrada])

  /* ------------------------------- Acciones Caja ------------------------------ */
  const handleCerrarCaja = () => setConfirmCerrar(true)
  const confirmarCerrarCaja = async () => {
    setConfirmCerrar(false)
    await cerrarCaja()
  }

  const handleAgregarMovimiento = () => {
    const monto = parseFloat(nuevoMovimiento.monto)
    if (monto >= 1000) {
      movimientoPendiente.current = { ...nuevoMovimiento }
      setConfirmMovimiento(true)
    } else {
      agregarMovimiento()
    }
  }
  const confirmarAgregarMovimiento = async () => {
    setConfirmMovimiento(false)
    if (movimientoPendiente.current) {
      await agregarMovimiento(movimientoPendiente.current)
      movimientoPendiente.current = null
    }
  }

  const isValidMonto = (monto: string) => {
    if (!monto) return false
    const val = Number(monto)
    return !isNaN(val) && val > 0
  }
  const isValidEfectivo = (valor: string) => {
    if (valor === "") return false
    const v = Number(valor)
    return !isNaN(v) && v >= 0
  }

  const abrirCaja = async () => {
    if (!isValidEfectivo(efectivoInicial)) {
      toast({
        title: "Monto inválido",
        description: "Ingresa un efectivo inicial válido (>= 0)",
        variant: "destructive"
      })
      return
    }
    if (!usuario?.dni) {
      toast({
        title: "Usuario no encontrado",
        description: "No se pudo detectar el DNI de sesión",
        variant: "destructive"
      })
      return
    }
    setLoading(true)
    try {
      await fetchWithToken(apiUrl("/api/cajas/abrir"), {
        method: "POST",
        body: JSON.stringify({
          dniUsuario: usuario.dni,
          efectivoInicial: parseFloat(efectivoInicial)
        })
      })
      await refreshCajaActualYAbiertas()
      toast({
        title: "Caja abierta",
        description: `Apertura exitosa con S/ ${efectivoInicial}`
      })
      // refrescar historial (por si aparece una nueva caja)
      fetchHistorial(histPage, histPageSize)
    } catch {
      toast({
        title: "Error al abrir",
        description: "Revisa la conexión o intenta nuevamente",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const cerrarCaja = async () => {
    if (!usuario?.dni) {
      toast({
        title: "Usuario no encontrado",
        description: "No se pudo detectar la sesión",
        variant: "destructive"
      })
      return
    }
    if (!isValidEfectivo(efectivoFinalDeclarado)) {
      toast({
        title: "Efectivo contado inválido",
        description: "Debes registrar un valor numérico >= 0",
        variant: "destructive"
      })
      return
    }

    const idCajaActual = resumen?.id ?? resumen?.idCaja
    if (idCajaActual && movimientos.length > 0 && resumen?.fechaApertura) {
      setUltimaCajaCerrada(prev =>
        prev ||
        {
          id: idCajaActual,
          fechaApertura: resumen.fechaApertura!,
          fechaCierre: new Date().toISOString(),
          movimientos: [...movimientos]
        }
      )
    }

    setLoading(true)
    try {
      await fetchWithToken(apiUrl("/api/cajas/cerrar"), {
        method: "POST",
        body: JSON.stringify({
          dniUsuario: usuario.dni,
          efectivoFinalDeclarado: parseFloat(efectivoFinalDeclarado)
        })
      })
      toast({
        title: "Caja cerrada",
        description: "Cierre registrado correctamente"
      })
      await refreshCajaActualYAbiertas()

      if (idCajaActual) {
        const histItem = historial.find(h => h.id === idCajaActual)
        if (histItem) {
          const snapshot: UltimaCajaCerrada = {
            id: idCajaActual,
            fechaApertura: histItem.fechaApertura,
            fechaCierre: histItem.fechaCierre || new Date().toISOString(),
            movimientos: [...movimientos]
          }
          setUltimaCajaCerrada(snapshot)
          storeMovimientosCaja(idCajaActual, movimientos)
          localStorage.setItem("ultima_caja_cerrada", JSON.stringify(snapshot))
        }
      }

      // refrescar historial (la caja cerrada aparece con fechaCierre)
      fetchHistorial(histPage, histPageSize)
    } catch {
      toast({
        title: "Error al cerrar",
        description: "Revisa la operación y vuelve a intentar",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const agregarMovimiento = async (movParam?: { tipo: string; monto: string; descripcion: string }) => {
    const mov = movParam || nuevoMovimiento
    if (!mov.tipo || !mov.monto || !mov.descripcion) {
      toast({
        title: "Campos incompletos",
        description: "Completa tipo, monto y descripción",
        variant: "destructive"
      })
      return
    }
    if (!isValidMonto(mov.monto)) {
      toast({
        title: "Monto inválido",
        description: "El monto debe ser numérico y > 0",
        variant: "destructive"
      })
      return
    }
    if (!usuario?.dni) {
      toast({
        title: "Usuario no encontrado",
        description: "No se pudo detectar la sesión",
        variant: "destructive"
      })
      return
    }
    setLoading(true)
    try {
      await fetchWithToken(apiUrl("/api/cajas/movimiento"), {
        method: "POST",
        body: JSON.stringify({
          ...mov,
          monto: parseFloat(mov.monto),
          dniUsuario: usuario.dni
        })
      })
      await refreshCajaActualYAbiertas()
      setNuevoMovimiento({ tipo: "", monto: "", descripcion: "" })
      toast({ title: "Movimiento registrado" })
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No se pudo registrar",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  /* -------------------------- Cálculos y derivados --------------------------- */
  const efectivoEsperadoNum = resumen
    ? resumen.efectivoInicial + resumen.ingresos + resumen.ventasEfectivo - resumen.egresos
    : 0

  const efectivoContadoNum =
    efectivoFinalDeclarado.trim() !== "" && !isNaN(Number(efectivoFinalDeclarado))
      ? Number(efectivoFinalDeclarado)
      : null

  const diferenciaPreview =
    cajaAbierta && efectivoContadoNum !== null
      ? efectivoContadoNum - efectivoEsperadoNum
      : undefined

  const movimientosFiltrados = movimientos.filter(mov =>
    (!movimientoSearch ||
      mov.descripcion.toLowerCase().includes(movimientoSearch.toLowerCase()) ||
      mov.usuario.toLowerCase().includes(movimientoSearch.toLowerCase())) &&
    (movimientoFiltroTipo === "" ||
      movimientoFiltroTipo === "todos" ||
      mov.tipo.toLowerCase() === movimientoFiltroTipo.toLowerCase())
  )

  const cargarMovimientosCajaHist = async (caja: HistorialCaja) => {
    setCajaSeleccionada(caja)
    setDialogHistMovsOpen(true)
    setLoadingMovsCajaSeleccionada(true)
    const cache = loadMovimientosCajaCache(caja.id)
    if (cache) {
      setMovimientosCajaSeleccionada(cache)
      setLoadingMovsCajaSeleccionada(false)
      return
    }
    try {
      const movs = await fetchWithToken(apiUrl(`/api/cajas/${caja.id}/movimientos`))
      if (Array.isArray(movs)) {
        setMovimientosCajaSeleccionada(movs)
        storeMovimientosCaja(caja.id, movs)
      } else {
        setMovimientosCajaSeleccionada([])
      }
    } catch (e: any) {
      setMovimientosCajaSeleccionada([])
      toast({
        title: "Error cargando movimientos",
        description: e?.message || "Endpoint /api/cajas/{id}/movimientos no disponible",
        variant: "destructive"
      })
    } finally {
      setLoadingMovsCajaSeleccionada(false)
    }
  }

  // Calcula (y cachea) la suma de vueltos para una caja del historial
  const fetchVueltoForCaja = async (caja: HistorialCaja) => {
    if (!caja?.fechaApertura) return null
    const id = caja.id
    if (id == null) return null
    // si ya está cacheado (incluyendo null como cargado), no hacemos nada
    if (Object.prototype.hasOwnProperty.call(histVueltos, id)) return histVueltos[id]
    try {
      // rango desde apertura hasta cierre (si no hay cierre, usa fin del día)
      const from = new Date(caja.fechaApertura)
      const to = caja.fechaCierre ? new Date(caja.fechaCierre) : new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59, 999)
      const qs = `?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
      const res = await fetchWithToken(apiUrl(`/api/boletas${qs}`))
      let boletasArr: any[] = []
      if (!res) boletasArr = []
      else if (Array.isArray(res.boletas)) boletasArr = res.boletas
      else if (Array.isArray(res.content)) boletasArr = res.content
      else if (Array.isArray(res)) boletasArr = res

      const sum = boletasArr.reduce((acc, b) => acc + (Number(b.vuelto ?? 0) || 0), 0)
      setHistVueltos(prev => ({ ...prev, [id]: sum }))
      return sum
    } catch (e) {
      setHistVueltos(prev => ({ ...prev, [id]: 0 }))
      return 0
    }
  }

  // Prefetch de vueltos para la página de historial actual (mejora UX)
  useEffect(() => {
    if (historial.length === 0) return
    historial.forEach(c => {
      if (c?.id != null && !Object.prototype.hasOwnProperty.call(histVueltos, c.id)) {
        // no await: disparamos en background
        fetchVueltoForCaja(c)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historial])

  const etiquetaOrigenMovimientos = (() => {
    if (cajaAbierta) return "Caja actual (abierta)"
    if (!cajaAbierta && movimientos.length > 0 && ultimaCajaCerrada) {
      return `Caja cerrada (${new Date(ultimaCajaCerrada.fechaCierre).toLocaleString()})`
    }
    return "Sin caja activa"
  })()

  /* -------------------------- Componentes internos UI ------------------------ */
  function DiferenciaCierreCard({ diferencia }: { diferencia: number | undefined }) {
    if (diferencia === undefined || diferencia === 0) return null
    const esFaltante = diferencia < 0
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
      >
        {/* Puedes mostrar un aviso/alerta si quieres resaltar faltantes o sobrantes */}
      </motion.div>
    )
  }

  const totalHistPages = Math.max(1, Math.ceil(histTotal / histPageSize))
  // cuántas filas muestra la tabla (lo que llegó en esta página)
  const shownCount = historial.length
  const fromIdx = histTotal === 0 ? 0 : (histPage - 1) * histPageSize + (shownCount > 0 ? 1 : 0)
  const toIdx = (histPage - 1) * histPageSize + shownCount

  /* --------------------------------- Render ---------------------------------- */
  return (
    <div className="relative flex flex-col gap-8">
      <BackgroundFX />

      {/* Header */}
      <header className="relative z-10 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary/70 to-primary/40 bg-clip-text text-transparent flex items-center gap-2">
              Gestión de Caja
              <Sparkles className="h-6 w-6 text-primary/70 animate-pulse" />
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Workflow className="h-4 w-4 text-primary/60" />
              Control integral de apertura, movimientos y cierre
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-2",
                autoRefresh && "border-primary/50 bg-primary/10 text-primary"
              )}
              onClick={() => setAutoRefresh(a => !a)}
            >
              <RefreshCcw
                className={cn(
                  "h-4 w-4",
                  autoRefresh && "animate-spin-slow motion-reduce:animate-none"
                )}
              />
              Auto {autoRefresh ? "ON" : "OFF"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => {
                refreshCajaActualYAbiertas()
                fetchHistorial(histPage, histPageSize)
              }}
              className="gap-2"
            >
              <Rocket className={cn("h-4 w-4", loading && "animate-spin")} />
              Refrescar
            </Button>
            <Badge
              variant={cajaAbierta ? "secondary" : "outline"}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide",
                cajaAbierta
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white border-red-600"
              )}
            >
              {cajaAbierta ? "CAJA ABIERTA" : "CAJA CERRADA"}
            </Badge>
          </div>
        </div>

        <AnimatePresence>
          {alertaCajaAbierta && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative"
            >
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-amber-500/5 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 backdrop-blur">
                <Flame className="h-4 w-4 text-amber-500" />
                Existen otras cajas abiertas pendientes de cierre.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </header>

      {/* KPIs: sólo administradores */}
      {usuario?.rol?.toLowerCase() === "administrador" && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 relative">
          <MetricCard
            title="Efectivo actual"
            icon={<DollarSign className="h-4 w-4" />}
            value={resumen ? (resumen.efectivoFinal ?? resumen.efectivo) : null}
            suffix="S/"
            accent="from-emerald-500/25 to-emerald-500/5"
            footer="Disponible en caja"
          />
          <MetricCard
            title="Pagos Yape"
            icon={<Calculator className="h-4 w-4" />}
            value={resumen ? resumen.totalYape : null}
            suffix="S/"
            accent="from-cyan-500/25 to-cyan-500/5" 
            footer="Transacciones digitales"
          />
          <MetricCard
            title="Ingresos"
            icon={<TrendingUp className="h-4 w-4" />}
            value={resumen ? resumen.ingresos : null}
            suffix="S/"
            positive
            accent="from-blue-500/25 to-blue-500/5"
            footer="Movimientos manuales"
          />
          <MetricCard
            title="Egresos"
            icon={<TrendingDown className="h-4 w-4" />}
            value={resumen ? resumen.egresos : null}
            suffix="S/"
            negative
            accent="from-red-500/25 to-red-500/5"
            footer="Salidas registradas"
          />
        </section>
      )}

      {/* Tabs */}
      <Tabs defaultValue="movimientos" className="space-y-6 relative z-10">
        <TabsList className="w-full justify-start gap-2 bg-muted/30 backdrop-blur rounded-xl p-1">
          <FancyTab value="estado" icon={<ShieldCheck className="h-4 w-4" />}>
            Estado
          </FancyTab>
          <FancyTab value="movimientos" icon={<Layers className="h-4 w-4" />}>
            Movimientos
          </FancyTab>
          <FancyTab value="historial" icon={<History className="h-4 w-4" />}>
            Historial
          </FancyTab>
          {usuario?.rol?.toLowerCase() === "administrador" && (
            <FancyTab value="resumen" icon={<LibraryBig className="h-4 w-4" />}>
              Resumen
            </FancyTab>
          )}
        </TabsList>

        {/* ESTADO */}
        <TabsContent value="estado" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Apertura */}
            <GlassPanel>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-5 w-5 text-primary" />
                  Apertura de Caja
                </CardTitle>
                <CardDescription>Registra el efectivo inicial</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Efectivo inicial</Label>
                  <Input
                    inputMode="decimal"
                    type="number"
                    step="0.01"
                    min={0}
                    value={efectivoInicial}
                    onChange={e => setEfectivoInicial(e.target.value)}
                    disabled={cajaAbierta || loading}
                    className="bg-background/60 backdrop-blur"
                  />
                </div>
                <Button
                  onClick={abrirCaja}
                  disabled={cajaAbierta || loading}
                  
                  className="w-full"
                >
                  {cajaAbierta ? "Caja ya abierta" : loading ? "Procesando..." : "Abrir Caja"}
                </Button>
              </CardContent>
            </GlassPanel>

            {/* Cierre */}
            <GlassPanel>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock8 className="h-5 w-5 text-primary" />
                  Cierre de Caja
                </CardTitle>
                <CardDescription>Finaliza la caja actual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Efectivo contado</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={efectivoFinalDeclarado}
                    onChange={e => setEfectivoFinalDeclarado(e.target.value)}
                    disabled={!cajaAbierta || loading}
                    className="bg-background/60 backdrop-blur"
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={!cajaAbierta || loading}
                  onClick={handleCerrarCaja}
                  className="w-full"
                >
                  {!cajaAbierta ? "Caja cerrada" : loading ? "Cerrando..." : "Cerrar Caja"}
                </Button>
                <DiferenciaCierreCard
                  diferencia={
                    cajaAbierta
                      ? diferenciaPreview
                      : resumen?.diferencia
                  }
                />
              </CardContent>
            </GlassPanel>
          </div>
        </TabsContent>

        {/* MOVIMIENTOS */}
        <TabsContent value="movimientos" className="space-y-6">
          <GlassPanel>
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Movimientos de Efectivo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {etiquetaOrigenMovimientos}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Buscar usuario / descripción..."
                    className="w-56 bg-background/50 backdrop-blur"
                    value={movimientoSearch}
                    onChange={e => setMovimientoSearch(e.target.value)}
                  />
                  <Select
                    value={movimientoFiltroTipo || "todos"}
                    onValueChange={v => setMovimientoFiltroTipo(v === "todos" ? "" : v)}
                  >
                    <SelectTrigger className="w-36 bg-background/50 backdrop-blur">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="ingreso">Ingreso</SelectItem>
                      <SelectItem value="egreso">Egreso</SelectItem>
                    </SelectContent>
                  </Select>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button disabled={!cajaAbierta} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Nuevo Movimiento</DialogTitle>
                        <DialogDescription>
                          Registra un ingreso o egreso (monto ≥ 0.01).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2 text-sm">
                          <Label>Tipo</Label>
                          <Select
                            value={nuevoMovimiento.tipo}
                            onValueChange={v =>
                              setNuevoMovimiento({ ...nuevoMovimiento, tipo: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="INGRESO">Ingreso</SelectItem>
                              <SelectItem value="EGRESO">Egreso</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 text-sm">
                          <Label>Monto</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0.01}
                            value={nuevoMovimiento.monto}
                            onChange={e =>
                              setNuevoMovimiento({
                                ...nuevoMovimiento,
                                monto: e.target.value
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2 text-sm">
                          <Label>Descripción</Label>
                          <Textarea
                            rows={3}
                            value={nuevoMovimiento.descripcion}
                            onChange={e =>
                              setNuevoMovimiento({
                                ...nuevoMovimiento,
                                descripcion: e.target.value
                              })
                            }
                            placeholder="Motivo / detalle"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAgregarMovimiento} className="w-full">
                          Registrar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-xl border bg-background/50 backdrop-blur overflow-x-auto relative shadow-inner">
                <Table className="min-w-[760px]">
                  <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Fecha / Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay movimientos que coincidan.
                        </TableCell>
                      </TableRow>
                    )}
                    {movimientosFiltrados.map(mov => (
                      <motion.tr
                        key={mov.id}
                        layout
                        className="group border-b last:border-b-0 data-[state=open]:bg-muted/40 hover:bg-muted/30"
                      >
                        <TableCell className="py-2 text-xs md:text-sm">
                          {mov.fecha}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "gap-1",
                              mov.tipo.toLowerCase() === "ingreso"
                                ? "bg-emerald-500 hover:bg-emerald-500"
                                : "bg-red-500 hover:bg-red-500"
                            )}
                          >
                            {mov.tipo.toLowerCase() === "ingreso" ? (
                              <ArrowUpIcon className="h-3 w-3" />
                            ) : (
                              <ArrowDownIcon className="h-3 w-3" />
                            )}
                            {mov.tipo.charAt(0).toUpperCase() +
                              mov.tipo.slice(1).toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-pre-line break-words">
                          {mov.descripcion}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          S/ {mov.monto.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {typeof mov.usuario === "string"
                            ? mov.usuario
                            : (mov.usuario as any)?.nombreCompleto || ""}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </GlassPanel>
        </TabsContent>

        {/* HISTORIAL */}
        <TabsContent value="historial" className="space-y-6">
          <GlassPanel>
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Historial de Cajas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Aperturas y cierres ordenados del más reciente al más antiguo
                  </CardDescription>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Tamaño</Label>
                    <Select
                      value={String(histPageSize)}
                      onValueChange={v => {
                        setHistPageSize(Number(v))
                        setHistPage(1)
                      }}
                    >
                      <SelectTrigger className="h-8 w-[90px] bg-background/50 backdrop-blur">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 25, 50].map(n => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {histLoading
                      ? "Cargando..."
                      : (histTotal === 0
                        ? "0"
                        : `${fromIdx}–${toIdx}`) + ` de ${histTotal}`}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-xl border bg-background/50 backdrop-blur overflow-x-auto shadow-inner">
                <Table className="min-w-[1080px]">
                  <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
                      <TableRow>
                        <TableHead>Apertura</TableHead>
                        <TableHead>Cierre</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Ef. Inicial</TableHead>
                        <TableHead>Ef. Declarado</TableHead>
                        <TableHead>Ef. Final Sistema</TableHead>
                        <TableHead>Diferencia</TableHead>
                        <TableHead>Yape</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Ver</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {histLoading && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Cargando historial...
                        </TableCell>
                      </TableRow>
                    )}
                    {!histLoading && historial.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Sin registros.
                        </TableCell>
                      </TableRow>
                    )}
                    {!histLoading && historial.map(caja => {
                      const diff = caja.diferencia
                      return (
                        <TableRow
                          key={caja._key}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="text-xs md:text-sm">
                            {new Date(caja.fechaApertura).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">
                            {caja.fechaCierre ? (
                              new Date(caja.fechaCierre).toLocaleString()
                            ) : (
                              <span className="text-amber-500 font-medium">
                                Abierta
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">
                            {caja.usuarioResponsable}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            S/ {caja.efectivoInicial.toFixed(2)}
                          </TableCell>
                          {/* Ef. Declarado (monto contado al cerrar) - si backend lo expone usa ese campo, si no muestra — */}
                          <TableCell className="tabular-nums">
                            {((caja as any).efectivoFinalDeclarado ?? (caja as any).efectivoContado) != null
                              ? `S/ ${(Number((caja as any).efectivoFinalDeclarado ?? (caja as any).efectivoContado)).toFixed(2)}`
                              : "—"}
                          </TableCell>
                          {/* Ef. Final: mostrar valor que el sistema debe tener (restamos vueltos si están disponibles) */}
                          <TableCell className="tabular-nums">
                            {(() => {
                              if (caja.efectivoFinal == null) return "—"
                              let expected = Number(caja.efectivoFinal)
                              return `S/ ${expected.toFixed(2)}`
                            })()}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "tabular-nums",
                              diff != null && diff < 0
                                ? "text-red-500"
                                : diff != null && diff > 0
                                ? "text-emerald-500"
                                : ""
                            )}
                          >
                            {diff != null ? "S/ " + diff.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            S/ {caja.totalYape.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {caja.fechaCierre ? (
                              <Badge className="bg-red-600">Cerrada</Badge>
                            ) : (
                              <Badge className="bg-emerald-600">Abierta</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => cargarMovimientosCajaHist(caja)}
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {histTotal > histPageSize && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                  <div className="text-xs text-muted-foreground">
                    Página {histPage} de {totalHistPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={histPage === 1}
                      onClick={() => setHistPage(1)}
                    >
                      «
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={histPage === 1}
                      onClick={() => setHistPage(p => Math.max(1, p - 1))}
                    >
                      Prev
                    </Button>
                    <Input
                      className="w-16 h-8 text-center"
                      type="number"
                      min={1}
                      max={totalHistPages}
                      value={histPage}
                      onChange={e => {
                        const v = Number(e.target.value)
                        if (!Number.isNaN(v)) {
                          setHistPage(Math.min(Math.max(1, v), totalHistPages))
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={histPage === totalHistPages}
                      onClick={() =>
                        setHistPage(p => Math.min(totalHistPages, p + 1))
                      }
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={histPage === totalHistPages}
                      onClick={() => setHistPage(totalHistPages)}
                    >
                      »
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </GlassPanel>
        </TabsContent>

        {/* RESUMEN (solo administradores) */}
        {usuario?.rol?.toLowerCase() === "administrador" && (
          <TabsContent value="resumen" className="space-y-6">
          <GlassPanel>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                Resumen Diario
              </CardTitle>
              <CardDescription className="text-xs">
                Consolidado de operaciones del día
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
                      Movimientos y efectivo
                    </h3>
                  </div>
                  <MetricList>
                    <MetricRow label="Efectivo inicial" value={resumen?.efectivoInicial} />
                    <MetricRow
                      label="Ingresos manuales"
                      value={resumen?.ingresos}
                      positive
                    />
                    <MetricRow
                      label="Ventas en efectivo"
                      value={resumen?.ventasEfectivo}
                      positive
                    />
                    <MetricRow
                      label="Egresos"
                      value={resumen?.egresos}
                      negative
                    />
                  </MetricList>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
                      Ventas por método
                    </h3>
                  </div>
                  <MetricList>
                    <MetricRow
                      label="Ventas efectivo"
                      value={resumen?.ventasEfectivo}
                      positive
                    />
                    <MetricRow
                      label="Pagos Yape"
                      value={resumen?.totalYape}
                      accent="cyan"
                    />
                    <MetricRow
                      label="Total ventas"
                      value={resumen?.totalVentas}
                      bold
                    />
                  </MetricList>
                </div>
              </div>
            </CardContent>
          </GlassPanel>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <Dialog open={confirmCerrar} onOpenChange={setConfirmCerrar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar caja?</DialogTitle>
            <DialogDescription>
              Esta acción registrará el cierre definitivo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmCerrar(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarCerrarCaja}
              disabled={loading}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmMovimiento} onOpenChange={setConfirmMovimiento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimiento de alto valor</DialogTitle>
            <DialogDescription>
              El monto supera el umbral de revisión. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmMovimiento(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarAgregarMovimiento}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogHistMovsOpen}
        onOpenChange={o => {
          setDialogHistMovsOpen(o)
          if (!o) {
            setCajaSeleccionada(null)
            setMovimientosCajaSeleccionada(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Movimientos Caja #{cajaSeleccionada?.id ?? "—"}
            </DialogTitle>
            <DialogDescription>
              {cajaSeleccionada
                ? `Apertura: ${new Date(
                    cajaSeleccionada.fechaApertura
                  ).toLocaleString()}${
                    cajaSeleccionada.fechaCierre
                      ? " | Cierre: " +
                        new Date(
                          cajaSeleccionada.fechaCierre
                        ).toLocaleString()
                      : ""
                  }`
                : "Selecciona una caja del historial"}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-background/60 backdrop-blur max-h-[55vh] overflow-auto">
            <Table className="min-w-[720px]">
              <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-sm">
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMovsCajaSeleccionada && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground"
                    >
                      Cargando movimientos...
                    </TableCell>
                  </TableRow>
                )}
                {!loadingMovsCajaSeleccionada &&
                  movimientosCajaSeleccionada == null && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-6 text-muted-foreground"
                      >
                        Selecciona una caja.
                      </TableCell>
                    </TableRow>
                  )}
                {!loadingMovsCajaSeleccionada &&
                  movimientosCajaSeleccionada?.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-6 text-muted-foreground"
                      >
                        Sin movimientos.
                      </TableCell>
                    </TableRow>
                  )}
                {movimientosCajaSeleccionada?.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs md:text-sm">
                      {m.fecha}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "gap-1",
                          m.tipo.toLowerCase() === "ingreso"
                            ? "bg-emerald-500"
                            : "bg-red-500"
                        )}
                      >
                        {m.tipo.toLowerCase() === "ingreso" ? (
                          <ArrowUpIcon className="h-3 w-3" />
                        ) : (
                          <ArrowDownIcon className="h-3 w-3" />
                        )}
                        {m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-pre-line break-words">
                      {m.descripcion}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      S/ {m.monto.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs">{m.usuario}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogHistMovsOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                            Subcomponentes UI                               */
/* -------------------------------------------------------------------------- */
function Row({
  label,
  value,
  sign,
  color
}: {
  label: string
  value: number | undefined
  sign?: string
  color?: string
}) {
  return (
    <div className="flex justify-between">
      <span>{label}:</span>
      <span className={cn("tabular-nums font-medium", color)}>
        {value != null ? `${sign || ""}S/ ${value.toFixed(2)}` : "--"}
      </span>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: number | null
  icon: React.ReactNode
  suffix?: string
  accent?: string
  footer?: string
  positive?: boolean
  negative?: boolean
}
function MetricCard({
  title,
  value,
  icon,
  suffix = "",
  accent,
  footer,
  positive,
  negative
}: MetricCardProps) {
  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 240, damping: 18 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden border-border/50 bg-background/60 backdrop-blur group",
          "transition-shadow",
          "hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_8px_30px_-10px_hsl(var(--primary)/0.4)]"
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-70",
            "bg-gradient-to-br",
            accent || "from-primary/20 to-primary/5"
          )}
        />
        <CardHeader className="flex flex-row items-start justify-between pb-2 relative z-10">
          <div className="space-y-0.5">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {title}
            </CardTitle>
            {footer && (
              <p className="text-[10px] text-muted-foreground/70 uppercase">
                {footer}
              </p>
            )}
          </div>
          <div
            className={cn(
              "p-2 rounded-md bg-background/60 border border-border/50 text-primary",
              "shadow-inner"
            )}
          >
            {icon}
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div
            className={cn(
              "text-2xl font-bold tabular-nums",
              positive && "text-emerald-500",
              negative && "text-red-500"
            )}
          >
            {value != null ? `${suffix} ${value.toFixed(2)}` : "--"}
          </div>
        </CardContent>
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-primary/15 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      </Card>
    </motion.div>
  )
}

function FancyTab({
  value,
  children,
  icon
}: {
  value: string
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative px-4 py-2 rounded-md text-xs font-medium flex items-center gap-2",
        "data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/30 data-[state=active]:to-primary/10",
        "data-[state=active]:text-primary shadow-none",
        "transition-all hover:bg-muted/50"
      )}
    >
      {icon}
      {children}
    </TabsTrigger>
  )
}

function GlassPanel({ children }: { children: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-background/60 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(circle_at_90%_80%,hsl(var(--secondary)/0.18),transparent_60%)] opacity-40" />
      <div className="relative z-10">{children}</div>
    </Card>
  )
}

function MetricList({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background/50 backdrop-blur p-4 space-y-2 text-xs">
      {children}
    </div>
  )
}

function MetricRow({
  label,
  value,
  positive,
  negative,
  accent,
  bold
}: {
  label: string
  value: number | undefined
  positive?: boolean
  negative?: boolean
  accent?: "cyan" | "blue" | "purple"
  bold?: boolean
}) {
  const color =
    positive
      ? "text-emerald-500"
      : negative
      ? "text-red-500"
      : accent === "cyan"
      ? "text-cyan-500"
      : accent === "blue"
      ? "text-blue-500"
      : accent === "purple"
      ? "text-purple-500"
      : "text-foreground"
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn( 
          "tabular-nums",
          color,
          bold && "font-semibold",
          !positive && !negative && !bold && "font-medium"
        )}
      >
        {value != null ? `S/ ${value.toFixed(2)}` : "--"}
      </span>
    </div>
  )
}

function BackgroundFX() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(circle_at_85%_75%,hsl(var(--secondary)/0.18),transparent_55%)]" />
      <div className="absolute -top-48 -right-40 h-[560px] w-[560px] rounded-full bg-primary/15 blur-3xl opacity-40 animate-pulse" />
      <div className="absolute -bottom-48 -left-40 h-[560px] w-[560px] rounded-full bg-secondary/25 blur-3xl opacity-30 animate-pulse" />
    </div>
  )
}