-- =====================================================================
-- Área afectada de cada corte de luz, para dibujarla en el mapa como en
-- el mapa de afectaciones de CGE.
-- - geometria: GeoJSON (Polygon o MultiPolygon, con sus huecos; Point si
--   CGE no publica el área).
-- - latitud y longitud siguen siendo el punto de referencia del corte (el
--   <Point> que publica CGE), con el mismo CHECK de la región: el script y
--   la base filtran con la misma regla.
-- =====================================================================

ALTER TABLE public.cortes_luz ADD COLUMN geometria JSONB;

-- Las filas cargadas antes de esta migración solo tienen el punto.
UPDATE public.cortes_luz
SET geometria = jsonb_build_object(
    'type', 'Point',
    'coordinates', jsonb_build_array(longitud, latitud)
)
WHERE geometria IS NULL;

ALTER TABLE public.cortes_luz
    ALTER COLUMN geometria SET NOT NULL,
    ADD CONSTRAINT cortes_luz_geometria_tipo CHECK (
        jsonb_typeof(geometria) = 'object'
        AND geometria ->> 'type' IN ('Point', 'Polygon', 'MultiPolygon')
    ),
    -- Unos 6000 vértices; los cortes de CGE traen menos de 300.
    ADD CONSTRAINT cortes_luz_geometria_tamano CHECK (
        pg_column_size(geometria) <= 262144
    ),
    -- PostGIS debe poder leerla (falla con coordenadas mal formadas).
    ADD CONSTRAINT cortes_luz_geometria_valida CHECK (
        extensions.st_geomfromgeojson(geometria::TEXT) IS NOT NULL
    );

-- Misma función, ahora con la geometría. Si un registro no la trae (una
-- versión anterior del script), se guarda el punto de referencia. Si una
-- geometría no es válida, falla toda la carga y quedan los datos
-- anteriores.
CREATE OR REPLACE FUNCTION public.reemplazar_cortes_luz(cortes JSONB) RETURNS INT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    insertados INT;
BEGIN
    IF cortes IS NULL OR jsonb_typeof(cortes) <> 'array' THEN
        RAISE EXCEPTION 'Se esperaba un arreglo JSON de cortes.'
            USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(cortes) > 5000 THEN
        RAISE EXCEPTION 'Demasiados cortes en una carga (máximo 5000).'
            USING ERRCODE = '22023';
    END IF;

    -- Dos cargas simultáneas se esperan una a la otra. EXCLUSIVE no
    -- bloquea las lecturas: el mapa sigue viendo los datos anteriores
    -- hasta que esta transacción termina.
    LOCK TABLE public.cortes_luz IN EXCLUSIVE MODE;

    DELETE FROM public.cortes_luz WHERE TRUE;

    INSERT INTO public.cortes_luz (nombre, descripcion, latitud, longitud, geometria)
    SELECT c.nombre,
           NULLIF(btrim(c.descripcion), ''),
           c.latitud,
           c.longitud,
           COALESCE(
               NULLIF(c.geometria, 'null'::JSONB),
               jsonb_build_object(
                   'type', 'Point',
                   'coordinates', jsonb_build_array(c.longitud, c.latitud)
               )
           )
    FROM jsonb_to_recordset(cortes) AS c(
        nombre      TEXT,
        descripcion TEXT,
        latitud     DOUBLE PRECISION,
        longitud    DOUBLE PRECISION,
        geometria   JSONB
    );

    GET DIAGNOSTICS insertados = ROW_COUNT;
    RETURN insertados;
END;
$$;

-- CREATE OR REPLACE conserva los permisos; se repiten para que queden
-- a la vista.
REVOKE EXECUTE ON FUNCTION public.reemplazar_cortes_luz(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reemplazar_cortes_luz(JSONB) TO service_role;
