# Pendientes

Tareas acordadas que quedaron fuera de un cambio y no deben olvidarse.

## Reportes

- **Agregar fotos a un reporte pendiente.** Si al crear un reporte falla la
  subida de una foto, el reporte se guarda sin ella y solo se avisa al usuario
  en Mis reportes. La base ya permite subir y registrar fotos mientras el
  reporte siga pendiente (máximo 3); falta la pantalla para hacerlo.
- **Límite oficial de La Serena.** El trigger `validar_nuevo_reporte` y
  `RECTANGULO_LA_SERENA` (`apps/web/src/lib/reportes/esquemas.ts`) usan un
  rectángulo provisorio que incluye parte de Coquimbo. Cargar el polígono
  oficial en `comunas.limites` (fuente por definir) y quitar el rectángulo.
