import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "tutarea — Gestión de proyectos para equipos ágiles",
    template: "%s — tutarea",
  },
  description:
    "La plataforma de gestión de proyectos con la velocidad de Linear, la flexibilidad de Monday, y control desde Telegram.",
  keywords: ["gestión de proyectos", "tareas", "equipo", "productividad"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "hsl(var(--surface))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--text))",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
