-- =====================================================================
-- Valores nuevos para la administración de reportes. Van en su propia
-- migración porque un valor agregado con ADD VALUE no se puede usar en
-- la misma transacción (ver 20261023200100_admin_reportes.sql).
-- - archivado: fuera del mapa, del detalle y del panel de moderación;
--   restaurar lo devuelve al estado de moderación que tenía.
-- =====================================================================
ALTER TYPE public.estado_moderacion ADD VALUE 'archivado';

ALTER TYPE public.accion_historial ADD VALUE 'editar';
ALTER TYPE public.accion_historial ADD VALUE 'archivar';
ALTER TYPE public.accion_historial ADD VALUE 'restaurar';
