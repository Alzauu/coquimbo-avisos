-- =====================================================================
-- Cortes de luz de la Región de Coquimbo, tomados del mapa de
-- afectaciones de CGE por scripts/cge_cortes.py (cada minuto).
-- - Lectura pública: el mapa de la portada los muestra a cualquiera.
-- - Solo el script escribe, con service_role (se salta la RLS) y siempre
--   mediante reemplazar_cortes_luz: borra e inserta en una sola
--   transacción, así que nadie ve la tabla vacía ni a medio cargar, y si
--   la carga falla quedan los datos anteriores.
-- =====================================================================

CREATE TABLE public.cortes_luz (
    id          BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      TEXT             NOT NULL
                CHECK (char_length(nombre) BETWEEN 1 AND 200),
    descripcion TEXT
                CHECK (descripcion IS NULL OR char_length(descripcion) BETWEEN 1 AND 2000),
    -- Rectángulo de la Región de Coquimbo, el mismo que filtra el script.
    latitud     DOUBLE PRECISION NOT NULL CHECK (latitud BETWEEN -32.3 AND -29.0),
    longitud    DOUBLE PRECISION NOT NULL CHECK (longitud BETWEEN -72.0 AND -69.5),
    -- Momento de la carga (cuándo se vio el corte en el mapa de CGE).
    creado_en   TIMESTAMPTZ      NOT NULL DEFAULT now()
);

ALTER TABLE public.cortes_luz ENABLE ROW LEVEL SECURITY;

-- Supabase da todos los permisos por defecto a anon y authenticated: se
-- quitan y se concede solo la lectura.
REVOKE ALL ON public.cortes_luz FROM anon, authenticated;
GRANT SELECT ON public.cortes_luz TO anon, authenticated;

CREATE POLICY "cortes_luz: lectura pública" ON public.cortes_luz
    FOR SELECT TO anon, authenticated
    USING (TRUE);

-- Reemplaza todos los cortes por los de la última descarga. Recibe un
-- arreglo JSON [{nombre, descripcion, latitud, longitud}] y devuelve
-- cuántos insertó. Si una fila no cumple los CHECK, falla todo y la tabla
-- queda como estaba.
CREATE FUNCTION public.reemplazar_cortes_luz(cortes JSONB) RETURNS INT
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

    INSERT INTO public.cortes_luz (nombre, descripcion, latitud, longitud)
    SELECT c.nombre, NULLIF(btrim(c.descripcion), ''), c.latitud, c.longitud
    FROM jsonb_to_recordset(cortes) AS c(
        nombre      TEXT,
        descripcion TEXT,
        latitud     DOUBLE PRECISION,
        longitud    DOUBLE PRECISION
    );

    GET DIAGNOSTICS insertados = ROW_COUNT;
    RETURN insertados;
END;
$$;

-- Solo el script (service_role). Se ejecuta con los permisos de quien la
-- llama: anon y authenticated no podrían escribir la tabla de todos modos.
REVOKE EXECUTE ON FUNCTION public.reemplazar_cortes_luz(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reemplazar_cortes_luz(JSONB) TO service_role;
