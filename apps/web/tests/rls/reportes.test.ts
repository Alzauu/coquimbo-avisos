import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Consulta el proyecto remoto con la clave anon, como cualquier visitante.
// El cliente va sin tipos a propósito: pide columnas prohibidas tal como
// lo haría alguien que no usa la app.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en apps/web/.env.local.",
  );
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Ids fijos de supabase/seed.sql.
const idSeed = (n: number) =>
  `5eed0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const APROBADOS = Array.from({ length: 13 }, (_, i) => idSeed(i + 1));
const NO_PUBLICOS = Array.from({ length: 5 }, (_, i) => idSeed(i + 14));
const TODOS = [...APROBADOS, ...NO_PUBLICOS];

const ZONA_LA_SERENA = {
  oeste: -71.35,
  sur: -30.0,
  este: -71.15,
  norte: -29.8,
};

const PERMISO_DENEGADO = "42501";

function idsDeSeed(filas: { id: string }[] | null) {
  return (filas ?? [])
    .map((fila) => fila.id)
    .filter((id) => TODOS.includes(id))
    .sort();
}

describe("tabla reportes como anon", () => {
  it.each(["usuario_id", "es_anonimo", "entidad_asignada_id", "moderacion"])(
    "no puede leer %s",
    async (columna) => {
      const { data, error } = await anon
        .from("reportes")
        .select(columna)
        .limit(1);
      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISO_DENEGADO);
    },
  );

  it("no puede pedir todas las columnas", async () => {
    const { error } = await anon.from("reportes").select("*").limit(1);
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("ve los aprobados y no los pendientes ni el oculto", async () => {
    const { data, error } = await anon
      .from("reportes")
      .select("id")
      .in("id", TODOS);
    expect(error).toBeNull();
    expect(idsDeSeed(data)).toEqual([...APROBADOS].sort());
  });

  it("no puede crear, editar ni borrar", async () => {
    const insertar = await anon.from("reportes").insert({ titulo: "x" });
    const editar = await anon
      .from("reportes")
      .update({ titulo: "x" })
      .eq("id", APROBADOS[0]);
    const borrar = await anon.from("reportes").delete().eq("id", APROBADOS[0]);

    expect(insertar.error?.code).toBe(PERMISO_DENEGADO);
    expect(editar.error?.code).toBe(PERMISO_DENEGADO);
    expect(borrar.error?.code).toBe(PERMISO_DENEGADO);
  });
});

describe("vista v_reportes_publicos como anon", () => {
  it("expone solo columnas seguras, con coordenadas numéricas", async () => {
    const { data, error } = await anon
      .from("v_reportes_publicos")
      .select("*")
      .eq("id", APROBADOS[0])
      .single();
    expect(error).toBeNull();
    expect(Object.keys(data ?? {}).sort()).toEqual([
      "categoria_id",
      "comuna_id",
      "creado_en",
      "descripcion",
      "direccion_referencia",
      "estado",
      "id",
      "latitud",
      "longitud",
      "resuelto_en",
      "titulo",
      "ubicacion",
    ]);
    expect(typeof data?.latitud).toBe("number");
    expect(typeof data?.longitud).toBe("number");
  });

  it("no tiene columna usuario_id", async () => {
    const { data, error } = await anon
      .from("v_reportes_publicos")
      .select("usuario_id")
      .limit(1);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("muestra los aprobados y no los pendientes ni el oculto", async () => {
    const { data, error } = await anon
      .from("v_reportes_publicos")
      .select("id")
      .in("id", TODOS);
    expect(error).toBeNull();
    expect(idsDeSeed(data)).toEqual([...APROBADOS].sort());
  });

  it("es de solo lectura", async () => {
    const insertar = await anon
      .from("v_reportes_publicos")
      .insert({ titulo: "x" });
    const editar = await anon
      .from("v_reportes_publicos")
      .update({ titulo: "x" })
      .eq("id", APROBADOS[0]);
    const borrar = await anon
      .from("v_reportes_publicos")
      .delete()
      .eq("id", APROBADOS[0]);

    expect(insertar.error?.code).toBe(PERMISO_DENEGADO);
    expect(editar.error?.code).toBe(PERMISO_DENEGADO);
    expect(borrar.error?.code).toBe(PERMISO_DENEGADO);
  });
});

describe("función reportes_en_zona como anon", () => {
  it("devuelve los aprobados de La Serena y no los demás", async () => {
    const { data, error } = await anon.rpc("reportes_en_zona", ZONA_LA_SERENA);
    expect(error).toBeNull();
    expect(idsDeSeed(data)).toEqual([...APROBADOS].sort());
  });

  it("no devuelve usuario_id ni geography", async () => {
    const { data, error } = await anon.rpc("reportes_en_zona", ZONA_LA_SERENA);
    expect(error).toBeNull();
    const fila = data?.[0] ?? {};
    expect(fila).not.toHaveProperty("usuario_id");
    expect(fila).not.toHaveProperty("ubicacion");
    expect(typeof fila.latitud).toBe("number");
  });

  it("filtra por estado", async () => {
    const { data, error } = await anon.rpc("reportes_en_zona", {
      ...ZONA_LA_SERENA,
      estados: ["resuelto"],
    });
    expect(error).toBeNull();
    expect(idsDeSeed(data)).toEqual([idSeed(4), idSeed(10)]);
  });

  it("filtra por categoría", async () => {
    const { data: categoria } = await anon
      .from("categorias")
      .select("id")
      .eq("tipo", "reporte")
      .eq("codigo", "bache")
      .single();
    const { data, error } = await anon.rpc("reportes_en_zona", {
      ...ZONA_LA_SERENA,
      categorias: [categoria?.id],
    });
    expect(error).toBeNull();
    expect(idsDeSeed(data)).toEqual([idSeed(1), idSeed(9)]);
  });

  it("no devuelve nada fuera de la zona", async () => {
    // Santiago
    const { data, error } = await anon.rpc("reportes_en_zona", {
      oeste: -70.8,
      sur: -33.6,
      este: -70.5,
      norte: -33.3,
    });
    expect(error).toBeNull();
    expect(idsDeSeed(data)).toEqual([]);
  });
});

// Cortes de luz (los carga scripts/cge_cortes.py con service_role). Estos
// tests no reemplazan los datos reales: solo prueban permisos y llamadas
// que fallan antes de cambiar nada (una transacción fallida no deja huella).
describe("tabla cortes_luz", () => {
  const corteValido = {
    nombre: "Corte de prueba de test:rls",
    descripcion: "No debe quedar guardado.",
    latitud: -29.905,
    longitud: -71.25,
  };

  it("anon la lee", async () => {
    const { error } = await anon
      .from("cortes_luz")
      .select(
        "id, nombre, descripcion, latitud, longitud, geometria, creado_en",
      )
      .limit(1);
    expect(error).toBeNull();
  });

  it("anon no puede insertar, editar ni borrar", async () => {
    const insercion = await anon.from("cortes_luz").insert(corteValido);
    const edicion = await anon
      .from("cortes_luz")
      .update({ nombre: "Cambio" })
      .gt("id", 0);
    const borrado = await anon.from("cortes_luz").delete().gt("id", 0);
    expect(insercion.error?.code).toBe(PERMISO_DENEGADO);
    expect(edicion.error?.code).toBe(PERMISO_DENEGADO);
    expect(borrado.error?.code).toBe(PERMISO_DENEGADO);
  });

  it("anon no puede ejecutar reemplazar_cortes_luz", async () => {
    const { error } = await anon.rpc("reemplazar_cortes_luz", {
      cortes: [corteValido],
    });
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("con service_role, una carga no válida falla entera", async () => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error(
        "Falta SUPABASE_SERVICE_ROLE_KEY en apps/web/.env.test.local.",
      );
    }
    const servicio = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const noEsArreglo = await servicio.rpc("reemplazar_cortes_luz", {
      cortes: { nombre: "x" },
    });
    expect(noEsArreglo.error?.code).toBe("22023");

    // Un corte fuera de la región viola el CHECK: el DELETE previo se
    // deshace junto con todo lo demás.
    const fueraDeLaRegion = await servicio.rpc("reemplazar_cortes_luz", {
      cortes: [corteValido, { ...corteValido, latitud: -33.45 }],
    });
    expect(fueraDeLaRegion.error?.code).toBe("23514");

    // Geometría con un tipo no permitido o que PostGIS no puede leer: falla
    // la carga entera, aunque el resto de los cortes sea válido.
    const poligono = {
      type: "Polygon",
      coordinates: [
        [
          [-71.26, -29.91],
          [-71.24, -29.91],
          [-71.24, -29.89],
          [-71.26, -29.91],
        ],
      ],
    };
    const tipoNoPermitido = await servicio.rpc("reemplazar_cortes_luz", {
      cortes: [
        { ...corteValido, geometria: poligono },
        {
          ...corteValido,
          geometria: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        },
      ],
    });
    expect(tipoNoPermitido.error?.code).toBe("23514");

    const malFormada = await servicio.rpc("reemplazar_cortes_luz", {
      cortes: [
        { ...corteValido, geometria: poligono },
        { ...corteValido, geometria: { type: "Polygon", coordinates: "x" } },
      ],
    });
    expect(malFormada.error).not.toBeNull();

    const { data } = await servicio
      .from("cortes_luz")
      .select("id")
      .eq("nombre", corteValido.nombre);
    expect(data).toEqual([]);
  });
});
