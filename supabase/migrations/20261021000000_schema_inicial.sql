-- =====================================================================
-- Modelo de base de datos - App de reportes y obras regionales (MVP)
-- Motor: PostgreSQL 14+ con PostGIS
-- Diseñado para expandirse región a región.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE rol_usuario        AS ENUM ('ciudadano', 'moderador', 'admin');
CREATE TYPE estado_reporte     AS ENUM ('recibido', 'en_revision', 'derivado', 'resuelto', 'rechazado');
CREATE TYPE estado_obra        AS ENUM ('programada', 'en_curso', 'finalizada', 'cancelada');
CREATE TYPE tipo_categoria     AS ENUM ('reporte', 'obra');
CREATE TYPE tipo_entidad       AS ENUM ('municipalidad', 'gobierno_regional', 'ministerio', 'sanitaria', 'electrica', 'otra');
CREATE TYPE plataforma_disp    AS ENUM ('android', 'ios', 'web');
CREATE TYPE tipo_notificacion  AS ENUM ('nuevo_reporte_zona', 'cambio_estado_reporte', 'nueva_obra_zona', 'cambio_estado_obra', 'comentario');

-- ---------------------------------------------------------------------
-- Función genérica para mantener actualizado_en
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_actualizado_en() RETURNS trigger AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1. TERRITORIO (soporta expansión a otras regiones)
-- =====================================================================
CREATE TABLE regiones (
    id      SMALLINT PRIMARY KEY,
    codigo  VARCHAR(2)   NOT NULL UNIQUE,          -- código CUT, ej. '04'
    nombre  VARCHAR(80)  NOT NULL,
    activa  BOOLEAN      NOT NULL DEFAULT FALSE    -- región habilitada en la app
);

CREATE TABLE provincias (
    id         SMALLINT PRIMARY KEY,
    region_id  SMALLINT    NOT NULL REFERENCES regiones(id),
    codigo     VARCHAR(3)  NOT NULL UNIQUE,
    nombre     VARCHAR(80) NOT NULL
);
CREATE INDEX idx_provincias_region ON provincias(region_id);

CREATE TABLE comunas (
    id            SMALLINT PRIMARY KEY,
    provincia_id  SMALLINT    NOT NULL REFERENCES provincias(id),
    codigo        VARCHAR(5)  NOT NULL UNIQUE,     -- código CUT, ej. '04101'
    nombre        VARCHAR(80) NOT NULL,
    limites       geography(MultiPolygon, 4326),   -- opcional, para validar ubicación
    activa        BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_comunas_provincia ON comunas(provincia_id);
CREATE INDEX idx_comunas_limites   ON comunas USING GIST (limites);

-- =====================================================================
-- 2. USUARIOS
-- =====================================================================
CREATE TABLE usuarios (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                  CITEXT      NOT NULL UNIQUE,
    password_hash          TEXT        NOT NULL,
    nombre                 VARCHAR(100) NOT NULL,
    comuna_id              SMALLINT    REFERENCES comunas(id),
    rol                    rol_usuario NOT NULL DEFAULT 'ciudadano',
    activo                 BOOLEAN     NOT NULL DEFAULT TRUE,
    -- Cumplimiento Ley 21.719 (datos personales): evidencia de consentimiento
    acepto_terminos_en     TIMESTAMPTZ NOT NULL,
    version_terminos       VARCHAR(20) NOT NULL,
    version_privacidad     VARCHAR(20) NOT NULL,
    creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_acceso_en       TIMESTAMPTZ,
    eliminado_en           TIMESTAMPTZ                -- borrado lógico (derecho de supresión)
);
CREATE INDEX idx_usuarios_comuna ON usuarios(comuna_id);
CREATE TRIGGER trg_usuarios_actualizado BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE TABLE dispositivos (
    id           BIGSERIAL PRIMARY KEY,
    usuario_id   UUID             NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_push   TEXT             NOT NULL UNIQUE,
    plataforma   plataforma_disp  NOT NULL,
    creado_en    TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispositivos_usuario ON dispositivos(usuario_id);

-- =====================================================================
-- 3. CATÁLOGOS
-- =====================================================================
CREATE TABLE categorias (
    id      SMALLSERIAL PRIMARY KEY,
    tipo    tipo_categoria NOT NULL,
    codigo  VARCHAR(40)    NOT NULL,
    nombre  VARCHAR(80)    NOT NULL,
    icono   VARCHAR(40),
    activa  BOOLEAN        NOT NULL DEFAULT TRUE,
    UNIQUE (tipo, codigo)
);

-- Organismos responsables de las obras (municipios, MOP, sanitarias, etc.)
CREATE TABLE entidades (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(120)  NOT NULL,
    tipo        tipo_entidad  NOT NULL,
    comuna_id   SMALLINT      REFERENCES comunas(id),   -- NULL si es regional/nacional
    sitio_web   TEXT,
    email_contacto CITEXT,
    UNIQUE (nombre, comuna_id)
);

-- =====================================================================
-- 4. REPORTES CIUDADANOS
-- =====================================================================
CREATE TABLE reportes (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id           UUID           REFERENCES usuarios(id) ON DELETE SET NULL,
    categoria_id         SMALLINT       NOT NULL REFERENCES categorias(id),
    comuna_id            SMALLINT       NOT NULL REFERENCES comunas(id),
    titulo               VARCHAR(140)   NOT NULL,
    descripcion          TEXT,
    ubicacion            geography(Point, 4326) NOT NULL,
    direccion_referencia VARCHAR(200),
    estado               estado_reporte NOT NULL DEFAULT 'recibido',
    es_anonimo           BOOLEAN        NOT NULL DEFAULT FALSE,   -- no se muestra el autor al público
    entidad_asignada_id  INT            REFERENCES entidades(id),
    creado_en            TIMESTAMPTZ    NOT NULL DEFAULT now(),
    actualizado_en       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    resuelto_en          TIMESTAMPTZ,
    CHECK (resuelto_en IS NULL OR estado = 'resuelto')
);
CREATE INDEX idx_reportes_ubicacion ON reportes USING GIST (ubicacion);
CREATE INDEX idx_reportes_comuna_estado_fecha ON reportes(comuna_id, estado, creado_en DESC);
CREATE INDEX idx_reportes_categoria ON reportes(categoria_id);
CREATE INDEX idx_reportes_usuario   ON reportes(usuario_id);
CREATE TRIGGER trg_reportes_actualizado BEFORE UPDATE ON reportes
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE TABLE reporte_fotos (
    id          BIGSERIAL PRIMARY KEY,
    reporte_id  UUID        NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    url         TEXT        NOT NULL,
    orden       SMALLINT    NOT NULL DEFAULT 1,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reporte_fotos_reporte ON reporte_fotos(reporte_id);

-- "A mí también me afecta": evita reportes duplicados y mide prioridad
CREATE TABLE reporte_apoyos (
    reporte_id  UUID        NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    usuario_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (reporte_id, usuario_id)
);
CREATE INDEX idx_reporte_apoyos_usuario ON reporte_apoyos(usuario_id);

-- Línea de tiempo del estado de cada reporte (transparencia hacia el ciudadano)
CREATE TABLE reporte_historial (
    id               BIGSERIAL PRIMARY KEY,
    reporte_id       UUID           NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    estado_anterior  estado_reporte,
    estado_nuevo     estado_reporte NOT NULL,
    cambiado_por     UUID           REFERENCES usuarios(id) ON DELETE SET NULL,
    nota             TEXT,
    creado_en        TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_reporte_historial_reporte ON reporte_historial(reporte_id, creado_en);

CREATE TABLE comentarios (
    id          BIGSERIAL PRIMARY KEY,
    reporte_id  UUID        NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    usuario_id  UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
    contenido   TEXT        NOT NULL CHECK (length(contenido) BETWEEN 1 AND 1000),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comentarios_reporte ON comentarios(reporte_id, creado_en);

-- =====================================================================
-- 5. OBRAS Y ARREGLOS (programados o en curso)
-- =====================================================================
CREATE TABLE obras (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad_id       INT          REFERENCES entidades(id),
    categoria_id     SMALLINT     NOT NULL REFERENCES categorias(id),
    comuna_id        SMALLINT     NOT NULL REFERENCES comunas(id),
    titulo           VARCHAR(160) NOT NULL,
    descripcion      TEXT,
    ubicacion        geography(Geometry, 4326) NOT NULL,   -- punto, línea (calle) o polígono (sector)
    direccion_referencia VARCHAR(200),
    estado           estado_obra  NOT NULL DEFAULT 'programada',
    fecha_inicio     DATE         NOT NULL,
    fecha_fin        DATE,
    afecta_transito  BOOLEAN      NOT NULL DEFAULT FALSE,
    fuente_url       TEXT,                                  -- de dónde salió la información oficial
    creado_por       UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_obras_ubicacion ON obras USING GIST (ubicacion);
CREATE INDEX idx_obras_comuna_estado_inicio ON obras(comuna_id, estado, fecha_inicio);
CREATE INDEX idx_obras_categoria ON obras(categoria_id);
CREATE TRIGGER trg_obras_actualizado BEFORE UPDATE ON obras
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- =====================================================================
-- 6. SUSCRIPCIONES Y NOTIFICACIONES
-- =====================================================================
-- Qué zonas y categorías quiere seguir cada usuario
CREATE TABLE suscripciones (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    UUID      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    comuna_id     SMALLINT  NOT NULL REFERENCES comunas(id),
    categoria_id  SMALLINT  REFERENCES categorias(id),      -- NULL = todas las categorías
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_suscripciones
    ON suscripciones (usuario_id, comuna_id, COALESCE(categoria_id, 0));

CREATE TABLE notificaciones (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  UUID               NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo        tipo_notificacion  NOT NULL,
    titulo      VARCHAR(140)       NOT NULL,
    cuerpo      TEXT,
    reporte_id  UUID               REFERENCES reportes(id) ON DELETE CASCADE,
    obra_id     UUID               REFERENCES obras(id) ON DELETE CASCADE,
    leida       BOOLEAN            NOT NULL DEFAULT FALSE,
    creado_en   TIMESTAMPTZ        NOT NULL DEFAULT now(),
    enviada_en  TIMESTAMPTZ,
    CHECK (reporte_id IS NOT NULL OR obra_id IS NOT NULL)
);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, leida, creado_en DESC);

-- =====================================================================
-- 7. VISTAS ÚTILES
-- =====================================================================
-- Obras vigentes hoy o que empiezan pronto (para el mapa principal)
CREATE VIEW v_obras_vigentes AS
SELECT *
FROM obras
WHERE estado IN ('programada', 'en_curso')
  AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE);

-- Reportes públicos: no expone al autor si es anónimo
CREATE VIEW v_reportes_publicos AS
SELECT r.id, r.categoria_id, r.comuna_id, r.titulo, r.descripcion,
       r.ubicacion, r.direccion_referencia, r.estado,
       r.creado_en, r.resuelto_en,
       CASE WHEN r.es_anonimo THEN NULL ELSE r.usuario_id END AS usuario_id,
       (SELECT count(*) FROM reporte_apoyos a WHERE a.reporte_id = r.id) AS apoyos
FROM reportes r
WHERE r.estado <> 'rechazado';

-- =====================================================================
-- 8. DATOS INICIALES
-- =====================================================================
-- Región de Coquimbo (CUT 04): 3 provincias y 15 comunas
INSERT INTO regiones (id, codigo, nombre, activa) VALUES (4, '04', 'Coquimbo', TRUE);

INSERT INTO provincias (id, region_id, codigo, nombre) VALUES
    (41, 4, '041', 'Elqui'),
    (42, 4, '042', 'Choapa'),
    (43, 4, '043', 'Limarí');

-- Solo La Serena activa al inicio (validación en una comuna piloto)
INSERT INTO comunas (id, provincia_id, codigo, nombre, activa) VALUES
    (4101, 41, '04101', 'La Serena',    TRUE),
    (4102, 41, '04102', 'Coquimbo',     FALSE),
    (4103, 41, '04103', 'Andacollo',    FALSE),
    (4104, 41, '04104', 'La Higuera',   FALSE),
    (4105, 41, '04105', 'Paihuano',     FALSE),
    (4106, 41, '04106', 'Vicuña',       FALSE),
    (4201, 42, '04201', 'Illapel',      FALSE),
    (4202, 42, '04202', 'Canela',       FALSE),
    (4203, 42, '04203', 'Los Vilos',    FALSE),
    (4204, 42, '04204', 'Salamanca',    FALSE),
    (4301, 43, '04301', 'Ovalle',       FALSE),
    (4302, 43, '04302', 'Combarbalá',   FALSE),
    (4303, 43, '04303', 'Monte Patria', FALSE),
    (4304, 43, '04304', 'Punitaqui',    FALSE),
    (4305, 43, '04305', 'Río Hurtado',  FALSE);

INSERT INTO categorias (tipo, codigo, nombre, icono) VALUES
    ('reporte', 'bache',           'Bache o calzada dañada',     'road'),
    ('reporte', 'luminaria',       'Luminaria apagada',          'lightbulb'),
    ('reporte', 'basura',          'Basura o microbasural',      'trash'),
    ('reporte', 'semaforo',        'Semáforo o señalética',      'traffic-light'),
    ('reporte', 'agua_alcantarillado', 'Filtración o alcantarillado', 'droplet'),
    ('reporte', 'area_verde',      'Plaza o área verde dañada',  'tree'),
    ('reporte', 'vehiculo_abandonado', 'Vehículo abandonado',    'car'),
    ('reporte', 'otro',            'Otro problema urbano',       'alert'),
    ('obra',    'pavimentacion',   'Pavimentación o repavimentación', 'road'),
    ('obra',    'corte_agua',      'Corte de agua programado',   'droplet'),
    ('obra',    'corte_luz',       'Corte de luz programado',    'zap'),
    ('obra',    'corte_calle',     'Corte o desvío de calle',    'construction'),
    ('obra',    'alumbrado',       'Instalación de alumbrado',   'lightbulb'),
    ('obra',    'infraestructura', 'Obra de infraestructura',    'hammer'),
    ('obra',    'otro',            'Otra obra',                  'tool');
