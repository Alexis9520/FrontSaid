"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import Image from "next/image"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import type { Variants } from "framer-motion"
import {
  Github,
  Linkedin,
  Mail,
  Globe,
  Sparkles,
  User,
  Cpu,
  Layers,
  Stars,
  Orbit,
  MousePointerClick,
  Building2,
  Target,
  Lightbulb,
  ShieldCheck,
  ArrowUpRight,
  Search
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*                                   DATA                                     */
/* -------------------------------------------------------------------------- */
// Avatares (ideal: servir desde /public para mejores headers)
const avatarByRole: Record<string, string> = {
  "Full Stack Developer":
    "https://avatars.githubusercontent.com/u/106501453?v=4",
  "Frontend Developer":
    "https://i.pinimg.com/736x/1f/7c/21/1f7c216f53bf523ba7fe3b80f92c816c.jpg"
}

const glowByRole: Record<string, string> = {
  "Full Stack Developer": "from-fuchsia-700/70 via-indigo-600/70 to-sky-500/50",
  "Frontend Developer": "from-sky-700/80 via-cyan-500/70 to-emerald-400/50"
}

const iconByRole: Record<string, React.ReactNode> = {
  "Full Stack Developer": <Sparkles className="w-5 h-5 text-fuchsia-300 drop-shadow" />,
  "Frontend Developer": <User className="w-5 h-5 text-yellow-300 drop-shadow" />
}

interface Dev {
  nombre: string
  rol: string
  bio: string
  avatar: string
  github?: string
  linkedin?: string
  email?: string
  web?: string
  stack: string[]
}

const developers: Dev[] = [
  {
    nombre: "Miguel Castillo",
    rol: "Full Stack Developer",
    bio: "Arquitecta y construye soluciones empresariales altamente escalables con Java y Spring Boot. Domina integración de APIs, optimización de rendimiento y despliegues productivos resilientes.",
    avatar: avatarByRole["Full Stack Developer"],
    github: "https://github.com/LoP-1",
    linkedin: "https://www.linkedin.com/in/miguel-castillo-v/",
    email: "miguel.castillo.valero@gmail.com",
    web: "",
    stack: ["Java", "Spring Boot", "API REST", "MySQL", "Git", "VPS"]
  },
  {
    nombre: "Alexis Romani",
    rol: "Frontend Developer",
    bio: "Diseña experiencias inmersivas con React, TypeScript y Angular. Enfocado en accesibilidad, micro‑interacciones y rendimiento real en dispositivos variados.",
    avatar: avatarByRole["Frontend Developer"],
    github: "https://github.com/Alexis9520",
    linkedin: "https://www.linkedin.com/in/alexis-roman%C3%AD-maravi-0a51a9211/",
    email: "alexisdasiel@gmail.com",
    web: "",
    stack: ["React", "TypeScript", "HTML", "JavaScript", "Angular", "CSS"]
  }
]

/* -------------------------------------------------------------------------- */
/*                              ANIMATIONS / VARS                             */
/* -------------------------------------------------------------------------- */
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 56, scale: 0.9, filter: "blur(8px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      delay: i * 0.15,
      duration: 0.75,
      type: "spring",
      bounce: 0.35
    }
  })
}

const chipVariants: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.9 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.2 + i * 0.05, type: "spring", stiffness: 240 }
  })
}

/* -------------------------------------------------------------------------- */
/*                               PARALLAX HOOK                                */
/* -------------------------------------------------------------------------- */
function useParallax(intensity = 30) {
  const ref = useRef<HTMLDivElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rx = useSpring(useTransform(y, [-1, 1], [intensity, -intensity]), { stiffness: 100, damping: 20 })
  const ry = useSpring(useTransform(x, [-1, 1], [-intensity, intensity]), { stiffness: 100, damping: 20 })

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    x.set(px * 2 - 1)
    y.set(py * 2 - 1)
  }, [x, y])

  const reset = useCallback(() => {
    x.set(0)
    y.set(0)
  }, [x, y])

  return { ref, rx, ry, onPointerMove, reset }
}

/* -------------------------------------------------------------------------- */
/*                              GRADIENT MESH BG                              */
/* -------------------------------------------------------------------------- */
function FuturisticBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Radial gradient clusters */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--primary)/0.22),transparent_65%),radial-gradient(circle_at_80%_70%,hsl(var(--secondary)/0.18),transparent_60%)]" />
      {/* Animated color blobs */}
      <div className="motion-reduce:hidden">
        <div className="absolute -top-40 -left-44 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-fuchsia-600/35 via-indigo-600/25 to-cyan-500/30 blur-3xl animate-pulse" />
        <div className="absolute -bottom-44 -right-40 h-[560px] w-[560px] rounded-full bg-gradient-to-tr from-sky-500/25 via-purple-600/25 to-transparent blur-[110px] animate-[pulse_9s_ease-in-out_infinite]" />
      </div>
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:42px_42px]" />
      {/* Noise */}
      <div className="absolute inset-0 mix-blend-overlay opacity-[0.08] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 viewBox=%220 0 120 120%22><filter id=%22n%22 x=%220%22 y=%220%22 width=%22100%25%22 height=%22100%25%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%22.75%22/></svg>')]" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  ABOUT                                      */
/* -------------------------------------------------------------------------- */
function AboutSection() {
  return (
    <section className="mt-10">
      <Card className="relative overflow-hidden border-border/60 backdrop-blur-xl bg-gradient-to-br from-background/80 via-background/60 to-background/40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,hsl(var(--primary)/0.15),transparent_60%),radial-gradient(circle_at_80%_70%,hsl(var(--secondary)/0.15),transparent_55%)]" />
        </div>
        <CardHeader className="relative">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-primary">
                <Building2 className="h-4 w-4" />
                Quiénes Somos
              </div>
              <CardTitle className="text-2xl">Sobre Quantum Tech</CardTitle>
              <CardDescription className="max-w-3xl">
                Somos una empresa de desarrollo de software especializada en crear soluciones tecnológicas a medida que impulsan la transformación digital. Con más de 5 años de experiencia, ayudamos a compañías de distintos sectores a optimizar procesos, mejorar su eficiencia y alcanzar sus objetivos. Unimos excelencia técnica y entendimiento de negocio para entregar resultados medibles.
              </CardDescription>
            </div>
            <Button
              asChild
              className="group bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-lg hover:opacity-95"
            >
              <a
                href="https://quantify.net.pe"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Conoce más en quantify.net.pe"
              >
                Conoce más
                <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 -translate-y-0.5" />
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <AboutItem
              icon={<Target className="h-5 w-5" />}
              title="Enfoque en Resultados"
              desc="Entregamos soluciones que generan valor real para tu negocio."
            />
            <AboutItem
              icon={<User className="h-5 w-5" />}
              title="Equipo Experto"
              desc="Profesionales certificados con experiencia en tecnologías de vanguardia."
            />
            <AboutItem
              icon={<Lightbulb className="h-5 w-5" />}
              title="Innovación Constante"
              desc="Adoptamos lo último para mantenerte a la vanguardia."
            />
            <AboutItem
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Calidad Garantizada"
              desc="Testing riguroso y QA para software de alta calidad."
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function AboutItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 backdrop-blur p-4 hover:border-primary/40 transition-colors">
      <div className="flex items-center gap-2 text-primary mb-1.5 font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                               DEV CARD                                      */
/* -------------------------------------------------------------------------- */
function DevCard({ dev, index }: { dev: Dev; index: number }) {
  const { ref, rx, ry, onPointerMove, reset } = useParallax(12)
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0% 0% -10% 0%" }}
      variants={cardVariants}
      className="relative group"
    >
      <motion.div
        ref={ref}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        className="will-change-transform"
      >
        <Card
          className={cn(
            "relative overflow-hidden rounded-3xl border border-white/5 backdrop-blur-xl",
            "bg-gradient-to-br dark:to-slate-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_40px_-8px_rgba(0,0,0,0.5)]",
            glowByRole[dev.rol],
            "transition-all duration-500 group-hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_25px_60px_-5px_hsl(var(--primary)/0.35)]"
          )}
        >
          {/* Soft inner gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.15),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.12),transparent_60%)] pointer-events-none" />
          {/* Edge highlight */}
          <div className="absolute inset-0 rounded-3xl ring-1 ring-white/10" />

          <CardHeader className="relative pt-10 pb-4 flex flex-col items-center">
            {/* Role badge */}
            <motion.span
              className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full px-5 py-1.5 text-[10px] font-bold tracking-widest text-white shadow-2xl uppercase border border-white/20 backdrop-blur-md bg-gradient-to-r from-white/10 via-white/5 to-white/10"
              initial={{ scale: 0, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 + index * 0.06 }}
            >
              <span className="flex items-center gap-2">
                {iconByRole[dev.rol]}
                <span className="drop-shadow-sm">{dev.rol}</span>
              </span>
            </motion.span>

            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.85, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 120, delay: 0.25 + index * 0.07 }}
              className="relative w-32 h-32 rounded-full overflow-hidden ring-4 ring-white/20 shadow-2xl bg-black/40"
              style={{ transformStyle: "preserve-3d" }}
            >
              <Image
                src={dev.avatar}
                fill
                alt={dev.nombre}
                className="object-cover"
                sizes="128px"
                priority={index < 2}
              />
              {/* Animated ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/30"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 26, ease: "linear" }}
                style={{ mixBlendMode: "overlay" }}
              />
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-white/20 to-transparent opacity-30 mix-blend-overlay" />
            </motion.div>

            <CardTitle className="text-center text-xl font-semibold mt-4 leading-tight tracking-wide">
              {dev.nombre}
            </CardTitle>
            <CardDescription className="text-xs uppercase tracking-[0.2em] text-white/60">
              Quantum Tech
            </CardDescription>
          </CardHeader>

          <CardContent className="relative px-5 pb-6 space-y-6">
            {/* Bio */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + index * 0.05 }}
              className={cn("text-sm leading-relaxed text-white/80", expanded ? "" : "line-clamp-4")}
            >
              {dev.bio}
            </motion.p>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[11px] uppercase tracking-wide font-semibold text-primary hover:text-primary/80 transition"
            >
              
            </button>

            {/* Tech stack */}
            <motion.ul className="flex flex-wrap gap-2" initial="initial" whileInView="animate" viewport={{ once: true }}>
              {dev.stack.map((tech, i) => (
                <motion.li key={tech} custom={i} variants={chipVariants} className="relative z-10">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium tracking-wide",
                      "bg-white/10 backdrop-blur ring-1 ring-white/10 text-white/90",
                      "transition-all hover:bg-white/20 hover:ring-white/30 hover:-translate-y-0.5 active:translate-y-0",
                      "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]"
                    )}
                  >
                    <Cpu className="w-3.5 h-3.5 opacity-70" />
                    {tech}
                  </span>
                </motion.li>
              ))}
            </motion.ul>

            {/* Links */}
            <div className="flex items-center justify-center gap-5 pt-1">
              <SocialIcon href={dev.github} label="GitHub" icon={<Github />} />
              <SocialIcon href={dev.linkedin} label="LinkedIn" icon={<Linkedin />} />
              <SocialIcon href={dev.email ? `mailto:${dev.email}` : ""} label="Email" icon={<Mail />} />
              <SocialIcon href={dev.web} label="Sitio" icon={<Globe />} />
            </div>

            {/* Hover spotlight */}
            <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--mx)_var(--my),rgba(255,255,255,0.15),transparent_55%)] [--mx:50%] [--my:50%] group-hover:animate-[pulse_8s_ease-in-out_infinite]" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             SOCIAL ICON BUTTON                              */
/* -------------------------------------------------------------------------- */
function SocialIcon({
  href,
  label,
  icon
}: {
  href?: string
  label: string
  icon: React.ReactNode
}) {
  if (!href) return null
  const external = !href.startsWith("mailto:")
  return (
    <a
      href={href}
      target={external ? "_blank" : "_self"}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={label}
      className={cn(
        "group relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl",
        "bg-white/5 ring-1 ring-white/10 backdrop-blur-md",
        "transition-all hover:scale-110 hover:ring-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      )}
    >
      <motion.span whileHover={{ rotate: -10 }} className="text-white/80 group-hover:text-white">
        {icon as any}
      </motion.span>
      <span className="absolute -bottom-2 translate-y-full opacity-0 group-hover:opacity-100 group-hover:translate-y-0 text-[8px] font-semibold tracking-widest text-primary transition">
        {label}
      </span>
      <motion.div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-30"
        aria-hidden="true"
      />
    </a>
  )
}

/* -------------------------------------------------------------------------- */
/*                              SEARCH & FILTERS                               */
/* -------------------------------------------------------------------------- */
function useDeveloperSearch(devs: Dev[]) {
  const [query, setQuery] = useState("")
  const filtered = devs.filter(d => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      d.nombre.toLowerCase().includes(q) ||
      d.rol.toLowerCase().includes(q) ||
      d.stack.some(s => s.toLowerCase().includes(q))
    )
  })
  return { query, setQuery, filtered }
}

/* -------------------------------------------------------------------------- */
/*                                MAIN EXPORT                                  */
/* -------------------------------------------------------------------------- */
export default function DesarrolladoresPage() {
  const { query, setQuery, filtered } = useDeveloperSearch(developers)
  const [layout, setLayout] = useState<"grid" | "stack">("grid")

  // Cursor-driven global spotlight
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const root = document.documentElement
      root.style.setProperty("--spot-x", e.clientX + "px")
      root.style.setProperty("--spot-y", e.clientY + "px")
    }
    window.addEventListener("pointermove", handler, { passive: true })
    return () => window.removeEventListener("pointermove", handler)
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-hidden pb-24">
      <FuturisticBackground />

      {/* Global cursor spotlight */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-40 mix-blend-screen"
        style={{
          background:
            "radial-gradient(circle at var(--spot-x,50%) var(--spot-y,50%), rgba(255,255,255,0.18), transparent 55%)"
        }}
      />

      {/* HEADER */}
      <motion.header
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="px-5 md:px-10 pt-14 max-w-7xl mx-auto"
      >
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-fuchsia-400 via-sky-400 to-indigo-600 bg-clip-text text-transparent drop-shadow-lg animate-gradient-x">
              Equipo de Desarrollo
            </h1>
            <p className="mt-4 max-w-2xl text-sm md:text-base text-white/70 leading-relaxed">
              Pasión por resolver problemas reales con arquitectura escalable, interfaces humanas y experiencias
              digitales de alta fidelidad. Conoce a las mentes que impulsan esta plataforma.
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/50" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por nombre, rol o tecnología..."
                className="pl-8 bg-white/5 text-white placeholder:text-white/50 border-white/10 focus-visible:ring-primary/50"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={layout === "grid" ? "default" : "outline"}
                onClick={() => setLayout("grid")}
                size="sm"
                className="gap-1"
              >
                <Layers className="h-4 w-4" /> Grid
              </Button>
              <Button
                variant={layout === "stack" ? "default" : "outline"}
                onClick={() => setLayout("stack")}
                size="sm"
                className="gap-1"
              >
                <Stars className="h-4 w-4" /> Stack
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-[11px] uppercase tracking-wide text-white/40">
            <span className="flex items-center gap-1">
              <Orbit className="h-3.5 w-3.5" /> Miembros:{" "}
              <span className="text-white/70 font-semibold">{developers.length}</span>
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Tecnologías totales:{" "}
              <span className="text-white/70 font-semibold">
                {Array.from(new Set(developers.flatMap(d => d.stack))).length}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <MousePointerClick className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Quiénes Somos */}
        <AboutSection />
      </motion.header>

      {/* GRID / STACK */}
      <main
        className={cn(
          "relative mt-14 px-5 md:px-10 max-w-7xl mx-auto",
          layout === "grid"
            ? "grid gap-12 md:gap-16 grid-cols-1 md:grid-cols-2"
            : "flex flex-col gap-20"
        )}
      >
        {filtered.map((dev, i) => (
          <DevCard key={dev.nombre} dev={dev} index={i} />
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-24 opacity-70 text-sm tracking-wide">
            No se encontraron perfiles que coincidan con tu búsqueda.
          </div>
        )}
      </main>

      {/* FOOTER */}
      <motion.footer
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
        className="mt-28 pb-10 text-center text-[11px] tracking-wide text-white/40"
      >
        &copy; {new Date().getFullYear()} Quantum Tech — Ingeniería & Experiencia Digital.
      </motion.footer>
    </div>
  )
}