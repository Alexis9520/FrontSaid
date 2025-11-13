"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
  ChevronsUpDown,
  ArrowUpAZ,
  ArrowDownAZ,
  User2,
  ShoppingCart,
  CreditCard,
  BadgeDollarSign,
  ClipboardCheck,
  ScanSearch,
  Bot,
  CheckCircle2,
  Loader2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/lib/use-toast"
import { apiUrl } from "@/components/config"
import { fetchWithAuth } from "@/lib/api"
import { buildTicketHTML, VentaPreview } from "@/lib/print-utils"
import { cn } from "@/lib/utils"

/* -------------------------------------------------- */
/*                       TIPOS                        */
/* -------------------------------------------------- */
interface Producto {
  codigoBarras: string
  nombre: string
  precioVentaUnd: number
  precioVentaBlister?: number
  cantidadUnidadesBlister?: number
  cantidadGeneral: number
  descuento: number
  concentracion?: string
  laboratorio?: string
  tipoMedicamento?: "GENÉRICO" | "MARCA" | string
  presentacion?: string
}
interface ProductoCarrito {
  codigoBarras: string
  nombre: string
  precioVentaUnd: number
  precioVentaBlister?: number
  cantidadUnidadesBlister?: number
  descuento: number
  cantidadBlister: number
  cantidadUnidad: number
  subtotal: number
  stockDisponible: number
}
interface UsuarioSesion {
  dni: string
  nombreCompleto: string
  rol: string
}

type SortField = "nombre" | "precio" | "stock" | "laboratorio" | "tipo" | "concentracion"
type MetodoPago = "efectivo" | "yape" | "mixto"

/* NOTE: usamos `fetchWithAuth` centralizado desde `lib/api.ts` */

/* -------------------------------------------------- */
/*        Construir preview (ticket impresión)        */
/* -------------------------------------------------- */
function buildVentaPreviewFromState(params: {
  numero: string
  fecha: string
  carrito: ProductoCarrito[]
  total: number
  metodoPago: MetodoPago
  montoEfectivo: number
  montoYape: number
  nombreCliente: string
  dniCliente: string
  nombreVendedor?: string
}): VentaPreview {
  const {
    numero,
    fecha,
    carrito,
    total,
    metodoPago,
    montoEfectivo,
    montoYape,
    nombreCliente,
    dniCliente,
    nombreVendedor
  } = params
  const items: VentaPreview["items"] = []
  carrito.forEach(p => {
    const pu = Math.max(0, p.precioVentaUnd - (p.descuento ?? 0))
    if (p.cantidadBlister > 0 && p.precioVentaBlister) {
      const nombre = p.cantidadUnidadesBlister
        ? `${p.nombre} [Blister x${p.cantidadUnidadesBlister}]`
        : `${p.nombre} [Blister]`
      items.push({
        nombre,
        cantidad: p.cantidadBlister,
        precio: p.precioVentaBlister,
        subtotal: p.precioVentaBlister * p.cantidadBlister
      })
    }
    if (p.cantidadUnidad > 0) {
      items.push({
        nombre: `${p.nombre} [Unidad]`,
        cantidad: p.cantidadUnidad,
        precio: pu,
        subtotal: pu * p.cantidadUnidad
      })
    }
  })

  let nombreMetodo = "EFECTIVO"
  if (metodoPago === "yape") nombreMetodo = "YAPE"
  if (metodoPago === "mixto") nombreMetodo = "MIXTO"

  const pagado =
    (metodoPago === "efectivo" ? montoEfectivo : 0) +
    (metodoPago === "yape" ? montoYape : 0) +
    (metodoPago === "mixto" ? montoEfectivo + montoYape : 0)
  const vuelto = Math.max(0, pagado - total)

  return {
    numero,
    fecha,
    cliente: nombreCliente,
    dni: dniCliente || undefined,
    vendedor: nombreVendedor || "",
    items,
    total,
    metodo: {
      nombre: nombreMetodo,
      efectivo:
        metodoPago === "efectivo" || metodoPago === "mixto"
          ? (montoEfectivo || undefined)
          : undefined,
      digital:
        metodoPago === "yape" || metodoPago === "mixto"
          ? (montoYape || undefined)
          : undefined,
      vuelto: vuelto || undefined
    }
  }
}

/* -------------------------------------------------- */
/*             COMPONENTE PRINCIPAL (UI)              */
/* -------------------------------------------------- */
export default function NuevaVentaPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [busqueda, setBusqueda] = useState("")
  const [debouncedBusqueda, setDebouncedBusqueda] = useState("")
  const [productos, setProductos] = useState<Producto[]>([])
  const [mostrarResultados, setMostrarResultados] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [sortField, setSortField] = useState<SortField>("nombre")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const [blisterUnidadSeleccion, setBlisterUnidadSeleccion] = useState<
    Record<string, { blisters: number; unidades: number }>
  >({})

  const [carrito, setCarrito] = useState<ProductoCarrito[]>([])
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo")
  const [montoEfectivo, setMontoEfectivo] = useState("")
  const [montoYape, setMontoYape] = useState("")

  const [dniCliente, setDniCliente] = useState("")
  const [nombreCliente, setNombreCliente] = useState("")
  const [usuarioSesion, setUsuarioSesion] = useState<UsuarioSesion | null>(null)

  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null)
  const [cargandoCaja, setCargandoCaja] = useState(false)

  const [configuracionGeneral] = useState(() => {
    if (typeof window !== "undefined") {
      const data = localStorage.getItem("configuracionGeneral")
      return data
        ? JSON.parse(data)
                : {
                    nombreNegocio: "Boticas Said",
            direccion: "Av. La Esperanza 403 - El Tambo",
            telefono: "+51 961 668 320",
            ruc: "1234567890",
            moneda: "S/"
          }
    }
    return {
              nombreNegocio: "Boticas Said",
      direccion: "Av. La Esperanza 403 - El Tambo",
      telefono: "+51 961 668 320",
      ruc: "1234567890",
      moneda: "S/"
    }
  })

  const [configuracionBoleta] = useState(() => {
    if (typeof window !== "undefined") {
      const data = localStorage.getItem("configuracionBoleta")
      return data
        ? JSON.parse(data)
        : {
            serieBoleta: "B",
            mensajePie: "",
            mostrarLogo: true,
            imprimirAutomatico: true,
            formatoImpresion: "80mm"
          }
    }
    return {
      serieBoleta: "B",
      mensajePie: "",
      mostrarLogo: true,
      imprimirAutomatico: true,
      formatoImpresion: "80mm"
    }
  })

  const checkCajaAbierta = useCallback(
    async (showMessage = false): Promise<boolean> => {
      if (!usuarioSesion?.dni) {
        setCajaAbierta(false)
        return false
      }
      try {
        setCargandoCaja(true)
        const url = apiUrl(`/api/cajas/actual?dniUsuario=${encodeURIComponent(usuarioSesion.dni)}`)
        const resp = await fetchWithAuth(url)
        if (!resp) {
          setCajaAbierta(false)
          if (showMessage) {
            toast({
              title: "No hay caja abierta",
              description: "Debes abrir una caja antes de realizar la venta.",
              variant: "destructive"
            })
          }
          return false
        }
        const abierta =
          (resp.estado && resp.estado.toUpperCase() === "ABIERTA") ||
          (!resp.estado && !resp.fechaCierre)
        setCajaAbierta(abierta)
        if (showMessage && !abierta) {
          toast({
            title: "Caja no disponible",
            description: "La caja actual está cerrada.",
            variant: "destructive"
          })
        }
        return abierta
      } catch {
        setCajaAbierta(false)
        if (showMessage) {
          toast({
            title: "Error verificando caja",
            description: "No se pudo consultar el estado de la caja.",
            variant: "destructive"
          })
        }
        return false
      } finally {
        setCargandoCaja(false)
      }
    },
    [usuarioSesion?.dni, toast]
  )

  const cargarProductos = useCallback(
    async (opts?: { q?: string; page?: number; size?: number }) => {
      try {
        const q = opts?.q ?? debouncedBusqueda ?? ""
        const p = opts?.page ?? page
        const s = opts?.size ?? pageSize
        const url = `/productos?page=${Math.max(0, p - 1)}&size=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`
        const data = await fetchWithAuth(apiUrl(url))
        if (Array.isArray(data)) {
          setProductos(data)
          setTotalElements(data.length)
          setTotalPages(1)
        } else if (data && Array.isArray(data.content)) {
          setProductos(data.content)
          setTotalElements(data.totalElements ?? 0)
          setTotalPages(data.totalPages ?? 1)
        } else {
          setProductos([])
          setTotalElements(0)
          setTotalPages(1)
        }
      } catch (err) {
        console.error("Error cargarProductos:", err)
        toast({
          title: "Error",
          description: "No se pudo cargar productos",
          variant: "destructive"
        })
        setProductos([])
      }
    },
    [debouncedBusqueda, page, pageSize, toast]
  )

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusqueda(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    if (debouncedBusqueda) setMostrarResultados(true)
    cargarProductos({ q: debouncedBusqueda, page, size: pageSize })
  }, [cargarProductos, debouncedBusqueda, page, pageSize])

  useEffect(() => {
    const usuarioStr = typeof window !== "undefined" ? localStorage.getItem("usuario") : null
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (usuarioStr && token) {
      try {
        const usuario = JSON.parse(usuarioStr)
        setUsuarioSesion(usuario)
      } catch {
        setUsuarioSesion(null)
        localStorage.removeItem("usuario")
        localStorage.removeItem("token")
        toast({
          title: "Error",
          description: "No has iniciado sesión",
          variant: "destructive"
        })
        router.push("/login")
      }
    } else {
      setUsuarioSesion(null)
      toast({
        title: "Error",
        description: "No has iniciado sesión",
        variant: "destructive"
      })
      router.push("/login")
    }
  }, [toast, router])

  useEffect(() => {
    if (usuarioSesion?.dni) checkCajaAbierta()
  }, [usuarioSesion?.dni, checkCajaAbierta])

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const arr = Array.isArray(productos) ? productos : []
    const base = mostrarResultados
      ? arr.filter(p =>
          (p.nombre ?? "").toLowerCase().includes(q) ||
          (p.codigoBarras ?? "").toLowerCase().includes(q) ||
          (p.laboratorio ?? "").toLowerCase().includes(q) ||
          (p.concentracion ?? "").toLowerCase().includes(q) ||
          (p.tipoMedicamento ?? "").toLowerCase().includes(q)
        )
      : []
    base.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1
      switch (sortField) {
        case "nombre":
          return (a.nombre ?? "").localeCompare(b.nombre ?? "") * mul
        case "precio": {
          const pa = a.precioVentaUnd - (a.descuento || 0)
          const pb = b.precioVentaUnd - (b.descuento || 0)
          return (pa - pb) * mul
        }
        case "stock":
          return (a.cantidadGeneral - b.cantidadGeneral) * mul
        case "laboratorio":
          return (a.laboratorio || "").localeCompare(b.laboratorio || "") * mul
        case "tipo":
          return (a.tipoMedicamento || "").localeCompare(b.tipoMedicamento || "") * mul
        case "concentracion":
          return (a.concentracion || "").localeCompare(b.concentracion || "") * mul
        default:
          return 0
      }
    })
    return base
  }, [productos, busqueda, sortField, sortDir, mostrarResultados])

  const total = carrito.reduce(
    (sum, item) =>
      sum +
      (item.precioVentaBlister ?? 0) * item.cantidadBlister +
      (item.precioVentaUnd - (item.descuento ?? 0)) * item.cantidadUnidad,
    0
  )

  let vuelto = 0
  let faltante = 0
  if (metodoPago === "efectivo") {
    const efectivo = Number.parseFloat(montoEfectivo) || 0
    vuelto = efectivo > total ? efectivo - total : 0
    faltante = efectivo < total ? total - efectivo : 0
  } else if (metodoPago === "yape") {
    const yape = Number.parseFloat(montoYape) || 0
    vuelto = yape > total ? yape - total : 0
    faltante = yape < total ? total - yape : 0
  } else {
    const ef = Number(montoEfectivo) || 0
    const yp = Number(montoYape) || 0
    const pagado = ef + yp
    vuelto = pagado > total ? pagado - total : 0
    faltante = pagado < total ? total - pagado : 0
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === "asc" ? "desc" : "asc"))
    else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  // VALIDACIÓN al intentar agregar: código de barras y precios
  const agregarAlCarrito = (producto: Producto, selectionKey: string) => {
    const codigo = (producto.codigoBarras || "").trim()
    if (!codigo) {
      toast({
        title: "Producto inválido",
        description: "No se puede agregar un producto sin código de barras.",
        variant: "destructive"
      })
      return
    }

    const precioUnidadFinal = producto.precioVentaUnd - (producto.descuento ?? 0)
    if (precioUnidadFinal <= 0) {
      toast({
        title: "Precio inválido",
        description: `El producto "${producto.nombre}" tiene precio unidad <= 0.`,
        variant: "destructive"
      })
      return
    }
    if (
      producto.cantidadUnidadesBlister &&
      producto.precioVentaBlister !== undefined &&
      producto.precioVentaBlister <= 0
    ) {
      toast({
        title: "Precio blister inválido",
        description: `El producto "${producto.nombre}" tiene precio de blister <= 0.`,
        variant: "destructive"
      })
      return
    }

    const sel = blisterUnidadSeleccion[selectionKey] || { blisters: 0, unidades: 0 }
    const unidadesPorBlister = producto.cantidadUnidadesBlister || 0
    const cantidadTotal = unidadesPorBlister * sel.blisters + sel.unidades
    if (cantidadTotal <= 0) {
      toast({ title: "Cantidad inválida", description: "Agrega al menos 1 unidad o blister", variant: "destructive" })
      return
    }
    if (cantidadTotal > producto.cantidadGeneral) {
      toast({
        title: "Stock insuficiente",
        description: `Máximo ${producto.cantidadGeneral} unidades`,
        variant: "destructive"
      })
      return
    }

    setCarrito(prev => {
      const existing = prev.find(p => p.codigoBarras === producto.codigoBarras)
      const precioBlister = producto.precioVentaBlister ?? 0

      if (existing) {
        const newB = existing.cantidadBlister + sel.blisters
        const newU = existing.cantidadUnidad + sel.unidades
        const nuevoTotalUnidades = unidadesPorBlister * newB + newU
        if (nuevoTotalUnidades > existing.stockDisponible) {
          toast({
            title: "Stock insuficiente",
            description: `Máximo ${existing.stockDisponible} unidades`,
            variant: "destructive"
          })
          return prev
        }
        return prev.map(p =>
          p.codigoBarras === existing.codigoBarras
            ? {
                ...p,
                cantidadBlister: newB,
                cantidadUnidad: newU,
                subtotal: precioBlister * newB + precioUnidadFinal * newU
              }
            : p
        )
      }

      return [
        ...prev,
        {
          codigoBarras: producto.codigoBarras,
          nombre: producto.nombre,
            precioVentaUnd: producto.precioVentaUnd,
          precioVentaBlister: producto.precioVentaBlister,
          cantidadUnidadesBlister: producto.cantidadUnidadesBlister,
          descuento: producto.descuento,
          cantidadBlister: sel.blisters,
          cantidadUnidad: sel.unidades,
          subtotal: precioBlister * sel.blisters + precioUnidadFinal * sel.unidades,
          stockDisponible: producto.cantidadGeneral
        }
      ]
    })
  }

  const cambiarCantidadCarrito = (codigoBarras: string, tipo: "blister" | "unidad", delta: number) => {
    setCarrito(prev =>
      prev
        .map(item => {
          if (item.codigoBarras !== codigoBarras) {
            return item
          }

          // VALIDAR código de barras (si se quedó vacío por algún bug)
          if (!item.codigoBarras || !item.codigoBarras.trim()) {
            toast({
              title: "Código inválido",
              description: "Este producto no tiene código de barras válido.",
              variant: "destructive"
            })
            return item
          }

          const precioUnidadFinal = item.precioVentaUnd - (item.descuento ?? 0)
          if (precioUnidadFinal <= 0) {
            toast({
              title: "Precio inválido",
              description: `El producto "${item.nombre}" tiene precio unidad <= 0.`,
              variant: "destructive"
            })
            return item
          }

          const stockMax = item.stockDisponible
          let nb = item.cantidadBlister
          let nu = item.cantidadUnidad

          if (tipo === "blister") {
            nb = Math.max(0, nb + delta)
          } else {
            nu = Math.max(0, nu + delta)
          }

          const unidadesPorBlister = item.cantidadUnidadesBlister || 0
          const totalTemp = unidadesPorBlister * nb + nu
          if (totalTemp > stockMax) {
            toast({
              title: "Stock insuficiente",
              description: `Máximo ${stockMax} unidades`,
              variant: "destructive"
            })
            return item
          }
          const precioBlister = item.precioVentaBlister ?? 0
          return {
            ...item,
            cantidadBlister: nb,
            cantidadUnidad: nu,
            subtotal: precioBlister * nb + precioUnidadFinal * nu
          }
        })
        .filter(i => i.cantidadBlister > 0 || i.cantidadUnidad > 0)
    )
  }

  const eliminarDelCarrito = (codigoBarras: string) => {
    const eliminado = carrito.find(c => c.codigoBarras === codigoBarras)
    setCarrito(prev => prev.filter(c => c.codigoBarras !== codigoBarras))
    if (eliminado) {
      toast({
        title: "Producto eliminado",
        description: `"${eliminado.nombre}" fue removido`,
      })
    }
  }

  /* ---------- Procesar Venta ---------- */
  const procesarVenta = async () => {
    if (carrito.length === 0) {
      toast({ title: "Carrito vacío", description: "Agrega productos", variant: "destructive" })
      return
    }
    const abierta = await checkCajaAbierta(true)
    if (!abierta) return

    // Validación de integridad del carrito antes de enviar al backend
    const productoInvalido = carrito.find(p => {
      const codigo = (p.codigoBarras || "").trim()
      const precioUnidadFinal = p.precioVentaUnd - (p.descuento ?? 0)
      return !codigo || precioUnidadFinal <= 0
    })
    if (productoInvalido) {
      toast({
        title: "Carrito inválido",
        description: `El producto "${productoInvalido.nombre}" tiene código vacío o precio <= 0.`,
        variant: "destructive"
      })
      return
    }

    // Validaciones de pago
    if (metodoPago === "efectivo") {
      const efectivo = Number(montoEfectivo) || 0
      if (efectivo < total) {
        toast({ title: "Monto insuficiente", description: "El efectivo no cubre el total", variant: "destructive" })
        return
      }
    } else if (metodoPago === "yape") {
      const yape = Number(montoYape) || 0
      if (yape < total) {
        toast({ title: "Monto insuficiente", description: "El monto Yape no cubre el total", variant: "destructive" })
        return
      }
    } else {
      const ef = Number(montoEfectivo) || 0
      const yp = Number(montoYape) || 0
      if (ef <= 0 || yp <= 0) {
        toast({ title: "Montos inválidos", description: "Ambos montos deben ser > 0", variant: "destructive" })
        return
      }
      if (ef + yp < total) {
        toast({ title: "Suma insuficiente", description: "La suma no cubre el total", variant: "destructive" })
        return
      }
    }

    if (!nombreCliente.trim() || !usuarioSesion?.nombreCompleto) {
      toast({ title: "Faltan datos", description: "Completa los datos del cliente", variant: "destructive" })
      return
    }

    const ventaDTO = {
      dniCliente: dniCliente.trim() || "",
      nombreCliente: nombreCliente.trim(),
      dniVendedor: usuarioSesion?.dni || "",
      productos: carrito.map(item => ({
        codBarras: item.codigoBarras,
        cantidad:
          (item.cantidadUnidadesBlister ?? 0) * item.cantidadBlister +
          item.cantidadUnidad
      })),
      metodoPago: {
        nombre: metodoPago.toUpperCase(),

        efectivo: (metodoPago === "efectivo" || metodoPago === "mixto") ? Number(montoEfectivo) : 0.0,

        digital: metodoPago === "yape" ? total : (metodoPago === "mixto" ? Number(montoYape) : 0),

        efectivoFix: metodoPago === "efectivo" 
          ? total // Si todo es efectivo, el neto es el total
          : (metodoPago === "mixto" 
              ? (total - (Number(montoYape) || 0)) // Si es mixto, el neto es el total menos lo pagado con yape
              : 0) // Si es yape puro, el neto en efectivo es 0
      }
    }
    // --- CÓDIGO DE DEPURACIÓN AÑADIDO ---
    console.log("Enviando Venta DTO al Backend:", ventaDTO)
    // ------------------------------------

    try {
      const resp = await fetchWithAuth(apiUrl("/api/ventas"), {
        method: "POST",
        body: JSON.stringify(ventaDTO)
      })
      if (!resp?.numero) {
        toast({ title: "Error", description: "No se recibió número de boleta", variant: "destructive" })
        return
      }
      toast({ title: "Venta realizada", description: "Registrada correctamente" })

      const ventaPreview: VentaPreview = buildVentaPreviewFromState({
        numero: resp.numero,
        fecha: resp.fecha || new Date().toLocaleString(),
        carrito,
        total,
        metodoPago,
        montoEfectivo: Number(montoEfectivo) || 0,
        montoYape: Number(montoYape) || 0,
        nombreCliente: nombreCliente.trim(),
        dniCliente: dniCliente.trim(),
        nombreVendedor: usuarioSesion?.nombreCompleto
      })

      const html = buildTicketHTML(
        ventaPreview,
        {
          nombreNegocio: configuracionGeneral.nombreNegocio,
          direccion: configuracionGeneral.direccion,
          telefono: configuracionGeneral.telefono,
          email: configuracionGeneral.email,
          ruc: configuracionGeneral.ruc,
          moneda: configuracionGeneral.moneda
        },
        {
          mensajePie: configuracionBoleta.mensajePie,
          mostrarLogo: configuracionBoleta.mostrarLogo,
          formatoImpresion: configuracionBoleta.formatoImpresion as any
        }
      )

      const previewWin = window.open("/print", "ticketPreview", "width=800,height=900")
      if (!previewWin) {
        toast({
          title: "Pop-up bloqueado",
          description: "Permite ventanas emergentes para imprimir.",
          variant: "destructive"
        })
      }
      try {
        localStorage.setItem(
          "ticket_preview_job",
          JSON.stringify({
            html,
            formato: configuracionBoleta.formatoImpresion,
            auto: !!configuracionBoleta.imprimirAutomatico
          })
        )
      } catch {}

      try {
        await cargarProductos({ q: debouncedBusqueda, page: 1, size: pageSize })
      } catch {}

      setCarrito([])
      setMontoEfectivo("")
      setMontoYape("")
      setMostrarResultados(false)
      setDniCliente("")
      setNombreCliente("")
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || "No se pudo registrar la venta"
      if (msg.includes("No hay una caja abierta")) {
        setCajaAbierta(false)
        toast({
          title: "Caja cerrada",
          description: "Abre una caja antes de vender.",
          variant: "destructive"
        })
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" })
      }
    }
  }

  const procesarVentaDisabled = carrito.length === 0 || !cajaAbierta || cargandoCaja

  function SortButton({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field
    const dirIcon = active ? (sortDir === "asc" ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-60" />
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium transition",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {children}
        {dirIcon}
      </button>
    )
  }

  return (
    <div className="relative flex flex-col gap-8">
      <BackgroundFX />

      <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
        <Link
          href="/dashboard/ventas"
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Historial
        </Link>
        <div className="flex items-center gap-2">
          {cajaAbierta === null && <Badge variant="outline" className="animate-pulse">Verificando caja...</Badge>}
          {cajaAbierta === false && <Badge variant="destructive">Caja cerrada</Badge>}
          {cajaAbierta === true && (
            <Badge className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Caja abierta
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          <GlassPanel>
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ScanSearch className="h-5 w-5 text-primary" />
                    Buscar Productos
                  </CardTitle>
                  <CardDescription>
                    Nombre, código, laboratorio, concentración o tipo
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Buscar..."
                      className="pl-8 w-60"
                      value={busqueda}
                      onChange={e => {
                        setBusqueda(e.target.value)
                        if (e.target.value.trim() === "") setMostrarResultados(false)
                        else setMostrarResultados(true)
                      }}
                      onKeyDown={e => {
                        if (e.key === "Escape") {
                          setBusqueda("")
                          setMostrarResultados(false)
                        }
                      }}
                    />
                    {busqueda && (
                      <button
                        onClick={() => {
                          setBusqueda("")
                          setMostrarResultados(false)
                        }}
                        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant={mostrarResultados ? "secondary" : "default"}
                    onClick={() => {
                      if (busqueda.trim() === "") {
                        toast({ title: "Ingresa un término", variant: "destructive" })
                        return
                      }
                      setMostrarResultados(true)
                    }}
                  >
                    {mostrarResultados ? "Refrescar" : "Buscar"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {!mostrarResultados && (
                <div className="text-xs text-muted-foreground flex items-center gap-2 py-6">
                  <Bot className="h-4 w-4" />
                  Introduce un término de búsqueda para mostrar resultados.
                </div>
              )}
              {mostrarResultados && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">
                      Resultados <span className="text-muted-foreground">({resultados.length})</span>
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="hidden xl:flex items-center gap-3 pr-3 border-r">
                        <SortButton field="nombre">Nombre</SortButton>
                        <SortButton field="precio">Precio</SortButton>
                        <SortButton field="stock">Stock</SortButton>
                        <SortButton field="laboratorio">Lab</SortButton>
                        <SortButton field="tipo">Tipo</SortButton>
                        <SortButton field="concentracion">Concent.</SortButton>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setMostrarResultados(false)
                          setBusqueda("")
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/60 backdrop-blur max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[11px]">
                          <TableHead className="min-w-[120px]">
                            <SortButton field="nombre">Producto</SortButton>
                          </TableHead>
                          <TableHead className="w-[100px]">
                            <SortButton field="concentracion">Concent.</SortButton>
                          </TableHead>
                          <TableHead className="w-[120px]">
                            <SortButton field="laboratorio">Laboratorio</SortButton>
                          </TableHead>
                          <TableHead className="w-[80px]">
                            <SortButton field="tipo">Tipo</SortButton>
                          </TableHead>
                          <TableHead className="w-[110px]">Presentación</TableHead>
                          <TableHead className="w-[130px]">
                            <SortButton field="precio">Precio</SortButton>
                          </TableHead>
                          <TableHead className="w-[75px]">
                            <SortButton field="stock">Stock</SortButton>
                          </TableHead>
                          <TableHead className="w-[150px] text-center">
                            Venta
                          </TableHead>
                          <TableHead className="text-right w-[100px]">
                            Agregar
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultados.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-6 text-xs text-muted-foreground">
                              Sin resultados
                            </TableCell>
                          </TableRow>
                        )}
                        {resultados.map((prod, idx) => {
                          const selectionKey =
                            prod.codigoBarras ??
                            `${(prod.nombre || "").trim()}|${(prod.laboratorio || "").trim()}|${idx}`
                          const rowKey = prod.codigoBarras ?? `result-${idx}`

                          const precioUnidadFinal =
                            prod.precioVentaUnd - (prod.descuento ?? 0)
                          const descuentoPct =
                            prod.precioVentaUnd > 0 && (prod.descuento ?? 0) > 0
                              ? ((prod.descuento ?? 0) / prod.precioVentaUnd) * 100
                              : 0
                          const sel =
                            blisterUnidadSeleccion[selectionKey] || {
                              blisters: 0,
                              unidades: 0
                            }
                          const tipoBadgeVariant =
                            prod.tipoMedicamento === "MARCA" ? "destructive" : "outline"
                          return (
                            <TableRow key={rowKey} className="text-[11.5px]">
                              <TableCell className="align-top">
                                <div className="font-medium leading-tight">
                                  {prod.nombre}
                                </div>
                                <div className="text-[9px] text-muted-foreground">
                                  {prod.codigoBarras || "—"}
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                {prod.concentracion || "—"}
                              </TableCell>
                              <TableCell className="align-top">
                                {prod.laboratorio || "—"}
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge
                                  variant={tipoBadgeVariant}
                                  className="px-1.5 py-0 text-[9px]"
                                >
                                  {prod.tipoMedicamento || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top">
                                {prod.presentacion ? (
                                  <span className="line-clamp-2">
                                    {prod.presentacion}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="flex flex-col gap-0.5">
                                  {prod.precioVentaBlister &&
                                  prod.cantidadUnidadesBlister ? (
                                    <div className="text-xs">
                                      <span className="font-semibold text-primary">
                                        S/ {prod.precioVentaBlister.toFixed(2)}
                                      </span>{" "}
                                      <span className="text-muted-foreground">
                                        / blister
                                      </span>
                                    </div>
                                  ) : null}
                                  <div className="text-xs flex flex-col">
                                    {descuentoPct > 0 && (
                                      <span className="line-through text-[10px] text-muted-foreground">
                                        S/ {prod.precioVentaUnd.toFixed(2)}
                                      </span>
                                    )}
                                    <span
                                      className={cn(
                                        "font-semibold",
                                        descuentoPct > 0 && "text-emerald-600"
                                      )}
                                    >
                                      S/ {precioUnidadFinal.toFixed(2)}
                                      <span className="text-muted-foreground">
                                        {" "}
                                        / und
                                      </span>
                                    </span>
                                  </div>
                                  {descuentoPct > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-yellow-100 text-yellow-800 border-yellow-300 w-fit px-1 py-0 text-[9px]"
                                    >
                                      -{descuentoPct.toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge
                                  variant={
                                    prod.cantidadGeneral <= 0
                                      ? "destructive"
                                      : prod.cantidadGeneral <= 10
                                      ? "secondary"
                                      : "default"
                                  }
                                  className="px-1.5 py-0 text-[9px]"
                                >
                                  {prod.cantidadGeneral} u
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top">
                                <div className="flex flex-col gap-1">
                                  {prod.cantidadUnidadesBlister &&
                                  prod.precioVentaBlister ? (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-1">
                                        <span className="text-[9px]">Blisters</span>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={Math.floor(
                                            prod.cantidadGeneral /
                                              (prod.cantidadUnidadesBlister || 1)
                                          )}
                                          className="w-14 h-7 text-[11px]"
                                          value={sel.blisters || ""}
                                          onChange={e => {
                                            const v = Math.max(0, Number(e.target.value))
                                            setBlisterUnidadSeleccion(prev => ({
                                              ...prev,
                                              [selectionKey]: {
                                                blisters: v,
                                                unidades:
                                                  prev[selectionKey]?.unidades ?? 0
                                              }
                                            }))
                                          }}
                                        />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[9px]">Unidades</span>
                                        <Input
                                          type="number"
                                          min={0}
                                          max={
                                            prod.cantidadUnidadesBlister &&
                                            prod.cantidadUnidadesBlister > 1
                                              ? prod.cantidadUnidadesBlister - 1
                                              : prod.cantidadGeneral -
                                                sel.blisters *
                                                  (prod.cantidadUnidadesBlister || 0)
                                          }
                                          className="w-14 h-7 text-[11px]"
                                          value={sel.unidades || ""}
                                          onChange={e => {
                                            let v = Math.max(0, Number(e.target.value))
                                            const maxU =
                                              prod.cantidadUnidadesBlister &&
                                              prod.cantidadUnidadesBlister > 1
                                                ? prod.cantidadUnidadesBlister - 1
                                                : prod.cantidadGeneral -
                                                  sel.blisters *
                                                    (prod.cantidadUnidadesBlister || 0)
                                            if (v > maxU) v = maxU
                                            setBlisterUnidadSeleccion(prev => ({
                                              ...prev,
                                              [selectionKey]: {
                                                blisters:
                                                  prev[selectionKey]?.blisters ?? 0,
                                                unidades: v
                                              }
                                            }))
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px]">Unidades</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={prod.cantidadGeneral}
                                        className="w-16 h-7 text-[11px]"
                                        value={sel.unidades || ""}
                                        onChange={e => {
                                          const v = Math.max(0, Number(e.target.value))
                                          setBlisterUnidadSeleccion(prev => ({
                                            ...prev,
                                            [selectionKey]: {
                                              blisters: 0,
                                              unidades: v
                                            }
                                          }))
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="align-top text-right">
                                <Button
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => agregarAlCarrito(prod, selectionKey)}
                                  disabled={prod.cantidadGeneral === 0}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Agregar
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </GlassPanel>

          <GlassPanel>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Carrito de Venta
              </CardTitle>
              <CardDescription>Productos seleccionados</CardDescription>
            </CardHeader>
            <CardContent>
              {carrito.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No hay productos en el carrito
                </div>
              ) : (
                <div className="rounded-xl border bg-background/60 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead>Producto</TableHead>
                        <TableHead>Blisters</TableHead>
                        <TableHead>Unidades</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carrito.map((item, idx) => (
                        <TableRow key={item.codigoBarras || `car-${idx}`} className="text-[12px]">
                          <TableCell>
                            <div className="font-medium flex items-center gap-2">
                              {item.nombre}
                              {(item.descuento ?? 0) > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-yellow-100 text-yellow-800 border-yellow-300 px-1 py-0 text-[9px]"
                                >
                                  Desc
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {item.codigoBarras || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <QtyAdjust
                              value={item.cantidadBlister}
                              onDec={() => cambiarCantidadCarrito(item.codigoBarras, "blister", -1)}
                              onInc={() => cambiarCantidadCarrito(item.codigoBarras, "blister", 1)}
                              disabledDec={item.cantidadBlister === 0}
                              suffix={
                                item.cantidadUnidadesBlister
                                  ? `${item.cantidadUnidadesBlister}u/blister`
                                  : undefined
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <QtyAdjust
                              value={item.cantidadUnidad}
                              onDec={() => cambiarCantidadCarrito(item.codigoBarras, "unidad", -1)}
                              onInc={() => cambiarCantidadCarrito(item.codigoBarras, "unidad", 1)}
                              disabledDec={item.cantidadUnidad === 0}
                            />
                          </TableCell>
                          <TableCell className="font-semibold tabular-nums">
                            S/ {item.subtotal.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => eliminarDelCarrito(item.codigoBarras)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-medium">
                          Total
                        </TableCell>
                        <TableCell className="font-bold tabular-nums">
                          S/ {total.toFixed(2)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </GlassPanel>
        </div>

        <div className="space-y-8">
          <GlassPanel>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User2 className="h-5 w-5 text-primary" />
                Datos del Cliente
              </CardTitle>
              <CardDescription>DNI opcional</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="dni-cliente">DNI</Label>
                  <Input
                    id="dni-cliente"
                    value={dniCliente}
                    onChange={e => setDniCliente(e.target.value.replace(/[^0-9]/g, ""))}
                    maxLength={8}
                    placeholder="Opcional"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <Label htmlFor="vendedor">Vendedor</Label>
                  <Input
                    id="vendedor"
                    value={usuarioSesion?.nombreCompleto || ""}
                    readOnly
                    disabled
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="nombre-cliente">
                    Nombre Cliente <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="nombre-cliente"
                    value={nombreCliente}
                    onChange={e => setNombreCliente(e.target.value)}
                    placeholder="Nombre completo"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </GlassPanel>

          <GlassPanel>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5 text-primary" />
                Método de Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <RadioGroup
                value={metodoPago}
                onValueChange={v => {
                  setMetodoPago(v as MetodoPago)
                  setMontoEfectivo("")
                  setMontoYape("")
                }}
                className="grid gap-2 text-sm"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="efectivo" id="p-efectivo" />
                  <Label htmlFor="p-efectivo">Efectivo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yape" id="p-yape" />
                  <Label htmlFor="p-yape">Yape</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mixto" id="p-mixto" />
                  <Label htmlFor="p-mixto">Mixto</Label>
                </div>
              </RadioGroup>

              {metodoPago === "efectivo" && (
                <div className="space-y-2">
                  <Label htmlFor="monto-efectivo">Monto efectivo</Label>
                  <Input
                    id="monto-efectivo"
                    type="number"
                    step="0.01"
                    value={montoEfectivo}
                    onChange={e => setMontoEfectivo(e.target.value)}
                    placeholder="0.00"
                  />
                  {faltante > 0 && (
                    <div className="text-xs text-red-600">
                      Faltan S/ {faltante.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
              {metodoPago === "yape" && (
                <div className="space-y-2">
                  <Label htmlFor="monto-yape">Monto Yape</Label>
                  <Input
                    id="monto-yape"
                    type="number"
                    step="0.01"
                    value={montoYape}
                    onChange={e => setMontoYape(e.target.value)}
                    placeholder="0.00"
                  />
                  {faltante > 0 && (
                    <div className="text-xs text-red-600">
                      Faltan S/ {faltante.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
              {metodoPago === "mixto" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="monto-efectivo-mixto">Efectivo</Label>
                    <Input
                      id="monto-efectivo-mixto"
                      type="number"
                      step="0.01"
                      value={montoEfectivo}
                      onChange={e => setMontoEfectivo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monto-yape-mixto">Yape</Label>
                    <Input
                      id="monto-yape-mixto"
                      type="number"
                      step="0.01"
                      value={montoYape}
                      onChange={e => setMontoYape(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  {faltante > 0 && (
                    <div className="md:col-span-2 text-xs text-red-600">
                      Faltan S/ {faltante.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </GlassPanel>

          <GlassPanel>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeDollarSign className="h-5 w-5 text-primary" />
                Resumen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-medium">
                    S/ {total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-1 border-t">
                  <span>Total</span>
                  <span className="tabular-nums">S/ {total.toFixed(2)}</span>
                </div>
                {vuelto > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Vuelto</span>
                    <span className="tabular-nums">S/ {vuelto.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <Separator />
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={procesarVenta}
                disabled={procesarVentaDisabled}
              >
                {cargandoCaja && <Loader2 className="h-4 w-4 animate-spin" />}
                {!cargandoCaja && (
                  <ClipboardCheck className="h-4 w-4" />
                )}
                {cargandoCaja
                  ? "Verificando caja..."
                  : cajaAbierta
                  ? "Procesar Venta"
                  : "Abrir caja para vender"}
              </Button>
            </CardContent>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------- */
/*                 Subcomponentes UI                   */
/* -------------------------------------------------- */
function QtyAdjust({
  value,
  onDec,
  onInc,
  disabledDec,
  suffix
}: {
  value: number
  onDec: () => void
  onInc: () => void
  disabledDec?: boolean
  suffix?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={onDec}
          disabled={disabledDec}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-6 text-center text-sm tabular-nums">{value}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={onInc}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {suffix && (
        <span className="text-[10px] text-muted-foreground self-end">
          {suffix}
        </span>
      )}
    </div>
  )
}

function GlassPanel({ children }: { children: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-background/60 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(circle_at_90%_80%,hsl(var(--secondary)/0.18),transparent_60%)] opacity-40" />
      <div className="relative z-10">{children}</div>
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-border/40 [mask-image:linear-gradient(to_bottom,rgba(255,255,255,0.6),transparent)]" />
    </Card>
  )
}

function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,hsl(var(--primary)/0.16),transparent_60%),radial-gradient(circle_at_85%_75%,hsl(var(--secondary)/0.16),transparent_60%)]" />
      <div className="absolute -top-48 -right-40 h-[560px] w-[560px] rounded-full bg-primary/15 blur-3xl opacity-40 animate-pulse" />
      <div className="absolute -bottom-48 -left-40 h-[560px] w-[560px] rounded-full bg-secondary/25 blur-3xl opacity-30 animate-pulse" />
    </div>
  )
}