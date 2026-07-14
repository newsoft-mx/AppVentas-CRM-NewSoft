import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "NewSoft Sales",
    template: "%s | NewSoft Sales",
  },
  description: "Sistema interno de gestión de ventas — NewSoft",
  // El favicon lo aporta app/icon.png (convención de Next: se sirve en /icon con
  // hash de contenido → cache-bust y <link> canónico, sin apuntar a /public a mano).
  // PNG (no JPG) para conservar la transparencia del hexágono: sin recuadro de fondo.
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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
