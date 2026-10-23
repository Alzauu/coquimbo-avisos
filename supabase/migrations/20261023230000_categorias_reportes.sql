-- =====================================================================
-- Categorías de reportes nuevas: Calles, Basura, Filtración o
-- alcantarillado, Áreas verdes, Vehículos, Iluminación, Veredas y Otros.
-- - Las que son la misma categoría con otro nombre se renombran en su
--   lugar: conservan su id, así que sus reportes, el historial de
--   ediciones y reportes_eliminados siguen apuntando a la categoría
--   correcta.
-- - Veredas es nueva.
-- - Semáforo se une a Calles: sus reportes pasan a Calles (queda en el
--   historial) y la categoría se desactiva. No se borra: el historial y
--   reportes_eliminados pueden citar su id.
-- - Las categorías de obras no se tocan (todo filtra tipo = 'reporte').
-- - Nombres, colores e íconos de la app: apps/web/src/lib/reportes/categorias.ts.
-- - Además, la base rechaza reportes nuevos con una categoría inactiva o
--   de obras (antes solo lo revisaba la app).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Renombrar en su lugar
-- ---------------------------------------------------------------------
UPDATE public.categorias c
SET codigo = n.codigo, nombre = n.nombre, icono = n.codigo
FROM (VALUES
    ('bache',               'calles',         'Calles'),
    ('luminaria',           'iluminacion',    'Iluminación'),
    ('basura',              'basura',         'Basura'),
    ('agua_alcantarillado', 'alcantarillado', 'Filtración o alcantarillado'),
    ('area_verde',          'areas_verdes',   'Áreas verdes'),
    ('vehiculo_abandonado', 'vehiculos',      'Vehículos'),
    ('otro',                'otros',          'Otros')
) AS n (anterior, codigo, nombre)
WHERE c.tipo = 'reporte' AND c.codigo = n.anterior;

-- ---------------------------------------------------------------------
-- 2. Nueva
-- ---------------------------------------------------------------------
INSERT INTO public.categorias (tipo, codigo, nombre, icono)
VALUES ('reporte', 'veredas', 'Veredas', 'veredas');

-- ---------------------------------------------------------------------
-- 3. Semáforo se une a Calles. Cada reporte movido queda en su historial
--    como una edición del sistema (cambiado_por NULL).
-- ---------------------------------------------------------------------
WITH ids AS (
    SELECT
        (SELECT id FROM public.categorias WHERE tipo = 'reporte' AND codigo = 'semaforo') AS semaforo,
        (SELECT id FROM public.categorias WHERE tipo = 'reporte' AND codigo = 'calles')   AS calles
),
movidos AS (
    UPDATE public.reportes r
    SET categoria_id = ids.calles
    FROM ids
    WHERE r.categoria_id = ids.semaforo
    RETURNING r.id, r.estado, r.moderacion
)
INSERT INTO public.reporte_historial (
    reporte_id, accion, estado_anterior, estado_nuevo,
    moderacion_anterior, moderacion_nueva, cambiado_por, nota, cambios
)
SELECT m.id, 'editar', m.estado, m.estado, m.moderacion, m.moderacion, NULL,
       'Cambio de categorías: Semáforo se unió a Calles.',
       jsonb_build_object('categoria_id',
           jsonb_build_object('antes', ids.semaforo, 'despues', ids.calles))
FROM movidos m, ids;

UPDATE public.categorias
SET activa = FALSE
WHERE tipo = 'reporte' AND codigo = 'semaforo';

-- ---------------------------------------------------------------------
-- 4. Comprobación: exactamente las 8 categorías activas esperadas y
--    ningún reporte en una categoría inactiva. Si algo no calza (por
--    ejemplo, un código distinto en la base), la migración se deshace.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    activas TEXT[];
BEGIN
    SELECT array_agg(codigo ORDER BY codigo) INTO activas
    FROM public.categorias
    WHERE tipo = 'reporte' AND activa;

    IF activas IS DISTINCT FROM ARRAY[
        'alcantarillado', 'areas_verdes', 'basura', 'calles',
        'iluminacion', 'otros', 'vehiculos', 'veredas'
    ]::TEXT[] THEN
        RAISE EXCEPTION 'Categorías activas inesperadas: %', activas;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.reportes r
        JOIN public.categorias c ON c.id = r.categoria_id
        WHERE c.tipo = 'reporte' AND NOT c.activa
    ) THEN
        RAISE EXCEPTION 'Quedaron reportes en una categoría inactiva.';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Reportes nuevos: solo con una categoría de reportes activa. Se
--    revisa para todas las inserciones (también service_role y el seed),
--    antes del límite de frecuencia, que solo aplica a usuarios.
--    Mismo trigger de 20261023200100_admin_reportes.sql más esta regla.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_nuevo_reporte() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    recientes INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.categorias c
        WHERE c.id = NEW.categoria_id AND c.tipo = 'reporte' AND c.activa
    ) THEN
        RAISE EXCEPTION 'Elige una categoría de la lista.'
            USING ERRCODE = 'P0001', HINT = 'categoria_invalida';
    END IF;

    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Serializa los envíos simultáneos del mismo usuario para que no
    -- pasen todos el conteo a la vez.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('reportes:' || NEW.usuario_id::text, 0)
    );

    SELECT count(*) INTO recientes
    FROM public.reportes r
    WHERE r.usuario_id = NEW.usuario_id
      AND r.creado_en > now() - interval '1 hour';

    IF recientes >= 5 THEN
        RAISE EXCEPTION 'Alcanzaste el límite de 5 reportes por hora.'
            USING ERRCODE = 'P0001', HINT = 'limite_frecuencia';
    END IF;

    IF NOT public.ubicacion_en_comuna(NEW.comuna_id, NEW.ubicacion) THEN
        RAISE EXCEPTION 'La ubicación está fuera de la comuna.'
            USING ERRCODE = 'P0001', HINT = 'fuera_de_comuna';
    END IF;

    RETURN NEW;
END;
$$;
