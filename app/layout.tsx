import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "./theme-tokens.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeDesignProvider } from "@/lib/theme-design/provider"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Boticas Said",
  description: "Sistema de gestión",
  icons: { icon: "/icono-said.png" }
}

// (Opcional) Script anti-flash de variables personalizadas (ya te lo pasé antes).
function DesignNoFlashScript() {
  const code = `
    try {
      const raw = localStorage.getItem("ui:design:v1");
      if (raw) {
        const t = JSON.parse(raw);
        const accent = t.accent || "#6366F1";
        const accentAlt = t.accentAlt || "#06B6D4";
        const grad = (() => {
          switch (t.gradientStyle) {
            case "vibrant": return \`linear-gradient(135deg,\${accent} 0%,\${accentAlt} 50%,\${accent} 100%)\`;
            case "radial": return \`radial-gradient(circle at 30% 30%,\${accent} 0%,\${accentAlt} 70%,transparent 100%)\`;
            case "aurora": return \`linear-gradient(120deg,\${accent} 0%,\${accent}66 30%,\${accentAlt}cc 60%,\${accentAlt} 100%)\`;
            case "mesh": return \`radial-gradient(circle at 20% 30%,\${accent} 0%,transparent 60%),radial-gradient(circle at 80% 70%,\${accentAlt} 0%,transparent 55%),linear-gradient(135deg,\${accent}20,\${accentAlt}10)\`;
            default: return \`linear-gradient(135deg,\${accent} 0%,\${accentAlt} 100%)\`;
          }
        })();
        const root = document.documentElement;
        root.style.setProperty("--accent", accent);
        root.style.setProperty("--accent-alt", accentAlt);
        root.style.setProperty("--gradient-accent", grad);
        if (typeof t.radiusScale === "number") {
          const base = 10;
          const radius = Math.round(base * t.radiusScale) + "px";
          root.style.setProperty("--radius-base", radius);
        }
        if (typeof t.glass === "number") {
          root.style.setProperty("--glass-alpha", String(Math.min(Math.max(t.glass,0),1)));
        }
      }
    } catch {}
  `
  return <script dangerouslySetInnerHTML={{ __html: code }} suppressHydrationWarning />
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <DesignNoFlashScript />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <ThemeDesignProvider>
              {children}
              <Toaster />
            </ThemeDesignProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}