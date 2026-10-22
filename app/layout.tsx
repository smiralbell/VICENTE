import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard — G. Elías y Muñoz Abogados",
  description: "Panel privado de leads y conversaciones",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
