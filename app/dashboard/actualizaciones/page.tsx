"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import Spinner from "@/components/ui/Spinner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardContent } from "@/components/ui/card"

import {
  CalendarDays,
  ChevronDown,
  Link2,
  Layers,
  ArrowUp,
  Sparkles,
  Users,
  Filter,
  X,
  Brush,
  Cpu,
  Rocket,
  Search,
  Hourglass,
  Star,
  GitCommitVertical
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatePresence } from "framer-motion"

/* ================= Tipos ================= */
type ChangeType =
  | "added"
  | "changed"
  | "fixed"
  | "removed"
  | "security"
  | "internal"
  | "perf"
  | "ux"

interface ChangeEntry {
  type: ChangeType
  title: string
  description?: string
  issueRef?: string | number
  breaking?: boolean
  scope?: string
  highlight?: boolean
}

interface VersionLog {
  version: string
  date: string
  tag?: string
  entries: ChangeEntry[]
  summary?: string
  contributors?: string[]
  impactScore?: number
}

/* ============================================================
   CHANGELOG
   Añadida versión 1.6.0 (Roles + Ventas/Boletas + Backend JPA)
   ============================================================ */
const CHANGELOG: VersionLog[] = [
  {
    version: "1.6.0",
    date: "2025-11-02",
    tag: "stable",
    summary:
      "Primera implementación de la pagina de reportes, protección por roles en front, estandarización del endpoint de Boletas a paginación 0‑based (PageResponse) con carga diferida de detalles, y actualización de Specifications en backend. Además, se alinea la paginación en Ventas, se arreglan detalles vacíos y se añade paginación server‑side en Stock.",
    impactScore: 90,
    contributors: ["core-ui", "backend-api", "security-team"],
    entries: [
      {
        type: "security",
        title: "Guardas de rol en Dashboard (solo ADMIN) sin alterar el diseño",
        description:
          "Trabajador ya no monta la página ni dispara /api/dashboard/**; se redirige a Ventas. El backend mantiene la restricción y se evita cualquier 403 visible.",
        scope: "Auth/Roles",
        highlight: true
      },
      {
        type: "added",
        title: "Reportes: página implementada con export y gráficos",
        description:
          "La nueva página de Reportes ya está implementada: muestra datos mediante gráficos interactivos y permite exportar informes (ventas por día, por producto y inventario) en formatos descargables.",
        scope: "Reportes",
        highlight: true
      },
      {
        type: "changed",
        title: "Boletas: API estandarizada a PageResponse",
        description:
          "GET /api/boletas usa page (0‑based) y size; respuesta con content, totalElements, page, size, totalPages. Front adaptado con helpers getBoletasPage.",
        scope: "Ventas/Boletas",
        highlight: true
      },
      {
        type: "added",
        title: "Carga diferida de detalles de boleta",
        description:
          "Al expandir una boleta se consulta GET /api/boletas/{id} con fetch‑join; se mapean correctamente codBarras, cantidad y precioUnitario.",
        scope: "Ventas/Boletas",
        highlight: true
      },
      {
        type: "fixed",
        title: "Paginación inconsistente (17 resultados)",
        description:
          "Se corrige el desfase page/limit vs size que mostraba 17 elementos; ahora muestra exactamente size por página.",
        scope: "Ventas/Boletas"
      },
      {
        type: "fixed",
        title: "Detalles vacíos en boletas",
        description:
          "Los productos vendidos se muestran tras lazy‑load; se normaliza el parseo de fecha 'yyyy‑MM‑dd HH:mm:ss' y nombres de campos.",
        scope: "Ventas/Boletas",
        highlight: true
      },
      {
        type: "changed",
        title: "Specifications modernas en Spring Data JPA",
        description:
          "Reemplazo de Specification.where(...) (deprecado) por Specification.allOf(...) en filtros del listado.",
        scope: "Backend/JPA"
      },
      {
        type: "perf",
        title: "Listado de boletas sin N+1",
        description:
          "Precarga relaciones to‑one mediante @EntityGraph en el listado; la colección de detalles no se carga hasta el expand.",
        scope: "Backend/Boleta"
      },
      {
        type: "added",
        title: "Stock con paginación y filtros server‑side",
        description:
          "Front solicita page/size y filtros (q/lab/cat) a /api/stock; KPIs y tabs se basan en la página actual.",
        scope: "Stock"
      },
      {
        type: "internal",
        title: "fetchWithAuth sin silencios para admin‑only",
        description:
          "Se mantiene el manejo de 401/403 como antes; al no disparar endpoints admin desde trabajador, desaparecen los mensajes en ese rol.",
        scope: "Core/HTTP"
      },
      {
        type: "ux",
        title: "Ventas: orden estable y estados vacíos claros",
        description:
          "Normalización de fechas, orden consistente por fecha y mensajes de estado cuando no hay resultados/detalles.",
        scope: "UX/Ventas"
      },
      {
        type: "fixed",
        title: "Export y helpers de API",
        description:
          "Se restaura el export de getBoletas y se añaden getBoletasPage y getBoletaById con compatibilidad de contrato.",
        scope: "Build/Imports"
      }
    ]
  },
  {
    version: "1.5.0",
    date: "2025-08-22",
    tag: "stable",
    summary:
      "Fase de rediseño completada (100%). Se refuerza la seguridad del login, se amplían opciones de configuración, mejora radical de responsividad móvil y se corrigen fallos críticos en tablas y carrito de ventas.",
    impactScore: 93,
    contributors: ["core-ui", "design-lab", "security-team"],
    entries: [
      {
        type: "ux",
        title: "Rediseño visual fase final",
        description:
          "Aplicación del nuevo sistema de diseño (glass, gradientes dinámicos, tipografía fluida y animaciones) al 100% de las vistas restantes (Reportes, Configuración avanzada, Perfil, Autenticación).",
        scope: "UI/Global",
        highlight: true
      },
      {
        type: "fixed",
        title: "Correcciones masivas en tablas",
        description:
          "Se solucionaron errores de ordenamiento inestable, scroll desalineado, tooltips truncados y saltos de layout al paginar.",
        scope: "Tablas",
        highlight: true
      },
      {
        type: "security",
        title: "Endurecimiento de autenticación",
        description:
          "Validación adicional de horario + bloqueo progresivo tras intentos fallidos, limpieza de sesiones huérfanas y verificación consistente de zona horaria.",
        scope: "Auth/Login",
        highlight: true
      },
      {
        type: "added",
        title: "Funciones ampliadas en Configuración",
        description:
          "Nuevas secciones: parámetros de impresión avanzados, gestión de variables de negocio, control granular de permisos y vista previa en vivo.",
        scope: "Configuración"
      },
      {
        type: "ux",
        title: "Mejor responsividad móvil",
        description:
          "Refactor de rejillas y componentes adaptativos (carritos, tablas compactas, formularios de venta y panel de caja). Reducción de overflow horizontal.",
        scope: "Responsive/Mobile",
        highlight: true
      },
      {
        type: "fixed",
        title: "Carrito de ventas: ajuste de cantidades",
        description:
          "Ahora es posible incrementar o disminuir correctamente blisters y unidades aunque el producto ya no esté en los resultados de búsqueda (se cachea stock en el ítem).",
        scope: "Ventas/Carrito",
        highlight: true
      },
      {
        type: "changed",
        title: "Medición de impacto refinada",
        description:
          "Algoritmo de score pondera ahora superficies afectadas, criticidad (seguridad) y cambios UX para priorizar QA.",
        scope: "Changelog"
      },
      {
        type: "perf",
        title: "Optimización de carga diferida",
        description:
          "División de bundles en rutas de autenticación y configuración; reducción de primeras pinturas en ~18%.",
        scope: "Performance"
      },
      {
        type: "internal",
        title: "Refactor de hooks de sesión",
        description:
          "Unificación de lógica de expiración, limpieza y sincronización de storage para reducir estados inconsistentes.",
        scope: "Core/Auth"
      },
      {
        type: "fixed",
        title: "Errores residuales de impresión",
        description:
          "La vista previa ya no pierde estilos al abrir múltiples tickets simultáneamente.",
        scope: "Impresión"
      }
    ]
  },
  {
    version: "1.4.3",
    date: "2025-08-14",
    tag: "stable",
    summary:
      "Primera fase del rediseño aplicado a las vistas principales (Dashboard, Caja, Ventas, Productos, Changelog).",
    impactScore: 82,
    contributors: ["core-ui", "design-lab"],
    entries: [
      {
        type: "ux",
        title: "Rediseño visual fase 1",
        description:
          "Aplicación de estilo glass + gradientes dinámicos y animaciones sutiles en ~50% de las pantallas.",
        highlight: true,
        scope: "UI"
      },
      {
        type: "changed",
        title: "Nueva jerarquía tipográfica",
        description: "Escalas fluidas en títulos para mejorar legibilidad.",
        scope: "UI/Typography"
      },
      {
        type: "perf",
        title: "Reducción de layout shift",
        description:
          "Placeholder shimmer en componentes con datos asíncronos para estabilizar la carga.",
        scope: "Performance"
      },
      {
        type: "added",
        title: "Indicador de impacto en versiones",
        description: "Métrica porcentual que resume el alcance de la release.",
        scope: "Changelog"
      },
      {
        type: "added",
        title: "Badges de alcance (scope)",
        description:
          "Se muestra el módulo o área afectada por cada cambio.",
        scope: "Changelog/UX"
      },
      {
        type: "changed",
        title: "Filtro avanzado en historial",
        description:
          "Búsqueda con resaltado, atajo ( / ) y persistencia temporal.",
        scope: "Changelog"
      },
      {
        type: "internal",
        title: "Refactor de componentes de Tag",
        description:
          "Unificación de estilos en un sistema de variantes semánticas.",
        scope: "Codebase"
      }
    ]
  },
  {
    version: "1.4.2",
    date: "2025-08-13",
    tag: "stable",
    entries: [
      {
        type: "changed",
        title: "Orden de tablas de cajas",
        description:
          "Listados ahora se ordenan por fecha de apertura descendente y soportan ordenamiento secundario estable.",
        scope: "Caja"
      },
      {
        type: "added",
        title: "Más características visibles en detalle de venta",
        description:
          "Se muestran columnas y etiquetas adicionales (método de pago combinado, totales segmentados, usuario de registro).",
        scope: "Ventas"
      },
      {
        type: "fixed",
        title: "Consistencia de totales tras filtrar por usuario",
        description:
          "Los subtotales ya no se recalculan con desajustes al alternar usuarios rápidamente.",
        scope: "Ventas"
      },
      {
        type: "internal",
        title: "Refactor de consultas de historial de caja",
        description:
          "Se consolidó la lógica para reducir consultas N+1 y preparar soporte de paginación.",
        scope: "Caja/DB"
      }
    ]
  },
  {
    version: "1.4.1",
    date: "2025-08-11",
    tag: "stable",
    entries: [
      {
        type: "fixed",
        title: "Corrección de zona horaria",
        description:
          "Validaciones y controles ahora usan America/Lima y no la hora del servidor.",
        scope: "Auth"
      },
      {
        type: "fixed",
        title: "Acceso post-horario",
        description:
          "Los trabajadores no quedan bloqueados injustamente por desfase horario del servidor.",
        scope: "Auth"
      }
    ]
  },
  {
    version: "1.4.0",
    date: "2025-08-10",
    entries: [
      {
        type: "added",
        title: "Principio activo en productos",
        description:
          "Campo para registrar el componente farmacológico principal.",
        scope: "Productos"
      },
      {
        type: "added",
        title: "Tipo de medicamento (genérico / marca)",
        description:
          "Clasificación que permite mejores filtros y reportes.",
        scope: "Productos"
      },
      {
        type: "added",
        title: "Código de lote",
        description:
          "Soporte de lote por producto para trazabilidad y control de vencimientos.",
        scope: "Inventario"
      },
      {
        type: "fixed",
        title: "Actualización de productos",
        description:
          "Errores al editar se corrigieron (validaciones y persistencia).",
        scope: "Productos"
      }
    ]
  },
  {
    version: "1.3.9",
    date: "2025-08-08",
    tag: "security",
    entries: [
      {
        type: "security",
        title: "Cambio de contraseña (solo administradores)",
        description:
          "Funcionalidad para que administradores gestionen credenciales de usuarios.",
        scope: "Seguridad"
      },
      {
        type: "security",
        title: "Restricción de acceso fuera del horario",
        description:
          "Trabajadores no pueden iniciar sesión después de su hora de salida.",
        scope: "Auth"
      },
      {
        type: "security",
        title: "Ingreso exclusivo para cierre de caja",
        description:
          "Si no cerraron caja a tiempo, solo se les permite entrar para cerrarla.",
        scope: "Caja"
      }
    ]
  },
  {
    version: "1.3.8",
    date: "2025-08-06",
    entries: [
      {
        type: "added",
        title: "Más estadísticas en el Dashboard",
        description:
          "Nuevas métricas para mayor visibilidad del rendimiento.",
        scope: "Dashboard"
      },
      {
        type: "fixed",
        title: "Movimientos de caja",
        description:
          "Corrección de inconsistencias en registro y visualización.",
        scope: "Caja"
      }
    ]
  },
  {
    version: "1.3.7",
    date: "2025-08-05",
    entries: [
      {
        type: "fixed",
        title: "Orden de boletas",
        description: "Listado organizado y consistente.",
        scope: "Ventas/Boletas"
      },
      {
        type: "added",
        title: "Personalización de boleta",
        description: "Formato y aspectos visuales configurables.",
        scope: "Ventas/Boletas"
      }
    ]
  },
  {
    version: "1.3.6",
    date: "2025-08-04",
    entries: [
      {
        type: "fixed",
        title: "Visual del Dashboard",
        description:
          "Corrección de desalineaciones y componentes que no cargaban.",
        scope: "Dashboard"
      }
    ]
  }
]

// Derivado
const LATEST_VERSION = CHANGELOG[0]?.version
function isRecent(dateStr: string) {
  const diffDays =
    (Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86400000
  return diffDays <= 7
}

/* ================= Utilidades UI ================= */
const TYPE_LABEL: Record<ChangeType, string> = {
  added: "Añadido",
  changed: "Cambiado",
  fixed: "Corregido",
  removed: "Eliminado",
  security: "Seguridad",
  internal: "Interno",
  perf: "Rendimiento",
  ux: "UX"
}

const TYPE_VARIANT: Record<ChangeType, string> = {
  added: "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30",
  changed: "bg-blue-500/15 text-blue-500 ring-1 ring-blue-500/30",
  fixed: "bg-green-500/15 text-green-500 ring-1 ring-green-500/30",
  removed: "bg-red-500/15 text-red-500 ring-1 ring-red-500/30",
  security: "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30",
  internal: "bg-muted/50 text-muted-foreground ring-1 ring-border/40",
  perf: "bg-purple-500/15 text-purple-500 ring-1 ring-purple-500/30",
  ux: "bg-pink-500/15 text-pink-500 ring-1 ring-pink-500/30"
}

const SCOPE_COLORS = [
  "from-cyan-500 to-cyan-400",
  "from-fuchsia-500 to-fuchsia-400",
  "from-sky-500 to-sky-400",
  "from-teal-500 to-teal-400",
  "from-indigo-500 to-indigo-400",
  "from-orange-500 to-orange-400",
  "from-rose-500 to-rose-400"
]
const scopeColorCache = new Map<string, string>()
function scopeGradient(scope?: string) {
  if (!scope) return "from-primary/40 to-primary/20"
  if (scopeColorCache.has(scope)) return scopeColorCache.get(scope)!
  const color = SCOPE_COLORS[scopeColorCache.size % SCOPE_COLORS.length]
  scopeColorCache.set(scope, color)
  return color
}

/* ================== Componentes Pequeños ================== */
function TypeBadge({ type }: { type: ChangeType }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide backdrop-blur",
        "inline-flex items-center gap-1",
        TYPE_VARIANT[type]
      )}
    >
      <GitCommitVertical className="h-3 w-3 opacity-70" />
      {TYPE_LABEL[type]}
    </span>
  )
}

function ScopeBadge({ scope }: { scope?: string }) {
  if (!scope) return null
  return (
    <span
      className={cn(
        "text-[10px] font-medium rounded-full px-2 py-0.5 bg-gradient-to-r text-white shadow",
        scopeGradient(scope)
      )}
    >
      {scope}
    </span>
  )
}

function ImpactBar({ score }: { score?: number }) {
  if (score == null) return null
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className="space-y-1 w-full max-w-xs">
      <div className="h-1.5 rounded-full bg-gradient-to-r from-zinc-700/40 to-zinc-600/30 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/40 transition-all duration-700 rounded-full"
          style={{ width: pct + "%" }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
        Impacto: <span className="text-foreground font-semibold">{pct}%</span>
      </div>
    </div>
  )
}

/* ================= Bloque de Versión ================= */
function VersionBlock({
  version,
  index,
  expandAll,
  highlightQuery
}: {
  version: VersionLog
  index: number
  expandAll: boolean
  highlightQuery: string
}) {
  const [open, setOpen] = useState(index < 2 || expandAll)
  useEffect(() => {
    setOpen(expandAll || index < 2)
  }, [expandAll, index])

  const anchorId = `v-${version.version.replace(/\./g, "-")}`
  const recent = isRecent(version.date)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const copyLink = (e: any) => {
    e.stopPropagation()
    const url = window.location.href.split("#")[0] + "#" + anchorId
    navigator.clipboard.writeText(url)
  }

  const markText = useCallback(
    (text: string) => {
      if (!highlightQuery.trim()) return text
      const parts = text.split(
        new RegExp(`(${escapeRegExp(highlightQuery)})`, "ig")
      )
      return parts.map((p, i) =>
        p.toLowerCase() === highlightQuery.toLowerCase() ? (
          <mark
            key={i}
            className="bg-primary/30 text-primary-foreground px-0.5 rounded-sm"
          >
            {p}
          </mark>
        ) : (
          p
        )
      )
    },
    [highlightQuery]
  )

  useEffect(() => {
    if (!highlightQuery || !open) return
    if (containerRef.current && index === 0) {
      const el = containerRef.current.querySelector("mark")
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightQuery, open, index])

  return (
    <Card
      id={anchorId}
      ref={containerRef}
      className={cn(
        "relative overflow-hidden border-border/60 backdrop-blur-xl",
        "bg-gradient-to-br from-background/80 via-background/60 to-background/40",
        index === 0 && "ring-1 ring-primary/40 shadow-lg"
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--primary)/0.15),transparent_60%),radial-gradient(circle_at_85%_80%,hsl(var(--secondary)/0.15),transparent_55%)]" />
      </div>

      <CardHeader
        className="cursor-pointer pb-4 relative z-10"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-lg tracking-tight flex items-center gap-2">
              <span className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
                v{version.version}
              </span>
              {index === 0 && (
                <Badge className="h-5 px-2 text-[10px] rounded-full animate-pulse">
                  Última
                </Badge>
              )}
            </h2>
            {version.tag && (
              <Badge
                variant="outline"
                className="uppercase text-[10px] tracking-wide border-primary/40"
              >
                {version.tag}
              </Badge>
            )}
            {recent && (
              <Badge
                variant="secondary"
                className="text-[10px] tracking-wide bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              >
                Nuevo
              </Badge>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {version.date}
            </div>
            {version.contributors && version.contributors.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {version.contributors.length} contrib.
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ImpactBar score={version.impactScore} />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1"
              onClick={e => {
                e.stopPropagation()
                copyLink(e)
              }}
            >
              <Link2 className="h-3.5 w-3.5" /> Link
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1"
              onClick={e => {
                e.stopPropagation()
                setOpen(o => !o)
              }}
            >
              {open ? "Ocultar" : "Ver"}
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  open ? "rotate-180" : ""
                )}
              />
            </Button>
          </div>
        </div>
        {version.summary && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground max-w-3xl">
            {markText(version.summary)}
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="pt-0 relative z-10">
          <div className="relative mt-2 pl-6">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />
            <ul className="space-y-6">
              {version.entries.map((e, i) => {
                const accent = e.highlight
                  ? "ring-primary/60 bg-primary/10"
                  : "ring-border/60 bg-background/50"
                return (
                  <li
                    key={i}
                    className={cn(
                      "relative pl-5 pr-2 py-3 rounded-lg ring-1 backdrop-blur-sm transition group",
                      "hover:ring-primary/50 hover:bg-primary/5",
                      accent
                    )}
                  >
                    <span className="absolute left-[-11px] top-5 h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-primary to-primary/40 shadow ring-4 ring-background group-hover:scale-125 transition-transform" />
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <TypeBadge type={e.type} />
                      <ScopeBadge scope={e.scope} />
                      {e.breaking && (
                        <span className="rounded-full bg-destructive/20 text-destructive px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-destructive/40">
                          Breaking
                        </span>
                      )}
                      {e.issueRef && (
                        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium">
                          Ref: {e.issueRef}
                        </span>
                      )}
                      {e.highlight && (
                        <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-500 text-[10px] px-2 py-0.5 rounded-full ring-1 ring-amber-500/30">
                          <Star className="h-3 w-3" /> Clave
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm leading-snug">
                      {e.title}
                    </h3>
                    {e.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {highlightText(e.description, highlightQuery)}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

/* ================= Página ================= */
export default function ActualizacionesPage() {
  const { user, loading } = useAuth()

  const [q, setQ] = useState("")
  const [types, setTypes] = useState<ChangeType[]>([])
  const [expandAll, setExpandAll] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [onlyHighlighted, setOnlyHighlighted] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem("changelog_filters")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setQ(parsed.q || "")
        setTypes(parsed.types || [])
        setOnlyHighlighted(!!parsed.onlyHighlighted)
      } catch {}
    }
  }, [])
  useEffect(() => {
    sessionStorage.setItem(
      "changelog_filters",
      JSON.stringify({ q, types, onlyHighlighted })
    )
  }, [q, types, onlyHighlighted])

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const searchRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === "Escape") {
        searchRef.current?.blur()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return CHANGELOG.map(v => {
      const entries = v.entries.filter(e => {
        const textBucket = (
          e.title +
          " " +
          (e.description || "") +
          " " +
          (e.scope || "")
        ).toLowerCase()
        const matchText = !query || textBucket.includes(query)
        const matchType = types.length === 0 || types.includes(e.type)
        const matchHighlight = !onlyHighlighted || e.highlight
        return matchText && matchType && matchHighlight
      })
      return { ...v, entries }
    }).filter(v => v.entries.length > 0)
  }, [q, types, onlyHighlighted])

  if (loading || !user) return <Spinner />

  const toggleType = (t: ChangeType) => {
    setTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }
  const resetFilters = () => {
    setQ("")
    setTypes([])
    setOnlyHighlighted(false)
  }

  const activeFilters = types.length > 0 || q.trim() || onlyHighlighted

  return (
    <div className="relative flex flex-col gap-10">
      <BackgroundFX />

      <header className="relative z-10 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 bg-gradient-to-r from-primary via-primary/60 to-primary/30 bg-clip-text text-transparent">
              <Sparkles className="h-7 w-7 text-primary/80" />
              Historial de Cambios
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl flex items-center gap-2">
              <Brush className="h-4 w-4 text-primary/60" />
              Evolución continua de la plataforma. Última versión:{" "}
              <span className="font-semibold text-foreground">
                v{LATEST_VERSION}
              </span>
            </p>
            <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground uppercase tracking-wide">
              <div className="flex items-center gap-1">
                <Hourglass className="h-3.5 w-3.5" /> {CHANGELOG.length} versiones
              </div>
              <div className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5" /> Atajo búsqueda:{" "}
                <kbd className="px-1 py-0.5 rounded bg-muted">/</kbd>
              </div>
              <div className="flex items-center gap-1">
                <Rocket className="h-3.5 w-3.5" /> Rediseño completado
              </div>
            </div>
          </div>

          <div className="flex items-stretch gap-3 self-start">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setExpandAll(e => !e)}
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              {expandAll ? "Colapsar" : "Expandir"}
            </Button>
            <Button
              size="sm"
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(o => !o)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
            </Button>
            {activeFilters && (
              <Button
                size="sm"
                variant="outline"
                onClick={resetFilters}
                className="gap-1"
              >
                <X className="h-4 w-4" /> Limpiar
              </Button>
            )}
          </div>
        </div>

        <div
          className={cn(
            "grid gap-6 transition-all origin-top",
            showFilters
              ? "opacity-100 scale-y-100 pointer-events-auto"
              : "opacity-0 scale-y-95 pointer-events-none h-0"
          )}
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Filtrar por texto, scope, descripción..."
                  className="pl-8"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Tipos
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "added",
                    "changed",
                    "fixed",
                    "removed",
                    "security",
                    "internal",
                    "perf",
                    "ux"
                  ] as ChangeType[]
                ).map(t => {
                  const active = types.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      type="button"
                      className={cn(
                        "text-[11px] px-3 py-1 rounded-full border transition-all font-medium flex items-center gap-1",
                        "backdrop-blur ring-1",
                        active
                          ? "bg-primary text-primary-foreground border-primary/60 ring-primary/40 shadow-sm"
                          : "border-border/60 hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      {TYPE_LABEL[t]}
                      {active && (
                        <span className="text-[9px] bg-primary-foreground/20 px-1 rounded">
                          ×
                        </span>
                      )}
                    </button>
                  )
                })}
                <label className="flex items-center gap-1 ml-auto text-[11px] text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyHighlighted}
                    onChange={e => setOnlyHighlighted(e.target.checked)}
                    className="accent-primary h-3 w-3"
                  />
                  Solo destacados
                </label>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 space-y-10">
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground py-14 text-center border rounded-xl backdrop-blur bg-background/40">
            No hay resultados con los filtros actuales.
          </div>
        )}
        {filtered.map((v, i) => (
          <VersionBlock
            key={v.version}
            version={v}
            index={i}
            expandAll={expandAll}
            highlightQuery={q.trim()}
          />
        ))}
      </div>

      <AnimatePresence>
        {showTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition focus-visible:outline-none focus-visible:ring-2 ring-offset-2 ring-primary"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ================= Helpers & FX ================= */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function highlightText(text: string, query: string) {
  if (!query.trim()) return text
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "ig"))
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        className="bg-primary/30 text-primary-foreground px-0.5 rounded-sm"
      >
        {p}
      </mark>
    ) : (
      p
    )
  )
}

function BackgroundFX() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,hsl(var(--primary)/0.15),transparent_60%),radial-gradient(circle_at_80%_70%,hsl(var(--secondary)/0.15),transparent_55%)]" />
      <div className="absolute -top-44 -left-36 h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl opacity-40 animate-pulse" />
      <div className="absolute -bottom-44 -right-36 h-[520px] w-[520px] rounded-full bg-secondary/20 blur-3xl opacity-30 animate-pulse" />
    </div>
  )
}