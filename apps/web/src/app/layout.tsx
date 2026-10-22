import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coquimbo Avisos",
  description:
    "Reporta y revisa incidentes y obras en tu comuna de la Región de Coquimbo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
