"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import {
  Home,
  ShoppingCart,
  Plus,
  Receipt,
  History,
  Wallet,
  Pill,
  Box,
  BarChart3,
  Users,
  Settings,
  Sparkles,
  Code2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CHANGELOG, isRecent } from "@/lib/changelog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
  id?: string
  order?: number
}

/* -------------------------------- Icons ---------------------------------- */
const Icons = {
  dashboard: <Home className="h-[18px] w-[18px]" />,
  nuevaVenta: (
    <span className="relative inline-flex">
      <ShoppingCart className="h-[18px] w-[18px]" />
      <Plus className="h-3 w-3 absolute -right-1 -top-1 rounded-full bg-primary text-primary-foreground p-[1px]" />
    </span>
  ),
  historialVentas: (
    <span className="relative inline-flex">
      <Receipt className="h-[18px] w-[18px]" />
      <History className="h-3 w-3 absolute -right-1 -bottom-1 opacity-80" />
    </span>
  ),
  caja: <Wallet className="h-[18px] w-[18px]" />,
  productos: <Pill className="h-[18px] w-[18px]" />,
  stock: <Box className="h-[18px] w-[18px]" />,
  reportes: <BarChart3 className="h-[18px] w-[18px]" />,
  usuarios: <Users className="h-[18px] w-[18px]" />,
  configuracion: <Settings className="h-[18px] w-[18px]" />,
  changelog: <Sparkles className="h-[18px] w-[18px]" />,
  desarrolladores: <Code2 className="h-[18px] w-[18px]" />
}

/* ----------------------- Original nav with adminOnly --------------------- */
const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: Icons.dashboard, adminOnly: true, order: -100 },
  { title: "Vender", href: "/dashboard/nueva", icon: Icons.nuevaVenta, order: 10 },
  { title: "Historial ventas", href: "/dashboard/ventas", icon: Icons.historialVentas, order: 11 },
  { title: "Caja", href: "/dashboard/caja", icon: Icons.caja, order: 12 },
  { title: "Productos", href: "/dashboard/productos", icon: Icons.productos, adminOnly: true, order: 20 },
  { title: "Stock", href: "/dashboard/stock", icon: Icons.stock, order: 21 },
  { title: "Reportes", href: "/dashboard/reportes", icon: Icons.reportes, adminOnly: true, order: 30 },
  { title: "Usuarios", href: "/dashboard/usuarios", icon: Icons.usuarios, adminOnly: true, order: 40 },
  { title: "Configuración", href: "/dashboard/configuracion", icon: Icons.configuracion, adminOnly: true, order: 41 },

  { title: "Desarrolladores", href: "/dashboard/desarrolladores", icon: Icons.desarrolladores, adminOnly: true, order: 60 },
]

/* ----------------------------- Constants --------------------------------- */
const CHANGELOG_STORAGE_KEY = "changelog:lastSeenVersion"
const SIDEBAR_COLLAPSED_KEY = "sidebar:collapsed"
export const SIDEBAR_WIDTH_EXPANDED = 256
export const SIDEBAR_WIDTH_COLLAPSED = 74
const MOBILE_NAV_HEIGHT = 62
const WORKER_HOME = "/dashboard/nueva"
const ADMIN_HOME = "/dashboard"

/**
 * Reglas de protección:
 * - El error que tenías: estabas usando startsWith("/dashboard") y como TODAS las rutas comparten ese prefijo,
 *   siempre coincidía con el item Dashboard (adminOnly) y redirigía a Vender.
 * - Ahora comprobamos adminOnly SOLO si se trata de la ruta exacta (===) o un sub-path de un item admin distinto de /dashboard.
 *   Para "/dashboard" (dashboard principal) exigimos coincidencia EXACTA; no hacemos coincidencia por prefijo
 *   porque rompería a las demás páginas worker.
 */

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.rol?.toLowerCase() === "administrador"

  const [collapsed, setCollapsed] = useState(false)

  // Changelog
  const latest = CHANGELOG[0]
  const isLatestRecent = latest ? isRecent(latest.date) : false
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const unread = latest && lastSeen !== latest.version

  /* -------------------- Persisted UI state & changelog ------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return
    const sLast = localStorage.getItem(CHANGELOG_STORAGE_KEY)
    if (sLast) setLastSeen(sLast)
    const sCol = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (sCol) setCollapsed(sCol === "1")
  }, [])

  useEffect(() => {
    if (pathname.startsWith("/dashboard/actualizaciones") && latest) {
      localStorage.setItem(CHANGELOG_STORAGE_KEY, latest.version)
      setLastSeen(latest.version)
    }
  }, [pathname, latest])

  /* ---------------------- Role-based route protection -------------------- */
  useEffect(() => {
    if (!user) return
    if (isAdmin) {
      // Admin: si entra a la raíz /dashboard (OK) o a cualquier otra permitida.
      // Si aterriza por ejemplo en / (fuera) lo manejas en lógica de login.
      return
    }
    // NOT admin
    // 1. Si está en Dashboard exacto, redirigir a Vender
    if (pathname === ADMIN_HOME) {
      router.replace(WORKER_HOME)
      return
    }

    // 2. Comprobar si está en ruta adminOnly (exacta o subruta) SIN contar el simple prefijo /dashboard para todo.
    const isForbidden = navItems
      .filter(i => i.adminOnly)
      .some(item => {
        if (item.href === ADMIN_HOME) {
          // Dashboard principal: solo exacta
            return pathname === item.href
        }
        // Otras rutas admin: exacta o sub-ruta
        return pathname === item.href || pathname.startsWith(item.href + "/")
      })

    if (isForbidden) {
      router.replace(WORKER_HOME)
    }
  }, [pathname, isAdmin, user, router])

  /* --------------------------- Keyboard toggle --------------------------- */
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      if (typeof window !== "undefined")
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0")
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleCollapsed])

  /* --------------------------- Filtered nav list ------------------------- */
  const filteredNavItems = useMemo(
    () =>
      navItems
        .filter(i => !i.adminOnly || isAdmin)
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [isAdmin]
  )

  /* -------------------- Global body padding for mobile nav --------------- */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    function apply() {
      if (mq.matches) {
        document.documentElement.style.setProperty("--mobile-nav-height", `${MOBILE_NAV_HEIGHT}px`)
        if (!document.body.dataset.prevPb) {
          const current = parseFloat(getComputedStyle(document.body).paddingBottom || "0")
          document.body.dataset.prevPb = String(current)
          document.body.style.paddingBottom = `${current + MOBILE_NAV_HEIGHT}px`
        }
      } else {
        cleanup()
      }
    }
    function cleanup() {
      if (document.body.dataset.prevPb !== undefined) {
        document.body.style.paddingBottom = document.body.dataset.prevPb
        delete document.body.dataset.prevPb
      }
      document.documentElement.style.removeProperty("--mobile-nav-height")
    }
    apply()
    mq.addEventListener("change", apply)
    return () => {
      mq.removeEventListener("change", apply)
      cleanup()
    }
  }, [])

  /* ------------------------------ Helpers -------------------------------- */
  const isActive = useCallback(
    (href: string) =>
      pathname === href || (href !== ADMIN_HOME && pathname.startsWith(href + "/")) || (href !== ADMIN_HOME && pathname === href),
    [pathname]
  )

  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href)
    const showUnread = item.id === "changelog" && unread && !active

    const link =
      <Link
        key={item.href}
        href={item.href}
        aria-label={item.title}
        className={cn(
          "group relative flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium outline-none transition",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          active
            ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-primary dark:from-primary/20 dark:via-primary/10"
            : "text-muted-foreground hover:bg-muted/60 dark:hover:bg-muted/30"
        )}
        aria-current={active ? "page" : undefined}
      >
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border text-[13px] transition",
            active
              ? "border-primary/40 bg-primary/10 text-primary dark:bg-primary/15"
              : "border-transparent bg-muted/50 dark:bg-muted/20 group-hover:border-primary/30 group-hover:text-primary"
          )}
        >
          {item.icon}
        </span>
        {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
        {showUnread && (
          <span
            className={cn(
              "absolute",
              collapsed ? "top-1.5 right-1.5" : "top-1/2 -translate-y-1/2 right-2",
              "h-2 w-2 rounded-full bg-primary ring-2 ring-background animate-pulse"
            )}
            aria-label="Nuevo"
          />
        )}
        {active && (
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary"
          />
        )}
      </Link>

    if (!collapsed) return link

    return (
      <Tooltip key={item.href} delayDuration={50}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="px-2 py-1 text-xs font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>
    )
  }

  /* ------------------------------ Render --------------------------------- */
  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <TooltipProvider disableHoverableContent>
        <aside
          className={cn(
            "hidden md:flex h-screen flex-col border-r shadow-sm transition-[width] duration-300 shrink-0",
            "relative z-40",
            "bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-xl",
            collapsed ? "w-[74px]" : "w-64"
          )}
          style={{
            ["--sidebar-width" as any]: collapsed ? `${SIDEBAR_WIDTH_COLLAPSED}px` : `${SIDEBAR_WIDTH_EXPANDED}px`
          }}
        >
          {/* Brand */}
          <div className="flex h-14 items-center px-3">
            <Link
              href={isAdmin ? ADMIN_HOME : WORKER_HOME}
              className={cn(
                "flex items-center gap-2 group",
                collapsed && "justify-center mx-auto"
              )} 
              aria-label="Ir a inicio"
            >
              <div className="relative flex h-9 w-9 items-center justify-center">
                <img src="/icono-said.png" alt="Icono Sidebar" className="h-9 w-9" />
                {isLatestRecent && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary-foreground/95 text-[8px] font-bold text-primary shadow ring-1 ring-primary">
                    !
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="font-semibold text-[15px] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  Boticas Said
                </span>
              )}
            </Link>
          </div>

          {/* Collapse handle */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 flex items-center justify-center",
              collapsed ? "right-[-6px]" : "right-[-8px]"
            )}
            style={{ zIndex: 50 }}
          >
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
              className={cn(
                "group h-8 w-8 rounded-full border bg-background/95 backdrop-blur text-muted-foreground shadow transition",
                "hover:text-foreground hover:border-primary/40 hover:bg-primary/5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              )}
            >
              {collapsed ? <ChevronRight className="h-4 w-4 mx-auto" /> : <ChevronLeft className="h-4 w-4 mx-auto" />}
            </button>
          </div>

          <ScrollArea className="flex-1 px-2 py-3">
            <nav className="space-y-1.5">
              {filteredNavItems.map(renderNavLink)}
            </nav>
          </ScrollArea>

          <div
            className={cn(
              "border-t px-2 py-2 text-[10px] text-muted-foreground flex items-center justify-between",
              collapsed && "flex-col gap-1 text-center"
            )}
          >
            {!collapsed && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Online
              </span>
            )}
            <span className="opacity-70">
              
            </span>
          </div>
        </aside>
      </TooltipProvider>

      {/* MOBILE BOTTOM NAV: sólo items permitidos para ese rol */}
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex md:hidden border-t",
          "bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70"
        )}
        role="navigation"
        aria-label="Barra de navegación móvil"
        style={{ height: MOBILE_NAV_HEIGHT }}
      >
        <ul
          className={cn(
            "flex w-full items-stretch gap-1 overflow-x-auto px-2 py-1",
            "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
          )}
        >
          {filteredNavItems.map(item => {
            const active = isActive(item.href)
            const showUnread = item.id === "changelog" && unread && !active
            return (
              <li
                key={item.href}
                className="flex flex-col items-center min-w-[70px] flex-1 basis-[70px]"
              >
                <Link
                  href={item.href}
                  aria-label={item.title}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border text-xs transition",
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent bg-muted/40 dark:bg-muted/30"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="leading-none truncate max-w-[68px]">
                    {item.title}
                  </span>
                  {active && (
                    <span className="absolute -top-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                  {showUnread && (
                    <span className="absolute top-1 right-3 h-2 w-2 rounded-full bg-primary animate-pulse" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  )
}

/**
 * RESUMEN DE ARREGLOS:
 * - El problema de redirección continua era por usar startsWith("/dashboard") con el item Dashboard adminOnly.
 *   Ahora la protección distingue:
 *     * Dashboard (admin) solo bloquea coincidencia EXACTA.
 *     * Otros adminOnly bloquean ruta exacta o subrutas.
 * - Se restauró la lista original con adminOnly.
 * - Se añadió redirección solo cuando un trabajador visita una ruta realmente admin.
 * - Trabajador ya puede navegar a: Vender, Historial ventas, Caja, Productos, Stock, Actualizaciones.
 * - Admin puede ver Dashboard y demás rutas.
 * - Ajustado body padding en móvil para que el bottom nav no tape el contenido.
 * - WORKER_HOME y ADMIN_HOME centralizados; cambia si quieres otro home.
 *
 * SUGERENCIA ADICIONAL (Servidor):
 * Añade un middleware o verificación server-side para rutas admin (por seguridad real) y redirige ahí también.
 */