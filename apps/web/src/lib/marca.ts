// Nombre e identidad de la app, en un solo lugar. El nombre comercial aún es
// provisorio: cámbialo aquí y en ningún otro archivo.

export const MARCA = {
  // Encabezados, título de las páginas y correos.
  nombre: "Coquimbo Avisos",
  // Bajo el nombre, en la portada.
  lema: "Reportes vecinales · Piloto en La Serena",
  // Metadatos (buscadores, vista previa al compartir).
  descripcion:
    "Reporta y revisa problemas de tu barrio en la Región de Coquimbo: calles, basura, luminarias y más.",
} as const;

// Título de una página: «Sección · Nombre».
export const tituloPagina = (seccion: string) => `${seccion} · ${MARCA.nombre}`;
