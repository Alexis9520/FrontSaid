"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, Variants } from "framer-motion"
import { login } from "@/lib/auth"
import { useToast } from "@/lib/use-toast"
import { Pill, Eye, EyeOff, Loader2, Shield, Lock } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

/* ---------------- VALIDACIÓN ---------------- */
const formSchema = z.object({
  dni: z.string().trim().length(8, { message: "Debe tener 8 dígitos" }).regex(/^\d+$/, { message: "Solo números" }),
  password: z.string().min(6, { message: "Mínimo 6 caracteres" })
})
type FormValues = z.infer<typeof formSchema>

const MAX_ATTEMPTS = 5
const LOCK_SECONDS = 45

/* --------------- ANIMACIONES ---------------- */
const fadeIn: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.10 * i, duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  })
}

/* =============== COMPONENTE PRINCIPAL =============== */
export default function LoginForm() {
  const router = useRouter()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockCountdown, setLockCountdown] = useState<number | null>(null)
  const [capsLock, setCapsLock] = useState(false)
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { dni: "", password: "" },
    mode: "onChange"
  })

  /* Manejo de bloqueos */
  useEffect(() => {
    if (failedAttempts >= MAX_ATTEMPTS) {
      setLockCountdown(LOCK_SECONDS)
      lockTimerRef.current && clearInterval(lockTimerRef.current)
      lockTimerRef.current = setInterval(() => {
        setLockCountdown(prev => {
          if (prev === null) return null
          if (prev <= 1) {
            clearInterval(lockTimerRef.current as NodeJS.Timeout)
            return null
          }
            return prev - 1
        })
      }, 1000)
      toast({
        variant: "destructive",
        title: "Demasiados intentos",
        description: `Espera ${LOCK_SECONDS} segundos`
      })
    }
  }, [failedAttempts, toast])

  useEffect(() => {
    return () => {
      lockTimerRef.current && clearInterval(lockTimerRef.current)
    }
  }, [])

  async function onSubmit(values: FormValues) {
    if (lockCountdown !== null) {
      toast({
        variant: "destructive",
        title: "Bloqueado",
        description: `Quedan ${lockCountdown}s`
      })
      return
    }
    setIsLoading(true)
    try {
      const result = await login(values.dni, values.password)
      if (result.ok) {
        setFailedAttempts(0)
        toast({ title: "Bienvenido", description: "Sesión iniciada" })
        router.push("/dashboard")
        router.refresh()
      } else {
        setFailedAttempts(p => p + 1)
        toast({
          variant: "destructive",
          title: "Credenciales inválidas",
          description: result.error || "Revisa tu DNI o contraseña."
        })
      }
    } catch {
      setFailedAttempts(p => p + 1)
      toast({
        variant: "destructive",
        title: "Error inesperado",
        description: "Intenta nuevamente."
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState?.("CapsLock"))
  }

  const isLocked = lockCountdown !== null

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#130B2A] text-slate-100">
      <BackgroundBlobs />

      {/* CONTENEDOR CENTRADO RESPONSIVO */}
      <div className="relative flex h-full w-full flex-col items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-10">
        <div className="mx-auto flex w-full max-w-[1650px] flex-col items-center justify-center">
          {/* En móvil: primero el logo + bienvenida (centrado), luego form.
              En >=lg: grid 2 columnas (bienvenida izquierda / form derecha) */}
          <div className="flex w-full flex-col gap-10 md:gap-14 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 xl:gap-24">
            {/* IZQUIERDA (o arriba en móvil) */}
            <motion.section
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              custom={0}
              className="relative flex flex-col items-start justify-center lg:items-start"
            >
              {/* Eliminado el swirl rectangular: nuevo fondo radial con máscara para evitar borde/shadow visible */}
              <AmbientWelcomeBackground />

              <div className="relative z-10 w-full max-w-xl">
                <BrandHeaderLeft compactOnMobile />
                <h1 className="mt-8 text-[2.35rem] font-bold leading-[1.05] tracking-tight sm:text-[2.9rem] md:text-[3.2rem] lg:text-[3.6rem] xl:text-[4.25rem]">
                  <span className="bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                    Bienvenido
                  </span>
                </h1>
                <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-slate-300/90 sm:text-sm md:text-[15px]">
                  
                </p>
                <div className="mt-6">
                  
                </div>
              </div>
            </motion.section>

            {/* DERECHA FORM */}
            <motion.section
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              custom={0.3}
              className="relative flex w-full items-start justify-center lg:items-center"
            >
              <div className="w-full max-w-sm md:max-w-md lg:max-w-sm">
                <FormCard
                  form={form}
                  onSubmit={onSubmit}
                  isLoading={isLoading}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  isLocked={isLocked}
                  lockCountdown={lockCountdown}
                  capsLock={capsLock}
                  handleKeyEvent={handleKeyEvent}
                  failedAttempts={failedAttempts}
                />
              </div>
            </motion.section>
          </div>
        </div>
      </div>

      {/* Reset body para evitar marco en claro */}
      <style jsx global>{`
        html, body, #__next {
          height: 100%;
          width: 100%;
        }
        body {
          margin: 0;
          padding: 0;
          background: #130B2A;
          overscroll-behavior: none;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  )
}

/* =============== SUBCOMPONENTES UI =============== */

/* Fondo general (sin líneas) */
function BackgroundBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-20">
      {/* Base soft radial blobs */}
      <div className="absolute -left-40 top-0 h-[75vmax] w-[75vmax] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.33),transparent_72%)] blur-[150px]" />
      <div className="absolute bottom-[-25%] right-[-25%] h-[65vmax] w-[65vmax] rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.33),transparent_70%)] blur-[150px]" />

      {/* Animated slow gradient overlay (modern subtle motion) */}
      <div
        className="absolute inset-0 opacity-60 mix-blend-overlay"
        style={{
          background: 'linear-gradient(120deg, rgba(168,85,247,0.12), rgba(236,72,153,0.08), rgba(14,165,233,0.12))',
          backgroundSize: '300% 300%'
        }}
      />

      {/* Floating micro-particles (subtle) */}
      <div className="absolute inset-0 overflow-hidden">
  <div className="absolute -left-10 -top-10 w-[140%] h-[140%] bg-[radial-gradient(circle,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:18px_18px] opacity-40 animate-[particlesMove_8s_linear_infinite]" />
      </div>

      <style jsx>{`
        @keyframes bgShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes particlesMove {
          0% { transform: translateY(0px) translateX(0px) rotate(0deg); }
          25% { transform: translateY(-12px) translateX(8px) rotate(6deg); }
          50% { transform: translateY(6px) translateX(18px) rotate(12deg); }
          75% { transform: translateY(-6px) translateX(6px) rotate(4deg); }
          100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
        }
        /* Apply the background shift animation to the overlay element */
        .mix-blend-overlay[style] {
          animation: bgShift 10s ease-in-out infinite;
        }
        .animate-[particlesMove_8s_linear_infinite] { animation: particlesMove 8s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mix-blend-overlay[style], .animate-[particlesMove_20s_linear_infinite] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

/* Nuevo fondo para bienvenida SIN borde rectangular:
   - Se extiende fuera del contenedor (inset-[-40%]) y se aplica máscara radial */
function AmbientWelcomeBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-visible">
      {/* Layered floating blobs animation (different style): multiple blobs drifting with slight scale/opacity changes */}
  <div className="absolute -left-20 -top-10 h-[58vmax] w-[58vmax] rounded-full blur-[110px] opacity-70 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.38),transparent_60%)] animate-[floatA_8s_ease-in-out_infinite]" />
  <div className="absolute -right-28 top-6 h-[48vmax] w-[48vmax] rounded-full blur-[90px] opacity-65 bg-[radial-gradient(circle_at_80%_70%,rgba(236,72,153,0.34),transparent_60%)] animate-[floatB_10s_ease-in-out_infinite]" />
  <div className="absolute left-1/3 -bottom-12 h-[46vmax] w-[46vmax] rounded-full blur-[100px] opacity-60 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.32),transparent_60%)] animate-[floatC_9s_ease-in-out_infinite]" />

      <style jsx>{`
        @keyframes floatA {
          0% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.72; }
          25% { transform: translateY(-24px) translateX(18px) scale(1.03); opacity: 0.8; }
          50% { transform: translateY(0px) translateX(36px) scale(1.02); opacity: 0.7; }
          75% { transform: translateY(18px) translateX(18px) scale(1.01); opacity: 0.78; }
          100% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.72; }
        }
        @keyframes floatB {
          0% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.65; }
          30% { transform: translateY(18px) translateX(-22px) scale(1.04); opacity: 0.72; }
          60% { transform: translateY(-12px) translateX(-40px) scale(1.02); opacity: 0.6; }
          100% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.65; }
        }
        @keyframes floatC {
          0% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.62; }
          20% { transform: translateY(-18px) translateX(12px) scale(1.02); opacity: 0.7; }
          50% { transform: translateY(22px) translateX(-8px) scale(1.01); opacity: 0.6; }
          80% { transform: translateY(-6px) translateX(-26px) scale(1.03); opacity: 0.68; }
          100% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.62; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-[floatA_8s_ease-in-out_infinite], .animate-[floatB_10s_ease-in-out_infinite], .animate-[floatC_9s_ease-in-out_infinite] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

function BrandHeaderLeft({ compactOnMobile }: { compactOnMobile?: boolean }) {
  return (
    <div className={`flex items-center gap-4 ${compactOnMobile ? "sm:gap-4" : ""}`}>
    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl">
      <img src="/icono-sidebar.png" alt="Icono Sidebar" className="h-12 w-12" />
    </div>
    <div className="leading-tight">
      <p className="text-lg sm:text-xl font-semibold text-white">Botica Nueva Esperanza</p>
      <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-slate-300">
        Salud & Economía
      </p>
    </div>
  </div>
  )
}

interface SharedProps {
  form: ReturnType<typeof useForm<FormValues>>
  onSubmit: (v: FormValues) => void
  isLoading: boolean
  showPassword: boolean
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
  isLocked: boolean
  lockCountdown: number | null
  capsLock: boolean
  handleKeyEvent: (e: React.KeyboardEvent<HTMLInputElement>) => void
  failedAttempts: number
}

function FormCard(props: SharedProps) {
  const {
    form,
    onSubmit,
    isLoading,
    showPassword,
    setShowPassword,
    isLocked,
    lockCountdown,
    capsLock,
    handleKeyEvent,
    failedAttempts
  } = props

  return (
    <Card className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_8px_40px_-14px_rgba(0,0,0,0.65)] sm:shadow-[0_8px_42px_-12px_rgba(0,0,0,0.65)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.17)_0%,rgba(255,255,255,0)_45%)]" />
      <CardHeader className="space-y-2 pb-4 text-center">
        <CardTitle className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-white">
          Iniciar sesión
        </CardTitle>
        <CardDescription className="text-xs text-slate-300/80">
          Accede a tu panel de control
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <DNIField form={form} />
            <PasswordField
              form={form}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              capsLock={capsLock}
              handleKeyEvent={handleKeyEvent}
            />
            <SubmitArea
              form={form}
              isLoading={isLoading}
              isLocked={isLocked}
              lockCountdown={lockCountdown}
              failedAttempts={failedAttempts}
            />
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pb-6 pt-2">
        <p className="text-center text-[10px] font-medium tracking-wide text-slate-300/70">
          
        </p>
      </CardFooter>
    </Card>
  )
}

/* ---------- Campos ---------- */
function DNIField({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <FormField
      control={form.control}
      name="dni"
      render={({ field }) => (
        <FormItem>
          <div className="mb-1 flex items-center justify-between">
            <FormLabel className="text-[11px] font-medium uppercase tracking-wide text-slate-200">
              DNI
            </FormLabel>
            {form.formState.errors.dni && (
              <span className="text-[10px] font-medium text-rose-300">
                {form.formState.errors.dni.message}
              </span>
            )}
          </div>
          <FormControl>
            <div className="group relative">
              <Input
                inputMode="numeric"
                autoComplete="username"
                maxLength={8}
                placeholder="00000000"
                {...field}
                onKeyUp={(e) => {
                  const clean = e.currentTarget.value.replace(/\D/g, "")
                  field.onChange(clean)
                }}
                className="peer h-11 rounded-xl border border-white/10 bg-white/10 px-3 pr-11 font-medium tracking-wider text-slate-50 placeholder:text-slate-400/50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/40"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 transition peer-focus:text-cyan-300">
                <Shield className="h-4 w-4" />
              </span>
              <span className="pointer-events-none absolute -bottom-px left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 transition-all duration-500 peer-focus:w-[92%]" />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function PasswordField({
  form,
  showPassword,
  setShowPassword,
  capsLock,
  handleKeyEvent
}: {
  form: ReturnType<typeof useForm<FormValues>>
  showPassword: boolean
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
  capsLock: boolean
  handleKeyEvent: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <FormField
      control={form.control}
      name="password"
      render={({ field }) => (
        <FormItem>
          <div className="mb-1 flex items-center justify-between">
            <FormLabel className="text-[11px] font-medium uppercase tracking-wide text-slate-200">
              Contraseña
            </FormLabel>
            {capsLock && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300">
                <Lock className="h-3.5 w-3.5" /> Caps
              </span>
            )}
          </div>
          <FormControl>
            <div className="group relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                {...field}
                onKeyDown={handleKeyEvent}
                onKeyUp={handleKeyEvent}
                className="peer h-11 rounded-xl border border-white/10 bg-white/10 px-3 pr-11 font-medium tracking-wide text-slate-50 placeholder:text-slate-400/50 outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-2 flex items-center rounded-md p-1 text-slate-400 transition hover:text-fuchsia-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/40"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <span className="pointer-events-none absolute -bottom-px left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-pink-500 transition-all duration-500 peer-focus:w-[92%]" />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function SubmitArea({
  form,
  isLoading,
  isLocked,
  lockCountdown,
  failedAttempts
}: {
  form: ReturnType<typeof useForm<FormValues>>
  isLoading: boolean
  isLocked: boolean
  lockCountdown: number | null
  failedAttempts: number
}) {
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <Button
        type="submit"
        disabled={isLoading || isLocked || !form.formState.isValid}
        className="group relative h-11 w-full overflow-hidden rounded-xl bg-[linear-gradient(95deg,#7E22CE_0%,#6366F1_30%,#0EA5E9_60%,#06B6D4_90%)] bg-[length:200%_200%] text-sm font-semibold tracking-wide text-white shadow-[0_8px_20px_-6px_rgba(109,40,217,0.55)] transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 animate-[gradientMove_11s_linear_infinite]"
      >
        <span className="relative flex items-center justify-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLocked ? `Bloqueado (${lockCountdown}s)` : isLoading ? "Verificando..." : "Entrar"}
        </span>
        <span className="pointer-events-none absolute inset-0 translate-x-[-60%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition duration-700 group-hover:translate-x-[125%] group-hover:opacity-70" />
        <style jsx>{`
          @keyframes gradientMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
      </Button>
      {failedAttempts > 0 && failedAttempts < MAX_ATTEMPTS && (
        <p className="text-center text-[11px] font-medium text-amber-300">
          Intentos fallidos: {failedAttempts}/{MAX_ATTEMPTS}
        </p>
      )}
      {isLocked && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-rose-400/60 bg-rose-500/15 px-3 py-2 text-center text-[11px] font-medium text-rose-200 shadow-[0_0_0_1px_rgba(244,63,94,0.35),0_0_14px_-2px_rgba(244,63,94,0.55)]"
        >
          Bloqueo temporal. Reintenta en {lockCountdown}s.
        </motion.div>
      )}
    </div>
  )
}