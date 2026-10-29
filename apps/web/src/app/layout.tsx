import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

import { MARCA } from "@/lib/marca";
import { urlBaseMetadatos } from "@/lib/sitio";

// next/font descarga la fuente al compilar y la sirve desde la app: el
// navegador no pide nada a Google.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--fuente-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  // Base de las URLs absolutas de la vista previa al compartir.
  metadataBase: urlBaseMetadatos(),
  title: MARCA.nombre,
  description: MARCA.descripcion,
  openGraph: {
    siteName: MARCA.nombre,
    locale: "es_CL",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Algunos navegadores (por ejemplo, Chrome en iOS) agregan atributos a
    // <html> antes de la hidratación, y React avisaría de una diferencia
    // con el HTML del servidor. suppressHydrationWarning solo ignora los
    // atributos de esta etiqueta, no los de sus hijos: no lo uses en otros
    // elementos.
    <html
      lang="es-CL"
      className={`${figtree.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
