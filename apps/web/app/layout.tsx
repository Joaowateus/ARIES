import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
// Números (tabelas, valores, contadores) — o painel Pró-Labore usa as duas.
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Redesenho do Hoje: serifada no título e no número de destaque; Manrope no menu e no corpo do Hoje.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: "ARIES — Sistema Comercial",
  description: "Gestão comercial para concessionárias de motos",
};

// Sem isso, o Chrome no Android (e outros navegadores com "modo escuro
// forçado") tenta inverter as cores da página sozinho — o app é 100% tema
// claro, então essa "ajuda" deixa texto sobre fundo da mesma cor.
export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${geist.className} ${geist.variable} ${geistMono.variable} ${fraunces.variable} ${manrope.variable} h-full`}>
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
