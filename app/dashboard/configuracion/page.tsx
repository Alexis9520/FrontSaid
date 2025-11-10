"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import { useTheme } from "next-themes"
import {
  Wrench, Check, Moon, Printer, Save, Settings, Sun,
  RefreshCw, Sparkles, Laptop2, HardDriveDownload,
  Eye, Palette, ShieldCheck, RotateCcw
} from "lucide-react"

import "@/styles/futuristic-config.css"

import { RoleGuard } from "@/components/RoleGuard"
import { useToast } from "@/lib/use-toast"
import { buildTicketHTML, VentaPreview } from "@/lib/print-utils"
import { getBoletas } from "@/lib/api"

import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { useLocalStorageState } from "@/hooks/use-local-storage-state"
import { useDebouncedCallback } from "@/hooks/use-debounced-callback"

/* ------------------ Tipos ------------------ */
type ConfGeneral = {
  nombreNegocio: string
  direccion: string
  telefono: string
  email?: string
  ruc?: string
  moneda: string
}
type ConfBoleta = {
  serieBoleta: string
  mensajePie: string
  mostrarLogo: boolean
  imprimirAutomatico: boolean
  formatoImpresion: "80mm" | "58mm" | "a4"
}
type ConfNotificaciones = {
  stockBajo: boolean
  proximosVencer: boolean
  ventasAltas: boolean
  cierreCaja: boolean
  nuevosUsuarios: boolean
}

/* ------------------ Constantes ------------------ */
const ENABLE_AUTOSAVE = true
const AUTOSAVE_DELAY = 900

/* ------------------ Utils ------------------ */
function safeTime(s: any) {
  const t = new Date(s as string).getTime()
  return isNaN(t) ? 0 : t
}

/* ------------------ Variants (con easing válido) ------------------ */
const fadeIn: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }
  }
}
const subtleCard: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const }
  }
}

/* ------------------ Página ------------------ */
export default function ConfiguracionPage() {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const [configuracionGeneral, setConfiguracionGeneral] = useLocalStorageState<ConfGeneral>("configuracionGeneral", {
    nombreNegocio: "Botica Nueva Esperanza",
    direccion: "Av. La Esperanza 403 - El Tambo",
    telefono: "+51 961 668 320",
    email: "contacto@nuevaesperanza.net.pe",
    ruc: "1234567890",
    moneda: "S/",
  })

  const [configuracionBoleta, setConfiguracionBoleta] = useLocalStorageState<ConfBoleta>("configuracionBoleta", {
    serieBoleta: "B",
    mensajePie: "¡Gracias por su compra!",
    mostrarLogo: true,
    imprimirAutomatico: true,
    formatoImpresion: "80mm",
  })

  const [configuracionNotificaciones, setConfiguracionNotificaciones] = useState<ConfNotificaciones>({
    stockBajo: true,
    proximosVencer: true,
    ventasAltas: true,
    cierreCaja: true,
    nuevosUsuarios: true,
  })

  const [ultimaVenta, setUltimaVenta] = useState<VentaPreview | null>(null)
  const ventanaAbiertaRef = useRef<Window | null>(null)

  const [changedGeneral, setChangedGeneral] = useState(false)
  const [changedBoleta, setChangedBoleta] = useState(false)
  const [autoSavedGeneralAt, setAutoSavedGeneralAt] = useState<number | null>(null)
  const [autoSavedBoletaAt, setAutoSavedBoletaAt] = useState<number | null>(null)

  const moneda = configuracionGeneral.moneda

  /* -------- Carga última venta -------- */
  useEffect(() => {
    const load = async () => {
      try {
        const ls = localStorage.getItem("ultimaVentaPreview")
        if (ls) {
          setUltimaVenta(JSON.parse(ls))
          return
        }
      } catch {}
      try {
        const data = await getBoletas({ page: 1, limit: 10 })
        const itemsRaw = data?.items
        const lista: any[] = Array.isArray(itemsRaw) ? itemsRaw : []
        const adapt = (b: any): VentaPreview => {
          const numero = b.numero ?? b.boleta ?? "B-000000"
          const fechaR = b.fecha ?? b.fecha_venta ?? new Date().toISOString()
          const cliente = b.cliente ?? b.nombre_cliente ?? "Público general"
          const dni = b.dni ?? b.dni_cliente ?? ""
          const vendedor = b.usuario ?? b.usuario_nombre ?? ""
          const productos = (b.productos ?? b.detalles ?? []) as any[]
          const items = productos.map((p: any) => {
            const qty = Number(p.cantidad ?? 0)
            const precio = Number(p.precio ?? p.precio_unitario ?? 0)
            return {
              nombre: p.nombre ?? p.producto ?? "Producto",
              cantidad: qty,
              precio,
              subtotal: qty * precio
            }
          })
          const total =
            Number(b.totalCompra ?? b.total_compra ?? b.total) ||
            items.reduce((acc, it) => acc + it.subtotal, 0)
          const metodoNombre = b.metodoPago ?? b.metodo_pago ?? "Efectivo"
          const efectivo = Number(b.efectivo ?? 0)
          const digital = Number(b.digital ?? 0)
          const pagado = efectivo + digital
          const vuelto = pagado > total ? pagado - total : 0
          return {
            numero,
            fecha: new Date(fechaR).toLocaleString(),
            cliente,
            dni,
            vendedor,
            items,
            total,
            metodo: {
              nombre: String(metodoNombre),
              efectivo: efectivo || undefined,
              digital: digital || undefined,
              vuelto: vuelto || undefined
            }
          }
        }
        const adaptadas: VentaPreview[] = lista.map(adapt).sort(
          (a: VentaPreview, b: VentaPreview) => safeTime(b.fecha) - safeTime(a.fecha)
        )
        if (adaptadas[0]) {
          setUltimaVenta(adaptadas[0])
          try { localStorage.setItem("ultimaVentaPreview", JSON.stringify(adaptadas[0])) } catch {}
        }
      } catch {}
    }
    load()
  }, [])

  /* -------- Mock si no hay venta -------- */
  const mockVenta: VentaPreview = useMemo(() => ({
    numero: `${configuracionBoleta.serieBoleta}-000123`,
    fecha: new Date().toLocaleString(),
    cliente: "Público general",
    dni: "",
    vendedor: "",
    items: [
      { nombre: "Paracetamol 500mg", cantidad: 1, precio: 2.5, subtotal: 2.5 },
      { nombre: "Ibuprofeno 400mg", cantidad: 2, precio: 3, subtotal: 6 },
    ],
    total: 8.5,
    metodo: { nombre: "Efectivo", efectivo: 10, digital: 0, vuelto: 1.5 },
  }), [configuracionBoleta.serieBoleta])

  const ventaParaPreview = ultimaVenta ?? mockVenta

  /* -------- Ticket HTML para print window -------- */
  const construirHTMLTicket = useCallback(() => {
    return buildTicketHTML(
      ventaParaPreview,
      {
        nombreNegocio: configuracionGeneral.nombreNegocio,
        direccion: configuracionGeneral.direccion,
        telefono: configuracionGeneral.telefono,
        email: configuracionGeneral.email || "",
        ruc: configuracionGeneral.ruc || "",
        moneda
      },
      {
        mensajePie: configuracionBoleta.mensajePie,
        mostrarLogo: configuracionBoleta.mostrarLogo,
        formatoImpresion: configuracionBoleta.formatoImpresion
      }
    )
  }, [ventaParaPreview, configuracionGeneral, configuracionBoleta, moneda])

  const guardarJob = (auto = false) => {
    try {
      localStorage.setItem("ticket_preview_job", JSON.stringify({
        html: construirHTMLTicket(),
        formato: configuracionBoleta.formatoImpresion,
        auto
      }))
    } catch {}
  }

  const vistaPreviaTicket = () => {
    guardarJob(false)
    const win = window.open("/print", "ticketPreview", "width=800,height=900")
    if (!win) {
      toast({ title: "Pop‑up bloqueado", description: "Permite ventanas emergentes para la vista previa.", variant: "destructive" })
      return
    }
    ventanaAbiertaRef.current = win
  }
  const reenviarJob = () => {
    if (!ventanaAbiertaRef.current || ventanaAbiertaRef.current.closed) {
      toast({ title: "Ventana no abierta", description: "Abre primero la vista previa.", variant: "destructive" })
      return
    }
    guardarJob(false)
    try { ventanaAbiertaRef.current.focus() } catch {}
    toast({ title: "Vista previa actualizada", description: "Ticket reenviado." })
  }

  /* -------- Guardados manuales / autosave -------- */
  const guardarConfiguracionGeneral = () => {
    setChangedGeneral(false)
    setAutoSavedGeneralAt(Date.now())
    toast({ title: "General guardado", description: "Configuración actualizada." })
  }
  const guardarConfiguracionBoleta = () => {
    setChangedBoleta(false)
    setAutoSavedBoletaAt(Date.now())
    toast({ title: "Boletas guardado", description: "Configuración aplicada." })
  }
  const guardarConfiguracionNotificaciones = () => {
    toast({ title: "Notificaciones", description: "Sección en desarrollo." })
  }

  const resetearConfiguracion = () => {
    setConfiguracionGeneral({
      nombreNegocio: "Botica Nueva Esperanza",
      direccion: "Av. La Esperanza 403 - El Tambo",
      telefono: "+51 961 668 320",
      email: "contacto@nuevaesperanza.net.pe",
      ruc: "1234567890",
      moneda: "S/",
    })
    setConfiguracionBoleta({
      serieBoleta: "B",
      mensajePie: "¡Gracias por su compra!",
      mostrarLogo: true,
      imprimirAutomatico: true,
      formatoImpresion: "80mm",
    })
    setChangedGeneral(false)
    setChangedBoleta(false)
    toast({ title: "Restablecido", description: "Valores predeterminados." })
  }

  const debouncedGeneral = useDebouncedCallback(() => {
    if (ENABLE_AUTOSAVE && changedGeneral) guardarConfiguracionGeneral()
  }, AUTOSAVE_DELAY, [configuracionGeneral, changedGeneral])

  const debouncedBoleta = useDebouncedCallback(() => {
    if (ENABLE_AUTOSAVE && changedBoleta) guardarConfiguracionBoleta()
  }, AUTOSAVE_DELAY, [configuracionBoleta, changedBoleta])

  useEffect(() => { if (changedGeneral) debouncedGeneral() }, [configuracionGeneral, changedGeneral, debouncedGeneral])
  useEffect(() => { if (changedBoleta) debouncedBoleta() }, [configuracionBoleta, changedBoleta, debouncedBoleta])

  const updateGeneral = (patch: Partial<ConfGeneral>) => {
    setConfiguracionGeneral(prev => ({ ...prev, ...patch }))
    setChangedGeneral(true)
  }
  const updateBoleta = (patch: Partial<ConfBoleta>) => {
    setConfiguracionBoleta(prev => ({ ...prev, ...patch }))
    setChangedBoleta(true)
  }

  return (
    <RoleGuard allowedRoles={["administrador"]}>
      <TooltipProvider delayDuration={120}>
        <div className="relative">
          {/* Fondo adaptado a tema */}
            <div className="pointer-events-none absolute inset-0 -z-10">
              {/* Light mode layers */}
              <div className="absolute inset-0 opacity-100 dark:opacity-0 transition">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(6,182,212,0.20),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_70%,rgba(16,185,129,0.18),transparent_65%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(0,0,0,0.04),transparent_40%,rgba(0,0,0,0.03)_70%,transparent)] mix-blend-overlay" />
              </div>
              {/* Dark mode layers */}
              <div className="absolute inset-0 opacity-0 dark:opacity-100 transition">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.08),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.07),transparent_65%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.05),transparent_40%,rgba(255,255,255,0.04)_70%,transparent)] mix-blend-overlay" />
              </div>
            </div>

          {/* Header */}
          <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-6 flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 via-cyan-500 to-sky-500 bg-clip-text text-transparent dark:from-emerald-300 dark:via-cyan-300 dark:to-sky-300">
                  Configuración
                </h1>
                <p className="text-sm text-muted-foreground">
                  Personaliza el sistema a tu flujo operativo
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={resetearConfiguracion}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restablecer
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restaurar valores por defecto</TooltipContent>
                </Tooltip>
              </div>
            </div>

            
          </motion.div>

          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="w-full flex flex-wrap">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="boletas">Boletas</TabsTrigger>
              <TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>
              <TabsTrigger value="apariencia">Apariencia / Tema</TabsTrigger>
              <TabsTrigger value="preview">Preview Ticket</TabsTrigger>
            </TabsList>

            {/* GENERAL */}
            <TabsContent value="general">
              <motion.div variants={subtleCard} initial="hidden" animate="visible">
                <Card className="futuristic-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                      Configuración General
                    </CardTitle>
                    <CardDescription>Información base del negocio</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <Field value={configuracionGeneral.nombreNegocio} label="Nombre del negocio" onChange={(v) => updateGeneral({ nombreNegocio: v })} />
                      <Field value={configuracionGeneral.direccion} label="Dirección" onChange={(v) => updateGeneral({ direccion: v })} />
                      <Field value={configuracionGeneral.telefono} label="Teléfono" onChange={(v) => updateGeneral({ telefono: v })} />
                      <Field value={configuracionGeneral.email || ""} label="Email" type="email" onChange={(v) => updateGeneral({ email: v })} />
                      <Field value={configuracionGeneral.ruc || ""} label="RUC" onChange={(v) => updateGeneral({ ruc: v })} />
                      
                    </div>

                    <Separator className="fc-separator" />

                    <div className="flex flex-wrap justify-end gap-2">
                      {!ENABLE_AUTOSAVE && (
                        <Button variant="outline" onClick={guardarConfiguracionGeneral} disabled={!changedGeneral}>
                          <Save className="mr-2 h-4 w-4" />
                          Guardar cambios
                        </Button>
                      )}
                      <Button variant="ghost" onClick={guardarConfiguracionGeneral}>
                        Sincronizar
                      </Button>
                    </div>

                    <AnimatePresence>
                      {autoSavedGeneralAt && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 0.75, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-xs text-emerald-600 dark:text-emerald-300/70"
                          aria-live="polite"
                        >
                          Guardado {new Date(autoSavedGeneralAt).toLocaleTimeString()}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* BOLETAS */}
            <TabsContent value="boletas">
              <motion.div variants={subtleCard} initial="hidden" animate="visible" className="space-y-6">
                <Card className="futuristic-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Printer className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                      Configuración de Boletas
                    </CardTitle>
                    <CardDescription>Formato y contenido del comprobante</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <Field value={configuracionBoleta.serieBoleta} label="Serie" onChange={(v) => updateBoleta({ serieBoleta: v })} />
                      <div className="space-y-2">
                        <Label>Formato de impresión</Label>
                        <Select
                          value={configuracionBoleta.formatoImpresion}
                          onValueChange={(value) => updateBoleta({ formatoImpresion: value as "80mm" | "58mm" | "a4" })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Formato" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="80mm">Ticket 80mm</SelectItem>
                            <SelectItem value="58mm">Ticket 58mm</SelectItem>
                            <SelectItem value="a4">Hoja A4</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Mensaje de pie</Label>
                      <Textarea
                        value={configuracionBoleta.mensajePie}
                        onChange={(e) => updateBoleta({ mensajePie: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Puedes incluir emojis o disclaimers breves.
                      </p>
                    </div>

                    <Accordion type="multiple" className="w-full">
                      <AccordionItem value="impresion">
                        <AccordionTrigger>Opciones de Impresión</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                          <ToggleSwitch
                            id="mostrar-logo"
                            label="Mostrar logo"
                            checked={configuracionBoleta.mostrarLogo}
                            onChange={(c) => updateBoleta({ mostrarLogo: c })}
                          />
                          <ToggleSwitch
                            id="imprimir-auto"
                            label="Imprimir automáticamente"
                            checked={configuracionBoleta.imprimirAutomatico}
                            onChange={(c) => updateBoleta({ imprimirAutomatico: c })}
                          />
                          <Alert variant="default" className="border-cyan-500/30 bg-cyan-500/10 dark:bg-cyan-500/5">
                            <Eye className="h-4 w-4" />
                            <AlertTitle>Tip</AlertTitle>
                            <AlertDescription>
                              Cambia el formato y usa “Actualizar vista” sin cerrar la ventana.
                            </AlertDescription>
                          </Alert>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <Separator className="fc-separator" />

                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="outline" onClick={vistaPreviaTicket}>
                        <Printer className="mr-2 h-4 w-4" />
                        Vista previa
                      </Button>
                      <Button variant="secondary" onClick={reenviarJob}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Actualizar vista
                      </Button>
                      {!ENABLE_AUTOSAVE && (
                        <Button onClick={guardarConfiguracionBoleta} disabled={!changedBoleta}>
                          <Save className="mr-2 h-4 w-4" />
                          Guardar
                        </Button>
                      )}
                    </div>

                    <AnimatePresence>
                      {autoSavedBoletaAt && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 0.75, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-xs text-cyan-600 dark:text-cyan-300/70"
                        >
                          Guardado {new Date(autoSavedBoletaAt).toLocaleTimeString()}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* NOTIFICACIONES */}
            <TabsContent value="notificaciones">
              <motion.div variants={subtleCard} initial="hidden" animate="visible">
                <Card className="futuristic-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                      Notificaciones
                    </CardTitle>
                    <CardDescription>Próximas capacidades inteligentes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Alert variant="destructive">
                      <Wrench className="h-5 w-5" />
                      <AlertTitle>En desarrollo</AlertTitle>
                      <AlertDescription>
                        Esta sección se ampliará con reglas dinámicas y alertas contextuales.
                      </AlertDescription>
                    </Alert>

                    <div className="flex flex-wrap gap-3">
                      {Object.entries(configuracionNotificaciones).map(([k, v]) => (
                        <div key={k} className="flex items-center space-x-2 rounded-md bg-black/5 dark:bg-white/5 px-3 py-2">
                          <Switch
                            checked={v}
                            onCheckedChange={(checked) =>
                              setConfiguracionNotificaciones(prev => ({ ...prev, [k]: checked }))
                            }
                            id={`notif-${k}`}
                          />
                          <Label htmlFor={`notif-${k}`} className="capitalize text-sm">
                            {k.replace(/([A-Z])/g, " $1")}
                          </Label>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={guardarConfiguracionNotificaciones}>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* APARIENCIA */}
            <TabsContent value="apariencia">
              <motion.div variants={subtleCard} initial="hidden" animate="visible">
                <Card className="futuristic-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                      Apariencia / Tema
                    </CardTitle>
                    <CardDescription>Control de modo y preferencias visuales</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Tema General</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ThemeCard
                          active={theme === "light"}
                          icon={<Sun className="h-6 w-6" />}
                          label="Claro"
                          onClick={() => setTheme("light")}
                        />
                        <ThemeCard
                          active={theme === "dark"}
                          icon={<Moon className="h-6 w-6" />}
                          label="Oscuro"
                          onClick={() => setTheme("dark")}
                        />
                        <ThemeCard
                          active={theme === "system"}
                          icon={<Laptop2 className="h-6 w-6" />}
                          label="Sistema"
                          onClick={() => setTheme("system")}
                        />
                      </div>
                    </div>
                    <Alert className="border-emerald-500/30 bg-emerald-500/15 dark:bg-emerald-500/10">
                      <Settings className="h-5 w-5" />
                      <AlertTitle>Próximamente</AlertTitle>
                      <AlertDescription>
                        Paletas personalizadas, densidad y animaciones avanzadas.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* PREVIEW TICKET */}
            <TabsContent value="preview">
              <motion.div variants={subtleCard} initial="hidden" animate="visible" className="space-y-6">
                <Card className="futuristic-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                      Vista previa
                    </CardTitle>
                    <CardDescription>Ticket con configuración actual</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={vistaPreviaTicket}>
                        <Printer className="mr-2 h-4 w-4" />
                        Abrir ventana
                      </Button>
                      <Button size="sm" variant="secondary" onClick={reenviarJob}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Actualizar ventana
                      </Button>
                    </div>
                    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/50 p-4 overflow-auto max-h-[420px] text-xs tracking-tight font-mono embedded-ticket-scroll">
                      <EmbeddedTicket
                        venta={ventaParaPreview}
                        confGen={configuracionGeneral}
                        confBol={configuracionBoleta}
                        moneda={moneda}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Para ver el formato de impresión real usa “Abrir ventana”.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </RoleGuard>
  )
}

/* ------------------ Sub-componentes ------------------ */
function Field({ value, label, onChange, type = "text" }: {
  value: string
  label: string
  type?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        className="focus-visible:ring-cyan-400/40"
      />
    </div>
  )
}

function ToggleSwitch({ id, label, checked, onChange }: {
  id: string
  label: string
  checked: boolean
  onChange: (c: boolean) => void
}) {
  return (
    <div className="flex items-center space-x-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer">{label}</Label>
    </div>
  )
}

function ThemeCard({ active, icon, label, onClick }:{
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={`relative h-28 flex flex-col gap-2 items-center justify-center group transition ${
        active
          ? "ring-2 ring-cyan-400 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_0_15px_-2px_rgba(56,189,248,0.45)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_15px_-2px_rgba(56,189,248,0.45)]"
          : ""
      }`}
    >
      <span className="text-cyan-600 dark:text-cyan-300 group-hover:scale-110 transition">{icon}</span>
      <span className="text-sm">{label}</span>
      {active && (
        <Check className="absolute top-2 right-2 h-4 w-4 text-emerald-500 dark:text-emerald-300" />
      )}
    </Button>
  )
}

function EmbeddedTicket({
  venta,
  confGen,
  confBol,
  moneda
}:{
  venta: VentaPreview
  confGen: ConfGeneral
  confBol: ConfBoleta
  moneda: string
}) {
  return (
    <div className="space-y-1 text-[11px]">
      <div className="text-center font-semibold text-cyan-600 dark:text-cyan-300">
        {confGen.nombreNegocio}
      </div>
      <div className="text-center">{confGen.direccion}</div>
      <div className="text-center">{confGen.telefono}</div>
      <div className="flex justify-between pt-1">
        <span className="text-emerald-600 dark:text-emerald-300">Serie</span>
        <span>{venta.numero}</span>
      </div>
      <div className="flex justify-between">
        <span>Fecha</span>
        <span>{venta.fecha}</span>
      </div>
      <Separator className="my-1 fc-separator" />
      {venta.items.map((it, i) => (
        <div key={i} className="flex justify-between gap-2">
          <span className="truncate">{it.nombre} x{it.cantidad}</span>
            <span>{moneda} {it.subtotal.toFixed(2)}</span>
        </div>
      ))}
      <Separator className="my-1 fc-separator" />
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{moneda} {venta.total.toFixed(2)}</span>
      </div>
      {confBol.mensajePie && (
        <div className="pt-1 text-center italic text-emerald-600/80 dark:text-emerald-300/70">
          {confBol.mensajePie}
        </div>
      )}
    </div>
  )
}