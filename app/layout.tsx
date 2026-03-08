import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-serif",
});

const sans = Source_Sans_3({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Dashboard — G. Elías y Muñoz Abogados",
  description: "Panel privado de leads y conversaciones",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
