import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const geist = Geist({ subsets: ["latin"] });

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
    <html lang="pt-BR" className={`${geist.className} h-full`}>
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
