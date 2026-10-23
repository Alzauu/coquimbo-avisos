-- =====================================================================
-- Rechazo por moderación: el reporte no se publica nunca.
-- Distinto de estado_reporte 'rechazado' (estado del problema) y de
-- 'oculto' (retirado después de publicarse).
-- Va en su propia migración: un valor nuevo de un enum no se puede usar
-- en la misma transacción en que se agrega.
-- =====================================================================

ALTER TYPE public.estado_moderacion ADD VALUE 'rechazado';
