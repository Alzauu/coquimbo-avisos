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

## Administración

- **Crear reportes como admin.** Hoy solo se crean desde `/reportar`, a
  nombre de quien tiene la sesión y con el límite de 5 por hora. Definir si
  un admin los crea ya aprobados, sin límite y a nombre de quién.
- **Gestionar obras y cortes.** Las tablas `obras` (y la vista
  `v_obras_vigentes`) existen, pero no hay pantallas para crearlas,
  editarlas ni cerrarlas. Para cortes de luz y agua, solo avisos públicos
  cargados a mano y citando la fuente (ver CLAUDE.md).
- **Ver el registro de eliminaciones y el historial desde la app.**
  `reportes_eliminados` y `reporte_historial` solo se consultan en el SQL
  Editor; falta una vista de solo lectura para admins.
- **Archivos huérfanos en reportes vigentes.** Si una foto se subió pero no
  llegó a registrarse, su archivo queda en la carpeta del reporte. La
  política de Storage solo deja borrar archivos de reportes que ya no
  existen, así que se borra al eliminar el reporte; no hay limpieza antes.

## Fotos

- **Generar la versión mediana al subir la foto.** Hoy `/fotos/[id]?tam=m`
  la genera con sharp en cada petición, a partir de la foto completa: el
  navegador descarga ~800 px, pero la app sigue bajando de Supabase la
  completa (hasta 800 KB) y gasta CPU en Vercel. Guardarla al subir
  (`…-m.webp`) exige una migración que ajuste `puede_subir_foto_reporte`
  (hoy máximo 3 archivos por reporte y solo `<uuid>.webp`),
  `puede_registrar_foto` y `ruta_foto_publica`, además de generar las
  medianas de las fotos ya subidas. Hacerlo cuando el tráfico lo justifique.
- **Miniaturas para la lista.** La lista del mapa no muestra fotos; si se
  agregan, usar la versión mediana o una más chica.
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
