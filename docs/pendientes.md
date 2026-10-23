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

## Fotos

- **Tarjeta del reporte en el mapa con carrusel de fotos.** Hoy el mapa
  selecciona el reporte en la lista y las fotos solo se ven en
  `/reporte/[id]`. Usar las URLs firmadas propias (`urlFotoPublica`).
- **Miniaturas.** Se sirve la foto completa (hasta 1600 px). Generar una
  versión reducida al subir (sharp) para listas y tarjetas.
- **Difuminar caras (y patentes) en el navegador** antes de subir la foto,
  como apoyo a la moderación, que hoy solo puede ocultar la foto entera.
- **Volver a mostrar una foto oculta.** `ocultar_foto` no tiene inversa;
  hoy solo se puede revertir en el SQL Editor.

## Datos personales y lanzamiento

- **Derecho de supresión (Ley 21.719).** Flujo para que una persona borre
  su cuenta y sus datos: perfil, fotos en Storage y reportes (o
  anonimizarlos). Hoy borrar el usuario en Auth deja sus fotos en el
  bucket y sus reportes con `usuario_id` NULL.
- **SMTP propio antes del lanzamiento.** El SMTP por defecto de Supabase
  tiene límites muy bajos y no es para producción (correos de ingreso).
