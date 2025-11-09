"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import {
  Edit,
  Plus,
  Search,
  User,
  Users,
  KeyRound,
  RefreshCw,
  Crown
} from "lucide-react"

import { RoleGuard } from "@/components/RoleGuard"
import { useToast } from "@/lib/use-toast"
import ChangePasswordDialog from "@/components/ChangePasswordDialog"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { apiUrl } from "@/components/config"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type Usuario = {
  id: number
  nombre_completo: string
  dni: string
  rol: string
  turno: string
  horario_entrada: string
  horario_salida: string
}

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null
}

async function fetchConAuth(input: RequestInfo, init: RequestInit = {}) {
  const token = getToken()
  if (!token) throw new Error("Sesión expirada o no autenticada")
  const headers = {
    ...(init.headers || {}),
    Authorization: `Bearer ${token}`
  }
  return fetch(input, { ...init, headers })
}

// Resaltar búsqueda
function highlight(text: string, term: string) {
  if (!term) return text
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig")
  return text.split(regex).map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="rounded bg-primary/20 px-0.5 py-[1px] text-primary dark:bg-primary/30"
      >
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export default function UsuariosPage() {
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  const [busqueda, setBusqueda] = useState("")
  const [debouncedBusqueda, setDebouncedBusqueda] = useState("")

  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre_completo: "",
    dni: "",
    rol: "",
    turno: "",
    horario_entrada: "",
    horario_salida: "",
    password: "",
    confirmPassword: ""
  })
  const [isEnviando, setIsEnviando] = useState(false)
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [usuarioIdPasswordDialog, setUsuarioIdPasswordDialog] = useState<number | null>(null)

  const nombreCompletoRef = useRef<HTMLInputElement>(null)
  const dniRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusqueda(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  const usuariosFiltrados = useMemo(() => {
    if (!debouncedBusqueda) return usuarios
    return usuarios.filter(
      (usuario) =>
        usuario.nombre_completo.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
        usuario.dni.includes(debouncedBusqueda) ||
        usuario.rol.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
        usuario.turno.toLowerCase().includes(debouncedBusqueda.toLowerCase())
    )
  }, [usuarios, debouncedBusqueda])

  // Agregar usuario
  const agregarUsuario = async () => {
    if (
      !nuevoUsuario.nombre_completo ||
      !nuevoUsuario.dni ||
      !nuevoUsuario.rol ||
      !nuevoUsuario.turno ||
      !nuevoUsuario.horario_entrada ||
      !nuevoUsuario.horario_salida ||
      !nuevoUsuario.password ||
      !nuevoUsuario.confirmPassword
    ) {
      toast({ title: "Error", description: "Completa todos los campos obligatorios", variant: "destructive" })
      nombreCompletoRef.current?.focus()
      return
    }

    if (nuevoUsuario.dni.length !== 8) {
      toast({ title: "Error", description: "El DNI debe tener 8 dígitos", variant: "destructive" })
      dniRef.current?.focus()
      return
    }

    if (usuarios.some((u) => u.dni === nuevoUsuario.dni)) {
      toast({ title: "Error", description: "Ya existe un usuario con este DNI", variant: "destructive" })
      dniRef.current?.focus()
      return
    }

    if (nuevoUsuario.password !== nuevoUsuario.confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" })
      passwordRef.current?.focus()
      return
    }

    if (nuevoUsuario.password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" })
      passwordRef.current?.focus()
      return
    }

    setIsEnviando(true)
    try {
      const res = await fetchConAuth(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dni: nuevoUsuario.dni,
          nombreCompleto: nuevoUsuario.nombre_completo,
          contrasena: nuevoUsuario.password,
          rol: nuevoUsuario.rol,
          turno: nuevoUsuario.turno,
          horarioEntrada: nuevoUsuario.horario_entrada,
          horarioSalida: nuevoUsuario.horario_salida
        })
      })

      if (res.ok) {
        toast({ title: "Usuario agregado", description: "Se creó correctamente" })
        setNuevoUsuario({
          nombre_completo: "",
          dni: "",
          rol: "",
          turno: "",
          horario_entrada: "",
          horario_salida: "",
          password: "",
          confirmPassword: ""
        })
        cargarUsuarios()
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.message || "No se pudo agregar", variant: "destructive" })
      }
    } catch (e) {
      toast({
        title: "Error",
        description: (e as Error).message || "Error de conexión",
        variant: "destructive"
      })
    } finally {
      setIsEnviando(false)
    }
  }

  // Editar usuario
  const guardarEdicionUsuario = async () => {
    if (!editandoUsuario) return
    if (
      !editandoUsuario.nombre_completo ||
      !editandoUsuario.dni ||
      !editandoUsuario.rol ||
      !editandoUsuario.turno ||
      !editandoUsuario.horario_entrada ||
      !editandoUsuario.horario_salida
    ) {
      toast({ title: "Error", description: "Completa todos los campos obligatorios", variant: "destructive" })
      return
    }

    try {
      const res = await fetchConAuth(apiUrl(`/usuarios/${editandoUsuario.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreCompleto: editandoUsuario.nombre_completo,
          dni: editandoUsuario.dni,
          rol: editandoUsuario.rol.toUpperCase(),
          turno: editandoUsuario.turno,
          horarioEntrada: editandoUsuario.horario_entrada,
          horarioSalida: editandoUsuario.horario_salida
        })
      })
      if (res.ok) {
        toast({ title: "Usuario actualizado" })
        setEditandoUsuario(null)
        cargarUsuarios()
      } else {
        const error = await res.json()
        toast({ title: "Error", description: error.message || "No se pudo editar", variant: "destructive" })
      }
    } catch (e) {
      toast({
        title: "Error",
        description: (e as Error).message || "No se pudo editar",
        variant: "destructive"
      })
    }
  }

  const cargarUsuarios = async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      toast({
        title: "Sesión expirada",
        description: "Inicia sesión nuevamente",
        variant: "destructive"
      })
      return
    }
    setRefrescando(true)
    try {
      const res = await fetch(apiUrl("/usuarios"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) throw new Error("Error de sesión o autorización")
      const data = await res.json()
      const usuariosAdaptados = data.map((u: any) => ({
        id: u.id,
        nombre_completo: u.nombreCompleto,
        dni: u.dni,
        rol: (u.rol || "").toLowerCase(),
        turno: u.turno,
        horario_entrada: u.horarioEntrada,
        horario_salida: u.horarioSalida
      }))
      setUsuarios(usuariosAdaptados)
    } catch {
      toast({
        title: "Sesión expirada",
        description: "Inicia sesión nuevamente",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setRefrescando(false)
    }
  }

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const totalAdmins = usuarios.filter(u => u.rol === "administrador").length
  const totalTrabajadores = usuarios.filter(u => u.rol === "trabajador").length

  return (
    <RoleGuard allowedRoles={["administrador"]}>
      <div className="flex flex-col gap-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-primary via-primary/70 to-primary/40 bg-clip-text text-transparent">
                  Gestión de Usuarios
                </span>
                <span className="absolute inset-x-0 -bottom-1 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
              </span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base">
              Control central de identidades y roles
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              onClick={cargarUsuarios}
              disabled={refrescando}
              title="Refrescar"
              className={cn(
                "relative overflow-hidden",
                refrescando && "animate-spin"
              )}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button className="group relative overflow-hidden">
                  <span className="absolute inset-0 bg-[conic-gradient(at_50%_50%,hsl(var(--primary)/.2),transparent_55%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl border border-primary/20 shadow-lg shadow-primary/20 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <DialogHeader>
                  <DialogTitle className="text-xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                    Crear nuevo usuario
                  </DialogTitle>
                  <DialogDescription>
                    Completa los datos para registrar un nuevo perfil
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-2">
                  <div className="grid gap-6 py-2">
                    <Section title="Identidad">
                      <div className="grid gap-5 md:grid-cols-2">
                        <Field label="Nombre completo *" htmlFor="nombre_completo">
                          <Input
                            id="nombre_completo"
                            placeholder="Ej: María Lozano"
                            value={nuevoUsuario.nombre_completo}
                            onChange={(e) =>
                              setNuevoUsuario({
                                ...nuevoUsuario,
                                nombre_completo: e.target.value.slice(0, 120)
                              })
                            }
                            ref={nombreCompletoRef}
                          />
                        </Field>
                        <Field label="DNI *" htmlFor="dni">
                          <Input
                            id="dni"
                            placeholder="12345678"
                            maxLength={8}
                            inputMode="numeric"
                            value={nuevoUsuario.dni}
                            onChange={(e) =>
                              setNuevoUsuario({
                                ...nuevoUsuario,
                                dni: e.target.value.replace(/\D/g, "").slice(0, 8)
                              })
                            }
                            ref={dniRef}
                          />
                        </Field>
                      </div>
                    </Section>

                    <Section title="Asignación">
                      <div className="grid gap-5 md:grid-cols-3">
                        <Field label="Rol *" htmlFor="rol">
                          <Select
                            value={nuevoUsuario.rol}
                            onValueChange={(value) => setNuevoUsuario({ ...nuevoUsuario, rol: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="administrador">Administrador</SelectItem>
                              <SelectItem value="trabajador">Trabajador</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Turno *" htmlFor="turno">
                          <Select
                            value={nuevoUsuario.turno}
                            onValueChange={(value) => setNuevoUsuario({ ...nuevoUsuario, turno: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Turno" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mañana">Mañana</SelectItem>
                              <SelectItem value="tarde">Tarde</SelectItem>
                              <SelectItem value="noche">Noche</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="" htmlFor="rol">
                          <div className="flex gap-2">
                            {nuevoUsuario.rol === "administrador" ? (
                              <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold shadow ring-1 ring-yellow-500/50">
                                Administrador
                              </Badge>
                            ) : nuevoUsuario.rol ? (
                              <Badge variant="secondary" className="capitalize">
                                {nuevoUsuario.rol}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Sin rol</Badge>
                            )}
                          </div>
                        </Field>
                      </div>
                      <div className="grid gap-5 md:grid-cols-2">
                        <Field label="Horario entrada *" htmlFor="horario_entrada">
                          <Input
                            id="horario_entrada"
                            type="time"
                            value={nuevoUsuario.horario_entrada}
                            onChange={(e) =>
                              setNuevoUsuario({ ...nuevoUsuario, horario_entrada: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Horario salida *" htmlFor="horario_salida">
                          <Input
                            id="horario_salida"
                            type="time"
                            value={nuevoUsuario.horario_salida}
                            onChange={(e) =>
                              setNuevoUsuario({ ...nuevoUsuario, horario_salida: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                    </Section>

                    <Section title="Seguridad">
                      <div className="grid gap-5 md:grid-cols-2">
                        <Field label="Contraseña *" htmlFor="password">
                          <Input
                            id="password"
                            type="password"
                            placeholder="Mínimo 6 caracteres"
                            value={nuevoUsuario.password}
                            onChange={(e) =>
                              setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })
                            }
                            ref={passwordRef}
                          />
                          <PasswordStrengthIndicator password={nuevoUsuario.password} />
                        </Field>
                        <Field label="Confirmar contraseña *" htmlFor="confirmPassword">
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Repite la contraseña"
                            value={nuevoUsuario.confirmPassword}
                            onChange={(e) =>
                              setNuevoUsuario({
                                ...nuevoUsuario,
                                confirmPassword: e.target.value
                              })
                            }
                          />
                          {nuevoUsuario.confirmPassword && (
                            <p
                              className={cn(
                                "text-xs mt-1",
                                nuevoUsuario.confirmPassword === nuevoUsuario.password
                                  ? "text-green-600"
                                  : "text-destructive"
                              )}
                            >
                              {nuevoUsuario.confirmPassword === nuevoUsuario.password
                                ? "Coincide ✔"
                                : "No coincide"}
                            </p>
                          )}
                        </Field>
                      </div>
                    </Section>
                  </div>
                </ScrollArea>
                <DialogFooter className="mt-4">
                  <Button
                    onClick={agregarUsuario}
                    disabled={isEnviando}
                    className="w-full md:w-auto bg-gradient-to-r from-primary via-primary/80 to-primary/60 hover:from-primary/90 hover:via-primary/70 hover:to-primary/50"
                  >
                    {isEnviando ? "Creando..." : "Crear Usuario"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid gap-6 md:grid-cols-3">
          <MetricCard
            title="Total Usuarios"
            subtitle="Registrados"
            value={usuarios.length}
            icon={<Users className="h-5 w-5" />}
            glow="from-primary/40 via-primary/10"
          />
          <MetricCard
            title="Administradores"
            subtitle="Acceso completo"
            value={totalAdmins}
            icon={<Crown className="h-5 w-5 text-amber-400 drop-shadow" />}
            variant="gold"
            glow="from-amber-400/50 via-amber-200/20"
          />
          <MetricCard
            title="Trabajadores"
            subtitle="Operativos activos"
            value={totalTrabajadores}
            icon={<User className="h-5 w-5" />}
            glow="from-emerald-400/40 via-emerald-200/20"
          />
        </div>

        {/* Buscador */}
        <div className="relative">
          <div className="absolute -inset-x-4 -inset-y-2 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-xl blur-xl pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, DNI, rol o turno..."
                className="pl-9 h-11 rounded-xl border-primary/30 focus-visible:ring-primary/40 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button
                  className="absolute right-2 top-2 text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition"
                  onClick={() => setBusqueda("")}
                >
                  Limpiar
                </button>
              )}
            </div>
            <Badge variant="outline" className="h-8 px-3 flex items-center gap-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> {usuariosFiltrados.length} visibles
            </Badge>
          </div>
        </div>

        {/* Lista de usuarios en tarjetas */}
        <section>
          {loading ? (
            <UserCardsSkeleton />
          ) : usuariosFiltrados.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
                <Users className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No se encontraron usuarios</p>
                <p className="text-sm text-muted-foreground">
                  Intenta cambiar el término de búsqueda o crea un nuevo usuario.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {usuariosFiltrados.map((u, i) => (
                <UserCard
                  key={u.id}
                  usuario={u}
                  index={i}
                  onEdit={() => setEditandoUsuario(u)}
                  onChangePassword={() => {
                    setUsuarioIdPasswordDialog(u.id)
                    setShowPasswordDialog(true)
                  }}
                  searchTerm={debouncedBusqueda}
                />
              ))}
            </div>
          )}
        </section>

        {/* Dialog Editar */}
        <Dialog open={!!editandoUsuario} onOpenChange={() => setEditandoUsuario(null)}>
          <DialogContent className="max-w-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 border border-primary/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                Editar usuario
              </DialogTitle>
              <DialogDescription>
                Ajusta la información del usuario seleccionado
              </DialogDescription>
            </DialogHeader>
            {editandoUsuario && (
              <div className="grid gap-6 py-2">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Nombre completo *" htmlFor="edit-nombre_completo">
                    <Input
                      id="edit-nombre_completo"
                      value={editandoUsuario.nombre_completo}
                      onChange={(e) =>
                        setEditandoUsuario({
                          ...editandoUsuario,
                          nombre_completo: e.target.value
                        })
                      }
                    />
                  </Field>
                  <Field label="DNI *" htmlFor="edit-dni">
                    <Input
                      id="edit-dni"
                      maxLength={8}
                      value={editandoUsuario.dni}
                      onChange={(e) =>
                        setEditandoUsuario({
                          ...editandoUsuario,
                          dni: e.target.value.replace(/\D/g, "").slice(0, 8)
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Rol *" htmlFor="edit-rol">
                    <Select
                      value={editandoUsuario.rol}
                      onValueChange={(value) =>
                        setEditandoUsuario({ ...editandoUsuario, rol: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Rol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="administrador">Administrador</SelectItem>
                        <SelectItem value="trabajador">Trabajador</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Turno *" htmlFor="edit-turno">
                    <Select
                      value={editandoUsuario.turno}
                      onValueChange={(value) =>
                        setEditandoUsuario({ ...editandoUsuario, turno: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Turno" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mañana">Mañana</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noche">Noche</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Entrada *" htmlFor="edit-horario_entrada">
                    <Input
                      id="edit-horario_entrada"
                      type="time"
                      value={editandoUsuario.horario_entrada}
                      onChange={(e) =>
                        setEditandoUsuario({
                          ...editandoUsuario,
                          horario_entrada: e.target.value
                        })
                      }
                    />
                  </Field>
                  <Field label="Salida *" htmlFor="edit-horario_salida">
                    <Input
                      id="edit-horario_salida"
                      type="time"
                      value={editandoUsuario.horario_salida}
                      onChange={(e) =>
                        setEditandoUsuario({
                          ...editandoUsuario,
                          horario_salida: e.target.value
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            )}
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setEditandoUsuario(null)}>
                Cancelar
              </Button>
              <Button onClick={guardarEdicionUsuario} className="bg-primary/90 hover:bg-primary">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog cambiar contraseña */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="max-w-md backdrop-blur supports-[backdrop-filter]:bg-background/80 border border-primary/30">
            <DialogHeader>
              <DialogTitle>Cambiar contraseña</DialogTitle>
              <DialogDescription>
                Establece una nueva contraseña segura para este usuario.
              </DialogDescription>
            </DialogHeader>
            {usuarioIdPasswordDialog && (
              <ChangePasswordDialog
                userId={usuarioIdPasswordDialog}
                onClose={() => setShowPasswordDialog(false)}
                isAdmin={true}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  )
}

/* =============== COMPONENTES AUXILIARES ================= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow shadow-primary/40" />
          {title}
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
  optional
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
  optional?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2"
      >
        {label} {optional && <span className="text-[10px] text-muted-foreground/60">(Opcional)</span>}
      </Label>
      {children}
    </div>
  )
}

function MetricCard({
  title,
  subtitle,
  value,
  icon,
  variant,
  glow
}: {
  title: string
  subtitle: string
  value: number | string
  icon: React.ReactNode
  variant?: "gold" | "default"
  glow?: string
}) {
  const gold = variant === "gold"
  return (
    <Card
      className={cn(
        "relative overflow-hidden group border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        gold &&
          "border-amber-400/40 bg-gradient-to-br from-amber-100/10 via-background to-background dark:from-amber-500/10 dark:border-amber-400/30"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity",
          glow && `bg-gradient-to-br ${glow} to-transparent`
        )}
      />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
            {title}
          </CardTitle>
          <div
            className={cn(
              "p-2 rounded-md bg-primary/10 text-primary shadow-inner",
              gold && "bg-amber-500/20 text-amber-400 shadow-amber-400/30"
            )}
          >
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-3xl font-bold tracking-tight",
            gold && "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow-sm"
          )}
        >
          {value}
        </div>
        <CardDescription className={cn(gold && "text-amber-500/70")}>{subtitle}</CardDescription>
      </CardContent>
    </Card>
  )
}

function UserCard({
  usuario,
  index,
  onEdit,
  onChangePassword,
  searchTerm
}: {
  usuario: Usuario
  index: number
  onEdit: () => void
  onChangePassword: () => void
  searchTerm: string
}) {
  const isAdmin = usuario.rol === "administrador"

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-5 flex flex-col gap-4 overflow-hidden",
        "transition duration-500",
        "border-border/60 hover:border-primary/40",
        "bg-gradient-to-br from-background via-background to-background/70",
        "shadow-sm hover:shadow-lg",
        isAdmin &&
          "border-amber-400/40 hover:border-amber-400/70 bg-gradient-to-br from-amber-100/10 via-background to-background dark:from-amber-500/10"
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity",
          isAdmin
            ? "bg-[radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.35),transparent_65%)]"
            : "bg-[radial-gradient(circle_at_85%_15%,rgba(99,102,241,0.25),transparent_65%)]"
        )}
      />
      <div
        className={cn(
          "absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition",
          "bg-gradient-to-r from-primary/40 via-transparent to-primary/40",
          isAdmin && "from-amber-400/60 to-amber-400/60"
        )}
      />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col">
          <h3 className="font-semibold leading-tight text-base md:text-lg">
            {highlight(usuario.nombre_completo, searchTerm)}
          </h3>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-mono">
            ID {usuario.id}
          </span>
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-1">
            <Crown className="h-5 w-5 text-amber-400 drop-shadow" />
          </div>
        ) : (
          <User className="h-5 w-5 text-muted-foreground/70" />
        )}
      </div>

      <Separator className="relative z-10 bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative z-10 grid grid-cols-2 gap-3 text-sm">
        <Info label="DNI" value={highlight(usuario.dni, searchTerm)} />
        <Info
          label="Rol"
          value={
            <Badge
              className={cn(
                "px-2.5 py-1 text-xs font-medium capitalize shadow-sm",
                isAdmin
                  ? "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black shadow-amber-400/40"
                  : "bg-primary/15 text-primary"
              )}
            >
              {highlight(isAdmin ? "Administrador" : "Trabajador", searchTerm)}
            </Badge>
          }
        />
        <Info label="Turno" value={highlight(usuario.turno, searchTerm)} />
        <Info label="Entrada" value={<time>{usuario.horario_entrada}</time>} />
        <Info label="Salida" value={<time>{usuario.horario_salida}</time>} />
      </div>

      <div className="relative z-10 flex flex-wrap gap-2 mt-auto pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className={cn(
            "rounded-full border-dashed",
            isAdmin
              ? "border-amber-400/60 hover:border-amber-400/80 hover:bg-amber-400/10"
              : "hover:bg-primary/10"
          )}
        >
          <Edit className="h-4 w-4 mr-1.5" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onChangePassword}
          className={cn(
            "rounded-full",
            isAdmin
              ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
              : "hover:bg-primary/10"
          )}
        >
          <KeyRound className="h-4 w-4 mr-1.5" />
          Contraseña
        </Button>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
        {label}
      </span>
      <span className="font-medium leading-tight">{value}</span>
    </div>
  )
}

/* Indicador de fuerza de contraseña */
function PasswordStrengthIndicator({ password }: { password: string }) {
  const score = useMemo(() => {
    let s = 0
    if (password.length >= 6) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    if (password.length >= 10) s++
    return s
  }, [password])

  if (!password) return null
  const colors = ["bg-destructive", "bg-orange-500", "bg-amber-500", "bg-green-500", "bg-emerald-600"]
  const labels = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"]

  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-muted transition-colors",
              i < score && colors[score - 1]
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          "text-[10px] uppercase tracking-wide",
          score <= 2 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {labels[Math.max(0, score - 1)]}
      </p>
    </div>
  )
}

/* Skeleton para tarjetas de usuarios */
function UserCardsSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="relative rounded-2xl border border-border/60 p-5 bg-gradient-to-br from-background via-background to-background/70"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}