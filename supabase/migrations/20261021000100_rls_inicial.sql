-- =====================================================================
-- RLS inicial: todas las tablas cerradas por defecto.
-- Solo el territorio y las categorías son de lectura pública.
-- El resto se abrirá con políticas explícitas al construir cada función.
-- =====================================================================

ALTER TABLE regiones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE provincias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE entidades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_fotos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_apoyos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras             ENABLE ROW LEVEL SECURITY;
ALTER TABLE suscripciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones    ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Lectura pública de catálogos (datos no personales)
-- ---------------------------------------------------------------------
CREATE POLICY "regiones: lectura pública" ON regiones
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "provincias: lectura pública" ON provincias
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "comunas: lectura pública" ON comunas
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "categorias: lectura pública" ON categorias
    FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------
-- Vistas: por defecto se ejecutan con los permisos de su dueño y se
-- saltan RLS. Con security_invoker respetan las políticas de quien
-- consulta; como reportes y obras aún no tienen políticas, quedan vacías
-- para anon y authenticated hasta que se diseñe su acceso.
-- ---------------------------------------------------------------------
ALTER VIEW v_obras_vigentes    SET (security_invoker = true);
ALTER VIEW v_reportes_publicos SET (security_invoker = true);
