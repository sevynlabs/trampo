import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
// Rounded heavy face for the TRAMPO wordmark
const nunito = Nunito({ subsets: ["latin"], weight: ["800", "900"], variable: "--font-brand" });

export const metadata: Metadata = {
  title: "Trampo Admin",
  description: "Painel administrativo Trampo — serviços sob demanda",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={nunito.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
