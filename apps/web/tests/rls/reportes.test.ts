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
