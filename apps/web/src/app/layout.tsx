import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coquimbo Avisos",
  description:
    "Reporta y revisa incidentes y obras en tu comuna de la Región de Coquimbo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Algunos navegadores (por ejemplo, Chrome en iOS) agregan atributos a
    // <html> antes de la hidratación, y React avisaría de una diferencia
    // con el HTML del servidor. suppressHydrationWarning solo ignora los
    // atributos de esta etiqueta, no los de sus hijos: no lo uses en otros
    // elementos.
    <html lang="es-CL" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
